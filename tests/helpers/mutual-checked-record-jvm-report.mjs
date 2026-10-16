/**
 * Reconcile one original recursive checked-record Maven acceptance record.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	mutualCheckedRecordJvmConfiguration, mutualCheckedRecordJvmProfiles
	, mutualCheckedRecordJvmReview, parseMutualCheckedRecordJvmResult
} from "./mutual-checked-record-jvm-fixture.mjs";
import {
	inspectMutualCheckedRecordJvmPackage
} from "./mutual-checked-record-jvm-package.mjs";
import {
	checkMutualCheckedRecordKotlinNullProbe
} from "./mutual-checked-record-jvm-probe.mjs";
import {
	mutualCheckedRecordJvmArchiveRoutes, mutualCheckedRecordJvmOriginal
	, mutualCheckedRecordJvmProducer
} from "./mutual-checked-record-jvm-provenance.mjs";

const jarPath = "handoff/archives/mutualcheckedrecords-1.0.0.jar";
const pomPath = "handoff/archives/mutualcheckedrecords-1.0.0.pom";
const basePaths = Object.freeze([
	"configuration.json", "consumer.java", "consumer.kt"
	, "expected.binding-ir.json", jarPath, pomPath
	, "handoff/package-set-receipt.json"
	, "handoff/package-set-receipt.json.sha256", "installation.json"
	, "java/installed.json", "java/relocated.json", "java/source-free.json"
	, "kotlin/installed.json"
	, "kotlin/nullability-false/NullProbe.kt"
	, "kotlin/nullability-false/classes/META-INF/main.kotlin_module"
	, "kotlin/nullability-false/classes/NullProbeKt.class"
	, "kotlin/nullability-false/record.json"
	, "kotlin/nullability-true/NullProbe.kt"
	, "kotlin/nullability-true/record.json"
	, "kotlin/relocated.json", "kotlin/source-free.json"
	, "report.json", "resources.json", "runtime.json"
]);
const buildPaths = (route, attempt) => [
	`build-${attempt}/MutualCheckedRecords.lean`
	, ...route === "reviewed" ? [`build-${attempt}/api.binding-ir.json`] : []
	, `build-${attempt}/author-inputs.json`
	, `build-${attempt}/lean-bridge.exports.json`
	, `build-${attempt}/model.json`
	, `build-${attempt}/native-jvm.json`
	, `build-${attempt}/package-set-receipt.json`
];

/**
 * Exact retained record paths for one authoring route.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 */
export const mutualCheckedRecordJvmRecordPaths = route => {
	assert.ok(mutualCheckedRecordJvmArchiveRoutes.includes(route));
	return [...basePaths, ...buildPaths(route, 0), ...buildPaths(route, 1)].sort();
};

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const json = async (read, path) => {
	const bytes = Buffer.from(await read(path));
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), path);
	return { bytes, value };
};
const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const normalizedInputs = value => value.map(({ path, mode, sha256: digest }) => ({
	path, mode, sha256: digest
}));

/**
 * Verify both builds, the complete package, six executions and nullability controls.
 *
 * @param read - Reader relative to one archived route's records directory.
 * @param options - Frozen route and producer identity.
 * @param options.route - Ordinary source or reviewed Binding IR.
 * @param options.producerCommit - Exact producer revision.
 */
