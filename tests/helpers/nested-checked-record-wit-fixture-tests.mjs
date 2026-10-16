/**
 * Source-only controls for the nested checked-record WIT caller. No compiled Lean
 * component or installed package executes here; the caller runs against a C stand-in.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader } from "../../src/backends/wit/copied-host.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nestedCheckedRecordConfiguration, nestedCheckedRecordReview } from "./nested-checked-record-fixture.mjs";
import {
	nestedCheckedRecordWitCaller
	, nestedCheckedRecordWitConfiguration
	, nestedCheckedRecordWitCounts
	, nestedCheckedRecordWitModes
	, nestedCheckedRecordWitReview
	, nestedCheckedRecordWitRoutes
	, nestedCheckedRecordWitSelection
	, nestedCheckedRecordWitTarget
	, parseNestedCheckedRecordWitResult
} from "./nested-checked-record-wit-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const capi = process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42");
const cc = process.env.CC ?? "/usr/bin/cc";
const callerControls = process.env.LEAN_BRIDGE_WASMTIME_C_API !== undefined
	|| existsSync(join(capi, "include/wasmtime.h"));
const witNames = [
	"first", "second", "pair", "in-array", "in-list", "in-option"
	, "in-product", "in-except", "in-holder", "in-choice", "echo-array"
	, "produce-option", "produce-array"
];

test("nested checked-record WIT keeps both author contracts and constructor-free results", async () => {
	for(const route of nestedCheckedRecordWitRoutes) for(const mode of nestedCheckedRecordWitModes)
	{
		const expected = nestedCheckedRecordConfiguration(route, ["c"], mode);
		const actual = nestedCheckedRecordWitConfiguration(route, mode); validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { "wit-wasi": { name: "nestedcheckedrecords", version: "1.0.0" } });
		const review = nestedCheckedRecordWitReview(mode); validateBindingIr(review);
		assert.deepEqual(review, nestedCheckedRecordReview(mode));
		const projection = compileCopiedWitModel(review, actual.targets["wit-wasi"], { callables: true });
		const names = mode === "full" ? witNames : witNames.slice(-2);
		assert.deepEqual(projection.surface.functions.map(fn => fn.witName), names);
		const packet = projection.surface.copies.find(copy => copy.witName === "packet");
		assert.deepEqual(packet.fields.map(field => [field.witName, field.type.wit]), [["digit", "bridge-value-0"], ["word", "bridge-value-0"]]);
		assert.match(projection.wit, /type bridge-value-0 = list<u32>;\n {2}record packet \{ digit: bridge-value-0, word: bridge-value-0 \}\n/u);
		if(mode === "full")
		{
			assert.match(projection.wit, /record holder \{ packet: packet, tag: bridge-value-0 \}/u);
			assert.match(projection.wit, /variant choice \{ empty, packet\(choice-packet-fields\) \}/u);
		}
		const caller = await nestedCheckedRecordWitCaller(route, mode);
		assert.doesNotMatch(caller, /#include "wit-values\.h"/u);
		assert.equal(caller.includes("#define NESTED_CHECKED_RECORD_RESULT_ONLY\n"), mode === "result-only");
		assert.equal(caller.includes('#define NESTED_PARAMETER_PREFIX "value"\n'), route === "reviewed");
		for(const name of names) assert.ok(caller.includes(`"${name}"`), name);
	}
});

test("nested checked-record WIT selections refuse disabled explicit work and unknown or duplicate selections", () => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_WIT_";
	assert.deepEqual(nestedCheckedRecordWitSelection({})
		, { enabled: false, routes: [...nestedCheckedRecordWitRoutes], modes: [...nestedCheckedRecordWitModes] });
	const enabled = {
		[prefix + "TEST"]: "1", [prefix + "ROUTES"]: "reviewed"
		, [prefix + "MODES"]: "result-only", [prefix + "OUTPUT"]: "build/x"
	};
	assert.deepEqual(nestedCheckedRecordWitSelection(enabled)
		, { enabled: true, routes: ["reviewed"], modes: ["result-only"] });
	for(const selection of [
		{ [prefix + "TEST"]: "yes" }, { [prefix + "ROUTES"]: "reviewed" }
		, { [prefix + "OUTPUT"]: "build/x" }
		, { [prefix + "TEST"]: "1", [prefix + "ROUTES"]: "other" }
		, { [prefix + "TEST"]: "1", [prefix + "MODES"]: "full,full" }
		, { [prefix + "TEST"]: "1", [prefix + "MODES"]: "" }
		, { [prefix + "TEST"]: "1", [prefix + "OUTPUT"]: "" }
	]) assert.throws(() => nestedCheckedRecordWitSelection(selection), JSON.stringify(selection));
	for(const mode of nestedCheckedRecordWitModes)
	{
		assert.deepEqual(parseNestedCheckedRecordWitResult(JSON.stringify(nestedCheckedRecordWitCounts[mode]), mode)
			, nestedCheckedRecordWitCounts[mode]);
		assert.throws(() => parseNestedCheckedRecordWitResult(JSON.stringify({ ...nestedCheckedRecordWitCounts[mode], checks: 1 }), mode));
	}
});

export const nestedCheckedRecordWitResultFaults = Object.freeze([
	"produce-offset", "produce-array-length", "accept-noncanonical"
	, "accept-wrong-kind", "wrong-host-diagnostic", "changed-field-name"
	, "input-mutation"
]);
export const nestedCheckedRecordWitInputFaults = Object.freeze([
	"missing-fin", "fin-after-constructor", "missing-normalization"
	, "conflated-constructor", "diagnostic-suffix", "wrong-path", "wrong-choice"
	, "except-swapped", "holder-tag", "echo-normalizes", "mutate-accepted-input"
	, "mutate-rejected-input", "list-as-array"
]);

for(const route of nestedCheckedRecordWitRoutes) for(const mode of nestedCheckedRecordWitModes)
	test(`nested checked-record WIT independent C caller model detects semantic faults ${route} ${mode}`, { skip: !callerControls, timeout: 300_000 }, async t => {
		assert.ok(isAbsolute(cc) && isAbsolute(capi));
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-wit-model-")); let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true }); else t.diagnostic(`Retained failed WIT model inputs: ${root}`);
		});
		const commands = [], environment = { PATH: "/usr/bin:/bin", LC_ALL: "C" };
		const run = async (command, args, extra = {}) => {
			const env = { ...environment, ...extra };
			const result = spawnSync(command, args
				, { cwd: root, env, encoding: "utf8", maxBuffer: 4 * 1024 ** 2, timeout: 60_000 });
			const { status, signal, stdout, stderr } = result;
			commands.push({ command, args, environment: env, status, signal, stdout, stderr });
			await saveLakeFile(root, "commands.json", canonicalJson(commands));
			assert.equal(result.error, undefined); assert.equal(result.signal, null); return commands.at(-1);
		};
		const projection = compileCopiedWitModel(nestedCheckedRecordWitReview(mode), { ...nestedCheckedRecordWitTarget }, { callables: true });
		await saveLakeFile(root, "nestedcheckedrecords_wasmtime.h", renderWitHostHeader(projection));
		await saveLakeFile(root, "consumer.c", await nestedCheckedRecordWitCaller(route, mode));
		await saveLakeFile(root, "wit-values.h", await readFile("tests/fixtures/nested-checked-record-consumers/wit-values.h"));
		const defines = (mode === "result-only" ? "#define NESTED_CHECKED_RECORD_RESULT_ONLY\n" : "")
			+ (route === "reviewed" ? '#define NESTED_PARAMETER_PREFIX "value"\n' : "");
		await saveLakeFile(root, "model.c", defines + await readFile("tests/helpers/nested-checked-record-wit-model.c", "utf8"));
		const compile = await run(cc, [
			"-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"
			, `-I${join(capi, "include")}`, "consumer.c", "model.c"
			, `-L${join(capi, "lib")}`, `-Wl,-rpath,${join(capi, "lib")}`
			, "-lwasmtime", "-o", "consumer"
		]);
		assert.equal(compile.status, 0, compile.stderr); assert.equal(compile.stderr, "");
		const baseline = await run(join(root, "consumer"), []);
		assert.equal(baseline.status, 0, baseline.stderr); assert.equal(baseline.stderr, "");
		parseNestedCheckedRecordWitResult(baseline.stdout, mode);
		const faults = [...nestedCheckedRecordWitResultFaults, ...mode === "full" ? nestedCheckedRecordWitInputFaults : []];
		for(const fault of faults)
		{
			const changed = await run(join(root, "consumer"), [], { NESTED_WIT_FAULT: fault });
			assert.equal(changed.status, 1, fault); assert.equal(changed.stdout, "");
			assert.match(changed.stderr, /nested WIT check failed/u, fault);
		}
		t.diagnostic(`${faults.length} incorrect stand-ins rejected; no compiled Lean or installed Component Model claim`);
		complete = true;
	});
