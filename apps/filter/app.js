#!/usr/bin/env node

var _ = require('lodash');
var fs = require('fs').promises;
var micromatch = require('micromatch');
var program = require('commander');

program
	.version(require('./package.json').version)
	.option('-i, --input <file>', 'Provide an input file (JSON)')
	.option('-o, --output <file>', 'Provide an output file (JSON)')
	.option('-f, --fields <fields>', 'Limit output to only the fields specified as a CSV')
	.option('-g, --globs <expression>', 'Limit output to only those matching the given globs as a CSV')
	.option('--glob-fields <fields>', 'Limit globbing to a CSV of specified fields (defaults to title only)')
	.parse(process.argv);


Promise.resolve()
	// Sanity checks {{{
	.then(()=> {
		// Check for required fields
		if (!program.input) throw 'No input file given';
		if (!program.output) throw 'No output file given';

		// Set some properties defaults
		if (!program.globFields) program.globFields = 'title';

		// Split various fields from CSV -> Arrays
		['fields', 'globs', 'globFields'].forEach(field => {
			if (program[field]) program[field] = program[field].split(/\s*,\s*/);
		});
	})
	// }}}
	.then(()=> fs.readFile(program.input))
	.then(contents => JSON.parse(contents))
	.then(refs => {
		return program.globs && program.globs.length
			? refs.filter(ref =>
				micromatch.some(_(ref).pick(program.globFields).map(), program.globs)
			)
			: refs;
	})
	.then(refs => {
		return program.fields && program.fields.length
			? refs.map(ref => _.pick(ref, program.fields))
			: refs;
	})
	.then(refs => JSON.stringify(refs))
	.then(contents => fs.writeFile(program.output, contents))
	// End {{{
	.then(()=> process.exit(0))
	.catch(err => {
		console.log('ERR', err.toString());
		process.exit(1);
	})
	// }}}
