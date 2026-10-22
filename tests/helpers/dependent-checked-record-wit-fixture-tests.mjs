/**
 * Source-only controls for the dependent checked-record WIT projection and
 * immutable caller. No compiled Lean component or installed package executes
 * here; a stand-in host over the Wasmtime C value types measures the caller's
 * exact totals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { dependentCheckedRecordSelection } from "./dependent-checked-record-browser-fixture.mjs";
import {
	parseDependentCheckedRecordWitResult, dependentCheckedRecordWitCaller
	, dependentCheckedRecordWitConfiguration, dependentCheckedRecordWitConsumerFiles
	, dependentCheckedRecordWitConsumerRoot, dependentCheckedRecordWitCounts
	, dependentCheckedRecordWitFixtureRoot, dependentCheckedRecordWitLeanModule
	, dependentCheckedRecordWitModes, dependentCheckedRecordWitRoutes
	, dependentCheckedRecordWitSelection, dependentCheckedRecordWitTarget
} from "./dependent-checked-record-wit-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { dependentCheckedRecordWitOriginalCaller } from "./dependent-checked-record-wit-report.mjs";

const capi = resolve(".toolchains/wasmtime42");
const cc = process.env.CC ?? "/usr/bin/cc";
const model = resolve("tests/helpers/dependent-checked-record-wit-model.c");
const header = route => renderWitHostHeader(compileCopiedWitModel(
	dependentCheckedRecordSelection(route).expected, dependentCheckedRecordWitTarget, { callables: true }
));

test("dependent checked-record WIT retains all four author routes and the limb-list projection", async () => {
	assert.deepEqual(dependentCheckedRecordWitRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(dependentCheckedRecordWitTarget, { name: "dependentrecords", version: "1.0.0" });
	assert.deepEqual(dependentCheckedRecordWitModes, ["full", "result-only"]);
	assert.equal(dependentCheckedRecordWitFixtureRoot, "tests/fixtures/onboarding/dependent-checked-records");
	assert.equal(dependentCheckedRecordWitLeanModule, "DependentRecords");
	for(const route of dependentCheckedRecordWitRoutes)
	{
		const selection = dependentCheckedRecordSelection(route);
		const configuration = dependentCheckedRecordWitConfiguration(route);
		validateExportConfiguration(configuration); validateBindingIr(selection.expected);
		assert.deepEqual(configuration, { ...selection.configuration
			, targets: { "wit-wasi": dependentCheckedRecordWitTarget } });
		assert.deepEqual(configuration.modules, ["DependentRecords"]);
		const projection = compileCopiedWitModel(selection.expected
			, dependentCheckedRecordWitTarget, { callables: true });
		const names = selection.resultOnly ? ["dependent-result"]
			: ["dependent-total", "dependent-roundtrip", "dependent-result"];
		assert.deepEqual([...projection.surface.functions.map(fn => fn.witName)].sort(), [...names].sort());
		assert.match(projection.wit, /type bridge-value-0 = list<u32>;/u);
		assert.match(projection.wit, /record dependent \{ bound: bridge-value-0, below: bridge-value-0 \}/u);
		assert.match(projection.wit, /dependent-result: func\(value0: bridge-value-0\) -> dependent;/u);
		assert.doesNotMatch(projection.wit, /\bvalid\b/u);
		assert.equal(projection.wit.includes("dependent-total: func(value0: dependent) -> bridge-value-0;"), !selection.resultOnly);
		assert.equal(projection.wit.includes("dependent-roundtrip: func(value0: dependent) -> dependent;"), !selection.resultOnly);
		const caller = await dependentCheckedRecordWitCaller(route);
		assert.doesNotMatch(caller, /#include "wit-values\.h"/u);
		assert.equal(caller.includes("#define DEPENDENT_RESULT_ONLY\n"), selection.resultOnly);
		assert.equal(caller.includes('#define DEPENDENT_PARAMETER_PREFIX "value"\n')
			, selection.reviewed);
		for(const name of names) assert.ok(caller.includes(`"${name}"`), name);
		for(const probe of [
			'static value dependent(value bound, value below) { return record2("bound", bound, "below", below); }'
			, "static value huge(void) { static const uint32_t limbs[5] = {0, 0, 0, 0, 4}; return nat(limbs, 5); }"
			, 'REJECTED_BY "mkDependent"'
			, "refuse(dependent(small(2), small(2))); recover();"
			, "refuse(dependent(small(0), small(0))); recover();"
			, "refuse(dependent(small(i + 1), small(i + 1))); recover();"
			, 'expect("dependent-total", dependent(huge(), huge_minus_one()), huge_total());'
			, 'expect("dependent-result", huge(), dependent(huge_plus_one(), huge()));'
			, 'host_refused("dependent-total", dependent(zero_limb(), small(0))); recover();'
			, 'host_refused("dependent-total", one_field("bound", small(1))); recover();'
			, 'host_refused("missing-export", small(1)); recover();'
		]) assert.ok(caller.includes(probe), probe);
	}
});

test("dependent checked-record WIT selection and complete result receipts are closed", () => {
	assert.deepEqual(dependentCheckedRecordWitSelection({}), {
		enabled: false, routes: dependentCheckedRecordWitRoutes, maxLoad: 8
	});
	assert.deepEqual(dependentCheckedRecordWitSelection({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_MAX_LOAD: "12"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_TEST: "2" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_MODES: "full" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_TEST: "1", LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_WIT_MAX_LOAD: "6" }
	]) assert.throws(() => dependentCheckedRecordWitSelection(environment));
	for(const mode of dependentCheckedRecordWitModes)
	{
		const value = dependentCheckedRecordWitCounts[mode];
		assert.deepEqual(parseDependentCheckedRecordWitResult(JSON.stringify(value), mode), value);
		assert.throws(() => parseDependentCheckedRecordWitResult("{}", mode));
		for(const key of Object.keys(value))
			assert.throws(() => parseDependentCheckedRecordWitResult(JSON.stringify({ ...value, [key]: value[key] + 1 }), mode));
	}
});

test("dependent checked-record WIT caller files resolve from one committed root and reconstruct from the producer revision", async () => {
	const git = args => execFileSync("git", args, { encoding: "utf8" });
	// Both files are committed under the shared root; no second fixture directory exists to drift to.
	for(const name of dependentCheckedRecordWitConsumerFiles)
		assert.equal(git(["ls-files", "--error-unmatch", `${dependentCheckedRecordWitConsumerRoot}${name}`]).trim()
			, `${dependentCheckedRecordWitConsumerRoot}${name}`);
	assert.equal(existsSync("tests/fixtures/dependent-checked-record-wit"), false);
	// The report rebuilds each route's caller from git objects at the producer revision, byte-identical
	// to what the fixture reader inlines from the committed working tree.
	const revision = git(["rev-parse", "HEAD"]).trim();
	for(const route of dependentCheckedRecordWitRoutes)
	{
		const mode = dependentCheckedRecordSelection(route).resultOnly ? "result-only" : "full";
		assert.equal(dependentCheckedRecordWitOriginalCaller(revision, route, mode)
			, await dependentCheckedRecordWitCaller(route), route);
		assert.throws(() => dependentCheckedRecordWitOriginalCaller(revision, route
			, mode === "full" ? "result-only" : "full"));
	}
	// A revision from before the caller existed cannot be reconstructed from the working tree instead.
	const introduced = git(["log", "--diff-filter=A", "--format=%H", "--"
		, `${dependentCheckedRecordWitConsumerRoot}wit-wasi.c`]).trim().split("\n").at(-1);
	const before = git(["rev-parse", `${introduced}^`]).trim();
	assert.throws(() => dependentCheckedRecordWitOriginalCaller(before
		, dependentCheckedRecordWitRoutes[0], "full"));
});

test("dependent checked-record WIT immutable C caller compiles against the public Wasmtime header", {
	skip: !existsSync(join(capi, "include/wasmtime.h"))
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-checked-record-wit-source-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of dependentCheckedRecordWitRoutes)
	{
		await saveLakeFile(root, "dependentrecords_wasmtime.h", header(route));
		await saveLakeFile(root, "consumer.c", await dependentCheckedRecordWitCaller(route));
		const result = spawnSync(cc, ["-std=c11", "-Wall", "-Wextra", "-Werror"
			, "-fsyntax-only", `-I${join(capi, "include")}`, "consumer.c"]
		, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } });
		assert.equal(result.error, undefined); assert.equal(result.signal, null);
		assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
	}
});

test("dependent checked-record WIT caller measures exact totals against a stand-in host and refuses faults", {
	skip: !existsSync(join(capi, "lib/libwasmtime.so"))
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-checked-record-wit-model-"));
	t.after(() => rm(root, { recursive: true }));
	assert.match(await readFile(model, "utf8"), /Stand-in host/u);
	const compile = async (route, extra) => {
		// The stand-in host is a separate translation unit: it needs the route's
		// result-only switch itself, while the caller carries it inline.
		const defines = [...dependentCheckedRecordSelection(route).resultOnly ? ["-DDEPENDENT_RESULT_ONLY="] : [], ...extra];
		await saveLakeFile(root, "dependentrecords_wasmtime.h", header(route));
		await saveLakeFile(root, "consumer.c", await dependentCheckedRecordWitCaller(route));
		const result = spawnSync(cc, [
			"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", ...defines
			, `-I${join(capi, "include")}`, `-I${root}`, "consumer.c", model
			, `-L${join(capi, "lib")}`, "-lwasmtime"
			, `-Wl,-rpath,${join(capi, "lib")}`, "-o", "consumer"
		], { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } });
		assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
		return spawnSync(join(root, "consumer"), [], { cwd: root, encoding: "utf8", env: { LC_ALL: "C" }, timeout: 120_000 });
	};
	for(const route of dependentCheckedRecordWitRoutes)
	{
		const selection = dependentCheckedRecordSelection(route), mode = selection.resultOnly ? "result-only" : "full";
		const defines = [...selection.reviewed ? ['-DDEPENDENT_PARAMETER_PREFIX="value"'] : []];
		const run = await compile(route, defines);
		assert.equal(run.status, 0, run.stderr); assert.equal(run.stderr, "");
		assert.deepEqual(parseDependentCheckedRecordWitResult(run.stdout, mode), dependentCheckedRecordWitCounts[mode]);
		t.diagnostic(`${route}: stand-in host passed with ${dependentCheckedRecordWitCounts[mode].checks} checks`);
	}
	for(const [route, faults] of [
		["ordinary-source", ["accept-invalid", "wrong-message", "wrong-produced", "wrong-roundtrip", "missing-producer"]]
		, ["result-only-ordinary-source", ["wrong-produced", "missing-producer", "inputs-exported"]]
	]) for(const fault of faults)
	{
		const run = await compile(route, [`-DDEPENDENT_FAULT="${fault}"`]);
		assert.equal(run.status, 1, `${route} ${fault}`);
		assert.match(run.stderr, /dependent WIT check failed/u);
	}
});
