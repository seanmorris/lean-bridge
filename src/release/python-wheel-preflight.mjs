#!/usr/bin/env node
/**
 * Evaluates whether a Python host can install one generated platform wheel.
 *
 * @file
 */

import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const minimumPythonVersion = "3.11";
const manylinuxPattern = /^(manylinux_(\d+)_(\d+)_(.+))$/;
const versionPattern = /^(\d+)\.(\d+)(?:\.(\d+))?/;
const usage = "Usage: python-wheel-preflight --wheel <archive.whl> [--python <command>] [--json]";

const fail = (code, message) => {
	const error = new Error(message);
	error.name = "PythonWheelCompatibilityError";
	error.code = code;
	throw error;
};

const versionParts = value => {
	const match = versionPattern.exec(value);
	return match === null ? null : match.slice(1).map(part => Number(part ?? 0));
};

const versionAtLeast = (observed, required) => {
	const left = versionParts(observed);
	const right = versionParts(required);
	if(left === null || right === null) return false;
	const length = Math.max(left.length, right.length);
	for(let index = 0; index < length; index += 1)
	{
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if(difference !== 0) return difference > 0;
	}
	return true;
};

const normalizedArchitecture = architecture => new Map([
	["amd64", "x86_64"]
	, ["x64", "x86_64"]
]).get(architecture) ?? architecture;

const parseWheel = path => {
	const filename = basename(path);
	if(!filename.endsWith(".whl")) fail("invalid-wheel-filename", `Python package is not a wheel: ${filename}`);
	const fields = filename.slice(0, -4).split("-");
	if(fields.length < 5) fail("invalid-wheel-filename", `Python wheel filename is incomplete: ${filename}`);
	const platformTag = fields.pop();
	const abiTag = fields.pop();
	const pythonTag = fields.pop();
	const platform = manylinuxPattern.exec(platformTag);
	if(platform === null)
	{
		fail("unsupported-wheel-platform", `Python wheel does not declare a manylinux glibc floor: ${platformTag}`);
	}
	return Object.freeze({
		filename
		, tag: `${pythonTag}-${abiTag}-${platformTag}`
		, pythonTag
		, abiTag
		, platformTag
		, architecture: platform[4]
		, minimumGlibcVersion: `${platform[2]}.${platform[3]}`
	});
};

/**
 * Evaluates the clean-room Python host against the exact wheel filename and pip tag set.
 *
 * @param root0 - Observed wheel and host properties.
 * @param root0.wheel - Path or filename of the wheel selected for installation.
 * @param root0.platform - Node platform name reported by the host.
 * @param root0.architecture - Node architecture name reported by the host.
 * @param root0.glibcVersion - GNU libc version reported by getconf.
 * @param root0.pythonVersion - Python runtime version selected for pip.
 * @param root0.pipTags - Compatible tags reported by pip for that Python runtime.
 * @returns {Readonly<object>} A closed compatibility report with one result per required check.
 */
export const evaluatePythonWheelCompatibility = ({
	wheel
	, platform
	, architecture
	, glibcVersion
	, pythonVersion
	, pipTags
}) => {
	const parsedWheel = parseWheel(wheel);
	const observedArchitecture = normalizedArchitecture(architecture);
	const pipTagAccepted = new Set(pipTags).has(parsedWheel.tag);
	const checks = Object.freeze([
		Object.freeze({ id: "platform", passed: platform === "linux", observed: platform, required: "linux" })
		, Object.freeze({
			id: "architecture"
			, passed: observedArchitecture === parsedWheel.architecture
			, observed: observedArchitecture
			, required: parsedWheel.architecture
		})
		, Object.freeze({
			id: "glibc"
			, passed: versionAtLeast(glibcVersion, parsedWheel.minimumGlibcVersion)
			, observed: glibcVersion
			, required: `>=${parsedWheel.minimumGlibcVersion}`
		})
		, Object.freeze({
			id: "python"
			, passed: versionAtLeast(pythonVersion, minimumPythonVersion)
			, observed: pythonVersion
			, required: `>=${minimumPythonVersion}`
		})
		, Object.freeze({
			id: "pip-wheel-tag"
			, passed: pipTagAccepted
			, observed: pipTagAccepted ? parsedWheel.tag : "absent"
			, required: parsedWheel.tag
		})
	]);
	return Object.freeze({
		schemaVersion: 1
		, compatible: checks.every(check => check.passed)
		, wheel: parsedWheel
		, host: Object.freeze({
			platform
			, architecture: observedArchitecture
			, glibcVersion
			, pythonVersion
		})
		, checks
	});
};

