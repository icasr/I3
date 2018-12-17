var _ = require('lodash');
var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var reflib = require('reflib');

var inputFile = 'test/data/dupes.json';
var outputFile = '/tmp/output.json';

describe('Test passthru App via CLI', function() {
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
			'--action=../apps/passthru',
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

	it('should launch the process and return a subset of fields', done => {
		var ps = spawn('node', [
			'../cli/app.js',
			'-vvv',
			'--action=../apps/passthru',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--setting=output.fields=title,year',
			'--no-merge',
		], {stdio: 'inherit'})
		ps.on('exit', code => {
			expect(code).to.be.equal(0);

			reflib.parseFile(outputFile, (err, outputRefs) => {
				expect(inputRefs.map(ref => _.pick(ref, ['title', 'year']))).to.deep.equal(outputRefs);
				done();
			});
		});
	});

});
