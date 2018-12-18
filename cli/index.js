var _ = require('lodash');
var crypto = require('crypto');
var fs = require('fs').promises;
var reflib = require('reflib');

function I3() {
	var i3 = this;

	i3.settings = {
		manifest: {
			files: ['package.json', 'i3.json'], // Files to search when looking for the manifest
		},
		settings: { // Default settings population
			input: {}, // Input settings - passed to reflib.parseFile()
			outputTransform: { // Reading back files from worker - passed to reflib.parseFile()
				fields: true, // Accept all fields back - when the driver supports it
			},
			output: { // Output settings - passed to reflib.outputFile()
				fields: true,
			},
			merge: { // Merge specific settings
				enabled: true,
				dupes: 'warn', // How to deal with duplicate references if merging
				fields: ['title'], // What fields to compare against when tracking a merge
				nonMatch: 'remove', // How to treat non-matching references. 'remove' = remove the incomming reference entirely, 'keep' = copy what we have into the output, 'keepDigest' = same as keep but only retain the fields listed in merge.fields
			},
		},
	};

	/**
	* Probe a file on disk and fetch its manifest
	* @param {string} path The path on disk to fetch the app from
	* @returns {Promise} A promise which will resolve with the found manifest contents or reject
	*/
	i3.stat = path =>
		Promise.all(i3.settings.manifest.files.map(file =>
			fs.readFile(`${path}/${file}`)
				.then(contents => ({path: `${path}/${file}`, contents}))
				.catch(e => Promise.resolve())
		))
			.then(files => files.find(f => f)) // Find first matching
			.then(file => ({path: file.path, ...JSON.parse(file.contents)}))


	/**
	* Validate a manifest file
	* @returns {Promise} Either a respolving promise if the manifest is valid or an array of errors passed to the catch
	*/
	i3.validate = manifestPath =>
		Promise.resolve()
			.then(()=> fs.readFile(manifestPath))
			.then(contents => JSON.parse(contents))
			.then(m => {
				var errs = [];

				if (!m) throw 'Not a JSON file';

				// Check for missing fields (dotted notation) {{{
				['name', 'version', 'description', 'license', 'inputs', 'outputs', 'worker', 'worker.container']
					.filter(field => !_.has(m, field))
					.map(field => `Field "${field}" is missing from manifest`)
					.forEach(text => err.push(text))
				// }}}

				// Check for empty input / output blocks {{{
				['inputs', 'outputs']
					.filter(field => !_.isObject(m[field]) || !_.isEmpty(m[field]))
					.map(field => `${field} must be a non-empty array or object`)
					.forEach(text => err.push(text))
				// }}}

				// Check inputs {{{
				(m.inputs ? _.castArray(m.inputs) : []).forEach((i, index) => {
					['type'].forEach(f => {
						if (!_.has(i, f)) err.push(`Input #${index} should have a '${f}' field`);
					})

					if (i.type == 'citations') {
						if (!_.has(i, 'filename')) err.push(`Input #${index} should specify a filename if the type is "citations"`);
						if (!_.has(i, 'format')) err.push(`Input #${index} should specify a citation library format`);
					} else if (i.type == 'other') {
						if (!_.has(i, 'accepts')) err.push(`Input #${index} should specify a glob or array of globs if the type is "other"`);
					}
				});
				// }}}

				// Check worker {{{
				if (['docker', 'url'].includes(m.worker.type)) throw 'worker.container can only be "docker" or "url" at this point';
				if (m.worker.type == 'docker' && !_.has(m, 'worker.container')) throw 'If worker.container == "docker", worker.container must be specified';
				if (m.worker.type == 'url' && !_.has(m, 'worker.url')) throw 'If worker.container == "url", worker.url must be specified';
				if (m.command && !_.isArray(m.command)) throw 'worker.command must be an array';
				if (m.command && m.command.every(i => _.isString(i))) throw 'worker.command must be an array of strings only';
				if (m.environment && !_.isPlainObject(m.environment)) throw 'worker.envionment must be an object';
				if (m.environment && _.every(m.environment, (v, k) => _.isString(v) && _.isString(k))) throw 'worker.envionment must be an object of string key / values only';
				// }}}

				// Check outputs {{{
				(m.outputs ? _.castArray(m.outputs) : []).forEach((i, index) => {
					['type'].forEach(f => {
						if (!_.has(i, f)) err.push({type: 'critical', text: `Output #${index} should have a '${f}' field`});
					})
				});
				// }}}

				if (errs.length) throw errs;
			})
			.catch(e => _.castArray(e))



	/**
	* Returns the SHA1 of an object reference
	* This is used as a utility function when stashing citations for later retrieval
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
	* Return a human readable citation - or as close as we can get with the information to hand
	* @param {Object} ref The reference to cite, following the RefLib standards
	* @param {Object} [options] Additional options to pass
	* @param {boolean} [options.html=false] Format the reference using HTML
	* @returns {string} The human readable reference
	*/
	i3.readableCitation = (ref, options) => {
		var settings = {
			html: false,
			...options,
		};

		var out = [];

		// NOTE: This is the Harvard citation style
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

	return i3;
};

module.exports = new I3();
