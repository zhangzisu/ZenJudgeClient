let Promise = require('bluebird');
let path = require('path');
let child_process = Promise.promisifyAll(require('child_process'));
let fs = Promise.promisifyAll(require('fs'));
let [isFile] = require('../util');

module.exports = {
	process: 1,
	getFilename(file) {
		return file + '.c';
	},
	getRunInfo(execFile) {
		return {
			executable: execFile,
			parameters: []
		};
	},
	async compile(file) {
		let parsed = path.parse(file)
		let execFile = path.join(parsed.dir, parsed.name);

		if (await isFile(execFile)) {
			await fs.unlinkAsync(execFile);
		}

		let output;
		try {
			output = await child_process.execAsync(`gcc ${file} -o ${execFile} -O2 -lm -DONLINE_JUDGE -fdiagnostics-color=always 2>&1 || true`, {
				timeout: 10000
			});
		} catch (e) {
			output = 'Time limit exceeded while compiling';
		}

		return {
			success: await isFile(execFile),
			execFile: execFile,
			output: output
		};
	}
};
