/**
 * Install generated NuGet packages offline and call only their safe public API.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedDotnetEvidence } from "../src/build/owned-dotnet-artifacts.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedNuget } from "../src/release/owned-nuget.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedDotnetRuntimeOnly, rejectOwnedDotnetConsumers, checkOwnedDotnetDocumentation } from "./helpers/owned-dotnet-installed.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

for(const scalar of [false, true]) for(const mode of ["ordinary", "reviewed"]) test(`installed C# owned ${scalar ? "scalars" : "compositions and callbacks"} preserve semantics (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-dotnet-nuget-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve(`tests/fixtures/onboarding/${scalar ? "owned-scalars" : "owned-dotnet-callables"}`), project, { recursive: true });
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { nuget: { name: "Owned.Values", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed")
	{
		const ir = scalar ? ownedPythonScalarsReviewedIr() : ownedDotnetCallbacksReviewedIr();
		if(scalar) ir.component = { ...ir.component, id: "owned-scalars@1.0.0", name: "owned-scalars", version: "1.0.0" };
		await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ir));
	}
	const before = await lakeInputState(project), environment = nativeFixtureEnvironment(["dotnet"]);
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output
		, targets: ["nuget"], environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(project), before);
	assert.equal(built.backend, "owned-dotnet-v1");
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-dotnet-binding"), dotnetRoot = join(output, "native/dotnet");
	const verified = await ownedDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(verified.model.exports.length, scalar ? 8 : 51);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const options = { nativeRoot, runtimeRoot, adapterRoot, dotnetRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.nuget
		, glibcMinimumVersion: built.glibcMinimumVersion };
	const compiled = await json(join(dotnetRoot, "native-dotnet.json"));
	const mutations = ["lifetime", "source", "guard", "gmp-receipt", "gmp-source", "library", "unrecorded"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "lifetime") forged.dotnetValues.guardSha256 = "0".repeat(64);
		else
		{
			path = ({ source: `src/${verified.prefix}-dotnet.c`
				, guard: `src/${verified.prefix}-dotnet-thread-exit.cpp`
				, "gmp-receipt": "gmp/share/lean-bridge/gmp.json"
				, "gmp-source": "gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, library: `lib/${verified.adapter.library}`
				, unrecorded: "unexpected.txt" })[mutation];
			original = mutation === "unrecorded" ? null : await readFile(join(adapterRoot, path));
			const changed = mutation === "gmp-receipt" ? Buffer.from(canonicalJson({ ...JSON.parse(original), binding: "global-symbols" }))
				: Buffer.concat([original ?? Buffer.alloc(0), Buffer.from("\n/* changed projection */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			if(!["library", "unrecorded"].includes(mutation)) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		await saveLakeFile(adapterRoot, "native-dotnet-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedNuget({ ...options, working: join(directory, `forged-${mutation}`) }));
		if(path)
		{
			if(original) await saveLakeFile(adapterRoot, path, original);
			else await rm(join(adapterRoot, path));
		}
		await saveLakeFile(adapterRoot, "native-dotnet-adapter.json", canonicalJson(verified.adapter));
	}
	const apiPath = `src/${verified.projection.assembly}/Api.cs`;
	const originalApi = await readFile(join(dotnetRoot, apiPath));
	const changedApi = Buffer.concat([originalApi, Buffer.from("\n// unapproved API change\n")]);
	const forgedManaged = structuredClone(compiled);
	forgedManaged.files[apiPath] = { bytes: changedApi.length, sha256: sha256(changedApi) };
	await saveLakeFile(dotnetRoot, apiPath, changedApi);
	await saveLakeFile(dotnetRoot, "native-dotnet.json", canonicalJson(forgedManaged));
	await assert.rejects(packageOwnedNuget({ ...options, working: join(directory, "forged-managed") }), /Generated owned C# source differs/u);
	await saveLakeFile(dotnetRoot, apiPath, originalApi);
	await saveLakeFile(dotnetRoot, "native-dotnet.json", canonicalJson(compiled));
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedNuget({ ...options, working: reassembled });
	assert.deepEqual(rebuilt.packages, built.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", built.packages[0].archive)));
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await rm(reassembled, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const pkg = receipt.packages.find(item => item.target === "nuget");
	await cp(join(handoff, pkg.artifacts[0].path), join(consumer, "feed", `${pkg.name}.${pkg.version}.nupkg`), { recursive: true });
	const originalProbe = await readFile(`tests/fixtures/structured-types/${scalar ? "owned-installed-dotnet-scalars.cs" : "owned-dotnet-callback-signatures.cs"}`, "utf8");
	const marker = "    private static unsafe void Main(string[] args)";
	if(!scalar) assert.equal(originalProbe.split(marker).length, 2);
	// Run the same authored signature assertions through the installed public
	// API. The native-probe setup is removed, and the consumer forbids unsafe C#.
	const source = scalar ? originalProbe : originalProbe.slice(0, originalProbe.indexOf(marker))
		.replace("using LeanBridge.OwnedAggregates.Interop;\n", "") + `    private static void Main()
    {
        Exception? failure = null;
        var thread = new Thread(() => {
            try { for (int i = 0; i < 3; i++) { calls = 0; Primitives(); HigherOrder(); checks += InstalledCompositions.Run(); } }
            catch (Exception error) { failure = error; }
        });
        thread.Start(); thread.Join();
        if (failure is not null) throw new Exception("Installed C# API failed", failure);
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, calls, primitives = 19, safePublicApi = true }));
    }
}
`;
	assert.doesNotMatch(source, /\bunsafe\b|\bNativeLibrary\b|OwnedLoader|\.Interop;/u);
	await saveLakeFile(consumer, "Program.cs", source);
	const extra = scalar ? "" : await readFile("tests/fixtures/structured-types/owned-installed-dotnet.cs", "utf8");
	assert.doesNotMatch(extra, /\bunsafe\b|\bNativeLibrary\b|OwnedLoader|\.Interop;/u);
	await saveLakeFile(consumer, "Compositions.cs", extra);
	await saveLakeFile(consumer, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>false</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Program.cs"/><Compile Include="Compositions.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`);
	await saveLakeFile(consumer, "NuGet.Config", '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const command = environment.LEAN_BRIDGE_DOTNET;
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command)
		, DOTNET_CLI_HOME: join(consumer, "home")
		, NUGET_PACKAGES: join(consumer, "packages")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await runCopied(command, ["restore", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], consumer, env);
	const installed = join(consumer, "packages", pkg.name.toLowerCase(), pkg.version);
	const manifest = await json(join(installed, "lean-bridge/package-receipt.json"));
	assert.equal(manifest.kind, "lean-bridge-owned-nuget-package");
	// NuGet removes OPC envelopes and normalizes the nuspec filename. The
	// handoff verification checks those archive bytes; verify deployed payloads
	// here, as in the existing copied and recursive NuGet installation gates.
	const installedFiles = Object.fromEntries(Object.entries(manifest.files)
		.filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path)));
	await verifyNativeFiles(installed, installedFiles);
	assert.ok(Object.keys(manifest.files).some(path => path.endsWith("sources/gmp-6.3.0.tar.xz")));
	const result = await runCopied(command, ["out/Consumer.dll"], consumer, env);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.equal(observation.safePublicApi, true); assert.equal(observation.primitives, 19);
	if(!scalar) assert.equal(observation.calls, 20);
	assert.ok(observation.checks >= (scalar ? 250 : 500));
	const rejectedConsumers = await rejectOwnedDotnetConsumers({ consumer, pkg, scalar, namespace: verified.projection.namespace, command, env });
	const documentation = scalar ? null : await checkOwnedDotnetDocumentation({ consumer, pkg, command, env });
	await rm(handoff, { recursive: true, force: true });
	await rm(join(consumer, "feed"), { recursive: true, force: true });
	await rm(join(consumer, "packages"), { recursive: true, force: true });
	await rename(join(consumer, "out"), join(consumer, "relocated"));
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const runtime = await ownedDotnetRuntimeOnly(join(directory, "runtime-only"), command);
	await rm(join(consumer, "obj"), { recursive: true, force: true });
	for(const name of ["Program.cs", "Compositions.cs", "Consumer.csproj", "Invalid.cs", "Invalid.csproj", "NuGet.Config"])
		await rm(join(consumer, name));
	if(documentation) for(const name of ["Example.cs", "Example.csproj"]) await rm(join(consumer, name));
	assert.deepEqual(await runCopied(runtime.executable, ["relocated/Consumer.dll"], consumer, runtime.env), result);
	if(documentation) assert.deepEqual(await runCopied(runtime.executable, ["example/Example.dll"], consumer, runtime.env),
		{ code: 0, stdout: documentation.stdout, stderr: documentation.stderr });
	await saveLakeFile(resolve("build/owned-dotnet-packaging"), `${scalar ? "scalars" : "compositions"}-${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedNuget: true
		, sourceUnchanged: true, sourceFreeInstallation: true
		, sourceFreeRelocatedExecution: true, handoffRemoved: true
		, packageCacheRemoved: true, sdkFreeExecution: true
		, consumerSourceRemoved: true
		, deterministicReassembly: true, safePublicApi: true
		, tamperRejected: [...mutations, "managed-source"]
		, consumerSha256: sha256(source), originalProbeSha256: sha256(originalProbe)
		, compositionsSha256: sha256(extra), rejectedConsumers, documentation
		, observation, manifest, input, componentReceipt: verified.receipt
		, adapterReceipt: verified.adapter, compiledProjection: compiled
		, packageSetReceipt: receipt
	}));
	t.diagnostic(JSON.stringify(observation));
});
