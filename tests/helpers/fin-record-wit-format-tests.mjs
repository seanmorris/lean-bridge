/**
 * Keep Fin record assertions strict across generator and wasm-tools renderings (#1448).
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { finRecordCompilerModel } from "./fin-record-model.mjs";
import { finRecordWitPatterns } from "./fin-record-install.mjs";
import "./fin-record-wit-format-source-history-tests.mjs";

const accepts = wit => finRecordWitPatterns.every(pattern => pattern.test(wit));
const canonicalLayout = wit => wit.replace(/((?:record|variant) [a-z0-9-]+) \{ ([^{}]+) \}/gu,
	(_all, header, body) => `${header} {\n      ${body.replaceAll(", ", ",\n      ")},\n    }`);
const changes = [
	["Nat limb width", wit => wit.replaceAll("list<u32>", "list<u64>")]
	, ["digit type", wit => wit.replace(/digit: bridge-value-\d+/u, "digit: u32")]
	, ["count type", wit => wit.replace(/count: bridge-value-\d+/u, "count: string")]
	, ["tile field order", wit => wit.replace(/digit: (bridge-value-\d+),(\s*)count: \1/u, "count: $1,$2digit: $1")]
	, ["extra tile field", wit => wit.replace(/(record tile \{\s*)/u, "$1extra: u32, ")]
	, ["nested record type", wit => wit.replace("inner: tile", "inner: slot")]
	, ["nested bound carrier", wit => wit.replace(/tag: bridge-value-\d+/u, "tag: string")]
	, ["nested argument type", wit => wit.replaceAll("nest-sum: func(arg0: nest)", "nest-sum: func(arg0: tile)")]
	, ["nested return type", wit => wit.replaceAll(/nest-sum: func\(arg0: nest\) -> bridge-value-\d+;/gu, "nest-sum: func(arg0: nest) -> u32;")]
	, ["radius type", wit => wit.replace(/radius: bridge-value-\d+/u, "radius: u32")]
	, ["shape case order", wit => wit.replace(/circle\(shape-circle-fields\),(\s*)label\(shape-label-fields\)/u, "label(shape-label-fields),$1circle(shape-circle-fields)")]
	, ["empty case payload", wit => wit.replace(/\bempty(?=,?\s*\})/u, "empty(u32)")]
	, ["shape return type", wit => wit.replaceAll(/shape-size: func\(arg0: shape\) -> bridge-value-\d+;/gu, "shape-size: func(arg0: shape) -> u32;")]
	, ["gate case order", wit => wit.replace(/closed,(\s*)never\(gate-never-fields\)/u, "never(gate-never-fields),$1closed")]
	, ["gate case type", wit => wit.replace("never(gate-never-fields)", "never(tile)")]
];
const rejectChanges = wit => {
	for(const [name, change] of changes)
	{
		const mutant = change(wit);
		assert.notEqual(mutant, wit, name); assert.equal(accepts(mutant), false, name);
	}
};

test("Fin record WIT assertions accept compact and multiline trailing-comma layouts", () => {
	const wit = compileCopiedWitModel(finRecordCompilerModel().bindingIr).wit;
	assert.equal(accepts(wit), true);
	const multiline = canonicalLayout(wit);
	assert.notEqual(multiline, wit); assert.equal(accepts(multiline), true);
	assert.equal(accepts(multiline.replaceAll("\n", "\r\n")), true);
	rejectChanges(wit); rejectChanges(multiline);
});

const selected = process.env.LEAN_BRIDGE_WIT_FIN_FORMAT_TEST === "1"
	|| ["LEAN_BRIDGE_FIN_RECORD_PROFILES", "LEAN_BRIDGE_REVIEWED_FIN_RECORD_PROFILES"]
		.some(variable => process.env[variable]?.split(",").includes("wit-wasi"));
test("actual wasm-tools Fin record round trip preserves strict signature assertions", { skip: !selected, timeout: 60_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-fin-format-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const tool = process.env.LEAN_BRIDGE_WASM_TOOLS ?? resolve(".toolchains/wasm-tools/bin/wasm-tools");
	const execute = (args, options = {}) => execFileSync(tool, args, { timeout: 15_000, maxBuffer: 1024 * 1024, ...options });
	t.diagnostic(execute(["--version"], { encoding: "utf8" }).trim());
	const model = compileCopiedWitModel(finRecordCompilerModel().bindingIr);
	const binary = join(root, "model.wasm");
	execute(["parse", "-", "-o", binary], { input: model.wat });
	execute(["validate", "--features", "component-model", binary]);
	const wit = execute(["component", "wit", binary], { encoding: "utf8" });
	assert.match(wit, /record tile \{\n/u);
	for(const pattern of finRecordWitPatterns) assert.match(wit, pattern);
	rejectChanges(wit);
});
