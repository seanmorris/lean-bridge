/**
 * Independently reconcile original C# packages and all three execution stages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexDotnetCaller, checkedRecordValueIndexDotnetCounts
	, checkedRecordValueIndexDotnetRoutes, checkedRecordValueIndexDotnetSelection
	, parseCheckedRecordValueIndexDotnetResult
} from "./checked-record-value-index-dotnet-fixture.mjs";
import {
	checkedRecordValueIndexModule
} from "./checked-record-value-index-browser-fixture.mjs";
import { checkedRecordValueIndexDotnetOriginal } from "./checked-record-value-index-dotnet-generators.mjs";
import { checkCheckedRecordValueIndexDotnetModels } from "./checked-record-value-index-dotnet-model-records.mjs";
import { checkCheckedRecordValueIndexDotnetPackage } from "./checked-record-value-index-dotnet-package-records.mjs";
import { checkCheckedRecordValueIndexDotnetEnvironment, checkedRecordValueIndexDotnetRestoreFiles, checkedRecordValueIndexDotnetCacheRecords } from "./checked-record-value-index-dotnet-environment-records.mjs";
import { checkCheckedRecordValueIndexDotnetToolsRecord, checkCheckedRecordValueIndexDotnetFrameworkRecord } from "./checked-record-value-index-dotnet-runtime-records.mjs";
import { checkCheckedRecordValueIndexDotnetProbeRecords } from "./checked-record-value-index-dotnet-probe-records.mjs";
import { checkedRecordValueIndexDotnetAssembly } from "./checked-record-value-index-dotnet-package.mjs";
import {
	checkedRecordValueIndexDotnetHandoffRecords
} from "./checked-record-value-index-dotnet-ci-handoff.mjs";

/**
 * Enumerate the exact original records required by one installed selection.
 *
 * @param route - Independently selected author route.
 * @param nuget - Authenticated package record.
 * @param context - Authenticated installation record.
 */
export const checkedRecordValueIndexDotnetRecords = (route, nuget, context) => {
	assert.ok(checkedRecordValueIndexDotnetRoutes.includes(route));
	const selection = checkedRecordValueIndexDotnetSelection(route);
	const mode = selection.resultOnly ? "result-only" : "full";
	return ["report.json", "runtime.json", "toolchain.json", "resources.json"
		, "expected.binding-ir.json", "configuration.json", "consumer.cs"
		, "nuget.json", "installation.json"
		, "installed.json", "relocated.json", "source-free.json"
		, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json"
			, "author-inputs.json", `${checkedRecordValueIndexModule}.lean`
			, "lean-bridge.exports.json"
			, ...selection.reviewed ? ["api.binding-ir.json"] : []]
			.map(path => `build-${index}/${path}`))
		, ...nuget.retained.map(path => `package/${path}`)
		, ...["consumer.cs", "Consumer.csproj", "NuGet.Config", "global.json"
			, ...checkedRecordValueIndexDotnetRestoreFiles.map(path => `obj/${path}`)
			, ...checkedRecordValueIndexDotnetCacheRecords.map(path => `cache/${path}`)
			, ...Object.keys(context.outputs).filter(path => !path.startsWith("runtimes/")
				&& path !== `${checkedRecordValueIndexDotnetAssembly}.dll`).map(path => `out/${path}`)]
			.map(path => `consumer-environment/${path}`)
		, ...["record.json", "errors.sarif", "processes.json"
			, "inputs/Probe.csproj", "inputs/probe.cs"
			, "inputs/NuGet.Config", "inputs/global.json"
			, `inputs/library/${checkedRecordValueIndexDotnetAssembly}.dll`
			, ...mode === "full" ? ["out/Probe.dll"] : []]
			.map(path => `api-probe/${path}`)
		, ...checkedRecordValueIndexDotnetHandoffRecords
	].sort();
};

/**
 * Reconcile frozen sources, per-site constructors, installation and complete results.
 *
 * @param read - Relative retained-record reader, never historical absolute paths.
 * @param options - Independent selection and observed platform/toolchain pins.
 * @param options.route - Exact ordinary/reviewed and full/result-only route.
 * @param options.producerCommit - Full immutable original revision.
 * @param options.consumerCommit - Full immutable caller revision.
 * @param options.runtime - Original observed platform, architecture and glibc.
 * @param options.floor - Explicit package glibc floor.
 * @param options.toolchain - Independently pinned actual host and SDK.
 * @param options.framework - Independently pinned actual framework facts and binary identities.
 * @param options.archiveSha512 - Derived from the verified original NuGet archive.
 */
