/**
 * Independently check reproduced and relocated recursive checked-record Ruby gem acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	parseRecursiveCheckedRecordRubyResult, recursiveCheckedRecordRubyCaller
	, recursiveCheckedRecordRubyCallerArgs, recursiveCheckedRecordRubyCounts
	, recursiveCheckedRecordRubyFixtures, recursiveCheckedRecordRubyPackage
	, recursiveCheckedRecordRubyRoutes
} from "./recursive-checked-record-ruby-fixture.mjs";
import { recursiveCheckedRecordRubyOriginal } from "./recursive-checked-record-ruby-generators.mjs";
import { recursiveCheckedRecordRubyReceipt } from "./recursive-checked-record-ruby-package.mjs";
import { checkRecursiveCheckedRecordRubyModels } from "./recursive-checked-record-ruby-model-records.mjs";
import { checkRecursiveCheckedRecordRubyPackage } from "./recursive-checked-record-ruby-package-records.mjs";
import { assertRecursiveCheckedRecordRubyInterpreter, checkRecursiveCheckedRecordRubyEnvironment } from "./recursive-checked-record-ruby-environment-records.mjs";
import { assertRecursiveCheckedRecordRubyResources, recursiveCheckedRecordRubyLoadCeilings } from "./recursive-checked-record-ruby-resources.mjs";

/**
 * Enumerate retained text records after authenticating the original gem inventory.
 *
 * @param route - Independently selected author route.
 * @param gem - Authenticated original gem record.
 * @param fixture - Selected module.
 */
export const recursiveCheckedRecordRubyRecords = (route, gem, fixture) => {
	assert.ok(recursiveCheckedRecordRubyRoutes.includes(route));
	const { leanModule } = recursiveCheckedRecordRubyPackage(fixture);
	return ["report.json", "runtime.json", "interpreter.json", "resources.json"
		, "expected.binding-ir.json", "configuration.json", "consumer.rb"
		, "gem.json", "environment.json", "installed.gemspec"
		, "installed.json", "relocated.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json"
			, `${leanModule}.lean`
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
 * @param options.fixture - Recursive or mutual module.
 * @param options.producerCommit - Full immutable source revision.
 * @param options.runtime - Observed native platform, architecture and glibc version.
 * @param options.floor - Explicit package glibc floor.
 * @param options.rubyVersion - Observed MRI 3.3 patch version.
 */
export const checkRecursiveCheckedRecordRubyReport = async (read, { route, fixture, producerCommit, runtime, floor, rubyVersion }) => {
	assert.ok(recursiveCheckedRecordRubyRoutes.includes(route)); assert.ok(recursiveCheckedRecordRubyFixtures.includes(fixture));
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
		, "dispatch", "expectedBindingIrSha256", "fixture", "gemReceiptSha256"
		, "independentBuilds"
		, "interpreter", "loadCeiling", "observations", "offlineInstall"
		, "producerCommit", "receipt", "relocatedInstallation", "reproducible"
		, "resourceChecks", "route", "runtime"
		, "schemaVersion"
		, "sourceRemovedBeforeInstallation"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.fixture, fixture); assert.equal(report.declaredGlibcFloor, floor);
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No Ruby constructor/source entry counters in this installed acceptance" });
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.ok(recursiveCheckedRecordRubyLoadCeilings.includes(report.loadCeiling), "Unrecorded recursive Ruby load ceiling");
	const resources = await json("resources.json"); assert.equal(resources.length, 6);
	assert.deepEqual(report.resourceChecks, resources);
	for(const resource of resources) assertRecursiveCheckedRecordRubyResources(resource, report.loadCeiling);
	const interpreter = await json("interpreter.json"); assert.deepEqual(report.interpreter, interpreter);
	assertRecursiveCheckedRecordRubyInterpreter(interpreter, rubyVersion);
	const { model, receipt } = await checkRecursiveCheckedRecordRubyModels({ report, read, json, route, fixture, producerCommit });
	const { gem, generatorPaths } = await checkRecursiveCheckedRecordRubyPackage({ read, json, model, receipt, floor, producerCommit, fixture });
	assert.equal(report.gemReceiptSha256, gem.receiptSha256);
	const source = recursiveCheckedRecordRubyOriginal(producerCommit, recursiveCheckedRecordRubyCaller).toString();
	const caller = source;
	assert.equal((await read("consumer.rb")).toString(), caller);
	const environment = await json("environment.json");
	const closure = checkRecursiveCheckedRecordRubyEnvironment({
		fixture, environment, interpreter, gem
		, receiptBytes: await read(`package/${recursiveCheckedRecordRubyReceipt}`)
		, gemspecBytes: await read("installed.gemspec") });
	const installed = posix.dirname(environment.gems), args = ["consumer.rb", ...recursiveCheckedRecordRubyCallerArgs(fixture)];
	assert.equal(report.observations.length, 2);
	for(const [index, position] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${position}.json`); assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(Object.keys(observation).sort(), ["args", "closure", "command", "counts", "cwd", "gems", "relocated", "run"]);
		assert.equal(observation.relocated, Boolean(index)); assert.deepEqual(observation.args, args);
		assert.equal(observation.command, interpreter.command); assert.deepEqual(observation.closure, closure);
		assert.equal(observation.cwd, installed + (index ? "-relocated" : "")); assert.equal(observation.gems, posix.join(observation.cwd, "gems"));
		assert.deepEqual(observation.counts, recursiveCheckedRecordRubyCounts[fixture]);
		assert.deepEqual(Object.keys(observation.run).sort(), ["code", "stderr", "stdout"]);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, ""); parseRecursiveCheckedRecordRubyResult(observation.run.stdout, fixture);
	}
	const recordPaths = recursiveCheckedRecordRubyRecords(route, gem, fixture).sort();
	return { route, fixture, producerCommit, runtime, floor, rubyVersion
		, counts: recursiveCheckedRecordRubyCounts[fixture], executions: 2
		, loadCeiling: report.loadCeiling
		, dispatchObserved: false, generatorModules: generatorPaths.length
		, records: recordPaths.length, recordPaths
		, archiveSha256: gem.archive.sha256
		, reportSha256: sha256(await read("report.json")) };
};
