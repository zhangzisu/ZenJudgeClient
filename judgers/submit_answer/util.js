let Promise = require('bluebird');
let fs = Promise.promisifyAll(require('fs'));

async function isFile(file) {
    try {
        let stat = await fs.statAsync(file);
        return stat.isFile();
    } catch (e) {
        return false;
    }
}

module.exports = [
    isFile
];