let Promise = require('bluebird');
let path = require('path');
let child_process = Promise.promisifyAll(require('child_process'));
let fs = Promise.promisifyAll(require('fs'));

async function isFile(file) {
	try {
		let stat = await fs.statAsync(file);
		return stat.isFile();
	} catch (e) {
		return false;
	}
}

module.exports = {
	process: 5,
	getRunInfo(execFile) {
		return {
			executable: '/usr/bin/node',
			parameters: ['/usr/bin/node', execFile]
		};
	},
	getFilename(file) {
		return file + '.js';
	},
	async compile(file) {
		return {
			success: await isFile(file),
			execFile: file,
			output: output
		};
	}
};