export const checkCheckedRecordValueIndexDotnetReport = async (read, {
	route, producerCommit, consumerCommit, runtime, floor, toolchain, framework
	, archiveSha512
}) => {
	assert.ok(checkedRecordValueIndexDotnetRoutes.includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.match(consumerCommit, /^[a-f0-9]{40}$/u);
	const selection = checkedRecordValueIndexDotnetSelection(route);
	const mode = selection.resultOnly ? "result-only" : "full";
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
	assert.deepEqual(Object.keys(report).sort(), [
		"apiProbe", "authorInputsUnchanged"
		, "builds", "compilerFreeReplay", "consumerCommit"
		, "declaredGlibcFloor", "dispatch"
		, "expectedBindingIrSha256", "independentBuilds", "installation"
		, "installerCommandLogs", "mode", "observations"
		, "offlineInstall", "producerCommit", "receipt"
		, "relocatedInstallation", "reproducible"
		, "resourceChecks", "route", "runtime", "schemaVersion"
		, "sourceFreeDeployment", "sourceRemovedBeforeInstallation"
		, "tools", "trustedToolchains"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.producerCommit, producerCommit);
	assert.equal(report.consumerCommit, consumerCommit);
	assert.equal(report.route, route); assert.equal(report.mode, mode);
	assert.equal(report.declaredGlibcFloor, floor); assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay"
		, "relocatedInstallation", "sourceFreeDeployment"])
		assert.equal(report[key], true, key);
	assert.deepEqual(report.dispatch, { observed: false
		, reason: "No C# constructor/source entry counters in this installed acceptance" });
	assert.equal(report.trustedToolchains, "Explicit .NET SDK and shared framework; their complete contents are not authenticated");
	assert.equal(report.installerCommandLogs, "Closed installer retains input/build-input/output identities, not restore/build stdout");
	const runtimeRecord = { platform: runtime.platform, arch: runtime.arch
		, glibc: { code: 0, stdout: `glibc ${runtime.glibc}\n`, stderr: "" } };
	assert.deepEqual(report.runtime, runtimeRecord, "Independent runtime record");
	assert.deepEqual(await json("runtime.json"), runtimeRecord
		, "Retained runtime record");
	assert.equal(report.resourceChecks.length, 4);
	assert.deepEqual(await json("resources.json"), report.resourceChecks);
	for(const check of report.resourceChecks)
	{
		assert.deepEqual(Object.keys(check).sort(), ["maxLoad", "observations", "waits"]);
		assert.ok([6, 8, 10, 12].includes(check.maxLoad));
		assert.ok(Number.isSafeInteger(check.waits) && check.waits >= 0 && check.waits <= 20);
		assert.equal(check.observations.length, check.waits + 1);
		for(const [index, sample] of check.observations.entries())
		{
			assert.deepEqual(Object.keys(sample).sort(), ["availableBytes", "freeBytes", "load"]);
			for(const key of ["availableBytes", "freeBytes"])
				assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 2 * 1024 ** 3);
			assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
			assert.equal(sample.load < check.maxLoad, index === check.waits);
		}
	}
	const tools = await json("toolchain.json");
	assert.deepEqual(report.tools, tools);
	const { model, receipt } = await checkCheckedRecordValueIndexDotnetModels({
		report, read, json, route, producerCommit
	});
	const { nuget, packageReceipt, generatorPaths } = await checkCheckedRecordValueIndexDotnetPackage({
		read, json, model, receipt, floor, producerCommit, sdk: toolchain.sdk.version
	});
	assert.deepEqual(report.installation, nuget);
	const caller = await checkedRecordValueIndexDotnetCaller(
		route, path => checkedRecordValueIndexDotnetOriginal(consumerCommit, path)
	);
	assert.equal((await read("consumer.cs")).toString(), caller
		, "Installed C# caller source");
	const { context, root, closure } = await checkCheckedRecordValueIndexDotnetEnvironment({
		read, json, nuget, packageReceipt, tools, archiveSha512, caller
	});
	checkCheckedRecordValueIndexDotnetToolsRecord(tools, toolchain, root);
	await checkCheckedRecordValueIndexDotnetProbeRecords({
		read, json, mode, root, tools
		, assembly: packageReceipt.files[`lib/net8.0/${checkedRecordValueIndexDotnetAssembly}.dll`]
		, report: report.apiProbe });
	assert.equal(report.observations.length, 3);
	for(const [index, stage] of ["installed", "relocated", "source-free"].entries())
	{
		const observation = await json(`${stage}.json`);
		assert.deepEqual(observation, report.observations[index]);
		assert.deepEqual(Object.keys(observation).sort(), ["closure", "counts"
			, "cwd", "framework", "run", "stage"
			, ...index === 2 ? ["sourcesRemoved"] : []].sort());
		assert.equal(observation.stage, stage);
		assert.equal(observation.cwd, index === 2
			? posix.join(posix.dirname(root), "source-free") : root + (index ? "-relocated" : ""));
		if(index === 2)
		{
			assert.equal(observation.sourcesRemoved, true);
			assert.deepEqual(observation.closure, { deployedFilesSha256: closure.deployedFilesSha256 });
		}
		else assert.deepEqual(observation.closure, closure);
		assert.deepEqual(observation.counts
			, checkedRecordValueIndexDotnetCounts[mode]
			, `${stage} value-index counts`);
		assert.deepEqual(Object.keys(observation.run).sort(), ["code", "stderr", "stdout"]);
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		parseCheckedRecordValueIndexDotnetResult(observation.run.stdout, route);
		checkCheckedRecordValueIndexDotnetFrameworkRecord(observation.framework, {
			tools, pinned: framework, cwd: observation.cwd, sourceFree: index === 2
		});
	}
	return { route, mode, producerCommit, consumerCommit, runtime, floor
		, toolchain, framework
		, archiveSha512, counts: checkedRecordValueIndexDotnetCounts[mode]
		, executions: 3
		, dispatchObserved: false, generatorModules: generatorPaths.length
		, records: checkedRecordValueIndexDotnetRecords(
			route, nuget, context).length };
};
