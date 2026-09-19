/**
 * Inspect installed NuGet payloads, reject invalid C# callers and run without an SDK.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

const rejectedSources = {
	"callback-result": 'Api.CallNat(System.Numerics.BigInteger.One, value => 1.5);'
	, "callback-width": 'Api.CallUint32(1, (uint value) => -1);'
	, "async-result": 'Api.CallUint32(1, async value => { await System.Threading.Tasks.Task.Yield(); return value; });'
	, "unit-result": 'Api.CallUnit(default, new System.Func<Unit, Unit>(value => value));'
	, "closure-signature": 'LeanClosure<System.Func<uint, uint>> value = Api.MakeString("x");'
	, "closure-argument": 'Api.MakeNat(1).Invoke("x", System.Numerics.BigInteger.Zero);'
	, "closure-constructor": 'new LeanClosure<System.Func<bool, uint, uint>>();'
};
const expectedDiagnostics = {
	"callback-result": ["CS0266", "CS1662"]
	, "callback-width": ["CS0031", "CS1662", "CS0221"]
	, "async-result": ["CS4010"], "unit-result": ["CS1503"]
	, "closure-signature": ["CS0029"], "closure-argument": ["CS1503"]
	, "closure-constructor": ["CS1729"]
};
const select = versions => versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);

/**
 * Bind the assembly, dependencies, compile rejections and source-free result.
 *
 * @param options - Completed installed .NET fixture and expected assertion count.
 * @param options.consumer - Temporary consumer root.
 * @param options.handoff - Verified producer archive handoff.
 * @param options.packages - Package-set entries.
 * @param options.environment - Producer toolchain selection.
 * @param options.checks - Expected source-free assertion count.
 */
export const checkInstalledDotnetCallables = async ({ consumer, handoff, packages, environment, checks }) => {
	const root = join(consumer, "dotnet"), pkg = packages.find(item => item.role === "component");
	const installed = join(root, "packages", pkg.name.toLowerCase(), pkg.version);
	const receiptPath = join(installed, "lean-bridge/package-receipt.json"), receipt = JSON.parse(await readFile(receiptPath));
	assert.equal(receipt.namespace, "LeanBridge.Callables"); assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(sha256(await readFile(join(installed, `${pkg.name.toLowerCase()}.${pkg.version}.nupkg`))), pkg.artifacts[0].sha256);
	await verifyNativeFiles(installed, Object.fromEntries(Object.entries(receipt.files).filter(([path]) => !["[Content_Types].xml", "_rels/.rels", `${pkg.name}.nuspec`].includes(path))));
	const assets = JSON.parse(await readFile(join(root, "obj/project.assets.json")));
	assert.deepEqual(Object.keys(assets.libraries), [`${pkg.name}/${pkg.version}`]);
	assert.deepEqual(Object.keys(assets.project.restore.sources), [join(root, "feed")]);
	const dotnet = await realpath(environment.LEAN_BRIDGE_DOTNET), dotnetRoot = dirname(dotnet);
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dotnetRoot, DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1", NUGET_PACKAGES: join(root, "packages") };
	const sdk = select((await runCopied(dotnet, ["--list-sdks"], root, env)).stdout.split("\n").map(line => /^(8\.0\.\d+) \[/.exec(line)?.[1]).filter(Boolean));
	const compiler = join(dotnetRoot, "sdk", sdk, "Roslyn/bincore/csc.dll");
	const refRoot = join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref", select((await readdir(join(dotnetRoot, "packs/Microsoft.NETCore.App.Ref"))).filter(version => version.startsWith("8.0."))), "ref/net8.0");
	const assembly = join(installed, "lib/net8.0/LeanBridge.Callables.dll");
	const references = (await readdir(refRoot)).filter(file => file.endsWith(".dll")).sort().map(file => `/reference:${join(refRoot, file)}`);
	const rejected = [];
	for(const [name, expression] of Object.entries(rejectedSources))
	{
		const source = `using LeanBridge.Callables; static class Invalid { static void Test() { ${expression} } }`;
		const file = `reject-${name}.cs`; await saveLakeFile(root, file, source);
		await assert.rejects(() => runCopied(dotnet, ["exec", compiler, "/nologo", "/noconfig", "/nostdlib+", "/target:library", "/langversion:12", "/nullable:enable", "/warnaserror+", ...references, `/reference:${assembly}`, "/out:rejected.dll", file], root, env)
			, error => { const message = error.details?.stdout ?? ""; const codes = [...message.matchAll(/error (CS\d+):/g)].map(match => match[1]); assert.deepEqual(codes, expectedDiagnostics[name], message); assert.ok(message.includes(`${file}(`)); rejected.push({ name, sourceSha256: sha256(source), codes }); return true; });
	}
	const evidence = { sdk, compilerSha256: sha256(await readFile(compiler))
		, assemblySha256: sha256(await readFile(assembly))
		, packageReceiptSha256: sha256(await readFile(receiptPath))
		, rejected, onlyPreparedDependency: true };
	const relocated = join(consumer, "relocated"); await rename(join(root, "out"), relocated);
	const files = {};
	for(const path of await nativeArtifactPaths(relocated))
	{ const bytes = await readFile(join(relocated, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	assert.equal(files["LeanBridge.Callables.dll"].sha256, evidence.assemblySha256);
	for(const [path, file] of Object.entries(receipt.files).filter(([path]) => path.startsWith("runtimes/"))) assert.deepEqual(files[path], file);
	const runtime = join(consumer, "runtime-only"); await mkdir(runtime);
	const fxrVersion = select((await readdir(join(dotnetRoot, "host/fxr"))).filter(version => version.startsWith("8.0.")));
	const runtimeVersion = select((await readdir(join(dotnetRoot, "shared/Microsoft.NETCore.App"))).filter(version => version.startsWith("8.0.")));
	await cp(dotnet, join(runtime, "dotnet"));
	await cp(join(dotnetRoot, "host/fxr", fxrVersion), join(runtime, "host/fxr", fxrVersion), { recursive: true });
	await cp(join(dotnetRoot, "shared/Microsoft.NETCore.App", runtimeVersion), join(runtime, "shared/Microsoft.NETCore.App", runtimeVersion), { recursive: true });
	await rm(root, { recursive: true, force: true }); await rm(handoff, { recursive: true, force: true });
	assert.deepEqual((await readdir(consumer)).sort(), ["relocated", "runtime-only"]);
	const runEnv = { ...copiedCleanEnvironment, DOTNET_ROOT: runtime, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_NOLOGO: "1" };
	assert.equal((await runCopied(join(runtime, "dotnet"), ["--list-sdks"], relocated, runEnv)).stdout.trim(), "");
	for(let i = 0; i < 2; ++i)
	{
		const result = await runCopied(join(runtime, "dotnet"), ["Consumer.dll"], relocated, runEnv);
		assert.equal(result.stderr, ""); assert.equal(result.stdout.trim(), `callable-dotnet-ok:${checks}`);
	}
	await verifyNativeFiles(relocated, files);
	return { ...evidence, deployment: files, runtimeVersion, fxrVersion, sourceFree: true, sourceFreeExecutions: 2, sourceFreeChecks: checks };
};
