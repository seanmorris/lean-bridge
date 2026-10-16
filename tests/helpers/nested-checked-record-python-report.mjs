/**
 * Independently check complete two-floor nested checked-record Python acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { nestedCheckedRecordPythonRoutes, nestedCheckedRecordPythonModes, nestedCheckedRecordPythonMinors, nestedCheckedRecordPythonCounts, nestedCheckedRecordPythonCallerArgs, parseNestedCheckedRecordPythonResult } from "./nested-checked-record-python-fixture.mjs";
import { nominalSubtypePythonOriginal as nestedCheckedRecordPythonOriginal } from "./nominal-subtype-python-generators.mjs";
import { checkNestedCheckedRecordPythonModels } from "./nested-checked-record-python-model-records.mjs";
import { checkNestedCheckedRecordPythonPackage } from "./nested-checked-record-python-package-records.mjs";
import { assertNestedCheckedRecordPythonInterpreter, checkNestedCheckedRecordPythonEnvironment } from "./nested-checked-record-python-environment-records.mjs";
import { nestedCheckedRecordPythonReceipt } from "./nested-checked-record-python-wheel.mjs";
import { checkNestedCheckedRecordPythonHandoff, nestedCheckedRecordPythonHandoffRecords } from "./nested-checked-record-python-handoff.mjs";

/**
 * Enumerate retained text records after authenticating the wheel inventory.
 *
 * @param route - Ordinary or reviewed author route.
 * @param wheel - Authenticated original wheel record.
 */
export const nestedCheckedRecordPythonRecords = (route, wheel) => {
	assert.ok(nestedCheckedRecordPythonRoutes.includes(route));
	return ["report.json", "runtime.json", "expected.binding-ir.json"
		, "configuration.json", "consumer.py", "wheel.json"
		, ...nestedCheckedRecordPythonHandoffRecords(wheel)
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json", "NestedCheckedRecords.lean"
			, "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(path => `build-${index}/${path}`))
		, ...wheel.retained.map(path => `package/${path}`)
		, ...nestedCheckedRecordPythonMinors.flatMap(minor => [
			"baseline.json", "environment.json", "pip.json"
			, "pip-metadata.json", "report.json", "installed.json", "relocated.json"
			, "installed-process.json", "relocated-process.json"
		].map(path => `${minor}/${path}`))];
};

/**
 * Check original source, both independent builds and every installed execution.
 *
 * @param read - Original record byte reader, relative to one route/API selection.
 * @param options - Independently chosen producer and execution scope.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Full immutable producer revision.
 * @param options.runtime - Observed platform, architecture and glibc version.
 * @param options.floor - Explicit package glibc floor.
 */
