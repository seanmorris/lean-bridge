/**
 * Source-only controls for the zero-payload WIT projection and immutable caller.
 * No compiled Lean component or installed package executes here; a stand-in
 * host over the Wasmtime C value types measures the caller's exact totals.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import {
	zeroPayloadBrowserInputNames, zeroPayloadBrowserResultNames
	, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";
import {
	parseZeroPayloadWitResult, zeroPayloadWitCaller, zeroPayloadWitConfiguration
	, zeroPayloadWitCounts, zeroPayloadWitModes, zeroPayloadWitRoutes
	, zeroPayloadWitSelection, zeroPayloadWitTarget
} from "./zero-payload-checked-record-wit-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const snake = name => name.replace(/([A-Z])/gu, "-$1").toLowerCase();
const capi = resolve(".toolchains/wasmtime42");
const cc = process.env.CC ?? "/usr/bin/cc";
const model = resolve("tests/helpers/zero-payload-checked-record-wit-model.c");
const header = route => renderWitHostHeader(compileCopiedWitModel(
	zeroPayloadBrowserSelection(route).expected, zeroPayloadWitTarget, { callables: true }
));

test("zero-payload WIT retains all four author routes and the empty-carrier projection", async () => {
	assert.deepEqual(zeroPayloadWitRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(zeroPayloadWitTarget, { name: "zeropayloadcheckedrecords", version: "1.0.0" });
	assert.deepEqual(zeroPayloadWitModes, ["full", "result-only"]);
	for(const route of zeroPayloadWitRoutes)
	{
		const selection = zeroPayloadBrowserSelection(route);
		const configuration = zeroPayloadWitConfiguration(route);
		validateExportConfiguration(configuration); validateBindingIr(selection.expected);
		assert.deepEqual(configuration, { ...selection.configuration
			, targets: { "wit-wasi": zeroPayloadWitTarget } });
		assert.deepEqual(configuration.modules, ["ZeroPayloadCheckedRecords"]);
		const projection = compileCopiedWitModel(selection.expected
			, zeroPayloadWitTarget, { callables: true });
		const names = (selection.resultOnly ? zeroPayloadBrowserResultNames
			: [...zeroPayloadBrowserInputNames, ...zeroPayloadBrowserResultNames]).map(snake);
		assert.deepEqual([...projection.surface.functions.map(fn => fn.witName)].sort(), [...names].sort());
		assert.match(projection.wit, /enum witness \{ empty \}/u);
		assert.match(projection.wit, /enum marker \{ empty \}/u);
		assert.match(projection.wit, /enum bridge-value-\d+ \{ unit \}/u);
		assert.match(projection.wit, /record token \{ tag: bridge-value-\d+ \}/u);
		assert.match(projection.wit, /type bridge-value-\d+ = list<witness>;/u);
		assert.match(projection.wit, /type bridge-value-\d+ = option<witness>;/u);
		assert.match(projection.wit, /record mark-marked-fields \{ witness: witness \}/u);
		assert.match(projection.wit, /variant mark \{ blank, marked\(mark-marked-fields\) \}/u);
		assert.doesNotMatch(projection.wit, /positive|fresh/u);
		assert.equal(projection.wit.includes("absent-count: func(value0: witness)"), !selection.resultOnly);
		const caller = await zeroPayloadWitCaller(route);
		assert.doesNotMatch(caller, /#include "wit-values\.h"/u);
		assert.equal(caller.includes("#define ZERO_PAYLOAD_RESULT_ONLY\n"), selection.resultOnly);
		assert.equal(caller.includes('#define ZERO_PAYLOAD_PARAMETER_PREFIX "value"\n')
			, selection.reviewed);
		for(const name of names) assert.ok(caller.includes(`"${name}"`), name);
		for(const probe of [
			'static value witness(void) { return enum_case("empty"); }'
			, 'static value unit_value(void) { return enum_case("unit"); }'
			, 'refused("absent-count", witness()'
			, 'REJECTED_BY "mkAbsent"'
			, 'host_refused("witness-count", enum_case("full"))'
			, 'host_refused("mark-count", variant("marked", NULL))'
			, 'expect("maybe-witness", boolean(false), none())'
			, 'expect("witnesses", small(0), witnesses(0))'
			, 'expect("produce-mark", boolean(true), marked())'
		]) assert.ok(caller.includes(probe), probe);
	}
});

test("zero-payload WIT selection and complete result receipts are closed", () => {
	assert.deepEqual(zeroPayloadWitSelection({}), {
		enabled: false, routes: zeroPayloadWitRoutes, maxLoad: 8
	});
	assert.deepEqual(zeroPayloadWitSelection({
		LEAN_BRIDGE_ZERO_PAYLOAD_WIT_TEST: "1"
		, LEAN_BRIDGE_ZERO_PAYLOAD_WIT_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_ZERO_PAYLOAD_WIT_MAX_LOAD: "12"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_ZERO_PAYLOAD_WIT_TEST: "2" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_WIT_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_WIT_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_WIT_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_WIT_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_WIT_MODES: "full" }
		, { LEAN_BRIDGE_ZERO_PAYLOAD_WIT_TEST: "1", LEAN_BRIDGE_ZERO_PAYLOAD_WIT_MAX_LOAD: "6" }
	]) assert.throws(() => zeroPayloadWitSelection(environment));
	for(const mode of zeroPayloadWitModes)
	{
		const value = zeroPayloadWitCounts[mode];
		assert.deepEqual(parseZeroPayloadWitResult(JSON.stringify(value), mode), value);
		assert.throws(() => parseZeroPayloadWitResult("{}", mode));
		for(const key of Object.keys(value))
			assert.throws(() => parseZeroPayloadWitResult(JSON.stringify({ ...value, [key]: value[key] + 1 }), mode));
	}
});

test("zero-payload WIT immutable C caller compiles against the public Wasmtime header", {
	skip: !existsSync(join(capi, "include/wasmtime.h"))
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-wit-source-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of zeroPayloadWitRoutes)
	{
		await saveLakeFile(root, "zeropayloadcheckedrecords_wasmtime.h", header(route));
		await saveLakeFile(root, "consumer.c", await zeroPayloadWitCaller(route));
		const result = spawnSync(cc, ["-std=c11", "-Wall", "-Wextra", "-Werror"
			, "-fsyntax-only", `-I${join(capi, "include")}`, "consumer.c"]
		, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } });
		assert.equal(result.error, undefined); assert.equal(result.signal, null);
		assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
	}
});

test("zero-payload WIT caller measures exact totals against a stand-in host and refuses faults", {
	skip: !existsSync(join(capi, "lib/libwasmtime.so"))
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-wit-model-"));
	t.after(() => rm(root, { recursive: true }));
	assert.match(await readFile(model, "utf8"), /Stand-in host/u);
	const compile = async (route, extra) => {
		// The stand-in host is a separate translation unit: it needs the route's
		// result-only switch itself, while the caller carries it inline.
		const defines = [...zeroPayloadBrowserSelection(route).resultOnly ? ["-DZERO_PAYLOAD_RESULT_ONLY="] : [], ...extra];
		await saveLakeFile(root, "zeropayloadcheckedrecords_wasmtime.h", header(route));
		await saveLakeFile(root, "consumer.c", await zeroPayloadWitCaller(route));
		const result = spawnSync(cc, [
			"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", ...defines
			, `-I${join(capi, "include")}`, `-I${root}`, "consumer.c", model
			, `-L${join(capi, "lib")}`, "-lwasmtime"
			, `-Wl,-rpath,${join(capi, "lib")}`, "-o", "consumer"
		], { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } });
		assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
		return spawnSync(join(root, "consumer"), [], { cwd: root, encoding: "utf8", env: { LC_ALL: "C" }, timeout: 60_000 });
	};
	for(const route of zeroPayloadWitRoutes)
	{
		const selection = zeroPayloadBrowserSelection(route), mode = selection.resultOnly ? "result-only" : "full";
		const defines = [...selection.reviewed ? ['-DZERO_PAYLOAD_PARAMETER_PREFIX="value"'] : []];
		const run = await compile(route, defines);
		assert.equal(run.status, 0, run.stderr); assert.equal(run.stderr, "");
		assert.deepEqual(parseZeroPayloadWitResult(run.stdout, mode), zeroPayloadWitCounts[mode]);
		t.diagnostic(`${route}: stand-in host passed with ${zeroPayloadWitCounts[mode].checks} checks`);
	}
	for(const [route, faults] of [
		["ordinary-source", ["accept-invalid", "wrong-message", "wrong-produced", "option-collapsed", "array-length"]]
		, ["result-only-ordinary-source", ["wrong-produced", "option-collapsed", "array-length", "inputs-exported"]]
	]) for(const fault of faults)
	{
		const run = await compile(route, [`-DZERO_PAYLOAD_FAULT="${fault}"`]);
		assert.equal(run.status, 1, `${route} ${fault}`);
		assert.match(run.stderr, /zero-payload WIT check failed/u);
	}
});
