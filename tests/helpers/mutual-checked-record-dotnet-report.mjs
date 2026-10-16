/**
 * Reconcile one original recursive checked-record NuGet acceptance record.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import {
	mutualCheckedRecordDotnetConfiguration
	, parseMutualCheckedRecordDotnetResult
} from "./mutual-checked-record-dotnet-fixture.mjs";
import {
	mutualCheckedRecordDotnetProducer, mutualCheckedRecordDotnetRoutes
} from "./mutual-checked-record-dotnet-provenance.mjs";

const archivePath = "handoff/archives/Mutualcheckedrecords.Api.1.0.0.nupkg";
const generatedPaths = Object.freeze([
	"binding-manifest.json"
	, "src/LeanBridge.Mutualcheckedrecords/Api.cs"
	, "src/LeanBridge.Mutualcheckedrecords/Calls.cs"
	, "src/LeanBridge.Mutualcheckedrecords/LeanBridge.Mutualcheckedrecords.csproj"
	, "src/LeanBridge.Mutualcheckedrecords/Runtime.cs"
]);
const basePaths = Object.freeze([
	"configuration.json", "consumer.cs", "expected.binding-ir.json"
	, archivePath, "handoff/package-set-receipt.json"
	, "handoff/package-set-receipt.json.sha256", "installed.json"
	, ...generatedPaths.map(path => `package-sources/${path}`)
	, "package-verification.json", "relocated.json", "report.json"
	, "resources.json", "source-free.json", "toolchain.json"
]);
const buildPaths = (route, attempt) => [
	`build-${attempt}/MutualCheckedRecords.lean`
	, ...route === "reviewed" ? [`build-${attempt}/api.binding-ir.json`] : []
	, `build-${attempt}/author-inputs.json`
	, `build-${attempt}/lean-bridge.exports.json`
	, `build-${attempt}/model.json`
	, `build-${attempt}/package-set-receipt.json`
];
/**
 * Exact retained record paths for one authoring route.
 *
 * @param route - Ordinary source or independently reviewed Binding IR.
 */
