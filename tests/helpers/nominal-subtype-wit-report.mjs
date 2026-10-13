/**
 * Verify original nominal WIT package, compilation and relocated execution records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { nominalSubtypeWitRoutes, nominalSubtypeWitModes, nominalSubtypeWitCounts, parseNominalSubtypeWitResult } from "./nominal-subtype-wit-fixture.mjs";
import { nominalSubtypeWitOriginal } from "./nominal-subtype-wit-generators.mjs";
import { checkNominalSubtypeWitModels } from "./nominal-subtype-wit-model-records.mjs";
import { checkNominalSubtypeWitPackageRecords, nominalSubtypeWitComponentRecord } from "./nominal-subtype-wit-package-records.mjs";
import { assertNominalSubtypeWitToolRecords, nominalSubtypeWitSuccessful } from "./nominal-subtype-wit-tool-records.mjs";
import { checkNominalSubtypeWitEnvironmentRecords } from "./nominal-subtype-wit-environment-records.mjs";
import { assertNominalSubtypePhpResources } from "./nominal-subtype-php-provenance.mjs";

/**
 * Authenticate retained originals without reopening producer paths or executing consumers.
 *
 * @param read - Selection-relative original byte reader, including the archive-derived component.
 * @param options - Independent selection and runtime pins.
 * @param options.route - Ordinary or independently reviewed author route.
 * @param options.mode - Full or standalone result-only API.
 * @param options.producerCommit - Immutable original producer revision.
 * @param options.runtime - Original platform, architecture and host glibc.
 * @param options.floor - Explicit package glibc floor.
 */
export const checkNominalSubtypeWitReport = async (read, { route, mode, producerCommit, runtime, floor }) => {
	assert.ok(nominalSubtypeWitRoutes.includes(route)); assert.ok(nominalSubtypeWitModes.includes(mode));
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
	assert.deepEqual(Object.keys(report).sort(), ["authorInputsUnchanged"
		, "builds", "callerCompiledOnce", "callerSourceRemovedBeforeExecution"
		, "compilerFreeReplay", "componentModel", "configuration"
		, "declaredGlibcFloor", "dispatch", "expectedBindingIrSha256"
		, "independentBuilds", "mode", "observations", "offlineInstall"
		, "packageReceiptSha256", "producerCommit", "receipt"
		, "relocatedInstallation", "reproducible", "route", "runtime"
		, "schemaVersion", "sourceRemovedBeforeInstallation", "tools"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode); assert.equal(report.independentBuilds, 2);
	assert.equal(report.declaredGlibcFloor, floor);
	for(const key of ["reproducible", "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation", "offlineInstall"
		, "callerCompiledOnce", "callerSourceRemovedBeforeExecution"
		, "compilerFreeReplay", "relocatedInstallation"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.componentModel, { nativeHostRequired: true, standaloneWasi: false });
	assert.deepEqual(report.dispatch, { observed: false, reason: "No constructor/source entry counters in this installed acceptance" });
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	const resources = await json("resources.json"); assert.equal(resources.length, 6);
	for(const resource of resources) assertNominalSubtypePhpResources(resource);
	const tools = await json("tools.json"); assert.deepEqual(report.tools, tools);
	assert.deepEqual(await json("tools-after.json"), tools); assertNominalSubtypeWitToolRecords(tools);
	const { model, receipt } = await checkNominalSubtypeWitModels({ report, read, json, route, mode, producerCommit });
	assert.deepEqual(report.configuration, await json("configuration.json"));
	assert.deepEqual(await json("handoff/package-set-receipt.json"), receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), sha256(await read("handoff/package-set-receipt.json")) + "  package-set-receipt.json\n");
	const { packaged, projection, generatorPaths } = await checkNominalSubtypeWitPackageRecords({ read, json, model, receipt, floor, tools, producerCommit });
	assert.equal(report.packageReceiptSha256, packaged.receiptSha256);
	const callerRoot = "tests/fixtures/nominal-subtype-consumers/";
	let caller = nominalSubtypeWitOriginal(producerCommit, callerRoot + "wit-wasi.c").toString();
	for(const name of ["wit-values.h", "wit-inputs.h"])
	{
		const include = `#include "${name}"`; assert.equal(caller.split(include).length, 2);
		const header = nominalSubtypeWitOriginal(producerCommit, callerRoot + name).toString(); caller = caller.replace(include, () => header);
	}
	if(mode === "result-only") caller = "#define NOMINAL_RESULT_ONLY\n" + caller;
	if(route === "reviewed") caller = caller.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.c")).toString(), caller);
	const { root, closure } = await checkNominalSubtypeWitEnvironmentRecords({ read, json, packaged, tools, caller, projection });
	assert.equal(report.observations.length, 2); const counts = nominalSubtypeWitCounts[mode];
	for(const [position, place] of ["installed", "relocated"].entries())
	{
		const observation = await json(place + ".json"); assert.deepEqual(report.observations[position], observation);
		assert.deepEqual(Object.keys(observation).sort(), ["args", "closure", "command", "counts", "cwd", "environment", "relocated", "run"]);
		assert.equal(observation.relocated, Boolean(position));
		assert.equal(observation.cwd, root + (position ? "-relocated" : ""));
		assert.equal(observation.command, posix.join(observation.cwd, "consumer")); assert.deepEqual(observation.args, []);
		assert.deepEqual(observation.environment, copiedCleanEnvironment); nominalSubtypeWitSuccessful(observation.run);
		parseNominalSubtypeWitResult(observation.run.stdout, mode);
		assert.deepEqual(observation.counts, counts); assert.deepEqual(observation.closure, closure);
	}
	const records = ["report.json", "runtime.json", "resources.json"
		, "tools.json", "tools-after.json", "package.json", "configuration.json"
		, "expected.binding-ir.json", "consumer.c", "consumer.bin"
		, "install-commands.json", "installation.json", "installed.json"
		, "relocated.json", "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json", "NominalSubtypes.lean", "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(path => `build-${index}/${path}`))
		, ...packaged.retained.map(path => "package/" + path)
		, nominalSubtypeWitComponentRecord];
	assert.equal(new Set(records).size, records.length);
	return { route, mode, producerCommit, runtime, floor, counts, executions: 2
		, ...Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, 2 * count]))
		, dispatchObserved: false, nativeHostRequired: true, standaloneWasi: false
		, wasmtime: tools.wasmtime.version, generatorPaths, records: records.sort()
		, archiveSha256: packaged.archive.sha256
		, reportSha256: sha256(await read("report.json")) };
};
