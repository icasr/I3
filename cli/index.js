var _ = require('lodash');
var fs = require('fs').promises;
var reflib = require('reflib');

function I3() {
	var i3 = this;

	i3.settings = {
		manifest: {
			files: ['package.json', 'i3.json'], // Files to search when looking for the manifest
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


	return i3;
};

module.exports = new I3();
