#!/usr/bin/env node

var _ = require('lodash');
var debug = require('debug')('i3');
var colors = require('chalk');
var fs = require('fs').promises;
var fspath = require('path');
var glob = require('glob');
var i3 = require('.');
var micromatch = require('micromatch');
var program = require('commander');
var promisify = require('util').promisify;
var reflib = require('reflib');
var spawn = require('child_process').spawn;
var temp = require('temp');

program
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
	.option('--debug-own-settings', 'List current configuration (only profile values, no defaults)')
	.parse(process.argv);


/**
* Storage for the original input references as a WeakMap
* Each key is the result of a reference being run though i3.hashObject(_.pick(cite, session.settings.merge.fields)), each key is the full reference
* @var {Map}
*/
var inputRefs = new Map(); // Parsed input references if `session.settings.merge.enabled`

Promise.resolve()
	// Load profiles {{{
	.then(()=> i3.loadConfig(program.args, false))
	.then(settings => {
		if (program.debugOwnSettings) i3.log('Settings (no defaults):', settings);
		Object.assign(i3.settings, settings); // Apply settings
		if (program.debugSettings) i3.log('Settings:', i3.settings);
	})
	// }}}
	// Validate settings {{{
	.then(()=> {
		if (!program.action) throw new Error('Action must be specified via "--action name"');
		if (!program.input || !program.input.length) throw new Error('At least one input file must be specified via "--input path"');
		if (!program.output || !program.output.length) throw new Error('At least one output file must be specified via "--input path"');
		return {};
	})
	// }}}
	// Fetch the action - URL, Git, path {{{
	.then(session => {
		if (/^https?:\/\//.test(program.action)) {
			throw new Error('Fetching apps from URLs is not yet supported');
		} else if (/^git\+/.test(program.action)) {
			throw new Error('Fetching apps from Git URLs is not yet supported');
		} else {
			if (program.verbose) i3.log(`Examining directory "${program.action}"`);
			return i3.stat(program.action)
				.catch(e => { throw `Cannot find I3 compatible app at "${program.action}"` })
				.then(manifest => ({
					manifest,
					worker: {
						path: fspath.resolve(program.action),
					},
				}))
		}
	})
	// }}}
	// Validate that the manifest {{{
	.then(async (session) => {
		if (program.verbose) i3.log(`Validating manifest "${session.manifest.path}"`);
		await i3.validate(session.manifest.path);
		return session;
	})
	// }}}
	// Calculate settings object {{{
	.then(session => {
		// Start with the I3 defaults
		session.settings = _.cloneDeep(i3.settings.settings);

		// Examine each manifest setting and inherit defaults
		_(_.get(session, 'manifest.settings') || {})
			.pickBy((v, k) => _.has(v, 'default'))
			.forEach((v, k) => _.set(session.settings, k, v.default));

		// Override everything with user supplied settings via the CLI
		_.merge(session.settings, program.setting);

		return session;
	})
	// }}}
	// Validate final settings object {{{
	.then(session => {
		if (!['remove', 'keep', 'keepDigest'].includes(session.settings.merge.nonMatch)) throw new Error('The setting "merge.nonMatch" can only be one of: remove, keep, keepDigest');
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
						&& program.input.length == (_.isString(i.filename) ? 1 : i.filename.length)
					);
					break;
				case 'other':
					matches = micromatch.every(program.input, i.accepts);
					break;
				case 'manual':
					matches = true;
					break;
			}
			if (program.verbose >= 2) i3.log(`Checking input method #${index + 1} / ${inputs.length}, ${matches ? 'accepted' : 'failed'}`);
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
						&& program.output.length == (_.isString(i.filename) ? 1 : i.filename.length)
					);
					break;
				case 'other':
					matches = micromatch.every(program.output[0], i.accepts);
					break;
			}
			if (program.verbose >= 2) i3.log(`Checking output method #${index + 1} / ${outputs.length}, ${matches ? 'accepted' : 'failed'}`);
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
		if (program.verbose) i3.log(`Using work directory "${session.workspace.path}"`);
		return session;
	})
	// }}}
	// Convert input files + copy into workspace {{{
	.then(session =>
		Promise.all(_.castArray(session.input.filename).map((file, fileIndex) => {
			var src = program.input[fileIndex];
			var dst = `${session.workspace.path}/${file}`;
			switch (session.input.type) {
				case 'citations':
					if (program.verbose) i3.log(`Converting input citation library "${src}" -> "${dst}"`);
					return reflib.promises.parseFile(src, session.settings.input) // FIXME: This is going to use a ton of memory - needs converting to a stream or something - MC 2018-12-14
						.then(refs => {
							if (session.settings.merge.enabled) { // We will merge later - hold the parsed refs in memory
								refs.forEach(ref => {
									var refHash = i3.hashObject(_.pick(ref, session.settings.merge.fields));
									if (session.settings.merge.dupes == 'warn' && inputRefs.has(refHash)) {
										i3.log('Duplicate citation warning:', i3.readableCitation(ref));
									} else if (session.settings.merge.dupes == 'stop' && inputRefs.has(refHash)) {
										i3.log('Input contains duplicates. Deduplicate before contunining');
										i3.log('Stopped on citation:', i3.readableCitation(ref));
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
					if (program.verbose) i3.log(`Copying input file "${src}" -> "${dst}"`);
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
	// Decide whether to build the worker (build=='lazy') {{{
	.then(session => {
		if (program.build != 'lazy') return session;

		return Promise.all([
			// Find last compiled file stamp
			fs.readFile(fspath.join(session.worker.path, '.i3-docker-build'), 'utf-8')
				.then(contents => JSON.parse(contents))
				.then(res => {
					res.lastModified = new Date(res.lastModified);
					return res;
				})
				.catch(e => Promise.resolve(false)),

			// Find latest modified file stamp
			new Promise((resolve, reject) => {
				var newestStamp;
				var statCache = {};

				glob('**/*', {stat: true, statCache, nobrace: true, cwd: session.worker.path})
					.on('match', file => {
						var stats = statCache[fspath.join(session.worker.path, file)];
						if (!newestStamp || stats.mtime > newestStamp) newestStamp = stats.mtime;
					})
					.on('end', ()=> resolve(newestStamp))
			}),
		])
			.then(res => {
				var [lastBuild, latestModified] = res;

				if (!lastBuild) {
					debug('Need to build Docker container. No cached latest file information found');
					program.build = true;
				} else if (latestModified > lastBuild.lastModified) {
					debug('Need to rebuild Docker container. Lastest file is', latestModified, 'which is newer than last build date of', lastBuild.lastModified);
					program.build = true;
				} else {
					debug('Skip build of Docker container. Latest file is', latestModified, 'which is older than last build date of', lastBuild.lastModified);
					program.build = false;
				}

				if (program.build === true) { // Would build - stash the timestamp
					return fs.writeFile(fspath.join(session.worker.path, '.i3-docker-build'), JSON.stringify({
						lastModified: latestModified,
						buildAt: new Date(),
					}));
				}
			})
			.then(()=> session)
	})
	// }}}
	// Build the worker {{{
	.then(session => new Promise((resolve, reject) => {
		if (!program.build || program.build == 'never') {
			if (program.verbose >= 2) i3.log(`Skipping Docker build of container "${session.manifest.worker.container}"`);
			return resolve(session);
		}

		process.chdir(session.worker.path);

		if (program.verbose) i3.log(`Building Docker container "${session.manifest.worker.container}"`);
		var ps = spawn('docker', ['build', `--tag=${session.manifest.worker.container}`, '.'], {stdio: 'inherit'});
		ps.on('close', code => {
			if (code != 0) return reject(`Docker-build exited with non-zero exit code: ${code}`);
			resolve(session);
		});
	}))
	// }}}
	// Compute the Docker workspace {{{
	.then(session => {
		// Compute the Docker arguments / environment objects {{{
		var templateArgs = {
			manifest: session.manifest,
			settings: session.settings,
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
		debug('Running session', session);

		if (program.verbose >= 3) i3.log('Running Docker as:', ['docker'].concat(session.docker.args).join(' '));

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
			var dst = program.output[fileIndex];
			switch (session.output.type) {
				case 'citations':
					if (program.verbose) i3.log(`Converting output citation library "${src}" -> "${dst}"`);

					return reflib.promises.parseFile(src, session.settings.outputTransform) // FIXME: This is going to use a ton of memory - needs converting to a stream or something - MC 2018-12-14
						.then(refs => { // Attempt to merge?
							if (session.settings.merge.enabled) { // Perform merge
								return refs.reduce((output, ref) => {
									var matchingRef = inputRefs.get(i3.hashObject(_.pick(ref, session.settings.merge.fields)));
									if (matchingRef) {
										output.push(_.merge(matchingRef, ref));
									} else if (session.settings.merge.nonMatch == 'remove') { // Non-matching reference - filter it out
										debug('Cannot find reference in output - removing:', _.pick(ref, session.settings.merge.fields));
										// Do nothing
									} else if (session.settings.merge.nonMatch == 'keep') {
										output.push(ref);
									} else if (session.settings.merge.nonMatch == 'keepDigest') {
										output.push(_.pick(ref, session.settings.merge.fields));
									}
									return output;
								}, []);
							} else {
								return refs;
							}
						})
						.then(refs => reflib.promises.outputFile(dst, refs, session.settings.output));
					break;
				case 'other':
					if (program.verbose) i3.log(`Copying output file "${src}" -> "${dst}"`);
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
		i3.log(colors.red('ERROR'), program.debug ? err.stack : err.toString());
		process.exit(1);
	})
	// }}}
