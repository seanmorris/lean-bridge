/**
 * Independent C# caller controls. Synthetic models are not installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import "./nominal-subtype-dotnet-evidence-tests.mjs";
import "./nominal-subtype-dotnet-ci-report-tests.mjs";
import "./nominal-subtype-dotnet-ci-handoff-tests.mjs";
import "./nominal-subtype-dotnet-ci-shell-tests.mjs";
import "./nominal-subtype-dotnet-ci-workflow-tests.mjs";
import "./nominal-subtype-dotnet-ci-history-tests.mjs";
import "./nominal-subtype-dotnet-promotion-tests.mjs";
import "./nominal-subtype-dotnet-promotion-history-tests.mjs";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeDotnetRoutes, nominalSubtypeDotnetModes, nominalSubtypeDotnetConfiguration, nominalSubtypeDotnetCaller, nominalSubtypeDotnetCounts, nominalSubtypeDotnetSelection, parseNominalSubtypeDotnetResult } from "./nominal-subtype-dotnet-fixture.mjs";
import { nominalSubtypeDotnetBuildFlags, nominalSubtypeDotnetEmptyFeeds, nominalSubtypeDotnetEnvironment, observeNominalSubtypeDotnetRuntime, selectNominalSubtypeDotnetTools } from "./nominal-subtype-dotnet-tools.mjs";
import { checkNominalSubtypeDotnetProbe, runNominalSubtypeDotnetProbe } from "./nominal-subtype-dotnet-probe.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const dotnet = process.env.LEAN_BRIDGE_DOTNET ?? resolve(".toolchains/dotnet/dotnet");
const callerControls = process.env.LEAN_BRIDGE_DOTNET !== undefined || existsSync(dotnet);

test("C# producer waits for load without relaxing memory or disk floors", async () => {
	const healthy = { freeBytes: 3 * 1024 ** 3, availableBytes: 3 * 1024 ** 3, load: 1 };
	assert.deepEqual(await waitNominalSubtypeDotnetResources("fixture", {
		sample: async () => healthy
		, pause: async () => assert.fail("Healthy host must not wait")
	}), { observations: [healthy], waits: 0 });
	const queue = [6, 9, 5.9], delays = [], notifications = [];
	const result = await waitNominalSubtypeDotnetResources("fixture", {
		sample: async root => { assert.equal(root, "fixture"); return { ...healthy, load: queue.shift() }; }
		, pause: async value => { delays.push(value); }
		, notify: message => { notifications.push(message); }
	});
	assert.deepEqual(result, { waits: 2, observations: [6, 9, 5.9].map(load => ({ ...healthy, load })) });
	assert.deepEqual(delays, [15_000, 15_000]); assert.equal(notifications.length, 2);
	for(const values of [{ ...healthy, freeBytes: 2 * 1024 ** 3 - 1 }
		, { ...healthy, availableBytes: 2 * 1024 ** 3 - 1 }
		, { ...healthy, load: NaN }, { ...healthy, load: -1 }])
		await assert.rejects(waitNominalSubtypeDotnetResources("fixture", { sample: async () => values, pause: async () => assert.fail("Must refuse before waiting") }));
	let waits = 0;
	await assert.rejects(waitNominalSubtypeDotnetResources("fixture", {
		sample: async () => ({ ...healthy, load: 6 })
		, pause: async delay => { assert.equal(delay, 15_000); waits++; }
	}), /five minutes/u);
	assert.equal(waits, 20);
});

test("nominal C# configurations retain both author routes and constructor-free results", async () => {
	for(const route of nominalSubtypeDotnetRoutes) for(const mode of nominalSubtypeDotnetModes)
	{
		const actual = nominalSubtypeDotnetConfiguration(route, mode);
		const expected = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { nuget: { name: "Nominalsubtypes.Api", version: "1.0.0" } });
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
		assert.equal(await nominalSubtypeDotnetCaller("reviewed", mode), (await nominalSubtypeDotnetCaller("ordinary", mode)).replaceAll(/arg([01])/gu, "value$1"));
	}
	assert.throws(() => nominalSubtypeDotnetConfiguration("unknown", "full"));
	assert.throws(() => nominalSubtypeDotnetConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalSubtypeDotnetCaller("unknown", "full"));
	await assert.rejects(nominalSubtypeDotnetCaller("ordinary", "unknown"));
	for(const mode of nominalSubtypeDotnetModes)
	{
		const counts = nominalSubtypeDotnetCounts[mode];
		assert.deepEqual(parseNominalSubtypeDotnetResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalSubtypeDotnetResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalSubtypeDotnetResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalSubtypeDotnetResult("{}", "unknown"));
});

test("nominal C# gates reject disabled explicit work and invalid selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_DOTNET_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypeDotnetSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypeDotnetSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2"]) assert.throws(() => nominalSubtypeDotnetSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`])
			assert.throws(() => nominalSubtypeDotnetSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalSubtypeDotnetSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypeDotnetSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	assert.throws(() => nominalSubtypeDotnetSelection({ [prefix + "OUTPUT"]: "explicit" }));
});

test("independent C# caller detects faulty values, constructors, mutation and rejection diagnostics", {
	skip: !callerControls && "Select LEAN_BRIDGE_DOTNET to execute C# caller controls"
	, timeout: 600_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-dotnet-controls-"));
	t.after(() => rm(root, { recursive: true }));
	const tools = await selectNominalSubtypeDotnetTools(root, dotnet);
	const model = await readFile("tests/helpers/nominal-subtype-dotnet-model.cs", "utf8");
	let controls = 0, probeControls = 0;
	for(const mode of nominalSubtypeDotnetModes) for(const route of nominalSubtypeDotnetRoutes)
	{
		const directory = join(root, route, mode), define = mode === "result-only" ? "#define RESULT_ONLY\n" : "";
		const project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultItems>false</EnableDefaultItems><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="consumer.cs"/><Compile Include="model.cs"/></ItemGroup></Project>';
		for(const [path, source] of Object.entries({ "Consumer.csproj": project
			, "consumer.cs": await nominalSubtypeDotnetCaller(route, mode)
			, "model.cs": define + model
			, "NuGet.Config": nominalSubtypeDotnetEmptyFeeds
			, "global.json": canonicalJson({ sdk: { version: tools.sdk.version, rollForward: "disable", allowPrerelease: false } }) }))
			await saveLakeFile(directory, path, source);
		const environment = nominalSubtypeDotnetEnvironment(directory, tools.command);
		await runCopied(tools.command, ["restore", "--configfile", "NuGet.Config", ...nominalSubtypeDotnetBuildFlags], directory, environment);
		await runCopied(tools.command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out", ...nominalSubtypeDotnetBuildFlags], directory, environment);
		const env = { ...environment, NOMINAL_DOTNET_ROUTE: route };
		const run = await runCopied(tools.command, ["out/Consumer.dll"], directory, env);
		assert.equal(run.stderr, ""); parseNominalSubtypeDotnetResult(run.stdout, mode);
		const runtime = await observeNominalSubtypeDotnetRuntime(directory, "out/Consumer.dll", tools);
		assert.equal(runtime.run.code, 0);
		const mutants = ["scalar", "short-array", "missing-pair-values"
			, "missing-event-choices", "missing-event-value", "truncate-envelope"
			, "wrong-choice-tag", "swap-pair", "negative-nat"
			, ...mode === "full" ? ["first", "second", "combine", "nested"
				, "plain-fin", "wrong-error-path", "fin-after-subtype"
				, "mutate-accepted-input", "mutate-rejected-input", "default-result"] : []];
		for(const mutant of mutants)
		{
			const failed = await captureCorpusCompiler(tools.command, ["out/Consumer.dll"], directory, { ...env, NOMINAL_DOTNET_MUTANT: mutant });
			assert.equal(failed.code, 1, `${route}/${mode}/${mutant}`);
			assert.equal(failed.stdout, ""); assert.match(failed.stderr, /failed: |accepted: /u);
			controls++;
		}
		if(route === "ordinary")
		{
			const probe = await runNominalSubtypeDotnetProbe({ root: join(root, `probe-${mode}`)
				, assembly: await readFile(join(directory, "out/Consumer.dll"))
				, tools, mode, output: join(root, `records-${mode}`) });
			const changes = [record => { record.restore.code = 1; }
				, record => { record.restore.stderr = "unexpected"; }
				, record => { record.build.stderr = "unexpected"; }
				, record => { record.build.code = mode === "full" ? 1 : 0; }
				, record => { record.diagnostics.version = "unknown"; }
				, record => { record.diagnostics.runs = []; }
				, record => { record.diagnostics.runs.push(record.diagnostics.runs[0]); }];
			if(mode === "full") changes.push(record => { record.outputs = {}; }
				, record => { record.outputs["Probe.dll"].bytes = 0; }
				, record => { record.outputs["Probe.dll"].sha256 = "changed"; }
				, record => { record.outputs["Other.dll"] = record.outputs["Probe.dll"]; });
			else changes.push(record => { record.outputs["Probe.dll"] = {}; }
				, record => { record.diagnostics.runs[0].results.pop(); }
				, record => { record.diagnostics.runs[0].results.push(record.diagnostics.runs[0].results[0]); }
				, record => { record.diagnostics.runs[0].results[0].level = "warning"; }
				, record => { record.diagnostics.runs[0].results[0].ruleId = "CS9999"; }
				, record => { record.diagnostics.runs[0].results[0].message = { text: "unrelated failure" }; }
				, record => { record.diagnostics.runs[0].results[0].locations = []; }
				, record => { record.diagnostics.runs[0].results[0].locations[0].physicalLocation.region.startLine++; }
				, record => { record.diagnostics.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri += "other"; });
			for(const mutate of changes)
			{
				const changed = structuredClone(probe); mutate(changed);
				assert.throws(() => checkNominalSubtypeDotnetProbe(changed, mode)); probeControls++;
			}
		}
	}
	assert.equal(controls, 56); assert.equal(probeControls, 27);
	t.diagnostic("56 synthetic caller mutation controls and 27 compiler-record refusals; no installed-package claim");
});

test("nominal C# declarations retain named public values and separate result-only exports", () => {
	for(const mode of nominalSubtypeDotnetModes)
	{
		const review = nominalSubtypeInstalledReview(mode === "result-only"), before = structuredClone(review);
		const files = generateCopiedDotnetPackage(review), source = files["src/LeanBridge.Nominalsubtypes/Api.cs"];
		assert.deepEqual(review, before);
		for(const name of ["Envelope", "AliasPair", "EventEmpty", "EventBox", "EventChoices"])
			assert.match(source, new RegExp(`^public sealed record ${name}\\(`, "mu"));
		assert.match(source, /^public abstract record Event$/mu);
		assert.equal([...source.matchAll(/^ {4}public static .+ => Interop\.Runtime\.Call/gmu)].length, mode === "full" ? 26 : 13);
		assert.equal(source.includes(" First("), mode === "full");
		assert.equal(source.includes("public sealed record Pair("), mode === "full");
		const manifest = JSON.parse(files["binding-manifest.json"]);
		assert.equal(manifest.generator, "dotnet-copied-v1"); assert.ok(manifest.aliases.length > 0);
	}
});
