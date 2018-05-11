let Promise = require('bluebird');
let fs = Promise.promisifyAll(require('fs'));
let path = require('path');
let randomstring = require("randomstring");
let child_process = require('child_process');
let shellEscape = require('shell-escape');

let [compileSpecialJudge, runSpecialJudge] = require('./spj');
let [sb, runTestcase, run] = require('./runner');
let [compile] = require('./compile');
let getLanguageModel = require('./language');

global.randomPrefix = randomstring.generate();

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

function shorterReadString(buffer, maxLen) {
	let s = buffer.toString();
	if (s.length > maxLen) return s.substr(0, maxLen) + '...';
	else return s;
}

async function judgeTestcase(data_info, user_info, language, execFile, extraFiles, testcase) {
	let runResult = await runTestcase(data_info, user_info, language, execFile, extraFiles, testcase);

	let result = {
		status: '',
		time_used: parseInt(runResult.result.time_usage / 1000),
		memory_used: runResult.result.memory_usage,
		input: shorterRead(testcase.input, 120),
		user_out: '',
		answer: shorterRead(testcase.output, 120),
		score: 0
	};

	let outputFile = runResult.getOutputFile();
	if (outputFile) {
		result.user_out = shorterRead(outputFile, 120);
	}

	let stderrFile = runResult.getStderrFile();
	if (stderrFile) {
		result.user_err = shorterRead(stderrFile, 1024);
	}

	if (result.time_used > data_info.config.time_limit) {
		result.status = 'Time Limit Exceeded';
	} else if (result.memory_used > data_info.config.memory_limit * 1024) {
		result.status = 'Memory Limit Exceeded';
	} else if (runResult.result.status !== 'Exited Normally') {
		result.status = runResult.result.status;
	} else if (!outputFile) {
		result.status = 'File Error';
	} else {
		// AC or WA
		let spjResult = await runSpecialJudge(data_info, user_info, testcase.input, outputFile, testcase.output);
		if (spjResult === null) {
			// No Special Judge
			console.log(`diff ${testcase.output} ${outputFile}`);
			if (diff(testcase.output, outputFile)) {
				result.status = 'Accepted';
				result.score = 100;
			} else {
				result.status = 'Wrong Answer';
			}
		} else {
			result.score = spjResult.score;
			if (!spjResult.success) result.status = 'Judgement Failed';
			else if (spjResult.score === 100) result.status = 'Accepted';
			else if (spjResult.score === 0) result.status = 'Wrong Answer';
			else result.status = 'Partially Correct';
			result.spj_message = shorterReadString(spjResult.message, config.spj_message_limit);
		}
	}

	return result;
}

module.exports = async function judge(pid, judge_id, data_info, user_info) {
	let result = {
		status: '',
		score: 0,
		total_time: 0,
		max_memory: 0,
		case_num: 0,
		compiler_output: ''
	};
	async function callback(result) {
		socket.emit('update', {
			judge_id: judge_id,
			result: result
		});
	}
	result.status = 'Compiling';
	result.pending = true;
	await callback(result);

	// Compile the source code
	let language = getLanguageModel(user_info.language);
	let compileResult = await compile(user_info.code, language);
	result.compiler_output = compileResult.output;

	if (!compileResult.success) {
		result.status = 'Compile Error';
		result.pending = false;
		return await callback(result);
	}

	let dataconf = data_info.config;
	if (!dataconf || !dataconf.testcases.length) {
		result.status = 'No Testdata';
		result.pending = false;
		return await callback(result);
	}

	const data_dir = path.join('data', data_info.hash);

	for (var subtask of dataconf.testcases) {
		for (var testcase of subtask.cases) {
			testcase.input = path.join(data_dir, testcase.input);
			testcase.output = path.join(data_dir, testcase.output);
		}
	}

	let spjCompileResult = await compileSpecialJudge(data_info, user_info);
	if (spjCompileResult && !spjCompileResult.success) {
		result.status = 'Judgement Failed';
		result.spj_compiler_output = spjCompileResult.output;
		result.pending = false;
		return await callback(result);
	}

	result.subtasks = [];
	for (let s = 0; s < dataconf.testcases.length; ++s) {
		result.subtasks[s] = {
			case_num: dataconf.testcases[s].cases.length,
			status: 'Waiting',
			pending: true
		};
	}

	let overallFinalStatus = null, overallScore = 0;
	result.score = 0;
	for (let s = 0; s < dataconf.testcases.length; ++s) {
		let subtask = dataconf.testcases[s];
		let subtaskResult = result.subtasks[s];
		let subtaskFinalStatus = null, subtaskScore = null;
		let caseNum = 0;
		let skipped = false;
		for (let testcase of subtask.cases) {
			overallScore -= subtaskScore;
			result.score = Math.min(100, Math.ceil(overallScore));

			if (skipped) {
				subtaskResult[caseNum++] = {
					status: 'Skipped',
					input: '',
					user_out: '',
					answer: '',
					score: 0
				};
				continue;
			}

			subtaskResult.status = `Running on #${caseNum + 1}`;
			if (dataconf.testcases.length === 1) {
				result.status = `Running on #${caseNum + 1}`;
			} else {
				result.status = `Running on #${s + 1}.${caseNum + 1}`;
			}
			subtaskResult.pending = true;
			await callback(result);

			let caseResult = await judgeTestcase(data_info, user_info, language, compileResult.execFile, compileResult.extraFiles, testcase);

			switch (subtask.type) {
				case 'min':
					caseResult.score = caseResult.score * (subtask.score / 100);
					subtaskScore = Math.min((subtaskScore == null) ? subtask.score : subtaskScore, caseResult.score);
					break;
				case 'mul':
					subtaskScore = ((subtaskScore == null) ? subtask.score : subtaskScore) * (caseResult.score / 100);
					caseResult.score = caseResult.score * (subtask.score / 100);
					break;
				case 'sum': default:
					subtask.type = 'sum';
					caseResult.score = caseResult.score / subtask.cases.length * (subtask.score / 100);
					subtaskScore = (subtaskScore || 0) + caseResult.score;
					break;
			}

			overallScore += subtaskScore;
			result.score = Math.min(100, Math.ceil(overallScore));
			result.max_memory = Math.max(result.max_memory, caseResult.memory_used);
			result.total_time += caseResult.time_used;
			subtaskResult[caseNum++] = caseResult;
			if (!subtaskFinalStatus && caseResult.status !== 'Accepted') {
				subtaskFinalStatus = caseResult.status;
				if (!caseResult.score && subtask.type !== 'sum') skipped = true;
			}
		}
		await callback(result);
		subtaskResult.score = subtaskScore;
		if (subtaskFinalStatus) subtaskResult.status = subtaskFinalStatus;
		else subtaskResult.status = 'Accepted';
		subtaskResult.pending = false;

		if (!overallFinalStatus && subtaskResult.status !== 'Accepted') {
			overallFinalStatus = subtaskResult.status;
		}
	}

	if (overallFinalStatus) result.status = overallFinalStatus;
	else result.status = 'Accepted';
	result.pending = false;

	await callback(result);
}