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
global.socket = sc.connect(config.zen_addr, { secure: true, reconnect: true, rejectUnauthorized: false });
global.server_status = "free";
global.task = null;

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
    let dir = path.join('data', task.datahash);
    if (await isdir(dir)) {
        await judge(
            task.pid,
            task.judge_id,
            { hash: task.datahash, config: task.config },
            { code: task.code, language: task.language }
        );
        server_status = 'free';
    } else {
        socket.emit('require_data', { pid: task.pid });
    }
});

const zipPath = "tmp.zip";
ss(socket).on('file', async function (stream, data) {
    if (await fsExistsAsync(zipPath)) await fs.unlinkAsync(zipPath);
    let dir = path.join('data', task.datahash);
    stream.pipe(fs.createWriteStream(zipPath)).on('finish', async function () {
        var Task = new Zip();
        var decompress = new Promise(function (resolve, reject) {
            Task.extractFull(zipPath, dir)
                .then(function () { resolve('Extracting done!'); })
                .catch(function (err) { console.error(err); process.exit(3); });
        });
        console.log(await decompress);
        if (await fsExistsAsync(zipPath)) await fs.unlinkAsync(zipPath);
        await judge(
            task.pid,
            task.judge_id,
            { hash: task.datahash, config: task.config },
            { code: task.code, language: task.language }
        );
        server_status = 'free';
    });
});

setInterval(function () {
    socket.emit(server_status, {});
}, config.reflush_timeout);