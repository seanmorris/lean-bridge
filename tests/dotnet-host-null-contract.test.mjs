/**
 * Direct nullable CLR projection for compiler-authenticated HostNull.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { generateCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { hostNullReviewedIr } from "./helpers/host-null-fixture.mjs";
import {
	hostNullManagedFixturePaths, runHostNullManagedAcceptance
} from "./helpers/host-null-managed-installed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test(".NET HostNull keeps null, Option absence, records and callback directions distinct", () => {
	const ir = hostNullReviewedIr(), model = compileCopiedDotnetModel(ir), files = generateCopiedDotnetPackage(ir);
	assert.deepEqual(files, generateCopiedDotnetPackage(structuredClone(ir)));
	const api = files["src/LeanBridge.HostNullDemo/Api.cs"];
	const runtime = files["src/LeanBridge.HostNullDemo/Runtime.cs"];
	assert.match(api, /record Packet\(uint\? Direct, Option<uint>\? NullableOption, Option<uint\?> OptionalNullable\)/u);
	assert.match(api, /uint\? Echo\(uint\? @value0\)/u);
	assert.match(api, /Option<uint>\? NullableOption\(Option<uint>\? @value0\)/u);
	assert.match(api, /Option<uint\?> OptionalNullable\(Option<uint\?> @value0\)/u);
	assert.match(api, /Option<uint>\? CallHost\(uint\? @value0, global::System.Func<uint\?, Option<uint>\?> @value1\)/u);
	assert.match(api, /LeanClosure<global::System.Func<uint\?, Option<uint>\?>> MakeClosure\(Option<uint>\? @value0\)/u);
	assert.match(runtime, /if \(value is not \{ \} present\) return default;/u);
	assert.match(runtime, /Flag switch \{ 0 => null, 1 => From\d+\(value\.F0\), _ => throw new InvalidOperationException\("Invalid native HostNull flag"\) \}/u);
	assert.match(files["README.md"], /HostNull \(Option T\) is Option<T>\?, while Option \(HostNull T\) is Option<T\?>/u);
	assert.deepEqual(model.surface.copies.filter(copy => copy.compound === "host-null").map(model.publicType), ["uint?", "Option<uint>?"]);
});

test(".NET rejects directly nested HostNull rather than collapsing two null branches", () => {
	const ir = hostNullReviewedIr();
	ir.declarations[0].parameters[0].type = {
		kind: "apply"
		, constructor: "host-null"
		, arguments: [ir.declarations[0].parameters[0].type]
	};
	assert.throws(() => compileCopiedDotnetModel(ir), error => error.code === "unsupported-dotnet-signature"
		&& /HostNull payloads must retain a value distinct from null/u.test(error.message));
});

const environment = nativeFixtureEnvironment(["dotnet"]);
test("generated .NET HostNull sources and all three absence states compile without warnings", {
	skip: !existsSync(environment.LEAN_BRIDGE_DOTNET)
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-host-null-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, source] of Object.entries(generateCopiedDotnetPackage(hostNullReviewedIr())))
		await saveLakeFile(root, path, source);
	await saveLakeFile(root, "consumer/consumer.cs", await readFile(
		"tests/fixtures/host-null-consumers/dotnet.cs"));
	await saveLakeFile(root, "consumer/Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <UseAppHost>false</UseAppHost>
  </PropertyGroup>
  <ItemGroup>
    <ProjectReference Include="../src/LeanBridge.HostNullDemo/LeanBridge.HostNullDemo.csproj" />
  </ItemGroup>
</Project>
`);
	const command = environment.LEAN_BRIDGE_DOTNET;
	await runCopied(command, [
		"build"
		, "consumer/Consumer.csproj"
		, "--disable-build-servers"
		, "-p:UseSharedCompilation=false"
		, "-o"
		, "out"
	], root, {
		...process.env
		, DOTNET_ROOT: dirname(command)
		, DOTNET_CLI_HOME: join(root, "dotnet-home")
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, DOTNET_NOLOGO: "1"
		, NUGET_PACKAGES: join(root, "packages")
	});
});

test("managed HostNull CI retains both routes and gates .NET plus JVM observations", async () => {
	const runner = await readFile("scripts/run-host-null-managed-ci.sh", "utf8");
	const installed = await readFile(
		"tests/helpers/host-null-managed-installed.mjs", "utf8");
	for(const required of [
		"<dotnet|jvm>", "LEAN_BRIDGE_HOST_NULL_MANAGED_OUTPUT"
		, "LEAN_BRIDGE_DOTNET_HOST_NULL_TEST=1"
		, "LEAN_BRIDGE_JVM_HOST_NULL_TEST=1"
		, "check-host-null-managed-ci.mjs"
	]) assert.ok(runner.includes(required), required);
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const required of [
		"id: host_null_managed"
		, "bash scripts/run-host-null-managed-ci.sh \"${{ matrix.profile }}\""
		, "name: host-null-managed-${{ matrix.profile }}-${{ github.sha }}"
		, "steps.host_null_managed.outcome"
	]) assert.ok(workflow.includes(required), required);
	assert.equal(workflow.match(/bash scripts\/run-host-null-managed-ci\.sh/gu)?.length, 3);
	assert.match(installed
		, /const target = group === "dotnet" \? "nuget" : "maven";/u);
	assert.match(installed, /targets: \[target\], environment/u);
	assert.deepEqual(hostNullManagedFixturePaths, {
		dotnet: "tests/fixtures/host-null-consumers/dotnet.cs"
		, java: "tests/fixtures/host-null-consumers/java.java"
		, kotlin: "tests/fixtures/host-null-consumers/kotlin.kt"
	});
	for(const path of Object.values(hostNullManagedFixturePaths))
		assert.ok((await readFile(path)).length > 0, path);
});

const installedFlag = process.env.LEAN_BRIDGE_DOTNET_HOST_NULL_TEST;
assert.ok(installedFlag === undefined || ["0", "1"].includes(installedFlag)
	, "Invalid LEAN_BRIDGE_DOTNET_HOST_NULL_TEST");
test("installed NuGet HostNull preserves all absence states on both author routes", {
	skip: installedFlag !== "1", timeout: 3_600_000
}, t => runHostNullManagedAcceptance(t, "dotnet"));
