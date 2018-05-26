let Promise = require('bluebird');
let fs = Promise.promisifyAll(require('fs'));
let path = require('path');
let randomstring = require("randomstring");
let child_process = require('child_process');
let shellEscape = require('shell-escape');
let [isFile] = require('./util');
let compile = require('./compile');
let run = require('./run');

function execute() {
	return child_process.execSync(shellEscape(Array.from(arguments)));
}

async function verifyData(datainfo) {
	for (let subtask of datainfo.testcases) {
		for (let task of subtask.cases) {
			if (!await isFile(task.input)) return 0;
			if (!await isFile(task.output)) return 0;
		}
	}
	return 1;
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

async function judgeTestcase(language, spj_lang, execFile, extraFiles, spj_exec, spj_extra, testcase, datainfo) {
	let runResult = await run(
		execFile,
		extraFiles,
		spj_exec,
		spj_extra,
		testcase.input,
		testcase.output,
		language,
		spj_lang,
		datainfo
	);

	let result = {
		status: '',
		time_used: parseInt(runResult.time / 1000),
		memory_used: runResult.memory,
		input: shorterRead(testcase.input, 120),
		user_out: '',
		answer: shorterRead(testcase.output, 120),
		score: 0
	};

	if (runResult.output) {
		result.user_out = runResult.output;
	}

	if (runResult.stderr) {
		result.user_err = runResult.stderr;
	}

	if (runResult.spj_message) {
		result.spj_message = runResult.spj_message;
	}

	result.status = runResult.status;
	result.score = runResult.score;
	return result;
}

module.exports = async function judge(datainfo, code, lang, callback) {
	let result = {
		status: 'Waiting',
		score: 0,
		total_time: 0,
		max_memory: 0,
		case_num: 0,
		compiler_output: '',
		judger: config.client_name
	};
	result.pending = true;
	await callback(result);

	if (!await verifyData(datainfo)) {
		result.status = 'No Testdata';
		result.pending = false;
		await callback(result);
		return;
	}

	let spjlang = path.extname(datainfo.spj);
	let spjlanguage = require(`../languages/${lang}`);
	let spj_compare_result = await compile(fs.readFileSync(datainfo.spj).toString(), spjlanguage);
	if (!spj_compare_result.success) {
		result.status = 'Judgement Failed';
		result.pending = false;
		await callback(result);
		return;
	}

	let language = require(`../languages/${lang}`);
	let compile_result = await compile(code, language);
	result.compiler_output = compile_result.output;

	if (!compile_result.success) {
		result.status = 'Compile Error';
		result.pending = false;
		await callback(result);
		return;
	}

	result.subtasks = [];

	let overallFinalStatus = null;
	let tmpSubtaskResult = [];

	for (let s = 0; s < datainfo.testcases.length; ++s) {
		result.status = 'Running on #' + (s + 1);

		let subtask = datainfo.testcases[s];
		let depend = subtask.depend || null;
		let subtaskResult = {
			status: 'Waiting',
			pending: true
		};

		let subtaskFinalStatus = null;
		let caseNum = 0;
		let totalScore = subtask.score;
		let realScore = 0;
		switch (subtask.type) {
			case 'sum': realScore = 0;
				break;
			case 'min': realScore = 100;
				break;
			case 'mul': realScore = 1;
				break;
		}

		if (depend) {
			let deps = result.subtask[deps].status;
			if (deps !== 'Accepted') {
				subtaskResult.score = 0;
				subtaskResult.status = 'Skipped';
				subtaskResult.pending = false;
			}
		} else {
			for (let testcase of subtask.cases) {
				let caseResult = await judgeTestcase(language, spjlanguage, compile_result.execFile, compile_result.extraFiles, spj_compare_result.execFile, spj_compare_result.extraFiles, testcase, datainfo);

				switch (subtask.type) {
					case 'min':
						realScore = Math.min(realScore, caseResult.score);
						break;
					case 'mul':
						realScore = realScore * (caseResult.score / 100);
						break;
					case 'sum':
						realScore += caseResult.score;
						break;
				}
				result.max_memory = Math.max(result.max_memory, caseResult.memory_used);
				result.total_time += caseResult.time_used;
				subtaskResult[caseNum++] = caseResult;
				if (!subtaskFinalStatus && caseResult.status !== 'Accepted')
					subtaskFinalStatus = caseResult.status;
				if (subtask.type !== 'sum' && (caseResult.score < 1))
					break;
			}
		}
		subtaskResult.case_num = caseNum;
		let cvtScore = 0;
		switch (subtask.type) {
			case 'sum':
				cvtScore = Math.min(Math.ceil((realScore / subtask.cases.length) / 100 * totalScore), totalScore);
				break;
			case 'min':
				cvtScore = Math.min(Math.ceil(realScore / 100 * totalScore), totalScore);;
				break;
			case 'mul':
				cvtScore = Math.min(Math.ceil(realScore * totalScore), totalScore);
				break;
		}
		subtaskResult.score = cvtScore;

		if (subtaskFinalStatus) subtaskResult.status = subtaskFinalStatus;
		else subtaskResult.status = 'Accepted';
		subtaskResult.pending = false;
		if (!overallFinalStatus && subtaskResult.status !== 'Accepted') {
			overallFinalStatus = subtaskResult.status;
		}
		tmpSubtaskResult.push(subtaskResult);
		result.score += subtaskResult.score;
		await callback(result);
	}

	if (overallFinalStatus) result.status = overallFinalStatus;
	else result.status = 'Accepted';
	result.subtasks = tmpSubtaskResult;
	result.pending = false;

	await callback(result);
}