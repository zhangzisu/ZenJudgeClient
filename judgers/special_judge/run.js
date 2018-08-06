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
    'Unknown Error',
    'OK',
    'Time Limit Exceeded',
    'Memory Limit Exceeded',
    'Runtime Error',
    'Cancelled',
    'Output Limit Exceeded'
];

module.exports = async function fun(
    execFile,
    extraFiles,
    spjExecFile,
    spjExtraFiles,
    stdin,
    stdout,
    language,
    spjLanguage,
    datainfo) {
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
    let stdinRl = path.join(binarydir_rl, 'input');
    let stdinSb = path.join(binarydir, 'input');
    execute('cp', stdin, stdinRl);

    let out = path.join(workdir_rl, 'userout');
    let err = path.join(workdir_rl, 'usererr');
    const runInfo = language.getRunInfo(execFileSb);
    let sandboxConfig = {
        executable: runInfo.executable,
        parameters: runInfo.parameters,
        time: datainfo.time_limit,
        memory: datainfo.memory_limit * 1024 * 1024,
        process: language.process,
        stackSize: datainfo.memory_limit * 1024 * 1024,
        stdin: stdinSb,
        stdout: path.join(workdir, 'userout'),
        stderr: path.join(workdir, 'usererr'),
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
    let prog = await sandbox.startSandbox(sandboxConfig);
    let result = await prog.waitForStop();
    console.log(JSON.stringify(result));
    let runResult = {};
    runResult.time = Math.ceil(result.time / 1000);
    runResult.memory = Math.ceil(result.memory / 1024);
    if (result.status !== 1) {
        runResult.status = statusMap[result.status];
    } else {
        runResult.status = 'Accepted';
    }
    if (await isFile(out)) {
        runResult.output = shorterRead(out, 128)
    }
    if (await isFile(err)) {
        runResult.stderr = shorterRead(err, 128);
    }
    if (runResult.status === 'Accepted') {
        let spjRl = path.join(binarydir_rl, path.basename(spjExecFile));
        let spjSb = path.join(binarydir, path.basename(spjExecFile));

        execute('cp', spjExecFile, spjRl);
        for (let file in spjExtraFiles) {
            execute('cp', file.src, path.join(workdir_rl, file.fileName));
        }
        execute('cp', stdout, path.join(workdir_rl, 'answer'));
        const spjRunInfo = spjLanguage.getRunInfo(spjSb);
        sandboxConfig.executable = spjRunInfo.executable;
        sandboxConfig.parameters = spjRunInfo.parameters;
        let scoreFileSb = path.join(workdir, 'score');
        let scoreFileRl = path.join(workdir_rl, 'score');
        let extraInfoSb = path.join(workdir, 'message');
        let extraInfoRl = path.join(workdir_rl, 'message');
        delete sandboxConfig.stdin;
        sandboxConfig.stdout = scoreFileSb;
        sandboxConfig.stderr = extraInfoSb;
        prog = await sandbox.startSandbox(sandboxConfig);
        let result = await prog.waitForStop();
        console.log(JSON.stringify(result));
        if (result.status === 1 && await isFile(scoreFileRl)) {
            let scoreStr = fs.readFileSync(scoreFileRl).toString();
            runResult.score = parseInt(scoreStr) || 0;
            console.log(`SPJ Return score: ${scoreStr}`);
            if (runResult.score === 0) {
                runResult.status = 'Wrong Answer';
            } else if (runResult.score !== 100) {
                runResult.status = 'Partially Correct';
            }
            if (await isFile(extraInfoRl)) {
                let spjMessage = fs.readFileSync(extraInfoRl).toString();
                runResult.spj_message = spjMessage;
            }
        } else {
            // console.log(sandboxConfig);
            runResult.score = 0;
            runResult.status = 'Judgement Failed';
        }
    } else runResult.score = 0;
    await fs.remove(tmpdir);
    return runResult;
}