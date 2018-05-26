'use strict';

async function judge(datainfo, code, language, callback) {
    console.log('Task attended.');
    let judger = require(`./judgers/${datainfo.judge_method}/index`);
    await judger(datainfo, code, language, callback);
    console.log('Task finished.');
}

module.exports = judge;