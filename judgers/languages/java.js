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
		let parsed = path.parse(execFile);

		return {
			executable: '/usr/bin/java',
			parameters: ['/usr/bin/java', path.join(parsed.dir, parsed.name)]
		};
	},
	getFilename(file) {
		return file + '.java';
	},
	async compile(file) {
		let parsed = path.parse(file)
		let execFile = path.join(parsed.dir, 'main.class');

		if (await isFile(execFile)) {
			await fs.unlinkAsync(execFile);
		}

		let output;

		try {
			output = await child_process.execAsync(`javac ${file} 2>&1 || true`, {
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
