let Promise = require('bluebird');
let fs = require('fs-extra');
let path = require('path');
let sandbox = require('simple-sandbox');
let randomstring = require('randomstring');
let [isFile] = require('./util');
let child_process = require('child_process');
let shellEscape = require('shell-escape');

async function prepareDir(path) {
    try {
        await fs.mkdir(path);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    await fs.emptyDir(path);
}

function shorterRead(fileName, maxLen) {
    let fd = fs.openSync(fileName, 'r');
    let len = fs.fstatSync(fd).size;
    if (len > maxLen) {
        let buf = Buffer.allocUnsafe(maxLen);
        fs.readSync(fd, buf, 0, maxLen, 0);
        let res = buf.toString() + '...';
        fs.closeSync(fd);
        return res;
    } else {
        fs.closeSync(fd);
        return fs.readFileSync(fileName).toString();
    }
}

function execute() {
    return child_process.execSync(shellEscape(Array.from(arguments)));
}

function diff(filename1, filename2) {
    try {
        execute('diff', '-Bb', filename1, filename2);
        return true;
    } catch (e) {
        return false;
    }
}

let statusMap = [
    'Unknown error',
    'OK',
    'Time Limit Exceeded',
    'Memory Limit Exceeded',
    'Runtime Error',
    'Cancelled',
    'Output Limit Exceeded'
];

module.exports = async function fun(user_out, stdout, datainfo) {

    let tmpdir = path.join(config.tmp_dir, randomstring.generate());
    await prepareDir(tmpdir);

    execute('cp', user_out, path.join(tmpdir, path.basename(user_out)));
    execute('cp', stdout, path.join(tmpdir, path.basename(stdout)));

    let runResult = {};

    runResult.time = 0;
    runResult.memory = 0;

    runResult.status = diff(stdout, user_out) ? 'Accepted' : 'Wrong Answer';

    if (await isFile(out)) {
        runResult.output = shorterRead(out, 128)
    }
    if (await isFile(err)) {
        runResult.stderr = shorterRead(err, 128);
    }
    await fs.remove(tmpdir);
    return runResult;
}