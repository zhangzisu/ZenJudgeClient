/*
 * File   : compile.js
 * Create : 2018-02-06
*/
let path = require('path');
let fs = require('fs');
let randomstring = require("randomstring");

async function compile(code, language) {
	let srcFile = path.join(config.tmp_dir, language.getFilename(`tmp_${randomPrefix}_${randomstring.generate()}`));
	await fs.writeFileAsync(srcFile, code);
	let res = await language.compile(srcFile);
	if (res.output && res.output.length > 10 * 1024) {
		res.output = res.output.substr(0, 10 * 1024) + '...';
	}
	return res;
}

module.exports = [
	compile
];
