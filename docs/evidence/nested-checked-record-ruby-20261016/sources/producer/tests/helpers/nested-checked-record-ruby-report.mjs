/**
 * Independently check reproduced and relocated nested checked-record Ruby package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nestedCheckedRecordRubyRoutes, nestedCheckedRecordRubyModes, nestedCheckedRecordRubyCounts, nestedCheckedRecordRubyCallerArgs, parseNestedCheckedRecordRubyResult } from "./nested-checked-record-ruby-fixture.mjs";
import { nominalSubtypeRubyOriginal as nestedCheckedRecordRubyOriginal } from "./nominal-subtype-ruby-generators.mjs";
import { nestedCheckedRecordRubyReceipt } from "./nested-checked-record-ruby-package.mjs";
import { checkNestedCheckedRecordRubyModels } from "./nested-checked-record-ruby-model-records.mjs";
import { checkNestedCheckedRecordRubyPackage } from "./nested-checked-record-ruby-package-records.mjs";
import { assertNestedCheckedRecordRubyInterpreter, checkNestedCheckedRecordRubyEnvironment } from "./nested-checked-record-ruby-environment-records.mjs";
import { assertNestedCheckedRecordRubyResources, nestedCheckedRecordRubyLoadCeilings } from "./nested-checked-record-ruby-resources.mjs";

/**
 * Enumerate retained text records after authenticating the original gem inventory.
 *
 * @param route - Independently selected author route.
 * @param gem - Authenticated original gem record.
 */
export const nestedCheckedRecordRubyRecords = (route, gem) => {
	assert.ok(nestedCheckedRecordRubyRoutes.includes(route));
	return ["report.json", "runtime.json", "interpreter.json", "resources.json"
		, "expected.binding-ir.json", "configuration.json", "consumer.rb"
		, "gem.json", "environment.json", "installed.gemspec"
		, "installed.json", "relocated.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json"
			, "NestedCheckedRecords.lean"
			, "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(path => `build-${index}/${path}`))
		, ...gem.retained.map(path => `package/${path}`)
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, "handoff/" + gem.archive.path];
};

/**
 * Check source, both builds, the complete installed closure and both public executions.
 *
 * @param read - Selection-relative original byte reader, never historical absolute paths.
 * @param options - Independently selected producer and runtime scope.
 * @param options.route - Ordinary or reviewed source route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Full immutable source revision.
 * @param options.runtime - Observed native platform, architecture and glibc version.
 * @param options.floor - Explicit package glibc floor.
 * @param options.rubyVersion - Observed MRI 3.3 patch version.
 */
export const checkNestedCheckedRecordRubyReport = async (read, { route, mode, producerCommit, runtime, floor, rubyVersion }) => {
	assert.ok(nestedCheckedRecordRubyRoutes.includes(route)); assert.ok(nestedCheckedRecordRubyModes.includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`); return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), [
		"authorInputsUnchanged", "builds", "compilerFreeReplay", "declaredGlibcFloor"
		, "dispatch", "expectedBindingIrSha256", "gemReceiptSha256"
		, "independentBuilds"
		, "interpreter", "loadCeiling", "mode", "observations", "offlineInstall"
		, "producerCommit", "receipt", "relocatedInstallation", "reproducible"
		, "resourceChecks", "route", "runtime"
		, "schemaVersion"
		, "sourceRemovedBeforeInstallation"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode); assert.equal(report.declaredGlibcFloor, floor);
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No Ruby constructor/source entry counters in this installed acceptance" });
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.ok(nestedCheckedRecordRubyLoadCeilings.includes(report.loadCeiling), "Unrecorded nested Ruby load ceiling");
	const resources = await json("resources.json"); assert.equal(resources.length, 6);
	assert.deepEqual(report.resourceChecks, resources);
	for(const resource of resources) assertNestedCheckedRecordRubyResources(resource, report.loadCeiling);
	const interpreter = await json("interpreter.json"); assert.deepEqual(report.interpreter, interpreter);
	assertNestedCheckedRecordRubyInterpreter(interpreter, rubyVersion);
	const { model, receipt } = await checkNestedCheckedRecordRubyModels({ report, read, json, route, mode, producerCommit });
	const { gem, generatorPaths } = await checkNestedCheckedRecordRubyPackage({ read, json, model, receipt, floor, producerCommit });
	assert.equal(report.gemReceiptSha256, gem.receiptSha256);
	const source = nestedCheckedRecordRubyOriginal(producerCommit, "tests/fixtures/nested-checked-record-consumers/ruby.rb").toString();
	const caller = source;
	assert.equal((await read("consumer.rb")).toString(), caller);
	const environment = await json("environment.json");
	const closure = checkNestedCheckedRecordRubyEnvironment({
		environment, interpreter, gem
		, receiptBytes: await read(`package/${nestedCheckedRecordRubyReceipt}`)
		, gemspecBytes: await read("installed.gemspec") });
	const installed = posix.dirname(environment.gems), args = ["consumer.rb", ...nestedCheckedRecordRubyCallerArgs(route, mode)];
	assert.equal(report.observations.length, 2);
	for(const [index, position] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${position}.json`); assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(Object.keys(observation).sort(), ["args", "closure", "command", "counts", "cwd", "gems", "relocated", "run"]);
		assert.equal(observation.relocated, Boolean(index)); assert.deepEqual(observation.args, args);
		assert.equal(observation.command, interpreter.command); assert.deepEqual(observation.closure, closure);
		assert.equal(observation.cwd, installed + (index ? "-relocated" : "")); assert.equal(observation.gems, posix.join(observation.cwd, "gems"));
		assert.deepEqual(observation.counts, nestedCheckedRecordRubyCounts[mode]);
		assert.deepEqual(Object.keys(observation.run).sort(), ["code", "stderr", "stdout"]);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, ""); parseNestedCheckedRecordRubyResult(observation.run.stdout, mode);
	}
	return { route, mode, producerCommit, runtime, floor, rubyVersion
		, counts: nestedCheckedRecordRubyCounts[mode], executions: 2
		, loadCeiling: report.loadCeiling
		, dispatchObserved: false, generatorModules: generatorPaths.length
		, records: nestedCheckedRecordRubyRecords(route, gem).length };
};
