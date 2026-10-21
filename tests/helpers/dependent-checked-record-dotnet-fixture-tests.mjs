/**
 * Static NuGet selection, projection and immutable-caller controls for
 * dependent checked records, plus an opt-out contract oracle: the immutable C#
 * caller compiles against a managed stand-in of the generated API and its
 * exact totals and fault sensitivity are measured without any Lean component.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import {
	parseDependentCheckedRecordDotnetResult, dependentCheckedRecordDotnetCaller
	, dependentCheckedRecordDotnetCounts, dependentCheckedRecordDotnetEnvironment
	, dependentCheckedRecordDotnetFixtureRoot, dependentCheckedRecordDotnetLeanModule
	, dependentCheckedRecordDotnetRoutes, dependentCheckedRecordDotnetSelection
	, dependentCheckedRecordDotnetTarget
} from "./dependent-checked-record-dotnet-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const callerPath = "tests/fixtures/dependent-checked-record-consumers/dotnet.cs";
const modelRoot = resolve("tests/helpers/dependent-checked-record-dotnet-model");
const dotnetRoot = process.env.LEAN_BRIDGE_DOTNET_ROOT ?? resolve(".toolchains/dotnet");
const dotnet = join(dotnetRoot, "dotnet");

test("dependent .NET selection is closed and explicit", () => {
	assert.deepEqual(dependentCheckedRecordDotnetEnvironment({}), {
		enabled: false, routes: [...dependentCheckedRecordDotnetRoutes], maxLoad: 10
	});
	assert.deepEqual(dependentCheckedRecordDotnetEnvironment({ CI: "true" }), {
		enabled: false, routes: [...dependentCheckedRecordDotnetRoutes], maxLoad: 6
	});
	assert.deepEqual(dependentCheckedRecordDotnetEnvironment({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_ROUTES: "result-only-reviewed-ir"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_MAX_LOAD: "12"
	}), { enabled: true, routes: ["result-only-reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_ROUTES: "unknown" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_ROUTES: "ordinary-source,ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_MAX_LOAD: "14" }
	]) assert.throws(() => dependentCheckedRecordDotnetEnvironment(environment));
});

test("dependent .NET configuration retains four independent routes", () => {
	assert.deepEqual(dependentCheckedRecordDotnetTarget, { name: "Dependentrecords.Api", version: "1.0.0" });
	assert.equal(dependentCheckedRecordDotnetFixtureRoot, "tests/fixtures/onboarding/dependent-checked-records");
	assert.equal(dependentCheckedRecordDotnetLeanModule, "DependentRecords");
	for(const route of dependentCheckedRecordDotnetRoutes)
	{
		const selection = dependentCheckedRecordDotnetSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			nuget: dependentCheckedRecordDotnetTarget
		});
		assert.deepEqual(selection.configuration.modules, ["DependentRecords"]);
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 1 : 3);
		assert.equal(Object.hasOwn(selection.configuration, "contracts")
			, !selection.reviewed);
		assert.deepEqual(selection.expected.declarations.map(item => item.name)
			, selection.resultOnly ? ["dependentResult"]
				: ["dependentTotal", "dependentRoundtrip", "dependentResult"]);
		assert.deepEqual(selection.expected.types.map(type => type.name), ["Dependent"]);
		assert.deepEqual(selection.expected.types[0].source.extensions, {
			"lean-lang.org/erased-proofs": { fields: ["valid"] }
			, "lean-lang.org/nominal-refinements": {
				kind: "record", fields: [null, { kind: "fin-field", field: "bound" }]
			}
		});
	}
});

test("dependent C# projection keeps both retained naturals and the checked constructor", () => {
	const full = dependentCheckedRecordDotnetSelection("reviewed-ir");
	const files = generateCopiedDotnetPackage(full.expected);
	const api = files["src/LeanBridge.Dependentrecords/Api.cs"];
	assert.match(api, /public sealed record Dependent\(global::System\.Numerics\.BigInteger Bound, global::System\.Numerics\.BigInteger Below\)/u);
	assert.match(api, /Equals\(Dependent\? other\) => other is not null/u);
	assert.match(api, /public static global::System\.Numerics\.BigInteger DependentTotal\(Dependent @value0\)/u);
	assert.match(api, /public static Dependent DependentRoundtrip\(Dependent @value0\)/u);
	assert.match(api, /public static Dependent DependentResult\(global::System\.Numerics\.BigInteger @value0\)/u);
	assert.match(api, /value0 checked by DependentRecords\.mkDependent; value0\.below &lt; value0\.bound/u);
	assert.match(api, /result projects proof-backed record payload fields; result\.below &lt; result\.bound/u);
	assert.doesNotMatch(api, /\bValid\b/u);
	const runtime = files["src/LeanBridge.Dependentrecords/Runtime.cs"];
	assert.match(runtime, /if \(status == 1\) throw new ArgumentException\(message\);/u);
	assert.match(runtime, /Lean Nat cannot be negative/u);
	assert.match(runtime, /return new Dependent\(From0\(value\.F0\), From0\(value\.F1\)\);/u);

	const result = dependentCheckedRecordDotnetSelection("result-only-reviewed-ir");
	const resultApi = generateCopiedDotnetPackage(result.expected)[
		"src/LeanBridge.Dependentrecords/Api.cs"
	];
	for(const method of ["DependentTotal", "DependentRoundtrip"])
		assert.doesNotMatch(resultApi, new RegExp(`\\b${method}\\(`, "u"));
	assert.match(resultApi, /\bDependentResult\(/u);
});

test("dependent C# caller is immutable and independently counted", async () => {
	const source = await readFile(callerPath, "utf8");
	assert.match(source, /BigInteger\.One << 130/u);
	assert.match(source, /" was rejected by DependentRecords\.mkDependent"/u);
	assert.match(source, /error\.GetType\(\) == typeof\(ArgumentException\)/u);
	assert.match(source, /error\.ParamName is null/u);
	assert.match(source, /for \(var index = 0; index < 512; \+\+index\) Produced\(index, "result " \+ index\);/u);
	assert.match(source, /for \(var index = 0; index < 256; \+\+index\)/u);
	assert.match(source, /Refuse\(Record\(2, 2\), "equal fields"\);/u);
	assert.match(source, /Refuse\(Record\(0, 0\), "zero bound"\);/u);
	assert.match(source, /arguments\[0\] == "--runtime"/u);
	for(const counter of ["calls", "checks", "recoveries", "rejections", "snapshots"])
		assert.match(source, new RegExp(`static int ${counter} = 0;`, "u"));
	for(const route of dependentCheckedRecordDotnetRoutes)
	{
		const selection = dependentCheckedRecordDotnetSelection(route);
		const caller = await dependentCheckedRecordDotnetCaller(route);
		assert.ok(caller.endsWith(source));
		assert.equal(caller.includes("#define REVIEWED"), selection.reviewed);
		assert.equal(caller.includes("#define RESULT_ONLY"), selection.resultOnly);
		const mode = selection.resultOnly ? "result-only" : "full";
		const expected = dependentCheckedRecordDotnetCounts[mode];
		assert.deepEqual(parseDependentCheckedRecordDotnetResult(
			JSON.stringify(expected), route), expected);
		for(const field of Object.keys(expected))
		{
			const changed = { ...expected, [field]: expected[field] + 1 };
			assert.throws(() => parseDependentCheckedRecordDotnetResult(
				JSON.stringify(changed), route));
		}
	}
});

test("dependent C# caller measures exact totals against a managed oracle and refuses faults", {
	skip: !existsSync(dotnet) && "Select LEAN_BRIDGE_DOTNET_ROOT for the C# contract oracle"
	, timeout: 1_800_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-checked-record-dotnet-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const home = join(root, "home"); await mkdir(home);
	const environment = {
		PATH: "/usr/bin:/bin", LC_ALL: "C", HOME: home, DOTNET_CLI_HOME: home
		, NUGET_PACKAGES: join(home, "nuget"), DOTNET_ROOT: dotnetRoot
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1"
		, DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1"
	};
	assert.match(await readFile(join(modelRoot, "Model.cs"), "utf8"), /contract oracle/u);
	const build = async (name, route, defines) => {
		const directory = join(root, name);
		await cp(modelRoot, directory, { recursive: true });
		await saveLakeFile(directory, "consumer.cs", await dependentCheckedRecordDotnetCaller(route));
		const result = spawnSync(dotnet, [
			"build", "model.csproj", "-c", "Release", "-o", "out", "-nologo", "-v", "q"
			, "-p:LeanBridgeCaller=consumer.cs"
			, `-p:LeanBridgeDefines=${defines.join("%3B")}`
		], { cwd: directory, encoding: "utf8", env: environment, timeout: 600_000 });
		assert.equal(result.error, undefined);
		return { directory, status: result.status, output: result.stdout + result.stderr };
	};
	const execute = (built, fault) => spawnSync(join(built.directory, "out/consumer"), [], {
		cwd: built.directory, encoding: "utf8", timeout: 300_000
		, env: { ...environment, ...fault ? { LEAN_BRIDGE_DEPENDENT_FAULT: fault } : {} }
	});
	const builds = new Map();
	for(const route of dependentCheckedRecordDotnetRoutes)
	{
		const selection = dependentCheckedRecordDotnetSelection(route);
		// The caller's own #define lines are file-local in C#; the oracle needs the
		// same route switches at project level to drop or rename its exports.
		const built = await build(route, route, [
			...selection.resultOnly ? ["RESULT_ONLY"] : []
			, ...selection.reviewed ? ["REVIEWED"] : []
		]);
		assert.equal(built.status, 0, built.output);
		builds.set(route, built);
		const run = execute(built);
		assert.equal(run.status, 0, run.stderr); assert.equal(run.stderr, "");
		const mode = selection.resultOnly ? "result-only" : "full";
		assert.deepEqual(parseDependentCheckedRecordDotnetResult(run.stdout, route)
			, dependentCheckedRecordDotnetCounts[mode]);
		t.diagnostic(`${route}: managed oracle passed with ${dependentCheckedRecordDotnetCounts[mode].checks} checks`);
	}
	for(const [route, faults] of [
		["ordinary-source", [
			"accept-invalid", "wrong-status", "wrong-message", "wrong-produced"
			, "wrong-roundtrip"
		]]
		, ["result-only-ordinary-source", ["wrong-produced"]]
	]) for(const fault of faults)
	{
		const run = execute(builds.get(route), fault);
		assert.equal(run.status, 1, `${route} ${fault}`);
		// A wrong status surfaces as the foreign LeanBridgeException the caller
		// deliberately does not catch; every other fault fails an exact check.
		assert.match(run.stderr
			, /dependent-record assertion failed|Accepted invalid dependent record|exact caller totals|LeanBridgeException/u);
	}
	// A missing producer cannot even compile the caller; an input export that
	// leaks into the result-only API is refused by the caller at run time.
	const missing = await build("missing", "ordinary-source", ["MISSING_PRODUCER"]);
	assert.notEqual(missing.status, 0); assert.match(missing.output, /DependentResult/u);
	const leaked = await build("leaked", "result-only-ordinary-source", ["RESULT_ONLY", "INPUTS_EXPORTED"]);
	assert.equal(leaked.status, 0, leaked.output);
	const leakedRun = execute(leaked);
	assert.equal(leakedRun.status, 1); assert.match(leakedRun.stderr, /export selection/u);
});