export const checkMutualCheckedRecordJvmReport = async (
	read, { route, producerCommit = mutualCheckedRecordJvmProducer }
) => {
	assert.ok(mutualCheckedRecordJvmArchiveRoutes.includes(route));
	assert.equal(producerCommit, mutualCheckedRecordJvmProducer);
	const paths = mutualCheckedRecordJvmRecordPaths(route);
	const { bytes: reportBytes, value: report } = await json(read, "report.json");
	exactKeys(report, [
		"activeBranchesCovered", "aliasesPreserved", "authorInputsUnchanged"
		, "builds", "compilerFreeReplay", "constructorFreeResultsCovered"
		, "consumers", "declaredGlibcFloor", "exactExceptionArtifacts"
		, "expectedBindingIrSha256", "immutableCallerAssertions"
		, "independentBuilds", "installation"
		, "javaRecordCycleConstructionRejected", "kotlinNullabilityProved"
		, "loadCeiling", "malformedDepthCycleRecovery", "offlineInstall"
		, "producerCommit", "receipt", "relocatedInstallation"
		, "reproducible", "resourceChecks", "route", "runtime"
		, "schemaVersion", "sourceFreeDeployment"
		, "sourceRemovedBeforeInstallation", "trustedToolchains"
		, "typedRecursiveCarriers"
	], "report keys");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.independentBuilds, 2);
	for(const key of [
		"activeBranchesCovered", "aliasesPreserved", "authorInputsUnchanged"
		, "compilerFreeReplay", "constructorFreeResultsCovered"
		, "exactExceptionArtifacts", "immutableCallerAssertions"
		, "javaRecordCycleConstructionRejected", "kotlinNullabilityProved"
		, "malformedDepthCycleRecovery", "offlineInstall"
		, "relocatedInstallation", "reproducible", "sourceFreeDeployment"
		, "sourceRemovedBeforeInstallation", "typedRecursiveCarriers"
	]) assert.equal(report[key], true, key);
	assert.equal(report.declaredGlibcFloor, "2.36");
	assert.equal(report.loadCeiling, 12);
	assert.equal(report.trustedToolchains
		, "Explicit JDK and Kotlin distributions; their complete contents are not authenticated");

	const runtime = (await json(read, "runtime.json")).value;
	assert.deepEqual(report.runtime, runtime);
	assert.deepEqual(runtime, {
		platform: "linux", arch: "x64"
		, glibc: { code: 0, stderr: "", stdout: "glibc 2.36\n" }
	});
	const configuration = (await json(read, "configuration.json")).value;
	assert.deepEqual(configuration, mutualCheckedRecordJvmConfiguration(route));
	const expected = (await json(read, "expected.binding-ir.json")).value;
	assert.deepEqual(expected, mutualCheckedRecordJvmReview());
	assert.equal(hashBindingIr(expected), report.expectedBindingIrSha256);

	const javaCaller = Buffer.from(await read("consumer.java"));
	assert.deepEqual(javaCaller, mutualCheckedRecordJvmOriginal(
		producerCommit, "tests/fixtures/mutual-checked-record-consumers/java.java"
	));
	const kotlinCaller = Buffer.from(await read("consumer.kt"));
	const kotlinTemplate = mutualCheckedRecordJvmOriginal(
		producerCommit, "tests/fixtures/mutual-checked-record-consumers/kotlin.kt"
	).toString();
	assert.equal((kotlinTemplate.match(/__ROUTE_PARAMETER__/gu) ?? []).length, 2);
	assert.equal(kotlinCaller.toString(), kotlinTemplate.replaceAll(
		"__ROUTE_PARAMETER__", route === "ordinary" ? "arg0" : "value0"
	));

	const handoff = await json(read, "handoff/package-set-receipt.json");
	assert.deepEqual(handoff.value, report.receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, `${sha256(handoff.bytes)}  package-set-receipt.json\n`);
	assert.equal(report.receipt.kind, "lean-bridge-package-set-receipt");
	assert.deepEqual(report.receipt.packages.map(pkg => [
		pkg.target, pkg.ecosystem, pkg.role, pkg.profile, pkg.name, pkg.version
	]), [["maven", "maven", "component", "native-library-v1"
		, "org.leanbridge:mutualcheckedrecords", "1.0.0"]]);
	const pkg = report.receipt.packages[0];
	assert.deepEqual(pkg.artifacts.map(item => item.path), [
		jarPath.replace(/^handoff\//u, ""), pomPath.replace(/^handoff\//u, "")
	]);
	const artifacts = new Map(pkg.artifacts.map(item => [item.path, item]));
	const jar = Buffer.from(await read(jarPath));
	const pom = Buffer.from(await read(pomPath));
	for(const [path, bytes] of [
		[jarPath, jar], [pomPath, pom]
	]) {
		const artifact = artifacts.get(path.replace(/^handoff\//u, ""));
		assert.deepEqual(identity(bytes), {
			bytes: artifact.bytes, sha256: artifact.sha256
		}, path);
	}

	const builds = [];
	let model, compiled;
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		const modelRecord = await json(read, prefix + "model.json");
		const compiledRecord = await json(read, prefix + "native-jvm.json");
		const receipt = await json(read, prefix + "package-set-receipt.json");
		const exports = (await json(
			read, prefix + "lean-bridge.exports.json"
		)).value;
		const inputs = (await json(read, prefix + "author-inputs.json")).value;
		model = modelRecord.value; compiled = compiledRecord.value;
		assert.deepEqual(exports, configuration);
		assert.deepEqual(receipt.value, handoff.value);
		assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(model.pointerBits, 64); assert.equal(model.byteOrder, "little");
		assert.equal(model.exports.length, 6); assert.ok(model.copiedGraph);
		assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
		assert.equal(compiled.profile, "native-library-v1");
		assert.match(compiled.compiler, /^javac 22[. ]/u);
		assert.equal(compiled.kotlin.standardLibraryVersion, "2.2.0");
		if(route === "reviewed")
		{
			const reviewed = await json(read, prefix + "api.binding-ir.json");
			assert.deepEqual(reviewed.value, expected);
			assert.equal(model.sourceIdentity.reviewedBindingIr.source
				, reviewed.bytes.toString());
		}
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const record = report.builds[attempt];
		assert.deepEqual(record, {
			bindingIrSha256: model.bindingIrSha256
			, modelSha256: sha256(modelRecord.bytes)
			, compiledSha256: sha256(compiledRecord.bytes)
			, receiptSha256: sha256(receipt.bytes)
			, archives: Object.fromEntries(pkg.artifacts.map(item => [
				item.path, item.sha256
			]))
		});
		builds.push({
			record, inputs: normalizedInputs(inputs)
			, lean: Buffer.from(await read(prefix + "MutualCheckedRecords.lean"))
		});
	}
	assert.deepEqual(builds[1], builds[0]);
	const inspected = inspectMutualCheckedRecordJvmPackage(jar, {
		pkg, model, compiled, floor: report.declaredGlibcFloor
	});
	const installation = (await json(read, "installation.json")).value;
	assert.deepEqual(report.installation, installation);
	assert.deepEqual(installation, inspected);
	assert.equal(installation.diagnosticSymbolAuthenticated, true);
	assert.deepEqual(installation.aliases.map(alias => [
		alias.name, alias.managedType
	]), [["EnvelopeAlias", "Envelope"]]);

	assert.deepEqual(report.consumers.map(item => item.profile)
		, mutualCheckedRecordJvmProfiles);
	const results = {};
	let executions = 0;
	for(const consumer of report.consumers)
	{
		const { profile, context } = consumer;
		assert.equal(context.profile, profile);
		assert.equal(context.archiveSha256, artifacts.get(
			jarPath.replace(/^handoff\//u, "")
		).sha256);
		assert.deepEqual(context.files["component.jar"], identity(jar));
		assert.deepEqual(context.files[`consumer.${profile === "java" ? "java" : "kt"}`]
			, identity(profile === "java" ? javaCaller : kotlinCaller));
		assert.match(context.interpreterSha256, /^[a-f0-9]{64}$/u);
		assert.match(consumer.javaVersion.stdout, /^openjdk 22\.0\.2 /u);
		assert.equal(consumer.javaVersion.code, 0);
		assert.equal(consumer.javaVersion.stderr, "");
		if(profile === "java") assert.deepEqual(consumer.nullability, []);
		else
		{
			assert.equal(consumer.nullability.length, 2);
			for(const [index, invalid] of [false, true].entries())
			{
				const prefix = `kotlin/nullability-${invalid}/`;
				const record = (await json(read, prefix + "record.json")).value;
				assert.deepEqual(consumer.nullability[index], record);
				assert.equal((await read(prefix + "NullProbe.kt")).toString()
					, record.source);
				for(const [path, expectedOutput] of Object.entries(record.outputs))
					assert.deepEqual(identity(Buffer.from(await read(
						prefix + "classes/" + path
					))), expectedOutput, path);
				checkMutualCheckedRecordKotlinNullProbe(record);
			}
		}
		const stages = ["installed", "relocated", "source-free"];
		assert.deepEqual(consumer.observations.map(item => item.stage), stages);
		for(const [index, stage] of stages.entries())
		{
			const observation = (await json(
				read, `${profile}/${stage}.json`
			)).value;
			assert.deepEqual(consumer.observations[index], observation);
			assert.equal(observation.run.code, 0);
			assert.equal(observation.run.stderr, "");
			const result = parseMutualCheckedRecordJvmResult(
				observation.run.stdout, profile, route
			);
			assert.deepEqual(observation.result, result);
			results[profile] ??= result;
			assert.deepEqual(result, results[profile]);
			if(stage === "source-free")
			{
				assert.equal(observation.sourcesRemoved, true);
				assert.equal(observation.compilerFree, true);
			}
			executions++;
		}
	}
	const resources = (await json(read, "resources.json")).value;
	assert.deepEqual(report.resourceChecks, resources);
	assert.equal(resources.length, 5);
	for(const check of resources)
	{
		exactKeys(check, ["observations", "waits"], "resource check");
		assert.ok(Number.isSafeInteger(check.waits) && check.waits >= 0);
		assert.ok(check.observations.length > 0);
		assert.ok(check.observations.every(item => item.load < report.loadCeiling
			&& item.freeBytes >= 2 * 1024 ** 3
			&& item.availableBytes >= 2 * 1024 ** 3));
	}
	return {
		route, producerCommit, recordPaths: paths
		, reportSha256: sha256(reportBytes), packages: pkg.artifacts
		, runtimeIdentity: pkg.runtimeIdentity
		, bindingIrSha256: installation.receipt.bindingIrSha256
		, layoutSha256: compiled.evidence.copiedGraph.layoutSha256
		, jdkVersion: "22.0.2"
		, kotlinVersion: compiled.kotlin.standardLibraryVersion
		, results, executions, independentBuilds: report.independentBuilds
	};
};
