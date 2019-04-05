var _ = require('lodash');
var mlog = require('mocha-logger');
var spawn = require('child_process').spawn;

module.exports = {
	/**
	* Simple wrapper around Spawn which makes it a little less painful to use
	* All STDOUT, STDERR feeds are echo'd to the console
	* Non-zero exit codes resolve with a fail
	* @param {array <string>} Arguments that should be passed to a node wrapped script
	* @returns {Promise} A promise which will return with the text output of the command
	*/
	runner: args => new Promise((resolve, reject) => {
		var ps = spawn('node', args);
		var output = '';
		ps.stdout.on('data', msg => {
			msg = msg.toString();
			mlog.log(msg.toString().replace(/\n$/, ''));
			output += msg;
		});
		ps.stderr.on('data', msg => mlog.log(msg.toString().replace(/\n$/, '')));
		ps.on('exit', code => {
			if (code == 0) { resolve() } else { reject(`Unknown exit code: ${code}`) }
		});
	}),
};
