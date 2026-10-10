/**
 * Real .NET compiler and loader controls for a synthetic package, not Fin acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finContainerEdgeDotnetFixture } from "./helpers/fin-container-edge-dotnet-closure-fixture.mjs";
import { inspectFinContainerEdgeDotnetArchive, installFinContainerEdgeDotnet, runFinContainerEdgeDotnet, verifyFinContainerEdgeDotnetEnvironment } from "./helpers/fin-container-edge-dotnet-closure.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_FIN_CONTAINER_EDGE_SOURCE_TEST === "1";
const source = 'if (System.IO.File.Exists("out/Injected.dll")) System.Reflection.Assembly.LoadFrom("out/Injected.dll").GetType("Injected")!.GetMethod("Run")!.Invoke(null, null);\nSystem.Console.WriteLine("dotnet-closure-ok:" + Probe.Api.Value());\n';
const install = async (fixture, name, installDotnet = installFinContainerEdgeDotnet, consumerSource = source) => installCopiedConsumer({ profile: "dotnet"
	, consumer: join(fixture.root, name)
	, ...await fixture.pack(name)
	, environment: { LEAN_BRIDGE_DOTNET: fixture.command, DOTNET_STARTUP_HOOKS: "/unavailable/poison.dll", MSBuildSDKsPath: "/unavailable/poison" }
	, fixture: { source: () => consumerSource, success: "dotnet-closure-ok", expectedChecks: 1, installDotnet } });

test("NuGet's exact root content-types name does not admit other bracketed inventory paths", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nuget-inventory-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const path of ["[Content_Types].xml", "nested/[Content_Types].xml", "[other].xml", "[Content_Types].xml/child"])
	{
		const directory = join(root, `case-${path.length}`);
		await saveLakeFile(directory, path, "payload");
		const files = { [path]: { bytes: 7, sha256: sha256("payload") } };
		if(path === "[Content_Types].xml") await verifyNativeFiles(directory, files);
		else await assert.rejects(verifyNativeFiles(directory, files), /invalid native artifact path/u);
	}
});

test(".NET guard verifies NuGet's derived cache layout and the complete deployed application", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgeDotnetFixture(t), result = await install(fixture, "consumer");
	assert.equal(result.checks, 1);
	let context = result.dotnetEnvironment;
	const expected = await verifyFinContainerEdgeDotnetEnvironment(context), call = () => runFinContainerEdgeDotnet(context);
	assert.equal((await call()).stdout, "dotnet-closure-ok:1\n");
	assert.deepEqual(await nativeArtifactPaths(join(context.root, "packages")), Object.keys(context.cacheFiles).sort());
	const cache = `packages/${context.packageDirectory}`;
	for(const path of [
		`${cache}/.nupkg.metadata`, `${cache}/probe.api.nuspec`
		, `${cache}/probe.api.1.0.0.nupkg.sha512`
		, `${cache}/lib/net8.0/Probe.Api.dll`, "out/Probe.Api.dll"
		, "out/Consumer.deps.json", "out/Consumer.runtimeconfig.json"
		, "consumer.cs", "Consumer.csproj", "NuGet.Config", "global.json"
		, "obj/Consumer.csproj.nuget.g.targets"
	]) {
		const original = await readFile(join(context.root, path));
		await saveLakeFile(context.root, path, "changed"); await assert.rejects(call(), /\.NET file drift/u);
		await saveLakeFile(context.root, path, original);
	}
	for(const path of [`${cache}/build/Probe.Api.targets`, "packages/extra/1.0.0/extra.dll", "out/Unexpected.dll", "obj/Consumer.csproj.extra.targets"])
	{
		await saveLakeFile(context.root, path, "extra"); await assert.rejects(call(), /unrecorded/u);
		await rm(join(context.root, path));
	}
	await assert.rejects(runFinContainerEdgeDotnet({ ...context, interpreter: { ...context.interpreter, sha256: sha256("wrong") } }), /host drift/u);
	await rename(join(context.root, "out"), join(fixture.root, "linked-out"));
	await symlink(join(fixture.root, "linked-out"), join(context.root, "out"));
	await assert.rejects(call(), /directory must not traverse/u);
	await rm(join(context.root, "out")); await rename(join(fixture.root, "linked-out"), join(context.root, "out"));
	const moved = join(fixture.root, "relocated"); await rename(context.root, moved); context = { ...context, root: moved };
	assert.equal((await call()).stdout, "dotnet-closure-ok:1\n");
	assert.deepEqual(await verifyFinContainerEdgeDotnetEnvironment(context), expected);
});

test("unrecorded NuGet targets are refused before restore and execute in an unguarded positive control", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgeDotnetFixture(t), marker = join(fixture.root, "package-target-executed");
	await saveLakeFile(fixture.payload, "build/Probe.Api.targets", `<Project><Target Name="InjectedTarget" BeforeTargets="BeforeBuild"><WriteLinesToFile File="${marker}" Lines="executed" Overwrite="true"/></Target></Project>`);
	await assert.rejects(install(fixture, "guarded"), /unrecorded or missing .NET archive file/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await assert.rejects(access(join(fixture.root, "guarded/dotnet/obj")), { code: "ENOENT" });
	assert.equal((await install(fixture, "unguarded", null)).checks, 1);
	assert.equal((await readFile(marker, "utf8")).trim(), "executed");
	const receiptPath = "lean-bridge/package-receipt.json", receipt = JSON.parse(await readFile(join(fixture.payload, receiptPath)));
	const injected = await readFile(join(fixture.payload, "build/Probe.Api.targets"));
	receipt.files["build/Probe.Api.targets"] = { bytes: injected.length, sha256: sha256(injected) };
	await saveLakeFile(fixture.payload, receiptPath, canonicalJson(receipt));
	await assert.rejects(install(fixture, "unexpected-discovery"), /unexpected NuGet executable discovery input/u);
});

test("ambient parent build imports and SDK selection cannot enter the isolated .NET build", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgeDotnetFixture(t), marker = join(fixture.root, "ancestor-executed");
	await saveLakeFile(fixture.root, "Directory.Build.targets", `<Project><Target Name="AncestorTarget" BeforeTargets="BeforeBuild"><WriteLinesToFile File="${marker}" Lines="executed" Overwrite="true"/></Target></Project>`);
	assert.equal((await install(fixture, "guarded")).checks, 1);
	await assert.rejects(access(marker), { code: "ENOENT" });
	assert.equal((await install(fixture, "unguarded", null)).checks, 1);
	assert.equal((await readFile(marker, "utf8")).trim(), "executed"); await rm(marker);
	await saveLakeFile(fixture.root, "Directory.Build.props", "not XML");
	await saveLakeFile(fixture.root, "Directory.Packages.props", "not XML");
	await saveLakeFile(fixture.root, "global.json", canonicalJson({ sdk: { version: "0.0.0", rollForward: "disable" } }));
	assert.equal((await install(fixture, "hostile-parent")).checks, 1);
	await assert.rejects(access(marker), { code: "ENOENT" });
});

test("extra deployed .NET code is refused before loading, with an executable positive control", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgeDotnetFixture(t), marker = join(fixture.root, "assembly-executed");
	const { dotnetEnvironment: context } = await install(fixture, "consumer");
	const project = join(fixture.root, "injected");
	await saveLakeFile(project, "Injected.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><NuGetAudit>false</NuGetAudit></PropertyGroup></Project>');
	await saveLakeFile(project, "Injected.cs", `public static class Injected { public static void Run() => System.IO.File.WriteAllText(${JSON.stringify(marker)}, "executed"); }`);
	await saveLakeFile(project, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(context.command), DOTNET_CLI_HOME: join(fixture.root, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await runCopied(context.command, ["build", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], project, env);
	await saveLakeFile(context.root, "out/Injected.dll", await readFile(join(project, "out/Injected.dll")));
	await assert.rejects(runFinContainerEdgeDotnet(context), /unrecorded or missing .NET file/u);
	await assert.rejects(access(marker), { code: "ENOENT" });
	await runCopied(context.command, ["out/Consumer.dll"], context.root, env);
	assert.equal(await readFile(marker, "utf8"), "executed");
});

test(".NET post-execution checks run on success and after an application failure", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgeDotnetFixture(t);
	for(const fail of [false, true])
	{
		const mutation = `System.IO.File.WriteAllText("out/Unexpected.dll", "extra");\n${fail ? 'throw new System.Exception("failed after mutation");' : 'System.Console.WriteLine("dotnet-closure-ok:1");'}`;
		await assert.rejects(install(fixture, `post-run-${fail}`, installFinContainerEdgeDotnet, mutation), /unrecorded or missing .NET file/u);
	}
});

test("NuGet archives authenticate their original digest and exact receipt before compilation", { skip: !enabled }, async t => {
	const fixture = await finContainerEdgeDotnetFixture(t), { handoff, packages } = await fixture.pack("original");
	const artifact = packages[0].artifacts[0], bytes = await readFile(join(handoff, artifact.path));
	assert.equal(inspectFinContainerEdgeDotnetArchive(bytes, artifact.sha256).receipt.name, "Probe.Api");
	assert.throws(() => inspectFinContainerEdgeDotnetArchive(bytes, sha256("wrong")), /original .NET archive drift/u);
	await saveLakeFile(fixture.payload, "lib/net8.0/Probe.Api.dll", "changed");
	await assert.rejects(install(fixture, "mutated-payload"), /archive member drift/u);
});
