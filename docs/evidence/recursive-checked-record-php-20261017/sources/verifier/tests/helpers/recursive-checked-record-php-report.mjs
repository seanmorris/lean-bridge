/**
 * Authenticate one complete recursive checked-record native PHP installed-package report.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	recursiveCheckedRecordPhpCaller, recursiveCheckedRecordPhpRoutes
	, recursiveCheckedRecordPhpFixtures, recursiveCheckedRecordPhpCounts
	, recursiveCheckedRecordPhpPackage, parseRecursiveCheckedRecordPhpResult
} from "./recursive-checked-record-php-fixture.mjs";
import { recursiveCheckedRecordPhpOriginal } from "./recursive-checked-record-php-generators.mjs";
import { checkRecursiveCheckedRecordPhpModels } from "./recursive-checked-record-php-model-records.mjs";
import { checkRecursiveCheckedRecordPhpPackageRecords } from "./recursive-checked-record-php-package-records.mjs";
import { assertNominalSubtypePhpToolRecords } from "./nominal-subtype-php-tool-records.mjs";
import { checkRecursiveCheckedRecordPhpEnvironmentRecords } from "./recursive-checked-record-php-environment-records.mjs";
import { assertRecursiveCheckedRecordPhpResources } from "./recursive-checked-record-php-resources.mjs";

/**
 * Check frozen source, models, package, Composer closure and all four executions.
 *
 * @param read - Selection-relative original byte reader.
 * @param options - Independent acceptance pins.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.fixture - Recursive or mutual module.
 * @param options.producerCommit - Full frozen producer revision.
 * @param options.runtime - Original host platform, architecture and glibc.
 * @param options.floor - Explicit package glibc floor.
 * @param options.phpVersion - Exact accepted PHP version.
 * @param options.composerVersion - Exact accepted Composer version.
 */
export const checkRecursiveCheckedRecordPhpReport = async (read, { route, fixture, producerCommit, runtime, floor, phpVersion, composerVersion }) => {
	assert.ok(recursiveCheckedRecordPhpRoutes.includes(route)); assert.ok(recursiveCheckedRecordPhpFixtures.includes(fixture));
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
		, "declaredGlibcFloor", "dispatch", "expectedBindingIrSha256", "fixture"
		, "independentBuilds", "loadCeiling", "observations", "offlineInstall"
		, "packageReceiptSha256", "producerCommit", "receipt"
		, "relocatedInstallation", "reproducible"
		, "resourceChecks", "route", "runtime"
		, "schemaVersion", "sourceRemovedBeforeInstallation", "tools"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.fixture, fixture);
	assert.equal(report.independentBuilds, 2); assert.equal(report.declaredGlibcFloor, floor);
	for(const key of [
		"reproducible"
		, "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation"
		, "offlineInstall"
		, "compilerFreeReplay"
		, "relocatedInstallation"
		, "consumerSourceRequired"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No PHP constructor/source entry counters in this installed acceptance" });
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.ok([8, 12, 16, 20].includes(report.loadCeiling)
		, "Unrecorded recursive PHP load ceiling");
	const resources = await json("resources.json"); assert.equal(resources.length, 8);
	assert.deepEqual(report.resourceChecks, resources);
	for(const resource of resources)
		assertRecursiveCheckedRecordPhpResources(resource, report.loadCeiling);
	const tools = await json("tools.json"); assert.deepEqual(report.tools, tools);
	assertNominalSubtypePhpToolRecords(tools, { phpVersion, composerVersion });
	const { model, receipt } = await checkRecursiveCheckedRecordPhpModels({ report, read, json, route, fixture, producerCommit });
	assert.deepEqual(report.configuration, await json("configuration.json"));
	assert.deepEqual(await json("handoff/package-set-receipt.json"), receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, sha256(await read("handoff/package-set-receipt.json")) + "  package-set-receipt.json\n");
	const { packaged, generatorPaths } = await checkRecursiveCheckedRecordPhpPackageRecords({ read, json, model, receipt, floor, producerCommit, fixture });
	assert.equal(report.packageReceiptSha256, packaged.receiptSha256);
	const archive = await read("handoff/" + packaged.archive.path);
	assert.deepEqual({ bytes: archive.length, sha256: sha256(archive) }
		, { bytes: packaged.archive.bytes, sha256: packaged.archive.sha256 });
	// One unchanged caller serves every selection; the installed package selects its module.
	const caller = recursiveCheckedRecordPhpOriginal(producerCommit, recursiveCheckedRecordPhpCaller).toString();
	assert.equal((await read("consumer.php")).toString(), caller);
	const environment = await json("environment.json");
	const closure = await checkRecursiveCheckedRecordPhpEnvironmentRecords({
		read
		, json
		, environment
		, packaged
		, receipt
		, tools
		, caller
		, fixture
	});
	assert.equal(report.observations.length, 4);
	const counts = recursiveCheckedRecordPhpCounts[fixture];
	for(const [position, place] of ["installed", "relocated"].entries())
		for(const [offset, strictness] of ["weak", "strict"].entries())
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
			parseRecursiveCheckedRecordPhpResult(observation.run.stdout, fixture);
			assert.deepEqual(observation.counts, counts); assert.deepEqual(observation.closure, closure);
		}
	const { leanModule } = recursiveCheckedRecordPhpPackage(fixture);
	const records = ["report.json", "runtime.json", "resources.json", "tools.json"
		, "package.json", "environment.json", "configuration.json"
		, "expected.binding-ir.json", "consumer.php"
		, "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, "handoff/" + packaged.archive.path
		, ...["installed", "relocated"].flatMap(place => ["weak", "strict"].map(strictness => `${place}-${strictness}.json`))
		, ...[0, 1].flatMap(index => [
			"model.json"
			, "package-set-receipt.json"
			, "author-inputs.json"
			, `${leanModule}.lean`, "lean-bridge.exports.json"
			, ...route === "reviewed" ? ["api.binding-ir.json"] : []].map(path => `build-${index}/${path}`))
		, ...packaged.retained.map(path => "package/" + path)
		, ...Object.keys({ ...environment.inputs, ...environment.generatedFiles }).map(path => "installation/" + path)];
	assert.equal(new Set(records).size, records.length);
	return {
		route
		, fixture
		, producerCommit
		, runtime
		, floor
		, phpVersion
		, composerVersion
		, counts, executions: 4, loadCeiling: report.loadCeiling
		, dispatchObserved: false, generatorPaths, records: records.sort()
		, archiveSha256: packaged.archive.sha256
		, reportSha256: sha256(await read("report.json")) };
};
