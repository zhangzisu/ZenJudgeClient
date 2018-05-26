let sandbox = require('simple-sandbox');

let sandboxConfig = {
    executable: "/sandbox/binary/tmp_NPz2WGewrd9HNYTkhvvwAviZ6bbwZoQV",
    parameters: [],
    time: 1000,
    memory: 268435456,
    process: 10,
    stackSize: -1,
    stdin: "/sandbox/working/1.in",
    stdout: "/sandbox/working/out",
    stderr: "/sandbox/working/err",
    workingDirectory: "/sandbox/working",
    chroot: "/opt/rootfs",
    mountProc: false,
    redirectBeforeChroot: false,
    user: "root",
    cgroup: "root",
    mounts: [
        {
            src: "/tmp/AFzblkBCXNWJyJbntpCgIcr4o0jG8ysO/bin",
            dst: "/sandbox/binary",
            limit: 0
        },
        {
            src: "/tmp/AFzblkBCXNWJyJbntpCgIcr4o0jG8ysO/work",
            dst: "/sandbox/working",
            limit: -1
        }
    ]
};

async function fun() {
    const prog = await sandbox.startSandbox(sandboxConfig);
    console.log("SB!!!");
    let result = await prog.waitForStop();
    console.log(JSON.stringify(result));
}
fun();