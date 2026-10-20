/**
 * Source-only controls for the value-index WIT projection and immutable caller.
 * No compiled Lean component or installed package executes here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import {
	checkedRecordValueIndexBrowserSelection, checkedRecordValueIndexInputNames
	, checkedRecordValueIndexResultNames
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexWitCaller, checkedRecordValueIndexWitConfiguration
	, checkedRecordValueIndexWitCounts, checkedRecordValueIndexWitModes
	, checkedRecordValueIndexWitRoutes, checkedRecordValueIndexWitSelection
	, checkedRecordValueIndexWitTarget, parseCheckedRecordValueIndexWitResult
} from "./checked-record-value-index-wit-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const snake = name => name.replace(/([A-Z])/gu, "-$1").toLowerCase();

test("value-index WIT retains all four author routes and exact component projections", async () => {
	assert.deepEqual(checkedRecordValueIndexWitRoutes, [
		"ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"
	]);
	assert.deepEqual(checkedRecordValueIndexWitTarget, {
		name: "checkedrecordvalueindices", version: "1.0.0"
	});
	assert.deepEqual(checkedRecordValueIndexWitModes, ["full", "result-only"]);
	for(const route of checkedRecordValueIndexWitRoutes)
	{
		const selection = checkedRecordValueIndexBrowserSelection(route);
		const configuration = checkedRecordValueIndexWitConfiguration(route);
		validateExportConfiguration(configuration); validateBindingIr(selection.expected);
		assert.deepEqual(configuration, { ...selection.configuration
			, targets: { "wit-wasi": checkedRecordValueIndexWitTarget } });
		const projection = compileCopiedWitModel(selection.expected
			, checkedRecordValueIndexWitTarget, { callables: true });
		const names = (selection.resultOnly ? checkedRecordValueIndexResultNames
			: [...checkedRecordValueIndexInputNames, ...checkedRecordValueIndexResultNames]).map(snake);
		assert.deepEqual(projection.surface.functions.map(fn => fn.witName), names);
		assert.match(projection.wit, /record on \{ count: bridge-value-0 \}/u);
		assert.match(projection.wit, /record empty-sized \{ data: bridge-value-6 \}/u);
		const caller = await checkedRecordValueIndexWitCaller(route);
		assert.doesNotMatch(caller, /#include "wit-values\.h"/u);
		assert.equal(caller.includes("#define VALUE_INDEX_RESULT_ONLY\n"), selection.resultOnly);
		assert.equal(caller.includes('#define VALUE_INDEX_PARAMETER_PREFIX "value"\n')
			, selection.reviewed);
		for(const name of names) assert.ok(caller.includes(`"${name}"`), name);
	}
});

test("value-index WIT selection and complete result receipts are closed", () => {
	assert.deepEqual(checkedRecordValueIndexWitSelection({}), {
		enabled: false, routes: checkedRecordValueIndexWitRoutes, maxLoad: 8
	});
	assert.deepEqual(checkedRecordValueIndexWitSelection({
		LEAN_BRIDGE_VALUE_INDEX_WIT_TEST: "1"
		, LEAN_BRIDGE_VALUE_INDEX_WIT_ROUTES: "reviewed-ir"
		, LEAN_BRIDGE_VALUE_INDEX_WIT_MAX_LOAD: "12"
	}), { enabled: true, routes: ["reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_VALUE_INDEX_WIT_TEST: "2" }
		, { LEAN_BRIDGE_VALUE_INDEX_WIT_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_VALUE_INDEX_WIT_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_WIT_ROUTES: "ordinary" }
		, { LEAN_BRIDGE_VALUE_INDEX_WIT_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_WIT_MODES: "full" }
		, { LEAN_BRIDGE_VALUE_INDEX_WIT_TEST: "1", LEAN_BRIDGE_VALUE_INDEX_WIT_MAX_LOAD: "6" }
	]) assert.throws(() => checkedRecordValueIndexWitSelection(environment));
	for(const mode of checkedRecordValueIndexWitModes)
	{
		const value = checkedRecordValueIndexWitCounts[mode];
		assert.deepEqual(parseCheckedRecordValueIndexWitResult(JSON.stringify(value), mode), value);
		assert.throws(() => parseCheckedRecordValueIndexWitResult("{}", mode));
	}
});

test("value-index WIT immutable C caller compiles against the public Wasmtime header", {
	skip: !existsSync(resolve(".toolchains/wasmtime42/include/wasmtime.h"))
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-wit-source-"));
	t.after(() => rm(root, { recursive: true }));
	const capi = resolve(".toolchains/wasmtime42"), cc = process.env.CC ?? "/usr/bin/cc";
	for(const route of checkedRecordValueIndexWitRoutes)
	{
		const selection = checkedRecordValueIndexBrowserSelection(route);
		const projection = compileCopiedWitModel(selection.expected
			, checkedRecordValueIndexWitTarget, { callables: true });
		await saveLakeFile(root, "checkedrecordvalueindices_wasmtime.h", renderWitHostHeader(projection));
		await saveLakeFile(root, "consumer.c", await checkedRecordValueIndexWitCaller(route));
		const result = spawnSync(cc, ["-std=c11", "-Wall", "-Wextra", "-Werror"
			, "-fsyntax-only", `-I${join(capi, "include")}`, "consumer.c"]
		, { cwd: root, encoding: "utf8", env: { PATH: "/usr/bin:/bin", LC_ALL: "C" } });
		assert.equal(result.error, undefined); assert.equal(result.signal, null);
		assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
	}
});
