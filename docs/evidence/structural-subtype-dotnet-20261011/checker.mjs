/**
 * Check original structural Dotnet execution records without reopening historical paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeDotnetConfiguration, structuralSubtypeDotnetCounts, parseStructuralSubtypeDotnetResult } from "./structural-subtype-dotnet-fixture.mjs";

const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
export const structuralSubtypeDotnetRecords = Object.freeze([
	"report.json", "expected.binding-ir.json", "configuration.json", "consumer.cs"
	, "installed.json", "relocated.json"
	, ...["global.json", "Consumer.csproj", "NuGet.Config"
		, ...["Consumer.csproj.nuget.dgspec.json"
			, "Consumer.csproj.nuget.g.props", "Consumer.csproj.nuget.g.targets"
			, "project.assets.json", "project.nuget.cache"].map(path => `obj/${path}`)
		, "out/Consumer.deps.json", "out/Consumer.runtimeconfig.json"
		, "cache/.nupkg.metadata", "cache/structuralsubtypes.api.1.0.0.nupkg.sha512"
		, "cache/structuralsubtypes.api.nuspec"].map(path => `consumer-environment/${path}`)
	, ...[0, 1].flatMap(index => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${index}/${path}`))
]);

/**
 * Require exact Dotnet author contracts, authenticated gem environments and relocated observations.
 *
 * @param read - Original route-relative record reader.
 * @param options - Independent frozen producer and route selection.
 * @param options.route - Ordinary or reviewed author configuration.
 * @param options.producerCommit - Actual installed producer revision.
 */
