var _ = require('lodash');
var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var reflib = require('reflib');

var dedupePath = '/home/mc/Papers/Projects/Node/sra-dedupe'; // Needs to point to where sra-dedupe lives on disk
var inputFile = 'test/data/dupes.json';
var outputFile = '/tmp/output.json';

describe('Test dedupe App via CLI', function() {
	this.timeout(60 * 1000); // 60s

	var inputRefs;
	before('parse input references', done => {
		reflib.parseFile(inputFile, (err, refs) => {
			inputRefs = refs;
			done();
		});
	});

	it('should launch the process and mark references as duplicates', done => {
		var ps = spawn('node', [
			'../cli/i3',
			'-vvv',
			`--action=${dedupePath}`,
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--setting=action=mark',
			'--setting=markField=label',
		], {stdio: 'inherit'})
		ps.on('exit', code => {
			expect(code).to.be.equal(0);

			reflib.parseFile(outputFile, (err, outputRefs) => {
				expect(outputRefs).to.have.length(inputRefs.length);

				// Field we ignore when comparing
				var mangledFields = ['label', 'recNumber'];

				// Only the label field should have changed
				expect(inputRefs.map(ref => _.omit(ref, mangledFields))).to.deep.equal(outputRefs.map(ref => _.omit(ref, mangledFields)));

				done();
			});
		});
	});

});
