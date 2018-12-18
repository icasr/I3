var _ = require('lodash');
var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var reflib = require('reflib');

var inputFile = 'test/data/dupes.json';
var outputFile = '/tmp/output.json';

describe('Test filter App via CLI', function() {
	this.timeout(60 * 1000); // 60s

	var inputRefs;
	before('parse input references', done => {
		reflib.parseFile(inputFile, (err, refs) => {
			inputRefs = refs;
			done();
		});
	});

	it('should launch the process and pass through data unedited', done => {
		var ps = spawn('node', [
			'../cli/app.js',
			'-vvv',
			'--action=../apps/filter',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--no-merge', // Since its just a copy we can avoid the overhead of merging
		], {stdio: 'inherit'})
		ps.on('exit', code => {
			expect(code).to.be.equal(0);

			reflib.parseFile(outputFile, (err, outputRefs) => {
				expect(inputRefs).to.deep.equal(outputRefs);
				done();
			});
		});
	});

	it('should launch the process and accept back filtered data', done => {
		var ps = spawn('node', [
			'../cli/app.js',
			'-vvv',
			'--action=../apps/filter',
			'--setting=fields=title,year',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--no-merge', // Disable merge purposely so we don't try to merge the input data back into the output data
		], {stdio: 'inherit'})
		ps.on('exit', code => {
			expect(code).to.be.equal(0);

			reflib.parseFile(outputFile, (err, outputRefs) => {
				expect(outputRefs).to.have.length(inputRefs.length);
				expect(inputRefs
					.map(ref => Object.assign(
						_.pick(ref, ['title', 'year']),
						{type: 'report'}, // The fallback type for JSON data
					))
				).to.deep.equal(outputRefs);
				done();
			});
		});
	});

	it.only('should launch the process and merge back filtered data', done => {
		var ps = spawn('node', [
			'../cli/app.js',
			'-vvv',
			'--action=../apps/filter',
			'--setting=fields=title,year',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
		], {stdio: 'inherit'})
		ps.on('exit', code => {
			expect(code).to.be.equal(0);

			reflib.parseFile(outputFile, (err, outputRefs) => {
				expect(inputRefs).to.deep.equal(outputRefs);
				done();
			});
		});
	});

});
