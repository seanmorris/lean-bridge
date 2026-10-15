/**
 * Independently check reproduced and relocated nominal Ruby package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeRubyRoutes, nominalPrimitiveSubtypeRubyModes, nominalPrimitiveSubtypeRubyCounts, parseNominalPrimitiveSubtypeRubyResult } from "./nominal-primitive-subtype-ruby-fixture.mjs";
import { nominalSubtypeRubyOriginal as nominalPrimitiveSubtypeRubyOriginal } from "./nominal-subtype-ruby-generators.mjs";
import { nominalPrimitiveSubtypeRubyReceipt } from "./nominal-primitive-subtype-ruby-package.mjs";
import { checkNominalPrimitiveSubtypeRubyModels } from "./nominal-primitive-subtype-ruby-model-records.mjs";
import { checkNominalPrimitiveSubtypeRubyPackage } from "./nominal-primitive-subtype-ruby-package-records.mjs";
import { assertNominalPrimitiveSubtypeRubyInterpreter, checkNominalPrimitiveSubtypeRubyEnvironment } from "./nominal-primitive-subtype-ruby-environment-records.mjs";

/**
 * Enumerate retained text records after authenticating the original gem inventory.
 *
 * @param route - Independently selected author route.
 * @param gem - Authenticated original gem record.
 */
export const nominalPrimitiveSubtypeRubyRecords = (route, gem) => {
	assert.ok(nominalPrimitiveSubtypeRubyRoutes.includes(route));
	return ["report.json", "runtime.json", "interpreter.json"
		, "expected.binding-ir.json", "configuration.json", "consumer.rb"
		, "gem.json", "environment.json", "installed.gemspec"
		, "installed.json", "relocated.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json"
			, "NominalPrimitiveSubtypes.lean"
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
export const checkNominalPrimitiveSubtypeRubyReport = async (read, { route, mode, producerCommit, runtime, floor, rubyVersion }) => {
	assert.ok(nominalPrimitiveSubtypeRubyRoutes.includes(route)); assert.ok(nominalPrimitiveSubtypeRubyModes.includes(mode));
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
		, "interpreter", "mode", "observations", "offlineInstall", "producerCommit"
		, "receipt", "relocatedInstallation", "reproducible", "route", "runtime"
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
	const interpreter = await json("interpreter.json"); assert.deepEqual(report.interpreter, interpreter);
	assertNominalPrimitiveSubtypeRubyInterpreter(interpreter, rubyVersion);
	const { model, receipt } = await checkNominalPrimitiveSubtypeRubyModels({ report, read, json, route, mode, producerCommit });
	const { gem, generatorPaths } = await checkNominalPrimitiveSubtypeRubyPackage({ read, json, model, receipt, floor, producerCommit });
	assert.equal(report.gemReceiptSha256, gem.receiptSha256);
	const source = nominalPrimitiveSubtypeRubyOriginal(producerCommit, "tests/fixtures/nominal-primitive-subtype-consumers/ruby.rb").toString();
	const caller = source;
	assert.equal((await read("consumer.rb")).toString(), caller);
	const environment = await json("environment.json");
	const closure = checkNominalPrimitiveSubtypeRubyEnvironment({
		environment, interpreter, gem
		, receiptBytes: await read(`package/${nominalPrimitiveSubtypeRubyReceipt}`)
		, gemspecBytes: await read("installed.gemspec") });
	const installed = posix.dirname(environment.gems), args = ["consumer.rb", ...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []];
	assert.equal(report.observations.length, 2);
	for(const [index, position] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${position}.json`); assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(Object.keys(observation).sort(), ["args", "closure", "command", "counts", "cwd", "gems", "relocated", "run"]);
		assert.equal(observation.relocated, Boolean(index)); assert.deepEqual(observation.args, args);
		assert.equal(observation.command, interpreter.command); assert.deepEqual(observation.closure, closure);
		assert.equal(observation.cwd, installed + (index ? "-relocated" : "")); assert.equal(observation.gems, posix.join(observation.cwd, "gems"));
		assert.deepEqual(observation.counts, nominalPrimitiveSubtypeRubyCounts[mode]);
		assert.deepEqual(Object.keys(observation.run).sort(), ["code", "stderr", "stdout"]);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, ""); parseNominalPrimitiveSubtypeRubyResult(observation.run.stdout, mode);
	}
	return { route, mode, producerCommit, runtime, floor, rubyVersion
		, counts: nominalPrimitiveSubtypeRubyCounts[mode], executions: 2
		, dispatchObserved: false, generatorModules: generatorPaths.length
		, records: nominalPrimitiveSubtypeRubyRecords(route, gem).length };
};
