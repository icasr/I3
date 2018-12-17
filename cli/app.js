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
	.usage('-a <action> -i <input-file> -o <output-file>')
	.option('-i, --input <file>', 'Input file, use multiple times for more file inputs', (v, total) => { total.push(v); return total }, [])
	.option('-o, --output <file>', 'Output file, use multiple times for more file outputs', (v, total) => { total.push(v); return total }, [])
	.option('-a, --action <name>', 'The action to perform. Can be a URL or a short name to an already retreieved I3 worker')
	.option('-v, --verbose', 'Be verbose - use multiple to increase verbosity', (v, total) => total + 1, 0)
	.option('-s, --setting <key=val>', 'Set an option for the worker (dotted notation supported)', (v, total) => {
		var bits = v.split(/\s*=\s*/, 2);
		if (!bits.length == 2) throw `Failed to parse setting "${v}"`;
		_.set(total, bits[0], bits[1]);
		return total
	}, {
		input: {}, // Input settings - passed to reflib.parseFile()
		output: {}, // Output settings - passed to reflib.outputFile()
		merge: { // Merge specific settings
			fields: ['title'], // What fields to compare against when tracking a merge
			nonMatch: 'remove', // How to treat non-matching references. 'remove' = remove the incomming reference entirely, 'keep' = copy what we have into the output, 'keepDigest' = same as keep but only retain the fields listed in merge.fields
		}
	})
	.option('--build <never|always|lazy>', 'Specify when to build the docker container, lazy (the default) compares the last modified time stamp', 'lazy')
	.option('--no-merge', 'Skip trying to remerge the data back into the input set, use as is')
	.parse(process.argv);


/**
* Storage for the original input references as a WeakMap
* @var {WeakMap}
*/
var inputRefs = new WeakMap(); // Parsed input references if `program.merge`

