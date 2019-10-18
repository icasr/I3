var _ = require('lodash');
var colors = require('chalk');
var crypto = require('crypto');
var fs = require('fs').promises;
var fspath = require('path');
var os = require('os');
var ini = require('ini');
var reflib = require('reflib');

var i3 = function I3() {
	var i3 = this;

	i3.settings = {
		debug: false,
		docker: {
			strategy: 'lazy',
			markerFile: '.i3-docker-build',
			prefixStdout: '[docker]',
			prefixStderr: colors.red('[docker]'),
		},
		input: [],
		logging: {
			prefix: '',
		},
		manifest: {
			files: ['package.json', 'i3.json'], // Files to search when looking for the manifest
		},
		merge: { // Merge specific settings
			enabled: true,
			dupes: 'warn', // How to deal with duplicate references if merging
			fields: ['title'], // What fields to compare against when tracking a merge
			nonMatch: 'remove', // How to treat non-matching references. 'remove' = remove the incomming reference entirely, 'keep' = copy what we have into the output, 'keepDigest' = same as keep but only retain the fields listed in merge.fields
		},
		output: [],
		outputTransform: { // Reading back files from worker - passed to reflib.parseFile()
			fields: true, // Accept all fields back - when the driver supports it
		},
		profiles: {
			paths: [ // Paths to check in desending order
				fspath.join(os.homedir(), '.i3'), // Global HOMEDIR config
				fspath.join(process.cwd(), '.i3'), // CWD config
			],
		},
		verbose: 0,
	};


	/**
	* Load config from config files
	* Profile information is loaded from the following in desending order with each sucessive section overriding options:
	* 	- Base defaults in i3.settings
	* 	- Global profile (~/.i3)
	* 		- `[global]` section
	* 		- profiles section(s)
	* 	- CWD profile (./.i3)
	* 		- `[global]` section
	* 		- profiles section(s)
	* @param {string|array} [profile='default'] Optional profile(s) to use
	* @param {boolean} [mergeBase=true] Merge with the initial settings of i3.settings, disable to resolve with only user specified option (manual merging of i3.settings is still required for them to take effect)
	* @returns {Promise} A promise which will resolve with i3.settings when loaded based on the current profile
	*/
	i3.loadConfig = (profiles = 'default', mergeBase = true) =>
		Promise.resolve()
			.then(()=> Promise.all( // Read each config file
				i3.settings.profiles.paths.map(path =>
					fs.readFile(path, 'utf-8')
						.then(contents => ini.decode(contents))
						.catch(e => ({}))
				)
			))
			.then(inis => inis
				.filter(f => !_.isEmpty(f))
				.reduce((settings, file) => {
					_.merge(settings, _.get(file, 'global')); // Merge global section
					_.castArray(profiles).forEach(profile => _.merge(settings, _.get(file, profile))); // Merge each given profile
					return settings;
				}, {})
			)
			.then(settings => mergeBase ? Object.assign(i3.settings, settings) : settings)


	/**
	* Returns the SHA1 of an object reference
	* This is used as a utility function when stashing references for later retrieval
	* @param {Object} obj The object to hash
	* @returns {string} The SHA1 hash of the object
	*/
	i3.hashObject = obj =>
		crypto.createHash('sha1').update(
			JSON.stringify(
				_(obj)
					.toPairs()
					.orderBy(0)
					.fromPairs()
					.value()
			)
		).digest('base64')


	/**
	* Return a human readable reference - or as close as we can get with the information to hand
	* @param {Object} ref The reference to cite, following the RefLib standards
	* @param {Object} [options] Additional options to pass
	* @param {boolean} [options.html=false] Format the reference using HTML
	* @returns {string} The human readable reference
	*/
	i3.readableReference = (ref, options) => {
		var settings = {
			html: false,
			...options,
		};

		var out = [];

		// NOTE: This is the Harvard reference style
		if (ref.recNumber) out.push(`#${ref.recNumber}`);
		if (ref.authors) out.push(_.isArray(ref.authors) ? ref.authors.join(', ') : ref.authors);
		if (ref.year) out.push(`(${ref.year})`);
		out.push([
			settings.html ? '<i>' : '',
			ref.title ? ref.title.trimEnd('.') + '.' : 'Untitled',
			settings.html ? '<i>' : '',
		].filter(i => i).join(''))

		if (ref.journal) out.push(ref.journal);
		if (ref.volume) out.push(`Vol ${ref.volume}`);
		if (ref.pages) out.push(`pp. ${ref.pages}`);

		return out.join(' ');
	};


	/**
	* Utility function to log to STDERR
	* This function automatically adds prefixes and verbosity options
	* @param {number} [level=0] Debugging verbosity level, the higher the number the rarer it is that users will see the output
	* @param {*} msg... Strings or objects to log
	*/
	i3.log = (...msg) => {
		if (msg.length && typeof msg[0] == 'number') { // Supplied a verbosity number
			var verbosity = msg.shift();
			if (i3.settings.verbose < verbosity) return; // Not in a verbose-enough mode to output
		}
		console.warn.apply(i3, i3.settings.logging.prefix ? [i3.settings.logging.prefix].concat(msg) : msg);
	};


	// Load late-bound helper libraries
	i3.docker = new require('./lib/docker')(i3);
	i3.manifest = new require('./lib/manifest')(i3);

	return i3;
};

module.exports = i3;
