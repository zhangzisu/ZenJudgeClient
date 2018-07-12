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
		let parsed = path.parse(file);
		let execFile = path.join(parsed.dir, parsed.name + '.js');
		if (await isFile(execFile)) {
			await fs.unlinkAsync(execFile);
		}
		await fs.writeFileAsync(execFile, await fs.readFileAsync(file));
		return {
			success: await isFile(execFile),
			execFile: execFile,
			output: 'Javascript is the best language.'
		};
	}
};
