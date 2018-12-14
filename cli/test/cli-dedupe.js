var expect = require('chai').expect;
var spawn = require('child_process').spawn;

describe('Test dedupe App via CLI', ()=> {

	it('should launch the process', done => {
		var ps = spawn('../app.js', ['--action=dedupe', '--input=test/data/duped.json', '--output=/tmp/iee-test-deduped.csv'], {stdio: 'inherit'})
		ps.on('exit', code => {
			expect(code).to.be.equal.to(0);
			done();
		});
	})

});
