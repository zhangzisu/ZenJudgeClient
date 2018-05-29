'use strict';

let Promise = require('bluebird');
let fs = Promise.promisifyAll(require('fs'));
let Zip = require('node-7z');
let path = require('path');

async function fsExistsAsync(path) {
    try {
        await fs.accessAsync(path, fs.F_OK);
    } catch (e) {
        return false;
    }
    return true;
};

let ss = require('socket.io-stream');
let sc = require('socket.io-client');
global.config = require('./config.json');
let socket = sc.connect(config.zen_addr, { secure: true, reconnect: true, rejectUnauthorized: false });
let server_status = "free";
let task = null;

global.updateResult = (judge_id, result) => {
    socket.emit('update', {
        judge_id: judge_id,
        result: result
    });
};

socket.on('disconnect', function () {
    process.exit(1);
});

socket.on('terminate', function () {
    process.exit(1);
});

let judge = require('./judge');

socket.on('connect', function () {
    socket.emit('login', {
        token: config.token,
        id: config.client_id
    });
});

socket.on('task', async function (data) {
    server_status = 'busy';
    uploadStatus();
    task = data;
    async function isdir(path) {
        let stat;
        try {
            stat = await fs.statAsync(path);
            return stat.isDirectory();
        } catch (e) {
            return false;
        }
    }
    if (!await isdir('data')) await fs.mkdirAsync('data');
    let dir = path.join(__dirname, 'data', task.datahash);
    if (await isdir(dir)) {
        let callback_code = `updateResult(${task.judge_id}, result);`;
        await judge(
            parseData(dir, task.config),
            task.code,
            task.language,
            new Function('result', callback_code)
        );
        server_status = 'free';
    } else {
        updateResult(task.judge_id, {
            status: 'Testdata Downloading',
            score: 0,
            total_time: 0,
            max_memory: 0,
            case_num: 0,
            compiler_output: '',
            judger: config.client_name
        });
        socket.emit('require_data', { pid: task.pid });
    }
});

const zipPath = "tmp.zip";
ss(socket).on('file', async function (stream, data) {
    if (await fsExistsAsync(zipPath)) await fs.unlinkAsync(zipPath);
    let dir = path.join(__dirname, 'data', task.datahash);
    console.log('Downloading testdata...');
    stream.pipe(fs.createWriteStream(zipPath)).on('finish', async () => {
        var Task = new Zip();
        var decompress = new Promise(function (resolve, reject) {
            Task.extractFull(zipPath, dir)
                .then(function () { resolve('Extracting done!'); })
                .catch(function (err) { console.error(err); process.exit(3); });
        });
        console.log(await decompress);
        if (await fsExistsAsync(zipPath)) await fs.unlinkAsync(zipPath);
        let callback_code = `updateResult(${task.judge_id}, result);`;
        await judge(
            parseData(dir, task.config),
            task.code,
            task.language,
            new Function('result', callback_code)
        );
        server_status = 'free';
    }).on('error', () => {
        if (await fsExistsAsync(zipPath)) await fs.unlinkAsync(zipPath);
        updateResult(task.judge_id, {
            status: 'System Error',
            score: 0,
            total_time: 0,
            max_memory: 0,
            case_num: 0,
            compiler_output: '',
            judger: config.client_name
        });
        server_status = 'free';
    });
});

function uploadStatus() {
    socket.emit(server_status, {});
}

function parseData(datadir, dataconf) {
    for (let testcase of dataconf.testcases) {
        for (let sth of testcase.cases) {
            sth.input = path.join(datadir, sth.input);
            sth.output = path.join(datadir, sth.output);
        }
    }
    if (dataconf.spj) dataconf.spj = path.join(datadir, dataconf.spj);
    return dataconf;
}

setInterval(uploadStatus, config.reflush_timeout);

process.on('uncaughtException', function (err) {
    console.error(err);
    process.exit(1);
});