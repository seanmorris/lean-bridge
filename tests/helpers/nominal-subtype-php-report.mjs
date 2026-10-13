/**
 * Check original nominal PHP packages, Composer closure and all relocated executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypePhpRoutes, nominalSubtypePhpModes, nominalSubtypePhpCounts, parseNominalSubtypePhpResult } from "./nominal-subtype-php-fixture.mjs";
import { nominalSubtypePhpOriginal } from "./nominal-subtype-php-generators.mjs";
import { checkNominalSubtypePhpModels } from "./nominal-subtype-php-model-records.mjs";
import { checkNominalSubtypePhpPackageRecords } from "./nominal-subtype-php-package-records.mjs";
import { assertNominalSubtypePhpToolRecords } from "./nominal-subtype-php-tool-records.mjs";
import { checkNominalSubtypePhpEnvironmentRecords } from "./nominal-subtype-php-environment-records.mjs";
import { assertNominalSubtypePhpResources } from "./nominal-subtype-php-provenance.mjs";

/**
 * Authenticate retained originals without claiming a new installed execution.
 *
 * @param read - Selection-relative original byte reader.
 * @param options - Independent acceptance selection and runtime pins.
 * @param options.route - Ordinary source or independent review.
 * @param options.mode - Full or standalone result-only API.
 * @param options.producerCommit - Full immutable producer revision.
 * @param options.runtime - Observed platform, architecture and host glibc.
 * @param options.floor - Explicit package glibc floor.
 * @param options.phpVersion - Exact original PHP version.
 * @param options.composerVersion - Exact original Composer version.
 */
export const checkNominalSubtypePhpReport = async (read, { route, mode, producerCommit, runtime, floor, phpVersion, composerVersion }) => {
	assert.ok(nominalSubtypePhpRoutes.includes(route)); assert.ok(nominalSubtypePhpModes.includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
		return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), ["authorInputsUnchanged", "builds"
		, "compilerFreeReplay", "configuration", "consumerSourceRequired"
		, "declaredGlibcFloor", "dispatch", "expectedBindingIrSha256"
		, "independentBuilds"
		, "mode", "observations", "offlineInstall", "packageReceiptSha256"
		, "producerCommit", "receipt", "relocatedInstallation", "reproducible"
		, "route", "runtime", "schemaVersion", "sourceRemovedBeforeInstallation"
		, "tools"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.equal(report.independentBuilds, 2); assert.equal(report.declaredGlibcFloor, floor);
	for(const key of [
		"reproducible", "authorInputsUnchanged", "sourceRemovedBeforeInstallation"
		, "offlineInstall", "compilerFreeReplay", "relocatedInstallation"
		, "consumerSourceRequired"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No PHP constructor/source entry counters in this installed acceptance" });
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	const resources = await json("resources.json"); assert.equal(resources.length, 8);
	for(const resource of resources) assertNominalSubtypePhpResources(resource);
	const tools = await json("tools.json"); assert.deepEqual(report.tools, tools);
	assertNominalSubtypePhpToolRecords(tools, { phpVersion, composerVersion });
	const { model, receipt } = await checkNominalSubtypePhpModels({ report, read, json, route, mode, producerCommit });
	assert.deepEqual(report.configuration, await json("configuration.json"));
	assert.deepEqual(await json("handoff/package-set-receipt.json"), receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, sha256(await read("handoff/package-set-receipt.json")) + "  package-set-receipt.json\n");
	const { packaged, generatorPaths } = await checkNominalSubtypePhpPackageRecords({ read, json, model, receipt, floor, producerCommit });
	assert.equal(report.packageReceiptSha256, packaged.receiptSha256);
	let caller = nominalSubtypePhpOriginal(producerCommit, "tests/fixtures/nominal-subtype-consumers/php-native.php").toString();
	assert.equal((caller.match(/const NOMINAL_RESULT_ONLY = false;/gu) ?? []).length, 1);
	if(mode === "result-only") caller = caller.replace("const NOMINAL_RESULT_ONLY = false;", "const NOMINAL_RESULT_ONLY = true;");
	if(route === "reviewed") caller = caller.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.php")).toString(), caller);
	const environment = await json("environment.json");
	const closure = await checkNominalSubtypePhpEnvironmentRecords({ read, json, environment, packaged, receipt, tools, caller });
	assert.equal(report.observations.length, 4);
	const counts = nominalSubtypePhpCounts[mode];
	for(const [position, place] of ["installed", "relocated"].entries()) for(const [offset, strictness] of ["weak", "strict"].entries())
	{
		const observation = await json(`${place}-${strictness}.json`);
		assert.deepEqual(observation, report.observations[2 * position + offset]);
		assert.deepEqual(Object.keys(observation).sort(), ["args", "closure", "command", "counts", "cwd", "relocated", "run", "strictness"]);
		assert.equal(observation.relocated, Boolean(position)); assert.equal(observation.strictness, strictness);
		assert.equal(observation.command, tools.command);
		assert.deepEqual(observation.args, [...tools.runtimeFlags, strictness === "strict" ? "strict.php" : "consumer.php"]);
		assert.equal(observation.cwd, environment.root + (position ? "-relocated" : ""));
		assert.deepEqual(Object.keys(observation.run).sort(), ["code", "stderr", "stdout"]);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		parseNominalSubtypePhpResult(observation.run.stdout, mode);
		assert.deepEqual(observation.counts, counts); assert.deepEqual(observation.closure, closure);
	}
	const records = ["report.json", "runtime.json", "resources.json", "tools.json"
		, "package.json", "environment.json", "configuration.json"
		, "expected.binding-ir.json", "consumer.php"
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, ...["installed", "relocated"].flatMap(place => ["weak", "strict"].map(strictness => `${place}-${strictness}.json`))
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json", "NominalSubtypes.lean", "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(path => `build-${index}/${path}`))
		, ...packaged.retained.map(path => "package/" + path)
		, ...Object.keys({ ...environment.inputs, ...environment.generatedFiles }).map(path => "installation/" + path)];
	assert.equal(new Set(records).size, records.length);
	return { route, mode, producerCommit, runtime, floor, phpVersion
		, composerVersion, counts, executions: 4
		, ...Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, 4 * count]))
		, dispatchObserved: false, generatorPaths, records: records.sort()
		, archiveSha256: packaged.archive.sha256
		, reportSha256: sha256(await read("report.json")) };
};
