/**
 * Enforce one complete hosted dependent checked-record Python route from its retained
 * original records. This checker never treats a partial TAP stream as success.
 *
 * @file
 */
import assert from "node:assert/strict";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import {
	dependentCheckedRecordPythonCallerArgs, dependentCheckedRecordPythonMinors
	, dependentCheckedRecordPythonRoutes, dependentCheckedRecordPythonSelection
	, parseDependentCheckedRecordPythonResult
} from "./dependent-checked-record-python-fixture.mjs";

/**
 * Name the one installed route that a hosted TAP stream must cover.
 *
 * @param route - One closed ordinary/reviewed and full/result-only route.
 */
export const dependentCheckedRecordPythonCiTestName = route => {
	assert.ok(dependentCheckedRecordPythonRoutes.includes(route));
	return `installed dependent checked-record Python packages reproduce and relocate for ${route}`;
};

/**
 * Parse and close all hosted checker command-line arguments.
 *
 * @param args - Arguments after the checker script path.
 */
export const parseDependentCheckedRecordPythonCiArgs = args => {
	const usage = "Usage: check-dependent-checked-record-python-ci.mjs --route <closed-route> --producer <commit> --directory <records> --tap <original-tap> --glibc 2.38";
	const allowed = ["route", "producer", "directory", "tap", "glibc"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length && !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	dependentCheckedRecordPythonCiTestName(selected.route);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.match(selected.glibc, /^2\.[0-9]+$/u);
	return selected;
};

/**
 * Require the exact zero-skip Node TAP stream for one installed route.
 *
 * @param source - Original combined Node producer output.
 * @param route - Required route.
 */
export const assertDependentCheckedRecordPythonCiTap = (source, route) => {
	const name = dependentCheckedRecordPythonCiTestName(route);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]])
		, [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
};

/**
 * Recheck every retained route record independently of producer control flow.
 *
 * @param read - Relative original-record reader.
 * @param options - Closed producer, route and host scope.
 * @param options.route - Exact author/API route.
 * @param options.producerCommit - Full producer revision.
 * @param options.runtime - Current checker host facts.
 * @param options.floor - Explicit wheel glibc floor.
 */
export const checkDependentCheckedRecordPythonReport = async (
	read, { route, producerCommit, runtime, floor }
) => {
	assert.ok(dependentCheckedRecordPythonRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.deepEqual([runtime.platform, runtime.arch], ["linux", "x64"]);
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
		return value;
	};
	const selection = dependentCheckedRecordPythonSelection(route);
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged", "builds", "expectedBindingIrSha256"
		, "glibcMinimumVersion", "independentBuilds", "interpreters", "minors"
		, "producerCommit", "reports", "reproducible", "route", "runtime"
		, "schemaVersion", "sourceRemovedBeforeInstallation"
		, "wheelReceiptSha256"
	]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit); assert.deepEqual(report.runtime, runtime);
	assert.equal(report.glibcMinimumVersion, floor);
	assert.deepEqual(report.minors, dependentCheckedRecordPythonMinors);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(selection.expected));
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"])
		assert.equal(report[key], true, key);
	assert.equal(report.independentBuilds, 2); assert.equal(report.builds.length, 2);
	const modelHashes = [];
	for(const [index, build] of report.builds.entries())
	{
		assert.deepEqual(Object.keys(build).sort(), ["archives", "bindingIrSha256", "modelSha256", "receiptSha256"]);
		const modelBytes = await read(`build-${index}/model.json`), model = JSON.parse(modelBytes);
		assert.equal(model.bindingIrSha256, build.bindingIrSha256);
		assert.equal(sha256(modelBytes), build.modelSha256);
		assert.equal(reviewedContractDifference(selection.expected, model.bindingIr), null);
		if(selection.reviewed)
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(selection.expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		modelHashes.push(build.modelSha256);
	}
	assert.equal(new Set(modelHashes).size, 1, "Independent builds retain one model");
	const wheel = await json("wheel.json");
	assert.equal(wheel.receiptSha256, report.wheelReceiptSha256);
	assert.match(wheel.archive.sha256, /^[a-f0-9]{64}$/u);
	assert.ok(wheel.retained.includes("lean_dependentrecords/__init__.py"));
	assert.deepEqual(report.interpreters.map(value => value.minor), dependentCheckedRecordPythonMinors);
	assert.deepEqual(report.reports.map(value => value.minor), dependentCheckedRecordPythonMinors);
	for(const item of report.reports)
	{
		const prefix = `${item.minor}/`, interpreter = report.interpreters.find(value => value.minor === item.minor);
		assert.deepEqual(await json(prefix + "report.json"), item);
		assert.deepEqual(item.interpreter, interpreter);
		assert.deepEqual(item.arguments, ["consumer.py", ...dependentCheckedRecordPythonCallerArgs(route)]);
		for(const key of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "installedBytesUnchanged", "sourceUnchangedAfterReplay"])
			assert.equal(item[key], true, key);
		assert.equal(item.observations.length, 2);
		for(const [index, position] of ["installed", "relocated"].entries())
		{
			const observation = await json(`${prefix}${position}.json`);
			assert.deepEqual(observation, item.observations[index]);
			assert.equal(observation.relocated, Boolean(index));
			assert.deepEqual(observation.arguments, item.arguments);
			const run = await json(`${prefix}${position}-process.json`);
			assert.deepEqual(observation.run, run);
			assert.equal(run.code, 0); assert.equal(run.stderr, "");
			parseDependentCheckedRecordPythonResult(run.stdout, route);
		}
	}
	return {
		route, producerCommit, runtime, floor
		, records: 1 + 2 + 2 + report.reports.length * 5
		, executions: report.reports.length * 2
		, archiveSha256: wheel.archive.sha256
		, reportSha256: sha256(await read("report.json"))
	};
};

/**
 * Parse closed command options and dispatch to the independent report checker.
 *
 * @param args - Command-line arguments after the script path.
 * @param input - Original TAP and a relative record reader.
 * @param input.tap - Complete producer TAP stream.
 * @param input.read - Relative retained-record reader.
 * @param input.runtime - Checker host facts.
 */
export const checkDependentCheckedRecordPythonCiRecords = async (args, {
	tap, read, runtime
}) => {
	const selected = parseDependentCheckedRecordPythonCiArgs(args);
	assertDependentCheckedRecordPythonCiTap(tap, selected.route);
	return checkDependentCheckedRecordPythonReport(read, {
		route: selected.route, producerCommit: selected.producer
		, runtime, floor: selected.glibc
	});
};

/**
 * Render one independently checked route for exact same-run reconciliation.
 *
 * @param result - Closed checker result returned by this module.
 */
export const renderDependentCheckedRecordPythonCiVerification = result => {
	assert.ok(result && typeof result === "object" && !Array.isArray(result));
	assert.deepEqual(Object.keys(result).sort(), [
		"archiveSha256", "executions", "floor", "producerCommit", "records"
		, "reportSha256", "route", "runtime"
	]);
	return canonicalJson(result);
};
