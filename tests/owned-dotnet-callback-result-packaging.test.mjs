/**
 * Authenticate and install callback-result NuGet packages without producer files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, readFile, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedDotnetEvidence } from "../src/build/owned-dotnet-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectOwnedDotnet } from "../src/build/owned-dotnet-projection.mjs";
import { packageOwnedNuget } from "../src/release/owned-nuget.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { ownedDotnetCallbackInstalledProbe, rejectOwnedDotnetCallbackConsumers
	, checkOwnedDotnetCallbackDocumentation } from "./helpers/owned-dotnet-callback-result-installed.mjs";
import { ownedDotnetRuntimeOnly } from "./helpers/owned-dotnet-installed.mjs";
import { prepareOwnedDotnetCallbackInstalledProcess, runOwnedDotnetCallbackInstalledProcess } from "./helpers/owned-dotnet-callback-result-installed-process.mjs";
import { ownedDotnetBorrowProject } from "./helpers/owned-dotnet-borrow-installed.mjs";
import { rejectOwnedDotnetCallbackContracts } from "./helpers/owned-dotnet-callback-result-authenticity.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`installed NuGet callback-result owners (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_CALLBACK_RESULT_TEST !== "1"
	, timeout: 2400000
}, async t => {
	const authored = combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration;
	const reviewed = combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr;
	const configuration = mode === "ordinary" ? await authored() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { nuget: { name: "Owned.CallbackResults", version: "1.2.3" } };
	const context = await prepareOwnedReceiverCli(t, {
		label: `dotnet-callback-installed-${mode}-${combined}`, configuration
		, reviewedIr: mode === "reviewed" ? reviewed() : null
		, source: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
		, profiles: ["dotnet"]
		, environment: { LEAN_BRIDGE_DOTNET: resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet") }
	});
	const { directory, project, output, handoff, consumer, environment } = context;
	const before = await lakeInputState(project);
	const build = async destination => {
		if(combined) return context.build(destination);
		const runtimeRoot = join(destination, "native/runtime"), nativeRoot = join(destination, "native/component");
		const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		const native = await buildNativeComponent({ projectRoot: project
			, outputRoot: nativeRoot, runtimeRoot, leanPrefix, targets: ["nuget"]
			, ownedGraphs: true, ownedHostCallbacks: false
			, ownedCallbackResultAnchors: true });
		const projection = await projectOwnedDotnet({ working: destination
			, nativeRoot, runtimeRoot, leanPrefix
			, settings: configuration.targets.nuget, environment });
		await writeNativePackageSet({ root: destination, model: native.model
			, runtimeIdentity: native.receipt.runtimeIdentity
			, projections: [projection] });
		context.builds.push({ producerInterface: "native-build-api", projections: [projection] });
		assert.deepEqual(await lakeInputState(project), before); return projection;
	};
	const built = await build(output), projection = built.projections?.find(item => item.ecosystem === "nuget") ?? built;
	assert.equal(projection.backend, "owned-dotnet-v5");
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-dotnet-binding"), dotnetRoot = join(output, "native/dotnet");
	const verified = await ownedDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, receipt, adapter } = verified;
	assert.equal(model.schemaVersion, 11); assert.equal(receipt.schemaVersion, 7);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const key of ["hostCallbacks", "resultAnchors", "receiverExports", "inputTransfers"])
		assert.equal(Boolean(model.ownedGraph[key]), combined, key);
	if(!combined) await assert.rejects(access(join(nativeRoot, "callbacks.c")), { code: "ENOENT" });
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(adapter.schemaVersion, 5); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.equal(adapter.dotnetValues.schemaVersion, 5);
	const compiled = await json(join(dotnetRoot, "native-dotnet.json")); assert.equal(compiled.schemaVersion, 5);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: combined
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined, ownedCallbackResultAnchors: true };
	const incapable = ["ownedCallbackResultAnchors", ...combined ? ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"] : []];
	for(const key of incapable)
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...capabilities, [key]: false }));
	const packageOptions = { nativeRoot, runtimeRoot, adapterRoot, dotnetRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.nuget
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const original = await readFile(join(output, "archives", projection.packages[0].archive));
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedNuget({ ...packageOptions, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", projection.packages[0].archive)), original);
	await rm(reassembled, { recursive: true });
	const independent = join(directory, "independent"), second = await build(independent);
	const secondProjection = second.projections?.find(item => item.ecosystem === "nuget") ?? second;
	assert.deepEqual(secondProjection.packages, projection.packages);
	assert.deepEqual(await readFile(join(independent, "archives", projection.packages[0].archive)), original);
	await rm(independent, { recursive: true });
	const rejected = await rejectOwnedDotnetCallbackContracts({ adapter, compiled, packageOptions, directory });
	const apiPath = `src/${verified.projection.assembly}/Api.cs`;
	const originalApi = await readFile(join(dotnetRoot, apiPath));
	const changedApi = Buffer.concat([originalApi, Buffer.from("\n// changed callback ownership API\n")]);
	const forgedManaged = structuredClone(compiled);
	forgedManaged.files[apiPath] = { bytes: changedApi.length, sha256: sha256(changedApi) };
	await saveLakeFile(dotnetRoot, apiPath, changedApi);
	await saveLakeFile(dotnetRoot, "native-dotnet.json", canonicalJson(forgedManaged));
	try
	{ await assert.rejects(packageOwnedNuget({ ...packageOptions, working: join(directory, "forged-managed") }), /Generated owned C# source differs/u); }
	finally
	{ await saveLakeFile(dotnetRoot, apiPath, originalApi); await saveLakeFile(dotnetRoot, "native-dotnet.json", canonicalJson(compiled)); }
	rejected.push("managed-source");
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	const verification = await context.removeAuthor();
	const pkg = handoffReceipt.packages.find(item => item.target === "nuget");
	await cp(join(handoff, pkg.artifacts[0].path), join(consumer, "feed", `${pkg.name}.${pkg.version}.nupkg`), { recursive: true });
	const source = await ownedDotnetCallbackInstalledProbe(combined);
	await saveLakeFile(consumer, "Program.cs", source);
	await saveLakeFile(consumer, "Consumer.csproj", ownedDotnetBorrowProject(pkg, "Program.cs"));
	await saveLakeFile(consumer, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const command = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command)
		, DOTNET_CLI_HOME: join(consumer, "home")
		, NUGET_PACKAGES: join(consumer, "packages")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await runCopied(command, ["restore", "Consumer.csproj", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "Consumer.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
	const installed = join(consumer, "packages", pkg.name.toLowerCase(), pkg.version);
	const manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.kind, "lean-bridge-owned-nuget-package");
	assert.deepEqual(manifest.ownedValues, verified.projection.contract);
	const installedFiles = Object.fromEntries(Object.entries(manifest.files)
		.filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path)));
	await verifyNativeFiles(installed, installedFiles);
	const result = await runCopied(command, ["out/Consumer.dll"], consumer, env);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.equal(observation.safePublicApi, true); assert.ok(observation.checks > 20);
	const consumerOptions = { consumer, pkg, command, env
		, model: verified.projection, hostCallbacks: combined };
	const invalidConsumers = await rejectOwnedDotnetCallbackConsumers(consumerOptions);
	const documentation = await checkOwnedDotnetCallbackDocumentation(consumerOptions);
	const installedProcess = await prepareOwnedDotnetCallbackInstalledProcess({ ...consumerOptions, combined });
	const library = join(consumer, "out/runtimes/linux-x64/native", adapter.library);
	const libraryBytes = await readFile(library), corrupt = Buffer.from(libraryBytes); corrupt[0] ^= 1;
	await saveLakeFile(dirname(library), adapter.library, corrupt);
	await assert.rejects(runCopied(command, ["out/Consumer.dll"], consumer, env), error => /differs from the compiled package/u.test(error.details?.stderr));
	await saveLakeFile(dirname(library), adapter.library, libraryBytes);
	await rename(library, `${library}.original`); await symlink(`${library}.original`, library);
	await assert.rejects(runCopied(command, ["out/Consumer.dll"], consumer, env), error => /must be a regular file/u.test(error.details?.stderr));
	await rm(library); await rename(`${library}.original`, library);
	for(const path of [handoff, join(consumer, "feed"), join(consumer, "packages"), join(consumer, "obj")])
	{ await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" }); }
	await rename(join(consumer, "out"), join(consumer, "relocated"));
	await rename(join(consumer, "examples"), join(consumer, "relocated-examples"));
	await rename(join(consumer, "process"), join(consumer, "relocated-process"));
	for(const name of ["Program.cs", "Consumer.csproj", "NuGet.Config", "Invalid.cs", "Invalid.csproj", "Example.cs", "Example.csproj", "Process.cs", "Process.csproj", "process-fork.c"])
	{ await rm(join(consumer, name)); await assert.rejects(access(join(consumer, name)), { code: "ENOENT" }); }
	const runtime = await ownedDotnetRuntimeOnly(join(directory, "runtime-only"), command);
	const moved = await runCopied(runtime.executable, ["relocated/Consumer.dll"], consumer, runtime.env);
	assert.deepEqual(moved, result);
	const relocatedProcess = await runOwnedDotnetCallbackInstalledProcess({
		consumer, command: runtime.executable, env: runtime.env, combined
		, output: "relocated-process" });
	assert.deepEqual(relocatedProcess, installedProcess.observations);
	const relocatedDocumentation = [];
	for(const { name, sourceSha256, ...expected } of documentation.observed)
	{
		const actual = await runCopied(runtime.executable, [`relocated-examples/${name}/Example.dll`], consumer, runtime.env);
		assert.deepEqual(actual, expected);
		relocatedDocumentation.push({ name, sourceSha256, ...actual });
	}
	await saveLakeFile("build/owned-dotnet-callback-results", `${mode}-${combined ? "combined" : "no-host"}-package.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, combined, compiledLean: true
		, installedPackage: true, installedNuget: true, sourceUnchanged: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemoved: true, packageCacheRemoved: true, sdkFreeExecution: true
		, consumerSourceRemoved: true, deterministicReassembly: true
		, independentProducerBuild: true, cli: context.cli
		, cliInstallation: context.cliInstallation, cliBuilds: context.builds
		, cliVerification: verification, safePublicApi: true
		, tamperRejected: rejected, incapableReadersRejected: incapable
		, loaderRejected: ["changed-library", "symlink-library"]
		, consumerSha256: sha256(source), observation
		, invalidConsumers, documentation, relocatedDocumentation
		, installedProcess, relocatedProcess
		, relocatedObservation: JSON.parse(moved.stdout), manifest
		, input: { metadata, sourceIdentity: model.sourceIdentity, component: model.component }
		, componentReceipt: receipt, adapterReceipt: adapter
		, compiledProjection: compiled
		, runtimeReceipt: verified.runtime, packageSetReceipt: handoffReceipt
	}));
	t.diagnostic(`${mode}: ${observation.checks}+${observation.checks} installed and relocated checks`);
});
