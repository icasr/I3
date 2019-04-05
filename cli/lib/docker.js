/**
* I3 docker library / singleton
*/
var fs = require('fs').promises;
var fspath = require('path');
var glob = require('globby');

var i3Docker = function i3Docker(i3) {
	var docker = this;

	/**
	* Determine if the docker image needs building
	* NOTE: This function uses i3.settings.docker.strategy and will always return true / false if those values are 'always', 'never' respectively
	*/
	docker.needsBuild = path => {
		if (i3.settings.docker.strategy == 'always') return Promise.resolve(true);
		if (i3.settings.docker.strategy == 'never') return Promise.resolve(false);

		return Promise.all([
			// Find last compiled file stamp
			fs.readFile(fspath.join(path, i3.settings.docker.markerFile), 'utf-8')
				.then(contents => JSON.parse(contents))
				.then(res => {
					res.lastModified = new Date(res.lastModified);
					return res;
				})
				.catch(e => Promise.resolve(false)),

			// Find latest modified file stamp
			glob('**/*', {stats: true, nobrace: true, cwd: path})
				.then(files => files.reduce((newestStamp, file) =>
					!newestStamp || file.mtime > newestStamp
						? file.mtime
						: newestStamp
				, 0)),
		])
			.then(res => {
				var [lastBuild, latestModified] = res;
				var needsBuild;

				if (!lastBuild) {
					i3.log(2, 'Need to build Docker container. No cached latest file information found');
					needsBuild = true;
				} else if (latestModified > lastBuild.lastModified) {
					i3.log(2, 'Need to rebuild Docker container. Lastest file is', latestModified, 'which is newer than last build date of', lastBuild.lastModified);
					needsBuild = true;
				} else {
					i3.log(2, 'Skip build of Docker container. Latest file is', latestModified, 'which is older than last build date of', lastBuild.lastModified);
					needsBuild = false;
				}

				if (needsBuild) { // Would build - stash the timestamp
					return fs.writeFile(fspath.join(path, '.i3-docker-build'), JSON.stringify({
						lastModified: latestModified,
						buildAt: new Date(),
					})).then(()=> needsBuild);
				} else {
					return needsBuild;
				}
			});
	};


	/**
	* Build a worker path
	* NOTE: Generally a call to needsBuild() is preferred first to skip this potencially costly stage
	* @param {string} path The path to the worker directory
	* @param {Object} [manifest] Optional manifest to use, if omitted `i3.manifest.get(path)` is used instead
	* @return {Promise} A promise which will resolve when the build process completes
	*/
	docker.build = (path, manifest) =>
		Promise.resolve()
			.then(()=> process.chdir(path))
			.then(()=> manifest ? manifest : i3.manifest.get(path))
			.then(manifest => {
				if (i3.settings.verbose) i3.log(`Building Docker container "${manifest.worker.container}"`);
				var ps = spawn('docker', ['build', `--tag=${manifest.worker.container}`, '.'], {stdio: 'inherit'});
				ps.on('close', code => {
					if (code != 0) return reject(`Docker-build exited with non-zero exit code: ${code}`);
					resolve();
				});
			});



	return docker;
};

module.exports = i3Docker;
