#!/usr/bin/env node

var _ = require('lodash');
var debug = require('debug')('i3');
var colors = require('chalk');
var fspath = require('path');
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
	.option('-s, --setting [key=val]', 'Set an option for the worker', (v, total) => { total.push(v); return total }, [])
	.parse(process.argv);


Promise.resolve()
	// Validate settings {{{
	.then(()=> {
		if (!program.action) throw 'Action must be specified via "--action name"';
		if (!program.input.length) throw 'At least one input file must be specified via "--input path"';
		if (!program.output.length) throw 'At least one output file must be specified via "--input path"';
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
					return reflib.promises.parseFile(src) // FIXME: This is going to use a ton of memory - needs converting to a stream or something - MC 2018-12-14
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
	// Run the worker {{{
	// FIXME: We assume the docker image already exists - needs to be built if out of date
	.then(session => new Promise((resolve, reject) => {
		session.docker = {
			args: _([
				'run',
				session.manifest.worker.mount ? ['--volume', `${session.workspace.path}:${session.manifest.worker.mount}`] : '',
				session.manifest.worker.container,
			])
				.flatten()
				.filter() // Remove blanks
				.value(),
		};

		debug('Running session', session);

		var ps = spawn('docker', session.docker.args, {stdio: 'inherit'});

		ps.on('close', code => {
			if (code != 0) return reject(`Docker exited with non-zero exit code: ${code}`);
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
						.then(refs => reflib.promises.outputFile(dst, refs));
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
