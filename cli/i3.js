#!/usr/bin/env node

var _ = require('lodash');
var colors = require('chalk');
var commander = require('commander');
var fs = require('fs').promises;
var fspath = require('path');
var i3 = new require('.')();
var micromatch = require('micromatch');
var promisify = require('util').promisify;
var reflib = require('reflib');
var spawn = require('child_process').spawn;
var temp = require('temp');


/**
* Storage for the original input references as a WeakMap
* Each key is the result of a reference being run though i3.hashObject(_.pick(cite, i3.settings.merge.fields)), each key is the full reference
* @var {Map}
*/
var inputRefs = new Map(); // Parsed input references if `i3.settings.merge.enabled`

Promise.resolve({}) // Setup waterfall session (gets populated at each successive stage with more data)
	// Read in original command line {{{
	.then(session => {
		var cli = commander
			.version(require('./package.json').version)
			.usage('-a <action> -i <input-file> -o <output-file> [profile...]')
			.description('CLI to easily automate systematic review tools')
			.option('-i, --input <file>', 'Input file, use multiple times for more file inputs', (v, total) => { total.push(v); return total }, [])
			.option('-o, --output <file>', 'Output file, use multiple times for more file outputs', (v, total) => { total.push(v); return total }, [])
			.option('-a, --action <name>', 'The action to perform. Can be a URL or a short name to an already retreieved I3 worker')
			.option('-v, --verbose', 'Be verbose - use multiple to increase verbosity', (v, total) => total + 1, 0)
			.option('-s, --setting <key=val>', 'Set an option for the worker (dotted notation accepted)', (v, total) => {
				var bits = [key, val] = v.split(/\s*=\s*/, 2);
				if (bits.length == 1) { // Assume we are just setting a flag to true
					_.set(total, key, true);
				}  else if (bits.length == 2) { // Assume key=val
					_.set(total, key, // Set the key, accepting various shorthand boolean values
						val === 'true' ? true
						: val === 'false' ? false
						: val
					);
				} else {
					throw `Failed to parse setting "${v}"`;
				}
				return total
			}, {})
			.option('--build <never|always|lazy>', 'Specify when to build the docker container, lazy (the default) compares the last modified time stamp', 'lazy')
			.option('--debug', 'Show more detailed errors')
			.option('--debug-settings', 'List current configuration')
			.option('--debug-profile-settings', 'List current configuration (only profile values, no defaults)')
			.parse(process.argv);

		return _.set(session, 'cli', cli);
	})
	// }}}
	// Load profiles {{{
	.then(session => i3.loadConfig(session.cli.args, false).then(profileSettings => _.set(session, 'profileSettings', profileSettings)))
	.then(session => {
		if (session.cli.debugProfileSettings) i3.log(0, 'Settings (from profile):', session.profileSettings);
		_.merge(i3.settings, session.profileSettings); // Apply settings
		return session;
	})
	// }}}
	// Map settings to I3 {{{
	.then(session => {
		[
			{cliKey: 'action', i3Key: 'action'},
			{cliKey: 'build', i3Key: 'docker.strategy'},
			{cliKey: 'debug', i3Key: 'debug'},
			{cliKey: 'input', i3Key: 'input'},
			{cliKey: 'output', i3Key: 'output'},
			{cliKey: 'verbose', i3Key: 'verbose'},
		].forEach(s => {
			if (!_.has(session.cli, s.cliKey) || _.isEmpty(_.get(session.cli, s.cliKey))) return;
			_.set(i3.settings, s.i3Key, _.get(session.cli, s.cliKey));
		})
		return session;
	})
	.then(session => {
		i3.settings.input = _.castArray(i3.settings.input);
		i3.settings.output = _.castArray(i3.settings.output);
		i3.settings.verbose = parseInt(i3.settings.verbose);
		if (session.cli.debugSettings) i3.log(0, 'Settings (final):', i3.settings)
		return session;
	})
	// }}}
	// Validate settings {{{
	.then(session => {
		if (!i3.settings.action) throw new Error('Action must be specified via "--action name" or in a profile');
		if (!i3.settings.input || !i3.settings.input.length) throw new Error('At least one input file must be specified via "--input path" or in a profile');
		if (!i3.settings.output || !i3.settings.output.length) throw new Error('At least one output file must be specified via "--output path" or in a profile');
		return session;
	})
	// }}}
	// Fetch the action - URL, Git, path {{{
	.then(session => {
		if (/^https?:\/\//.test(i3.settings.action)) {
			throw new Error('Fetching apps from URLs is not yet supported');
		} else if (/^git\+/.test(i3.settings.action)) {
			throw new Error('Fetching apps from Git URLs is not yet supported');
		} else {
			i3.log(1, `Retrieving manifest from "${i3.settings.action}"`);
			return i3.manifest.get(i3.settings.action)
				.catch(e => { throw `Cannot find I3 compatible app at "${i3.settings.action}"` })
				.then(manifest => {
					_.set(session, 'manifest', manifest);
					_.set(session, 'worker', {path: fspath.resolve(i3.settings.action)});
					return session;
				});
		}
	})
	// }}}
	// Validate that the manifest {{{
	.then(session => {
		i3.log(1, `Validating manifest "${session.manifest.path}"`);
		return i3.manifest.validate(session.manifest.path).then(()=> session);
	})
	// }}}
	// Calculate settings object {{{
	.then(session => {
		// Examine each manifest setting and inherit defaults
		_(_.get(session, 'manifest.settings') || {})
			.pickBy((v, k) => _.has(v, 'default'))
			.forEach((v, k) => _.set(i3.settings, k, v.default));

		// Override everything with user supplied settings via the CLI
		_.merge(i3.settings, session.cli.setting);

		return session;
	})
	// }}}
	// Validate final settings object {{{
	.then(session => {
		if (!['remove', 'keep', 'keepDigest'].includes(i3.settings.merge.nonMatch)) throw new Error('The setting "merge.nonMatch" can only be one of: remove, keep, keepDigest');
		return session;
	})
	// }}}
	// Compute inputs / outputs {{{
	.then(session => {
		var inputs = _.castArray(session.manifest.inputs);
		session.input = inputs.find((i, index) => {
			var matches = false;
			switch (i.type) {
				case 'citations':
					matches = (
						reflib.supported.find(rl => rl.id == i.format) // Find first supported Reflib format
						&& i3.settings.input.length == (_.isString(i.filename) ? 1 : i.filename.length)
					);
					break;
				case 'other':
					matches = micromatch.every(i3.settings.input, i.accepts);
					break;
				case 'manual':
					matches = true;
					break;
			}
			i3.log(2, `Checking input method #${index + 1} / ${inputs.length}, ${matches ? 'accepted' : 'failed'}`);
			return matches;
		});
		if (!session.input) throw new Error('No valid worker input methods found');

		var outputs = _.castArray(session.manifest.outputs);
		session.output = outputs.find((i, index) => {
			var matches = false;
			switch (i.type) {
				case 'citations':
					matches = (
						reflib.supported.find(rl => rl.id == i.format) // Find first supported Reflib format
						&& i3.settings.output.length == (_.isString(i.filename) ? 1 : i.filename.length)
					);
					break;
				case 'other':
					matches = micromatch.every(i3.settings.output[0], i.accepts);
					break;
			}
			i3.log(2, `Checking output method #${index + 1} / ${outputs.length}, ${matches ? 'accepted' : 'failed'}`);
			return matches;
		});
		if (!session.output) throw new Error('No valid worker output methods found');

		return session;
	})
	// }}}
	// Create workspace {{{
	.then(session =>
		promisify(temp.mkdir)({prefix: 'i3-'})
			.then(path => _.set(session, 'workspace', {path}))
	)
	.then(session => {
		i3.log(1, `Using work directory "${session.workspace.path}"`);
		return session;
	})
	// }}}
	// Convert input files + copy into workspace {{{
	.then(session =>
		Promise.all(_.castArray(session.input.filename).map((file, fileIndex) => {
			var src = i3.settings.input[fileIndex];
			var dst = `${session.workspace.path}/${file}`;
			switch (session.input.type) {
				case 'citations':
					i3.log(1, `Converting input citation library "${src}" -> "${dst}"`);
					return reflib.promises.parseFile(src, i3.settings.input) // FIXME: This is going to use a ton of memory - needs converting to a stream or something - MC 2018-12-14
						.then(refs => {
							if (i3.settings.merge.enabled) { // We will merge later - hold the parsed refs in memory
								refs.forEach(ref => {
									var refHash = i3.hashObject(_.pick(ref, i3.settings.merge.fields));
									if (i3.settings.merge.dupes == 'warn' && inputRefs.has(refHash)) {
										i3.log(0, 'Duplicate citation warning:', i3.readableCitation(ref));
									} else if (i3.settings.merge.dupes == 'stop' && inputRefs.has(refHash)) {
										i3.log(0, 'Input contains duplicates. Deduplicate before contunining');
										i3.log(0, 'Stopped on citation:', i3.readableCitation(ref));
										throw new Error('Duplicates');
									}
									inputRefs.set(refHash, ref);
								});
							}
							return refs;
						})
						.then(refs => reflib.promises.outputFile(dst, refs));
					break;
				case 'other':
					i3.log(1, `Copying input file "${src}" -> "${dst}"`);
					return new Promise((resolve, reject) => {
						fs.createReadStream(src)
							.pipe(fs.createWriteStream(dst))
							.on('close', ()=> resolve())
							.on('error', err => reject(err))
					});
			}
		})).then(()=> session)
	)
	// }}}
	// Build the worker if needed {{{
	.then(session => i3.docker.needsBuild(session.worker.path).then(needed => _.set(session, 'needsBuild', needed))
	.then(session => {
		if (!session.needsBuild) {
			i3.log(2, `Skipping Docker build of container "${session.manifest.worker.container}"`);
			return session; // Doesn't need building - pass session on and skip
		} else {
			return i3.docker.build(path, session.manifest).then(()=> session);
		}
	}))
	// }}}
	// Compute the Docker workspace {{{
	.then(session => {
		// Compute the Docker arguments / environment objects {{{
		var templateArgs = {
			manifest: session.manifest,
			settings: i3.settings,
		};

		var entryArgs = (session.manifest.worker.command || [])
			.map(arg => _.template(arg)(templateArgs))
			.filter(i => i) // Remove empty

		var entryEnv = _(session.manifest.worker.environment || {})
			.mapValues(v => _.template(v)(templateArgs))
			.pickBy(v => v) // Remove empty
			.map((v, k) => `--env=${k}=${v}`)
			.value();
		// }}}

		session.docker = {
			args: _([
				// Docker sub-command
				'run',

				// Docker options including mounts
				session.manifest.worker.mount ? ['--volume', `${session.workspace.path}:${session.manifest.worker.mount}`] : '',

				// Environment variables
				entryEnv.length ? entryEnv : false,

				// Main container name
				session.manifest.worker.container,

				// Command line arguments for an optional entry point
				entryArgs.length ? entryArgs : false,
			])
				.flattenDeep()
				.filter() // Remove blanks
				.value(),
		};
		return session;
	})
	// }}}
	// Run the worker {{{
	.then(session => new Promise((resolve, reject) => {
		i3.log(3, 'Running session', session);

		i3.log(2, 'Running Docker as:', ['docker'].concat(session.docker.args).join(' '));

		var ps = spawn('docker', session.docker.args, {stdio: 'inherit'});

		ps.on('close', code => {
			if (code != 0) return reject(`Docker-run exited with non-zero exit code: ${code}`);
			resolve(session);
		});
	}))
	// }}}
	// Convert output files back to destinations {{{
	.then(session =>
		Promise.all(_.castArray(session.output.filename).map((file, fileIndex) => {
			var src = `${session.workspace.path}/${file}`;
			var dst = i3.settings.output[fileIndex];
			switch (session.output.type) {
				case 'citations':
					i3.log(1, `Converting output citation library "${src}" -> "${dst}"`);

					return reflib.promises.parseFile(src, i3.settings.outputTransform) // FIXME: This is going to use a ton of memory - needs converting to a stream or something - MC 2018-12-14
						.then(refs => { // Attempt to merge?
							if (i3.settings.merge.enabled) { // Perform merge
								return refs.reduce((output, ref) => {
									var matchingRef = inputRefs.get(i3.hashObject(_.pick(ref, i3.settings.merge.fields)));
									if (matchingRef) {
										output.push(_.merge(matchingRef, ref));
									} else if (i3.settings.merge.nonMatch == 'remove') { // Non-matching reference - filter it out
										i3.log(2, 'Cannot find reference in output - removing:', _.pick(ref, i3.settings.merge.fields));
										// Do nothing
									} else if (i3.settings.merge.nonMatch == 'keep') {
										output.push(ref);
									} else if (i3.settings.merge.nonMatch == 'keepDigest') {
										output.push(_.pick(ref, i3.settings.merge.fields));
									}
									return output;
								}, []);
							} else {
								return refs;
							}
						})
						.then(refs => reflib.promises.outputFile(dst, refs, i3.settings.output));
					break;
				case 'other':
					i3.log(1, `Copying output file "${src}" -> "${dst}"`);
					return new Promise((resolve, reject) => {
						fs.createReadStream(src)
							.pipe(fs.createWriteStream(dst))
							.on('close', ()=> resolve())
							.on('error', err => reject(err))
					});
			}
		})).then(()=> session)
	)
	// }}}
	// End {{{
	.then(()=> process.exit(0))
	.catch(err => {
		i3.log(colors.red('ERROR'), i3.settings.debug ? err.stack : err.toString());
		process.exit(1);
	})
	// }}}
