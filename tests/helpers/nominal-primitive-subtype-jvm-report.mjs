/**
 * Reconcile original nineteen-base JVM models, package contents and complete executions.
 * Readers resolve retained relative paths, never historical scratch directories.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeModule } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeJvmDefaultLoadCeiling, nominalPrimitiveSubtypeJvmMaximumLoadCeiling, nominalPrimitiveSubtypeJvmModes, nominalPrimitiveSubtypeJvmRoutes } from "./nominal-primitive-subtype-jvm-fixture.mjs";
import { checkNominalPrimitiveSubtypeJvmModels } from "./nominal-primitive-subtype-jvm-model-records.mjs";
import { checkNominalPrimitiveSubtypeJvmPackageRecords, nominalPrimitiveSubtypeJvmRetainedMembers } from "./nominal-primitive-subtype-jvm-package-records.mjs";
import { checkNominalPrimitiveSubtypeJvmConsumers } from "./nominal-primitive-subtype-jvm-consumer-records.mjs";

const buildRecords = route => ["model.json", "native-jvm.json", "package-set-receipt.json", "author-inputs.json", `${nominalPrimitiveSubtypeModule}.lean`, "lean-bridge.exports.json", ...route === "reviewed" ? ["api.binding-ir.json"] : []];

/**
 * Check the original report without inventing fresh execution or absent binaries.
 *
 * @param read - Selection-relative retained-record reader.
 * @param options - Independent selection, source and original platform pins.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or constructor-free result-only API.
 * @param options.producerCommit - Full immutable producer revision.
 * @param options.runtime - Independently observed platform, architecture and glibc.
 * @param options.floor - Explicit package glibc floor.
 * @param options.javaVersion - Independently pinned original Java version output.
 */
export const checkNominalPrimitiveSubtypeJvmReport = async (read, { route, mode, producerCommit, runtime, floor, javaVersion }) => {
	assert.ok(nominalPrimitiveSubtypeJvmRoutes.includes(route)); assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(floor.split(".")[1]));
	assert.match(javaVersion, /^(?:openjdk|java) 22[. ]/u);
	const json = async path => {
		const bytes = Buffer.from(await read(path)), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Noncanonical record: ${path}`);
		return value;
	};
	const report = await json("report.json");
	assert.deepEqual(Object.keys(report).sort(), ["authorInputsUnchanged", "builds"
		, "compilerFreeReplay", "consumers", "declaredGlibcFloor", "dispatch"
		, "expectedBindingIrSha256", "independentBuilds", "installation"
		, "installerCommandLogs", "loadCeiling", "mode", "offlineInstall"
		, "producerCommit"
		, "receipt", "relocatedInstallation"
		, "reproducible", "resourceChecks", "route", "runtime", "schemaVersion"
		, "sourceFreeDeployment", "sourceRemovedBeforeInstallation"
		, "trustedToolchains"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.equal(report.independentBuilds, 2); assert.equal(report.declaredGlibcFloor, floor);
	for(const key of ["reproducible", "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay"
		, "relocatedInstallation", "sourceFreeDeployment"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false, reason: "No JVM constructor/source entry counters in this installed acceptance" });
	assert.equal(report.trustedToolchains, "Explicit JDK and Kotlin distributions; their complete contents are not authenticated");
	assert.equal(report.installerCommandLogs, "Closed installer retains package/source/output identities, not compiler stdout");
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord); assert.deepEqual(await json("runtime.json"), runtimeRecord);
	assert.ok([nominalPrimitiveSubtypeJvmDefaultLoadCeiling, nominalPrimitiveSubtypeJvmMaximumLoadCeiling].includes(report.loadCeiling), "Unrecorded JVM load ceiling");
	assert.equal(report.resourceChecks.length, 5);
	assert.deepEqual(await json("resources.json"), report.resourceChecks);
	for(const check of report.resourceChecks)
	{
		assert.deepEqual(Object.keys(check).sort(), ["observations", "waits"]);
		assert.ok(Number.isSafeInteger(check.waits) && check.waits >= 0 && check.waits <= 20);
		assert.equal(check.observations.length, check.waits + 1);
		for(const [index, sample] of check.observations.entries())
		{
			assert.deepEqual(Object.keys(sample).sort(), ["availableBytes", "freeBytes", "load"]);
			for(const key of ["availableBytes", "freeBytes"]) assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 2 * 1024 ** 3);
			assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
			assert.equal(sample.load < report.loadCeiling, index === check.waits);
		}
	}
	const { model, receipt, compiled } = await checkNominalPrimitiveSubtypeJvmModels({ report, read, json, route, mode, producerCommit });
	assert.deepEqual(await json("handoff/package-set-receipt.json"), receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, sha256(await read("handoff/package-set-receipt.json")) + "  package-set-receipt.json\n");
	const { installation, packageReceipt, generatorPaths, generatedFiles } = await checkNominalPrimitiveSubtypeJvmPackageRecords({
		read, json, model, receipt, compiled, floor, mode, producerCommit
	});
	assert.deepEqual(report.installation, installation);
	const consumers = await checkNominalPrimitiveSubtypeJvmConsumers({ report, read, json, route, mode, producerCommit, installation, javaVersion });
	const records = ["report.json", "runtime.json", "resources.json"
		, "configuration.json", "expected.binding-ir.json", "consumer.java"
		, "consumer.kt", "installation.json", "handoff/package-set-receipt.json"
		, "handoff/package-set-receipt.json.sha256"
		, "handoff/archives/nominalprimitivesubtypes-1.0.0.pom"
		, ...[0, 1].flatMap(index => buildRecords(route).map(path => `build-${index}/${path}`))
		, ...nominalPrimitiveSubtypeJvmRetainedMembers(packageReceipt).map(path => "package/" + path)
		, ...consumers.records];
	assert.equal(new Set(records).size, records.length);
	return { route, mode, producerCommit, runtime, floor, javaVersion
		, generatorPaths, generatedFiles, ...consumers, records: records.sort()
		, archiveSha256: installation.artifact.sha256
		, reportSha256: sha256(await read("report.json")) };
};