const parseOptions = argumentsList => {
	const options = { wheel: null, python: "python3", json: false, help: false };
	for(let index = 0; index < argumentsList.length; index += 1)
	{
		const argument = argumentsList[index];
		if(argument === "--json") options.json = true;
		else if(argument === "--help" || argument === "-h") options.help = true;
		else if(argument === "--wheel" || argument === "--python")
		{
			const value = argumentsList[index + 1];
			if(value === undefined || value.startsWith("--")) fail("invalid-python-preflight-option", `${argument} requires a value`);
			options[argument.slice(2)] = value;
			index += 1;
		} else fail("invalid-python-preflight-option", `unknown argument ${argument}`);
	}
	return options;
};

const capture = async (command, argumentsList) => {
	try
	{
		const result = await execute(command, argumentsList, { maxBuffer: 8 * 1024 * 1024 });
		return { code: 0, stdout: result.stdout, stderr: result.stderr };
	} catch(error)
	{
		return {
			code: Number.isInteger(error.code) ? error.code : 1
			, stdout: typeof error.stdout === "string" ? error.stdout : ""
			, stderr: typeof error.stderr === "string" ? error.stderr : String(error.message ?? error)
		};
	}
};

const firstVersion = value => /\d+\.\d+(?:\.\d+)?/.exec(value)?.[0] ?? "unavailable";
const compatibleTags = value => value
	.split("\n")
	.map(line => line.trim())
	.filter(line => /^[A-Za-z0-9_.]+-[A-Za-z0-9_.]+-[A-Za-z0-9_.]+$/.test(line));

const render = report => {
	const lines = [
		`Python wheel preflight: ${report.compatible ? "compatible" : "incompatible"}`
		, `wheel: ${report.wheel.filename}`
	];
	for(const check of report.checks)
	{
		lines.push(`${check.passed ? "PASS" : "FAIL"} ${check.id}: detected ${check.observed}; required ${check.required}`);
	}
	return `${lines.join("\n")}\n`;
};

/**
 * Runs the repository-free Python wheel compatibility command.
 *
 * @param argv - Command-line arguments excluding the Node executable and script path.
 * @returns {Promise<Readonly<object>|null>} The compatibility report, or null after printing help.
 */
export const runPythonWheelPreflightCli = async argv => {
	const options = parseOptions(argv);
	if(options.help)
	{
		process.stdout.write(`${usage}\n`);
		return null;
	}
	if(options.wheel === null) fail("missing-python-preflight-option", "--wheel is required");
	const wheel = await stat(options.wheel);
	if(!wheel.isFile()) fail("invalid-python-wheel", `wheel is not a regular file: ${options.wheel}`);
	const [glibc, python, pip] = await Promise.all([
		capture(options.python, ["-c", "import platform; print(platform.libc_ver()[1])"])
		, capture(options.python, ["--version"])
		, capture(options.python, ["-m", "pip", "debug", "--verbose"])
	]);
	const report = evaluatePythonWheelCompatibility({
		wheel: options.wheel
		, platform: process.platform
		, architecture: process.arch
		, glibcVersion: glibc.code === 0 ? firstVersion(glibc.stdout) : "unavailable"
		, pythonVersion: python.code === 0 ? firstVersion(`${python.stdout}\n${python.stderr}`) : "unavailable"
		, pipTags: pip.code === 0 ? compatibleTags(pip.stdout) : []
	});
	process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : render(report));
	return report;
};

if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
{
	try
	{
		const report = await runPythonWheelPreflightCli(process.argv.slice(2));
		process.exitCode = report === null || report.compatible ? 0 : 2;
	} catch(error)
	{
		process.stderr.write(`python-wheel-preflight: ${error.message}\n${usage}\n`);
		process.exitCode = 1;
	}
}