Promise.resolve()
	// Validate settings {{{
	.then(()=> {
		if (!program.action) throw 'Action must be specified via "--action name"';
		if (!program.input.length) throw 'At least one input file must be specified via "--input path"';
		if (!program.output.length) throw 'At least one output file must be specified via "--input path"';
		if (!['remove', 'keep', 'keepDigest'].includes(program.setting.merge.nonMatch)) throw 'The setting "merge.nonMatch" can only be one of: remove, keep, keepDigest';
		return {};
	})
	// }}}
	// Fetch the action - URL, Git, path {{{
	.then(session => {
		if (/^https?:\/\//.test(program.action)) {
			throw 'Fetching apps from URLs is not yet supported';
		} else if (/^git\+/.test(program.action)) {
			throw 'Fetching apps from Git URLs is not yet supported';
		} else {
			if (program.verbose) console.log(`Examining directory "${program.action}"`);
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
		if (program.verbose) console.log(`Validating manifest "${session.manifest.path}"`);
		await i3.validate(session.manifest.path);
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
			if (program.verbose >= 2) console.log(`Checking input method #${index + 1} / ${inputs.length}, ${matches ? 'accepted' : 'failed'}`);
			return matches;
		});
		if (!session.input) throw 'No valid worker input methods found';

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
			if (program.verbose >= 2) console.log(`Checking output method #${index + 1} / ${outputs.length}, ${matches ? 'accepted' : 'failed'}`);
			return matches;
		});
		if (!session.output) throw 'No valid worker output methods found';

		return session;
	})
	// }}}
	// Create workspace {{{
	.then(session =>
		promisify(temp.mkdir)({prefix: 'i3-'})
			.then(path => _.set(session, 'workspace', {path}))
	)
	.then(session => {
		if (program.verbose) console.log(`Using work directory "${session.workspace.path}"`);
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
					if (program.verbose) console.log(`Converting input citation library "${src}" -> "${dst}"`);
					return reflib.promises.parseFile(src, program.setting.input) // FIXME: This is going to use a ton of memory - needs converting to a stream or something - MC 2018-12-14
						.then(refs => {
							if (program.merge) { // We will merge later - hold the parsed refs in memory
								refs.forEach(ref => {
									inputRefs.set(_.pick(ref, program.setting.merge.fields), ref);
								});
							}
							return refs;
						})
						.then(refs => reflib.promises.outputFile(dst, refs));
					break;
				case 'other':
					if (program.verbose) console.log(`Copying input file "${src}" -> "${dst}"`);
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
						if (!newestStamp || newestStamp.mtime  < stats.mtime) newestStamp = stats.mtime;
					})
					.on('end', ()=> resolve(newestStamp))
			}),
		])
			.then(res => {
				var [lastBuild, latestModified] = res;

				if (!lastBuild) {
					debug('Need to build Docker container. No cached latest file information found');
					program.build = true;
				} else if (lastBuild.lastModified <= latestModified) {
					debug('No need to build Docker container. Latest file is', latestModified, 'which is older than last build date of', lastBuild.lastModified);
					program.build = false;
				} else {
					debug('Need to rebuild Docker container. Lastest file is', latestModified, 'which is newer than last build date of', lastBuild.lastModified);
					program.build = true;
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
			if (program.verbose >= 2) console.log(`Skipping Docker build of container "${session.manifest.worker.container}"`);
			return resolve(session);
		}

		process.chdir(session.worker.path);

		if (program.verbose) console.log(`Building Docker container "${session.manifest.worker.container}"`);
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
			settings: {
				// Read defaults from settings structure
				..._(session.manifest.settings || {})
					.pickBy((v, k) => _.isObject(v) && _.has(v, 'default'))
					.mapValues(v => v.default)
					.value(),
				// Convert incomming settings to object
				...program.setting,
			},
		};

		var entryArgs = (session.manifest.worker.command || [])
			.map(arg => {
				var got = _.template(arg)(templateArgs)
				console.log(`WILL TEMPLATE "${arg}" => "${got}"`);
				return got;
			})
			.filter(i => i) // Remove empty

		var entryEnv = _(session.manifest.worker.environment || {})
			.mapValues(v => _.template(v)(templateArgs))
			.pickBy(v => v) // Remove empty
			.map((v, k) => `--env "${k}=${v}"`)
			.value();
		// }}}

		session.docker = {
			args: _([
				'run',
				session.manifest.worker.mount ? ['--volume', `${session.workspace.path}:${session.manifest.worker.mount}`] : '',
				session.manifest.worker.container,

				// Environment variables
				entryEnv.length ? entryEnv : false,

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

		if (program.verbose >= 3) console.log('Running Docker as:', ['docker'].concat(session.docker.args).join(' '));

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
					if (program.verbose) console.log(`Converting output citation library "${src}" -> "${dst}"`);

					return reflib.promises.parseFile(src) // FIXME: This is going to use a ton of memory - needs converting to a stream or something - MC 2018-12-14
						.then(refs => { // Attempt to merge?
							if (program.merge) { // Perform merge
								return refs.reduce((output, ref) => {
									var matchingRef = inputRefs.get(_.pick(ref, program.setting.merge.fields));
									if (matchingRef) {
										return output.push(_.merge(matchingRef, ref));
									} else if (program.setting.merge.nonMatch == 'remove') { // Non-matching reference - filter it out
										console.log('CANT FIND', ref);
										return output;
									} else if (program.setting.merge.nonMatch == 'keep') {
										return output.push(ref);
									} else if (program.setting.merge.nonMatch == 'keepDigest') {
										return output.push(_.pick(ref, program.setting.merge.fields));
									}
								}, []);
							} else {
								return refs;
							}
						})
						.then(refs => reflib.promises.outputFile(dst, refs, program.setting.output));
					break;
				case 'other':
					if (program.verbose) console.log(`Copying output file "${src}" -> "${dst}"`);
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
	.then(()=> {
		console.log(colors.cyan('FIXME'), 'All done');
		process.exit(0);
	})
	.catch(err => {
		console.log(colors.red('ERR'), err.toString());
		process.exit(1);
	})
	// }}}
