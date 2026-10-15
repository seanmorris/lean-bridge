/**
 * Source-only controls for the nineteen-base nominal C# fixture.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";
import {
	nominalPrimitiveSubtypeDotnetCaller
	, nominalPrimitiveSubtypeDotnetConfiguration
	, nominalPrimitiveSubtypeDotnetCounts
	, nominalPrimitiveSubtypeDotnetModes
	, nominalPrimitiveSubtypeDotnetRoutes
	, nominalPrimitiveSubtypeDotnetSelection
	, parseNominalPrimitiveSubtypeDotnetResult
} from "./nominal-primitive-subtype-dotnet-fixture.mjs";
import {
	nominalSubtypeDotnetBuildFlags
	, nominalSubtypeDotnetEmptyFeeds
	, nominalSubtypeDotnetEnvironment
	, selectNominalSubtypeDotnetTools
} from "./nominal-subtype-dotnet-tools.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const dotnet = process.env.LEAN_BRIDGE_DOTNET ?? resolve(".toolchains/dotnet/dotnet");

test("primitive-base nominal C# configurations retain both author routes and result-only exports", async () => {
	for(const route of nominalPrimitiveSubtypeDotnetRoutes) for(const mode of nominalPrimitiveSubtypeDotnetModes)
	{
		const actual = nominalPrimitiveSubtypeDotnetConfiguration(route, mode);
		const expected = nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only");
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { nuget: { name: "Nominalprimitivesubtypes.Api", version: "1.0.0" } });
		const caller = await nominalPrimitiveSubtypeDotnetCaller(route, mode);
		assert.equal(caller.includes("#define RESULT_ONLY"), mode === "result-only");
		assert.equal(caller.includes("#define REVIEWED"), route === "reviewed");
	}
	assert.throws(() => nominalPrimitiveSubtypeDotnetConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypeDotnetConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalPrimitiveSubtypeDotnetCaller("unknown", "full"));
	await assert.rejects(nominalPrimitiveSubtypeDotnetCaller("ordinary", "unknown"));
	for(const mode of nominalPrimitiveSubtypeDotnetModes)
	{
		const counts = nominalPrimitiveSubtypeDotnetCounts[mode];
		assert.deepEqual(parseNominalPrimitiveSubtypeDotnetResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalPrimitiveSubtypeDotnetResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypeDotnetResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalPrimitiveSubtypeDotnetResult("{}", "unknown"));
});

test("primitive-base nominal C# gates reject disabled explicit work and invalid selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypeDotnetSelection({}), {
		enabled: false
		, routes: ["ordinary", "reviewed"]
		, modes: ["full", "result-only"]
	});
	assert.equal(nominalPrimitiveSubtypeDotnetSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2"])
		assert.throws(() => nominalPrimitiveSubtypeDotnetSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`])
			assert.throws(() => nominalPrimitiveSubtypeDotnetSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypeDotnetSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypeDotnetSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	assert.throws(() => nominalPrimitiveSubtypeDotnetSelection({ [prefix + "OUTPUT"]: "explicit" }));
});

test("generated primitive-base nominal C# API preserves all public copied values", () => {
	for(const mode of nominalPrimitiveSubtypeDotnetModes)
	{
		const review = nominalPrimitiveSubtypeReview(mode === "result-only"), before = structuredClone(review);
		const files = generateCopiedDotnetPackage(review);
		assert.deepEqual(review, before);
		assert.deepEqual(Object.keys(files).sort(), [
			"NuGet.Config", "README.md", "binding-manifest.json"
			, "src/LeanBridge.Nominalprimitivesubtypes/Api.cs"
			, "src/LeanBridge.Nominalprimitivesubtypes/LeanBridge.Nominalprimitivesubtypes.csproj"
			, "src/LeanBridge.Nominalprimitivesubtypes/Runtime.cs"
		].sort());
		const source = files["src/LeanBridge.Nominalprimitivesubtypes/Api.cs"];
		for(const name of ["Packet", "RawPacket", "Pair", "EventEmpty", "EventBox", "EventChoices"])
			assert.match(source, new RegExp(`^public sealed record ${name}\\b`, "mu"));
		for(const type of [
			"bool"
			, "byte"
			, "ushort"
			, "uint"
			, "ulong"
			, "sbyte"
			, "short"
			, "int"
			, "long"
			, "global::System.Numerics.BigInteger"
			, "float"
			, "double"
			, "string"
			, "byte[]"
			, "global::System.Text.Rune"])
			assert.ok(source.includes(type), type);
		for(const name of ["Produce", "ProduceGroup", "ProducePair", "ProduceEvent", "ProduceChoices", "WordBits"])
			assert.match(source, new RegExp(`public static [^\\n]+ ${name}\\(`, "u"));
		for(const name of ["EchoA", "EchoB", "RefuseUnit", "Combine", "EchoPair", "EchoEventA", "EchoEventB", "Aliases"])
			assert.equal(source.includes(` ${name}(`), mode === "full", name);
	}
});

test("independent primitive-base nominal C# caller compiles for every route and API mode", {
	skip: !existsSync(dotnet) && "Select LEAN_BRIDGE_DOTNET to compile C# caller controls"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-dotnet-controls-"));
	t.after(() => rm(root, { recursive: true }));
	const toolRoot = join(root, "toolchain"); await mkdir(toolRoot);
	const tools = await selectNominalSubtypeDotnetTools(toolRoot, dotnet);
	const project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings><UseAppHost>false</UseAppHost><AllowUnsafeBlocks>true</AllowUnsafeBlocks><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><Compile Include="Api.cs"/><Compile Include="Runtime.cs"/></ItemGroup></Project>';
	for(const mode of nominalPrimitiveSubtypeDotnetModes)
	{
		const generated = generateCopiedDotnetPackage(nominalPrimitiveSubtypeReview(mode === "result-only"));
		for(const route of nominalPrimitiveSubtypeDotnetRoutes)
		{
			const directory = join(root, route, mode);
			for(const [path, source] of Object.entries({
				"Consumer.csproj": project
				, "consumer.cs": await nominalPrimitiveSubtypeDotnetCaller(route, mode)
				, "Api.cs": generated["src/LeanBridge.Nominalprimitivesubtypes/Api.cs"]
				, "Runtime.cs": generated["src/LeanBridge.Nominalprimitivesubtypes/Runtime.cs"]
				, "NuGet.Config": nominalSubtypeDotnetEmptyFeeds
				, "global.json": canonicalJson({ sdk: { version: tools.sdk.version, rollForward: "disable", allowPrerelease: false } })
			})) await saveLakeFile(directory, path, source);
			const environment = nominalSubtypeDotnetEnvironment(directory, tools.command);
			await runCopied(tools.command, ["restore", "--configfile", "NuGet.Config", ...nominalSubtypeDotnetBuildFlags], directory, environment);
			await runCopied(tools.command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out", ...nominalSubtypeDotnetBuildFlags], directory, environment);
		}
	}
});
