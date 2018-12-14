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

	it('should launch the process', done => {
		var ps = spawn('node', ['../cli/app.js', '-vvv', '--action=../apps/passthru', `--input=${inputFile}`, `--output=${outputFile}`], {stdio: 'inherit'})
		ps.on('exit', code => {
			expect(code).to.be.equal(0);
			done();
		});
	});

	it('should have created a valid output', done => {
		reflib.parseFile(outputFile, (err, outputRefs) => {
			expect(inputRefs).to.deep.equal(outputRefs);
			done();
		});
	});

});