export const checkNestedCheckedRecordPythonReport = async (read, { route, mode, producerCommit, runtime, floor }) => {
	assert.ok(nestedCheckedRecordPythonRoutes.includes(route)); assert.ok(nestedCheckedRecordPythonModes.includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.ok(bytes.toString() === canonicalJson(value), `Noncanonical record: ${path}`); return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged", "builds", "declaredGlibcFloor"
		, "expectedBindingIrSha256", "independentBuilds", "interpreters"
		, "minors", "mode", "producerCommit", "reports", "reproducible"
		, "route", "runtime", "schemaVersion"
		, "sourceRemovedBeforeInstallation", "wheelReceiptSha256"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode); assert.equal(report.declaredGlibcFloor, floor);
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"]) assert.equal(report[key], true, key);
	assert.deepEqual(report.minors, nestedCheckedRecordPythonMinors);
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.deepEqual(report.interpreters.map(item => item.minor), nestedCheckedRecordPythonMinors);
	assert.equal(new Set(report.interpreters.map(item => item.interpreter.sha256)).size, 2);
	for(const item of report.interpreters) assertNestedCheckedRecordPythonInterpreter(item, item.minor);
	const { model, receipt } = await checkNestedCheckedRecordPythonModels({ report, read, json, route, mode, producerCommit });
	const { wheel, generatorPaths } = await checkNestedCheckedRecordPythonPackage({ read, json, model, receipt, floor, producerCommit });
	const handoff = await checkNestedCheckedRecordPythonHandoff(read, { receipt, wheel });
	assert.equal(report.wheelReceiptSha256, wheel.receiptSha256);
	const caller = nestedCheckedRecordPythonOriginal(producerCommit, "tests/fixtures/nested-checked-record-consumers/python.py").toString();
	assert.equal((await read("consumer.py")).toString(), caller);
	assert.deepEqual(report.reports.map(item => item.minor), nestedCheckedRecordPythonMinors);
	for(const item of report.reports)
	{
		const prefix = `${item.minor}/`, interpreter = report.interpreters.find(value => value.minor === item.minor);
		assert.deepEqual(await json(prefix + "report.json"), item); assert.deepEqual(item.interpreter, interpreter);
		assert.deepEqual(Object.keys(item).sort(), [
			"archiveSha256", "arguments", "baselineSha256"
			, "compilerFreeExecution", "consumerSha256", "dispatch", "environmentSha256"
			, "installedBytesUnchanged", "interpreter", "minor", "mode", "observations"
			, "offlineInstall", "receiptSha256", "relocatedInstallation", "route"
			, "sourceUnchangedAfterReplay"]);
		assert.equal(item.route, route); assert.equal(item.mode, mode);
		assert.equal(item.consumerSha256, sha256(caller)); assert.equal(item.archiveSha256, wheel.archive.sha256);
		assert.deepEqual(item.arguments, ["consumer.py", ...nestedCheckedRecordPythonCallerArgs(route, mode)]);
		for(const key of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "installedBytesUnchanged", "sourceUnchangedAfterReplay"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.dispatch, { observed: false, reason: "Separate constructor/source entry probe remains required" });
		const closure = checkNestedCheckedRecordPythonEnvironment({ baseline: await json(prefix + "baseline.json")
			, installed: await json(prefix + "environment.json")
			, pip: await json(prefix + "pip.json")
			, pipMetadata: await json(prefix + "pip-metadata.json")
			, receiptBytes: await read(`package/${nestedCheckedRecordPythonReceipt}`)
			, interpreter, artifact: wheel.archive });
		assert.equal(item.baselineSha256, closure.baselineSha256); assert.equal(item.environmentSha256, closure.environmentSha256);
		assert.equal(item.receiptSha256, wheel.receiptSha256);
		assert.equal(item.observations.length, 2);
		for(const [index, position] of ["installed", "relocated"].entries())
		{
			const observation = await json(`${prefix}${position}.json`); assert.deepEqual(observation, item.observations[index]);
			assert.deepEqual(Object.keys(observation).sort(), ["arguments", "closure", "counts", "environment", "relocated", "run"]);
			assert.equal(observation.relocated, Boolean(index)); assert.deepEqual(observation.arguments, item.arguments);
			assert.deepEqual(observation.environment, copiedCleanEnvironment); assert.deepEqual(observation.closure, closure);
			assert.deepEqual(observation.counts, nestedCheckedRecordPythonCounts[mode]);
			const run = await json(`${prefix}${position}-process.json`); assert.deepEqual(observation.run, run);
			assert.deepEqual(Object.keys(run).sort(), ["code", "stderr", "stdout"]);
			assert.equal(run.code, 0); assert.equal(run.stderr, ""); parseNestedCheckedRecordPythonResult(run.stdout, mode);
		}
	}
	return { route, mode, producerCommit, runtime, floor
		, minors: nestedCheckedRecordPythonMinors
		, counts: nestedCheckedRecordPythonCounts[mode]
		, executions: 4, dispatchObserved: false
		, handoff
		, generatorModules: generatorPaths.length
		, records: nestedCheckedRecordPythonRecords(route, wheel).length };
};
