/**
 * Independent offset expectations and compiler checks for owned wasm32 values.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileOwnedJavaScriptWasmLayout } from "../src/backends/javascript/owned-wasm-layout.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const scalarFixture = () => {
	const ir = ownedAggregateReviewedIr();
	const payload = ir.types.find(type => type.name === "Payload"), template = payload.fields[0];
	const names = ["unit", "bool", "char", "string", "bytes", "nat", "int"
		, "uint8", "uint16", "uint32", "uint64", "usize"
		, "int8", "int16", "int32", "int64", "isize", "float32", "float64"];
	payload.fields = names.map(name => ({ ...template, name, type: { kind: "primitive", name } }));
	const empty = { ...payload, id: "lean:Owned.Empty", name: "Empty", fields: [] };
	ir.types.push(empty);
	payload.fields.push({ ...template, name: "empty", type: { kind: "named", id: empty.id } });
	return ir;
};

test("owned JavaScript layout preserves wasm32 pointers and full-width resource identities", () => {
	const ir = ownedAggregateReviewedIr(), before = structuredClone(ir);
	const layout = compileOwnedJavaScriptWasmLayout(ir), types = new Map(layout.types.map(type => [type.id, type]));
	assert.deepEqual(ir, before); assert.deepEqual(compileOwnedJavaScriptWasmLayout(ir), layout);
	assert.equal(layout.native.wordBits, 32); assert.equal(Object.isFrozen(layout.types), true);
	assert.deepEqual([types.get("lean:Owned.Ticket").size, types.get("lean:Owned.Ticket").alignment], [8, 8]);
	const bundle = types.get("lean:Owned.Bundle");
	assert.equal(bundle.size, 24); assert.equal(bundle.alignment, 8);
	assert.deepEqual(bundle.fields.map(field => field.offset), [0, 8, 12, 16, 20]);
	assert.deepEqual(bundle.fields.map(field => field.pointer), [false, true, true, true, true]);
	const choice = types.get("lean:Owned.Choice");
	assert.equal(choice.size, 24); assert.equal(choice.alignment, 8);
	assert.deepEqual(choice.cases.map(branch => branch.fields.map(field => field.offset)), [[], [8], [8, 16], [8]]);
	const tree = types.get("lean:Owned.Tree");
	assert.equal(tree.size, 16); assert.equal(tree.cases[1].fields[0].pointer, true);
	for(const type of layout.types.filter(type => type.element))
	{
		assert.equal(type.size, 8); assert.equal(type.alignment, 4);
		assert.equal(type.elementSize, types.get(type.element).size);
	}
	for(const callback of layout.types.filter(type => type.kind === "callback"))
		assert.deepEqual([callback.size, callback.alignment], [8, 8]);
});

test("owned JavaScript scalar storage keeps fixed-width numbers and dynamic payloads distinct", () => {
	const layout = compileOwnedJavaScriptWasmLayout(scalarFixture());
	const types = new Map(layout.types.map(type => [type.id, type]));
	for(const name of ["uint64", "int64", "float64"])
		assert.deepEqual([types.get(`primitive:${name}`).size, types.get(`primitive:${name}`).alignment], [8, 8]);
	for(const name of ["usize", "isize", "uint32", "int32", "float32", "char"])
		assert.deepEqual([types.get(`primitive:${name}`).size, types.get(`primitive:${name}`).alignment], [4, 4]);
	for(const name of ["string", "bytes", "nat"])
	{
		const type = types.get(`primitive:${name}`);
		assert.equal(type.size, 8); assert.equal(type.alignment, 4);
		assert.deepEqual(type.members.map(member => [member.path, member.offset]), [["data", 0], ["length", 4]]);
	}
	const integer = types.get("primitive:int");
	assert.equal(integer.size, 12); assert.equal(integer.alignment, 4);
	assert.deepEqual(integer.members.map(member => [member.path, member.offset]), [["data", 0], ["length", 4], ["negative", 8]]);
	assert.deepEqual([types.get("lean:Owned.Empty").size, types.get("lean:Owned.Empty").alignment], [1, 1]);
	assert.equal(layout.types.find(type => type.name === "Payload").fields.at(-1).pointer, true);
});

test("owned JavaScript layout retains option/result storage and resolves aliases without expansion", () => {
	const layout = compileOwnedJavaScriptWasmLayout(ownedAggregateReviewedIr());
	const option = layout.types.find(type => type.kind === "option" && type.fields[0].type === "lean:Owned.Ticket");
	assert.equal(option.size, 16); assert.equal(option.alignment, 8);
	assert.deepEqual(option.members.map(member => [member.path, member.offset]), [["tag", 0], ["f0", 8]]);
	const result = layout.types.find(type => type.kind === "result");
	assert.equal(result.size, 16); assert.equal(result.alignment, 8);
	assert.deepEqual(result.fields.map(field => field.offset), [4, 8]);
	assert.equal(layout.native.aliases.find(alias => alias.id === "lean:Owned.BundleAlias").target, "lean:Owned.Bundle");
	assert.match(layout.assertions, /__wasm32__/);
	assert.match(layout.assertions, /offsetof\([^,]+, cases.c2.f1\) == 16/);
});

test("the actual wasm32 compiler agrees with every owned JavaScript size and offset", {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_TEST !== "1", timeout: 120000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-owned-js-layout-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const sdk = resolve(process.env.LEAN_WASM_EMSDK ?? ".toolchains/emsdk");
	const run = () => processBuildRunner.capture({ command: join(sdk, "upstream/emscripten/emcc")
		, args: ["-std=c11", "-Wall", "-Wextra", "-Werror", "-c", "check.c", "-o", "check.o"]
		, cwd: directory
		, env: { ...process.env, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten") }
		, timeoutMs: 60000 });
	for(const ir of [ownedAggregateReviewedIr(), scalarFixture()])
	{
		const layout = compileOwnedJavaScriptWasmLayout(ir);
		await saveLakeFile(directory, "owned-values.h", layout.native.header);
		await saveLakeFile(directory, "owned-js-layout.h", layout.assertions);
		await saveLakeFile(directory, "check.c", '#include "owned-js-layout.h"\n');
		try
		{ await run(); }
		catch(error)
		{ t.diagnostic(error.details?.stderr ?? error.message); throw error; }
		const corrupt = layout.assertions.replace("sizeof(void *) == 4", "sizeof(void *) == 8");
		assert.notEqual(corrupt, layout.assertions);
		await saveLakeFile(directory, "owned-js-layout.h", corrupt);
		await assert.rejects(run, error => error.details?.stderr?.includes("Owned JavaScript requires wasm32"));
		const ticket = layout.types.find(type => type.kind === "resource");
		const offset = `offsetof(${ticket.cName}, token) == 0`;
		const wrongOffset = layout.assertions.replace(offset, offset.replace("== 0", "== 4"));
		assert.notEqual(wrongOffset, layout.assertions);
		await saveLakeFile(directory, "owned-js-layout.h", wrongOffset);
		await assert.rejects(run, error => error.details?.stderr?.includes(`Owned JavaScript field: ${ticket.index}.token`));
	}
});
