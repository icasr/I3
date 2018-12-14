var expect = require('chai').expect;
var fs = require('fs');
var spawn = require('child_process').spawn;
var temp = require('temp').track();

describe('Test data passthru', function() {
	this.timeout(60 * 1000); // 60s

	var path; // Temporary directory we are writing to
	before('should setup a test directory', done => {
		temp.mkdir({prefix: 'crebp-passthru-'}, (err, res) => {
			if (err) return done(err);
			path = res;

			fs.createReadStream(`${__dirname}/data/citations.json`)
				.pipe(fs.createWriteStream(`${path}/input.json`))
				.on('close', ()=> done())
		});
	});

	it('should build the docker image', done => {
		var ps = spawn('docker', ['build', '--tag', 'crebp/passthru', '.'], {stdio: 'inherit'});

		ps.on('close', code => {
			expect(code).to.be.equal(0);
			done();
		});
	});

	it('should pass though simple data', done => {
		var ps = spawn('docker', ['run', '--volume', `${path}:/app`, 'crebp/passthru'], {stdio: 'inherit'});

		ps.on('close', code => {
			expect(code).to.be.equal(0);
			done();
		});
	});

	it('should have written the input as the output file', ()=> {
		var original = fs.readFileSync(`${__dirname}/data/citations.json`);
		var copy = fs.readFileSync(`${path}/output.json`);

		expect(JSON.parse(copy)).to.deep.equal(JSON.parse(original));
	});

});
