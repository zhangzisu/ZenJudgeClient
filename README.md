# Zen Judge Client V2
2nd gen judge client for Zen Online Judge

## Setup
  - Execute `git clone https://github.com/ZhangZisu/ZenJudgeClient.git` first.
  - You should install some package to make `simple-sandbox` run correctly.
    - For Radhat Linux, CentOS and fedora, use `yum install -y gcc gcc-c++ make cmake boostup-devel`
    - For debian users, use `apt install build-essential libboost-all-dev`
  - `cd` into the project, and run `npm install`
  - Execute `cp config.example.json config.json`
  - Edit `config.json` to configure judge client
  - `node index.js` to start.

## More

Please read [wiki](https://github.com/ZhangZisu/ZenJudgeClient/wiki) for more information.