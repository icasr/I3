var _ = require('lodash');
var expect = require('chai').expect;
var exec = require('@momsfriendlydevco/exec');
var mlog = require('mocha-logger');
var reflib = require('reflib');

var inputFile = 'test/data/nodupes.json';
var outputFile = '/tmp/output.json';

describe('Filter CLI', function() {
	this.timeout(60 * 1000); // 60s

	var inputRefs;
	before('parse input references', done => {
		reflib.parseFile(inputFile, (err, refs) => {
			if (err) return done(err);
			inputRefs = refs;
			done();
		});
	});

	it('should launch the process and pass through data unedited', ()=>
		exec([
			`${__dirname}/../i3.js`,
			'-vv',
			'--debug',
			'--action=../apps/filter',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--setting=merge.enabled=false', // Since its just a copy we can avoid the overhead of merging
		], {log: mlog.log})
			.then(()=> reflib.parseFile(outputFile, (err, outputRefs) => {
				if (err) return Promise.reject(err);
				expect(inputRefs).to.deep.equal(outputRefs);
			}))
	);

	it('should launch the process and accept back filtered data', ()=>
		exec([
			`${__dirname}/../i3.js`,
			'-vv',
			'--action=../apps/filter',
			'--setting=fields=title,year',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
			'--setting=merge.enabled=false', // Since its just a copy we can avoid the overhead of merging
		], {log: mlog.log})
			.then(()=> reflib.parseFile(outputFile, (err, outputRefs) => {
				if (err) return Promise.reject(err);
				expect(outputRefs).to.have.length(inputRefs.length);
				expect(inputRefs
					.map(ref => Object.assign(
						_.pick(ref, ['title', 'year']),
						{type: 'report'}, // The fallback type for JSON data
					))
				).to.deep.equal(outputRefs);
			}))
	);

	it('should launch the process and merge back filtered data', ()=>
		exec([
			`${__dirname}/../i3.js`,
			'-vv',
			'--action=../apps/filter',
			'--setting=fields=title,year',
			`--input=${inputFile}`,
			`--output=${outputFile}`,
		], {log: mlog.log})
			.then(()=> reflib.parseFile(outputFile, (err, outputRefs) => {
				if (err) return Promise.reject(err);
				expect(inputRefs).to.deep.equal(outputRefs);
			}))
	);

});
