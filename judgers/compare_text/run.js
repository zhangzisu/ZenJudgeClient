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

module.exports = async function fun(execFile, extraFiles, stdin, stdout, language, datainfo) {
    let tmpdir = path.join(config.tmp_dir, randomstring.generate());
    await prepareDir(tmpdir);

    let binarydir_rl = path.join(tmpdir, 'bin');
    let workdir_rl = path.join(tmpdir, 'work');
    let binarydir = '/sandbox/binary';
    let workdir = '/sandbox/working';

    await prepareDir(binarydir_rl);
    await prepareDir(workdir_rl);

    for (let file in extraFiles) {
        execute('cp', file.src, path.join(workdir_rl, file.fileName));
    }

    let execFileRl = path.join(binarydir_rl, path.basename(execFile));
    let execFileSb = path.join(binarydir, path.basename(execFile));
    execute('cp', execFile, execFileRl);
    let stdinRl = path.join(workdir_rl, path.basename(stdin));
    let stdinSb = path.join(workdir, path.basename(stdin));
    execute('cp', stdin, stdinRl);

    let out = path.join(workdir_rl, 'out');
    let err = path.join(workdir_rl, 'err');
    const runInfo = language.getRunInfo(execFileSb);
    let sandboxConfig = {
        executable: runInfo.executable,
        parameters: runInfo.parameters,
        time: datainfo.time_limit,
        memory: datainfo.memory_limit * 1024 * 1024,
        process: language.process,
        stackSize: datainfo.memory_limit * 1024 * 1024,
        stdin: stdinSb,
        stdout: path.join(workdir, 'out'),
        stderr: path.join(workdir, 'err'),
        workingDirectory: workdir,
        chroot: config.sandbox.chroot,
        mountProc: config.sandbox.mountProc,
        redirectBeforeChroot: config.sandbox.redirectBeforeChroot,
        user: config.sandbox.user,
        cgroup: config.sandbox.cgroup,
        mounts: [
            {
                src: binarydir_rl,
                dst: binarydir,
                limit: 0
            },
            {
                src: workdir_rl,
                dst: workdir,
                limit: -1
            }
        ]
    };
    const prog = await sandbox.startSandbox(sandboxConfig);
    let result = await prog.waitForStop();
    console.log(JSON.stringify(result));
    let runResult = {};
    runResult.time = Math.ceil(result.time / 1000);
    runResult.memory = Math.ceil(result.memory / 1024);
    if (result.status !== 1) {
        runResult.status = statusMap[result.status];
    } else {
        runResult.status = diff(stdout, out) ? 'Accepted' : 'Wrong Answer';
    }
    if (await isFile(out)) {
        runResult.output = shorterRead(out, 128)
    }
    if (await isFile(err)) {
        runResult.stderr = shorterRead(err, 128);
    }
    await fs.remove(tmpdir);
    return runResult;
}