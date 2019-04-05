var _ = require('lodash');
var expect = require('chai').expect;
var spawn = require('child_process').spawn;
var reflib = require('reflib');
var testkit = require('./setup');

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

	it('should launch the process and pass through data unedited', ()=>
		testkit.runner([
			'../cli/i3',
			'-vv',
			'--action=../apps/passthru',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--setting=merge.enabled=false', // Since its just a copy we can avoid the overhead of merging
		])
			.then(()=> new Promise((resolve, reject) => {
				reflib.parseFile(outputFile, (err, outputRefs) => {
					if (err) return reject(err);
					expect(inputRefs).to.deep.equal(outputRefs);
					resolve();
				});
			}))
	);

	it('should launch the process and return a subset of fields', ()=>
		testkit.runner([
			'../cli/i3',
			'-vv',
			'--action=../apps/passthru',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--setting=output.fields=title,year',
			'--setting=merge.enabled=false', // Since its just a copy we can avoid the overhead of merging
		])
			.then(()=> new Promise((resolve, reject) => {
				reflib.parseFile(outputFile, (err, outputRefs) => {
					if (err) return reject(err);
					expect(inputRefs.map(ref => _.pick(ref, ['title', 'year']))).to.deep.equal(outputRefs);
					resolve();
				});
			}))
	);

});