export const mutualCheckedRecordDotnetRecordPaths = route => {
	assert.ok(mutualCheckedRecordDotnetRoutes.includes(route));
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
 * Verify the two builds, original package, three executions and exact failures.
 *
 * @param read - Reader relative to one archived route's records directory.
 * @param options - Frozen route and producer identity.
 * @param options.route - Ordinary source or reviewed Binding IR.
 * @param options.producerCommit - Exact producer revision.
 */
export const checkMutualCheckedRecordDotnetReport = async (
	read, { route, producerCommit = mutualCheckedRecordDotnetProducer }
) => {
	assert.ok(mutualCheckedRecordDotnetRoutes.includes(route));
	assert.equal(producerCommit, mutualCheckedRecordDotnetProducer);
	const paths = mutualCheckedRecordDotnetRecordPaths(route);
	const { bytes: reportBytes, value: report } = await json(read, "report.json");
	exactKeys(report, [
		"activeBranchesCovered", "aliasesPreserved", "authorInputsUnchanged"
		, "builds", "compilerFreeReplay", "constructorFreeResultsCovered"
		, "declaredGlibcFloor", "exactExceptionArtifacts"
		, "expectedBindingIrSha256", "immutableCallerAssertions"
		, "independentBuilds", "installation", "malformedDepthCycleRecovery"
		, "observations", "offlineInstall", "producerCommit", "receipt"
		, "relocatedInstallation", "reproducible", "resourceChecks", "route"
		, "schemaVersion", "sourceFreeDeployment", "sourceRemovedBeforeInstallation"
		, "tools", "trustedToolchains", "typedRecursiveCarriers"
	], "report keys");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.independentBuilds, 2);
	for(const key of [
		"activeBranchesCovered", "aliasesPreserved", "authorInputsUnchanged"
		, "compilerFreeReplay", "constructorFreeResultsCovered"
		, "exactExceptionArtifacts", "immutableCallerAssertions"
		, "malformedDepthCycleRecovery", "offlineInstall"
		, "relocatedInstallation", "reproducible", "sourceFreeDeployment"
		, "sourceRemovedBeforeInstallation", "typedRecursiveCarriers"
	]) assert.equal(report[key], true, key);
	assert.equal(report.declaredGlibcFloor, "2.38");
	assert.equal(report.trustedToolchains
		, "Explicit .NET SDK and shared framework; their complete contents are not authenticated");

	const configuration = (await json(read, "configuration.json")).value;
	assert.deepEqual(configuration, mutualCheckedRecordDotnetConfiguration(route));
	const expected = (await json(read, "expected.binding-ir.json")).value;
	assert.equal(hashBindingIr(expected), report.expectedBindingIrSha256);
	const caller = Buffer.from(await read("consumer.cs"));
	assert.ok(caller.length > 10_000);
	assert.match(caller.toString(), /static Envelope Envelope\(/u);
	assert.match(caller.toString(), /Cyclic copied input/u);

	const handoff = await json(read, "handoff/package-set-receipt.json");
	assert.deepEqual(handoff.value, report.receipt);
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString()
		, `${sha256(handoff.bytes)}  package-set-receipt.json\n`);
	assert.equal(report.receipt.kind, "lean-bridge-package-set-receipt");
	assert.deepEqual(report.receipt.packages.map(pkg => [
		pkg.target, pkg.ecosystem, pkg.role, pkg.profile, pkg.name, pkg.version
	]), [["nuget", "nuget", "component", "native-library-v1"
		, "Mutualcheckedrecords.Api", "1.0.0"]]);
	const pkg = report.receipt.packages[0], artifact = pkg.artifacts[0];
	assert.equal(artifact.path, archivePath.replace(/^handoff\//u, ""));
	const archive = Buffer.from(await read(archivePath));
	assert.deepEqual(identity(archive), {
		bytes: artifact.bytes, sha256: artifact.sha256
	});

	const buildRecords = [];
	for(const attempt of [0, 1])
	{
		const prefix = `build-${attempt}/`;
		const model = await json(read, prefix + "model.json");
		const receipt = await json(read, prefix + "package-set-receipt.json");
		const exports = (await json(read, prefix + "lean-bridge.exports.json")).value;
		const inputs = (await json(read, prefix + "author-inputs.json")).value;
		assert.deepEqual(exports, configuration);
		assert.deepEqual(receipt.value, handoff.value);
		assert.equal(model.value.schemaVersion, route === "reviewed" ? 5 : 4);
		assert.equal(reviewedContractDifference(expected, model.value.bindingIr), null);
		assert.equal(model.value.bindingIrSha256, hashBindingIr(model.value.bindingIr));
		assert.equal(model.value.pointerBits, 64);
		assert.ok(model.value.copiedGraph);
		if(route === "reviewed")
		{
			const reviewed = await json(read, prefix + "api.binding-ir.json");
			assert.deepEqual(reviewed.value, expected);
			assert.equal(model.value.sourceIdentity.reviewedBindingIr.source
				, reviewed.bytes.toString());
		}
		else assert.equal(model.value.sourceIdentity.reviewedBindingIr, undefined);
		const record = report.builds[attempt];
		assert.deepEqual(record, {
			bindingIrSha256: model.value.bindingIrSha256
			, modelSha256: sha256(model.bytes)
			, receiptSha256: sha256(receipt.bytes)
			, archives: { [artifact.path]: artifact.sha256 }
		});
		buildRecords.push({ record, inputs: normalizedInputs(inputs)
			, lean: Buffer.from(await read(prefix + "MutualCheckedRecords.lean")) });
	}
	assert.deepEqual(buildRecords[1].record, buildRecords[0].record);
	assert.deepEqual(buildRecords[1].inputs, buildRecords[0].inputs);
	assert.deepEqual(buildRecords[1].lean, buildRecords[0].lean);

	const verification = (await json(read, "package-verification.json")).value;
	assert.equal(verification.archive.path, artifact.path);
	assert.deepEqual(verification.archive, artifact);
	assert.equal(verification.bindingIrSha256
		, buildRecords[0].record.bindingIrSha256);
	assert.equal(verification.diagnosticSymbolAuthenticated, true);
	assert.deepEqual(verification.aliases.map(alias => [alias.name, alias.managedType])
		, [["EnvelopeAlias", "Envelope"]]);
	assert.deepEqual(report.installation, verification);
	for(const path of generatedPaths)
	{
		const bytes = Buffer.from(await read(`package-sources/${path}`));
		assert.deepEqual(identity(bytes), verification.generatedFiles[path], path);
	}
	const manifest = JSON.parse(await read("package-sources/binding-manifest.json"));
	assert.equal(manifest.bindingIrSha256, verification.bindingIrSha256);
	assert.equal(manifest.copiedGraph.layoutSha256, verification.layoutSha256);
	assert.ok(manifest.supportedFeatures.includes("checked-refinement-diagnostics"));
	assert.match((await read(
		"package-sources/src/LeanBridge.Mutualcheckedrecords/Calls.cs"
	)).toString(), /mutualcheckedrecords_graph_error/u);

	const stages = ["installed", "relocated", "source-free"];
	assert.deepEqual(report.observations.map(item => item.stage), stages);
	let accepted;
	for(const [index, stage] of stages.entries())
	{
		const observation = (await json(read, `${stage}.json`)).value;
		assert.deepEqual(report.observations[index], observation);
		assert.deepEqual(observation.run, {
			code: 0, stderr: "", stdout: observation.run.stdout
		});
		const result = parseMutualCheckedRecordDotnetResult(observation.run.stdout);
		assert.deepEqual(observation.result, result);
		accepted ??= result; assert.deepEqual(result, accepted);
		assert.equal(observation.framework.facts.architecture, "X64");
		assert.equal(observation.framework.facts.version, "8.0.30");
		assert.equal(observation.framework.facts.littleEndian, true);
		for(const file of Object.values(observation.framework.runtimeFiles))
		{
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
			assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		}
		if(stage === "source-free")
		{
			assert.equal(observation.sourcesRemoved, true);
			assert.equal(observation.sdkNotPresentInDeployment, true);
		}
	}
	for(const item of report.observations.slice(1))
	{
		assert.deepEqual(item.framework.facts, report.observations[0].framework.facts);
		assert.deepEqual(item.framework.runtimeFiles
			, report.observations[0].framework.runtimeFiles);
	}
	const resources = (await json(read, "resources.json")).value;
	assert.deepEqual(report.resourceChecks, resources); assert.equal(resources.length, 4);
	for(const check of resources)
	{
		assert.equal(check.maxLoad, 12); assert.equal(check.waits, 0);
		assert.ok(check.observations.length > 0);
		assert.ok(check.observations.every(item => item.load < 12
			&& item.freeBytes >= 2 * 1024 ** 3
			&& item.availableBytes >= 2 * 1024 ** 3));
	}
	const tools = (await json(read, "toolchain.json")).value;
	assert.deepEqual(report.tools, tools); assert.equal(tools.sdk.version, "8.0.424");
	assert.ok(Number.isSafeInteger(tools.interpreter.bytes)
		&& tools.interpreter.bytes > 0);
	assert.match(tools.interpreter.sha256, /^[a-f0-9]{64}$/u);
	assert.equal(tools.measurements.length, 3);
	assert.ok(tools.measurements.every(item => item.run.code === 0
		&& item.run.stderr === ""));
	return {
		route, producerCommit, recordPaths: paths, reportSha256: sha256(reportBytes)
		, package: artifact, runtimeIdentity: pkg.runtimeIdentity
		, bindingIrSha256: verification.bindingIrSha256
		, layoutSha256: verification.layoutSha256
		, sdkVersion: tools.sdk.version
		, frameworkVersion: report.observations[0].framework.facts.version
		, result: accepted, executions: report.observations.length
		, independentBuilds: report.independentBuilds
	};
};
