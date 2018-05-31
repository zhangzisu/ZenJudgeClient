let Promise = require('bluebird');
let child_process = Promise.promisifyAll(require('child_process'));

async function run() {
    let output;
    console.log('Service started.');
    try {
        output = await child_process.execAsync('npm start');
    } catch (e) {
        output = e.toString();
    }
    console.log(output);
    setTimeout(run, 10000);
}

run();