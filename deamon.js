let Promise = require('bluebird');
let child_process = Promise.promisifyAll(require('child_process'));

async function run() {
    let output = await child_process.execAsync('npm start');
    setTimeout(run, 10000);
}