export const checkStructuralSubtypeDotnetReport = async (read, { route, producerCommit }) => {
	assert.ok(["ordinary", "reviewed"].includes(route));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	const json = async path => {
		const bytes = await read(path), value = JSON.parse(bytes);
		assert.equal(bytes.toString(), canonicalJson(value), `Original canonical record: ${path}`);
		return value;
	};
	const original = path => execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeDotnetConfiguration(route), report = await json("report.json");
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.producerCommit, producerCommit);
	assert.deepEqual(report.configuration, configuration); assert.deepEqual(await json("configuration.json"), configuration);
	assert.deepEqual(await json("expected.binding-ir.json"), expected);
	assert.equal(report.expectedBindingIrSha256, hashBindingIr(expected));
	assert.equal(report.independentBuilds, 2);
	for(const key of ["reproducible", "sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeReplay", "relocatedInstallation"]) assert.equal(report[key], true, key);
	assert.ok(["2.36", "2.38"].includes(report.declaredGlibcFloor));
	assert.deepEqual(report.dispatch, { observed: false, reason: "No Dotnet entry counters in this installed acceptance" });
	assert.equal(report.builds.length, 2); assert.deepEqual(report.builds[1], report.builds[0]);
	for(const index of [0, 1])
	{
		const modelBytes = await read(`build-${index}/model.json`), model = await json(`build-${index}/model.json`);
		const receiptBytes = await read(`build-${index}/package-set-receipt.json`), receipt = await json(`build-${index}/package-set-receipt.json`);
		validatePackageSetReceipt(receipt); assert.deepEqual(receipt, report.receipt);
		assert.equal(model.profile, "native-library-v1"); assert.equal(model.pointerBits, 64); assert.equal(model.exports.length, 12);
		assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		for(const declaration of expected.declarations)
		{
			const exported = model.exports.find(item => item.name === declaration.id.slice(5)); assert.ok(exported);
			assert.deepEqual(exported.refinements, declaration.source.extensions["lean-lang.org/refinements"]);
		}
		const source = await read(`build-${index}/StructuralSubtypes.lean`);
		assert.deepEqual(source, original("tests/fixtures/onboarding/structural-subtypes/StructuralSubtypes.lean"));
		assert.equal(model.sourceIdentity.modules.length, 1);
		assert.deepEqual(model.sourceIdentity.modules[0].source, { path: "StructuralSubtypes.lean", bytes: source.length, sha256: sha256(source) });
		assert.equal(model.sourceIdentity.extractorSha256, sha256(original("src/analyze/NativeExports.lean")));
		assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
		assert.equal(model.sourceIdentity.exportConfigurationSha256, sha256(canonicalJson(configuration)));
		assert.deepEqual(model.sourceIdentity.request.metadata.modules.map(item => item.sourceSha256), [sha256(source)]);
		digest(model.sourceIdentity.leanCompilerSha256);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		assert.equal(receipt.source.treeSha256, model.sourceIdentity.sourceTreeSha256);
		assert.deepEqual(receipt.component, model.component);
		assert.equal(receipt.profiles.length, 1); assert.equal(receipt.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target), ["nuget"]);
		assert.deepEqual(report.builds[index], {
			modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256])))
		});
	}
	const source = original("tests/fixtures/structural-subtype-consumers/dotnet.cs").toString();
	const caller = route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
	assert.equal((await read("consumer.cs")).toString(), caller);
	assert.equal(report.installed.consumerSha256, sha256(caller));
	assert.equal(report.installed.checks, structuralSubtypeDotnetCounts.checks);
	assert.deepEqual(report.installed.result, structuralSubtypeDotnetCounts);
	for(const key of ["offlineInstall", "compilerFreePath"]) assert.equal(report.installed[key], true, key);
	const environment = report.installed.dotnetEnvironment;
	assert.match(report.dotnetSdk, /^8\.0\.[0-9]+$/u);
	assert.ok(environment.command.startsWith("/") && environment.root.startsWith("/"));
	digest(environment.interpreter.sha256);
	assert.ok(Number.isSafeInteger(environment.interpreter.bytes) && environment.interpreter.bytes > 0);
	const receiptBytes = Buffer.from(environment.receiptBytes), receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	const model = await json("build-0/model.json"), pkg = report.receipt.packages[0];
	assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package");
	assert.equal(receipt.ecosystem, "nuget"); assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.name, "StructuralSubtypes.Api"); assert.equal(receipt.version, "1.0.0");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.namespace, "LeanBridge.Structuralsubtypes");
	assert.equal(receipt.assembly, "LeanBridge.Structuralsubtypes");
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.glibcMinimumVersion, report.declaredGlibcFloor);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(receipt.component, model.component);
	const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
	assert.deepEqual(receipt.files["lean-bridge/component/model.json"], identity(await read("build-0/model.json")));
	digest(receipt.compiledProjectionSha256);
	const receiptPath = "lean-bridge/package-receipt.json";
	const payload = { ...receipt.files, [receiptPath]: identity(receiptBytes) };
	assert.equal(environment.packageFileSetSha256, sha256(canonicalJson(Object.keys(payload).sort())));
	assert.equal(environment.archiveName, "StructuralSubtypes.Api.1.0.0.nupkg");
	assert.equal(environment.packageDirectory, "structuralsubtypes.api/1.0.0");
	const cachedArchive = "structuralsubtypes.api.1.0.0.nupkg";
	const archiveIdentity = { bytes: pkg.artifacts[0].bytes, sha256: pkg.artifacts[0].sha256 };
	const feed = "feed/" + environment.archiveName;
	assert.deepEqual(Object.keys(environment.inputs).sort(), ["consumer.cs", "Consumer.csproj", "NuGet.Config", "global.json", feed].sort());
	assert.deepEqual(environment.inputs["consumer.cs"], identity(Buffer.from(caller)));
	assert.deepEqual(environment.inputs[feed], archiveIdentity);
	for(const path of ["Consumer.csproj", "NuGet.Config", "global.json"])
		assert.deepEqual(environment.inputs[path], identity(await read("consumer-environment/" + path)));
	assert.deepEqual(await json("consumer-environment/global.json"), {
		sdk: { version: report.dotnetSdk, rollForward: "disable", allowPrerelease: false } });
	const project = (await read("consumer-environment/Consumer.csproj")).toString();
	assert.equal(project, '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><PackageReference Include="StructuralSubtypes.Api" Version="[1.0.0]"/></ItemGroup></Project>');
	assert.equal((await read("consumer-environment/NuGet.Config")).toString(), '<configuration><packageSources><clear/><add key="prepared" value="feed"/></packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>');
	const cache = {};
	for(const [path, entry] of Object.entries(payload))
	{
		assert.ok(!/^(?:build|buildTransitive|buildMultiTargeting|analyzers|tools|content|contentFiles)\//iu.test(path));
		if(path === "[Content_Types].xml" || path === "_rels/.rels") continue;
		cache[path === "StructuralSubtypes.Api.nuspec" ? "structuralsubtypes.api.nuspec" : path] = entry;
	}
	cache[cachedArchive] = archiveIdentity;
	for(const path of [".nupkg.metadata", cachedArchive + ".sha512", "structuralsubtypes.api.nuspec"])
	{
		const bytes = await read("consumer-environment/cache/" + path);
		if(path.endsWith(".nuspec")) assert.deepEqual(identity(bytes), cache[path]);
		else cache[path] = identity(bytes);
	}
	const metadata = JSON.parse(await read("consumer-environment/cache/.nupkg.metadata"));
	const contentHash = (await read("consumer-environment/cache/" + cachedArchive + ".sha512")).toString();
	assert.match(contentHash, /^[A-Za-z0-9+/]{86}==$/u);
	assert.deepEqual(metadata, { version: 2, contentHash, source: environment.root + "/feed" });
	const nuspec = (await read("consumer-environment/cache/structuralsubtypes.api.nuspec")).toString();
	assert.ok(nuspec.includes("<id>StructuralSubtypes.Api</id>") && nuspec.includes("<version>1.0.0</version>"));
	assert.doesNotMatch(nuspec, /<!DOCTYPE|<!ENTITY|<dependency\b|<references\b|<frameworkAssemblies\b/iu);
	assert.deepEqual(environment.cacheFiles, Object.fromEntries(Object.entries(cache).map(([path, entry]) => [environment.packageDirectory + "/" + path, entry])));
	const restored = ["Consumer.csproj.nuget.dgspec.json"
		, "Consumer.csproj.nuget.g.props", "Consumer.csproj.nuget.g.targets"
		, "project.assets.json", "project.nuget.cache"];
	assert.deepEqual(Object.keys(environment.buildInputs).sort(), restored.sort());
	for(const path of restored)
		assert.deepEqual(environment.buildInputs[path], identity(await read("consumer-environment/obj/" + path)));
	const assets = JSON.parse(await read("consumer-environment/obj/project.assets.json"));
	assert.deepEqual(Object.keys(assets.libraries), ["StructuralSubtypes.Api/1.0.0"]);
	assert.equal(assets.libraries["StructuralSubtypes.Api/1.0.0"].sha512, contentHash);
	assert.equal(assets.libraries["StructuralSubtypes.Api/1.0.0"].path, environment.packageDirectory);
	assert.deepEqual(Object.keys(assets.packageFolders), [environment.root + "/packages"]);
	const supplied = {};
	for(const [path, entry] of Object.entries(receipt.files))
	{
		if(path.startsWith("lib/net8.0/") && /\.(?:dll|xml)$/u.test(path)) supplied[path.slice("lib/net8.0/".length)] = entry;
		else if(path.startsWith("runtimes/linux-x64/native/")) supplied[path] = entry;
	}
	assert.ok(supplied["LeanBridge.Structuralsubtypes.dll"]);
	assert.ok(Object.keys(supplied).some(path => path.endsWith(".so")));
	const generated = ["Consumer.deps.json", "Consumer.dll", "Consumer.pdb", "Consumer.runtimeconfig.json"];
	for(const [path, entry] of Object.entries(environment.outputs))
	{
		if(Object.hasOwn(supplied, path)) assert.deepEqual(entry, supplied[path]);
		else assert.ok(generated.includes(path), "Unrecorded deployed .NET file");
	}
	for(const path of [...generated, ...Object.keys(supplied).filter(path => !path.endsWith(".xml"))])
		assert.ok(environment.outputs[path], "Required deployed .NET file: " + path);
	for(const path of ["Consumer.deps.json", "Consumer.runtimeconfig.json"])
		assert.deepEqual(environment.outputs[path], identity(await read("consumer-environment/out/" + path)));
	const dependencies = JSON.parse(await read("consumer-environment/out/Consumer.deps.json"));
	assert.deepEqual(Object.keys(dependencies.libraries).sort(), ["Consumer/1.0.0", "StructuralSubtypes.Api/1.0.0"]);
	assert.equal(dependencies.libraries["StructuralSubtypes.Api/1.0.0"].sha512, "sha512-" + contentHash);
	const runtime = JSON.parse(await read("consumer-environment/out/Consumer.runtimeconfig.json")).runtimeOptions;
	assert.equal(runtime.tfm, "net8.0"); assert.equal(runtime.framework.name, "Microsoft.NETCore.App");
	assert.match(runtime.framework.version, /^8\.0\.[0-9]+$/u);
	for(const entry of Object.values({ ...payload, ...environment.inputs, ...environment.cacheFiles, ...environment.buildInputs, ...environment.outputs }))
	{
		assert.deepEqual(Object.keys(entry).sort(), ["bytes", "sha256"]);
		assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0); digest(entry.sha256);
	}
	const closure = { receiptSha256: sha256(receiptBytes)
		, packageFileSetSha256: environment.packageFileSetSha256
		, cacheFilesSha256: sha256(canonicalJson(environment.cacheFiles))
		, buildInputsSha256: sha256(canonicalJson(environment.buildInputs))
		, deployedFilesSha256: sha256(canonicalJson(environment.outputs))
		, interpreterSha256: environment.interpreter.sha256 };
	assert.equal(report.observations.length, 2);
	for(const [position, name] of ["installed", "relocated"].entries())
	{
		const observation = await json(`${name}.json`); assert.deepEqual(observation, report.observations[position]);
		assert.equal(observation.relocated, Boolean(position));
		assert.equal(observation.run.code, 0); assert.equal(observation.run.stderr, "");
		assert.deepEqual(parseStructuralSubtypeDotnetResult(observation.run.stdout), structuralSubtypeDotnetCounts);
		assert.deepEqual(observation.counts, structuralSubtypeDotnetCounts);
		assert.deepEqual(observation.closure, closure);
	}
	return {
		route, producerCommit
		, ...structuralSubtypeDotnetCounts
		, executions: 2, dotnetSdk: report.dotnetSdk, dispatchObserved: false
		, archives: report.builds[0].archives };
};
