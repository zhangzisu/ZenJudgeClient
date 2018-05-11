'use strict';

async function judge(pid, judge_id, data_info, user_info) {
    console.log('Task attended.');
    await require(`./judgers/${data_info.config.judge_method}/index`)(pid, judge_id, data_info, user_info);
    console.log('Task finished.');
}

module.exports = judge;