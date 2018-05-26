let Promise = require('bluebird');
let path = require('path');
let fs = Promise.promisifyAll(require('fs'));
let randomstring = require("randomstring");

async function compile(code, language) {
	let srcFile = path.join(config.tmp_dir, language.getFilename(`tmp_${randomstring.generate()}`));
	await fs.writeFileAsync(srcFile, code);
	let res = await language.compile(srcFile);
	if (res.output && res.output.length > 10 * 1024) {
		res.output = res.output.substr(0, 10 * 1024) + '...';
	}
	await fs.unlinkAsync(srcFile);
	return res;
}

module.exports = compile;