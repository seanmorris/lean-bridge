/**
 * Parsed and binary WIT List signatures retain semantic and ownership boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { generateWitPackage } from "../src/backends/wit/generate.mjs";
import { renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { validateWitListSignatures } from "./helpers/wit-list-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("WIT Lists use canonical lists with distinct source and native identities", () => {
	const ir = listReviewedIr(), model = compileCopiedWitModel(ir);
	assert.equal(model.functions.length, 27);
	assert.equal(model.wit, generateWitPackage(ir).wit);
	assert.deepEqual(model.manifest.deferred, []);
	assert.equal(model.wat, compileCopiedWitModel(structuredClone(ir)).wat);
	const list = model.surface.copies.find(copy => copy.ref.constructor === "list" && copy.element.scalarName === "uint32");
	const array = model.surface.copies.find(copy => copy.ref.constructor === "array" && copy.element.scalarName === "uint32");
	assert.ok(list && array); assert.notEqual(list.name, array.name); assert.notEqual(list.index, array.index);
	for(const copy of [list, array]) assert.ok(model.wit.includes(`type ${copy.witName} = list<u32>;`));
	const host = renderWitHostSource(model, new Uint8Array());
	for(const pattern of [/WASMTIME_COMPONENT_LIST/, /lb_charge\(scope, value->length/, /if \(!count\) return true/, /!data \|\| !width/, /wasmtime_component_val_delete\(&converted\)/, /lb_scope_close\(&scope\)/]) assert.match(host, pattern);
	for(const copy of [list, array]) assert.ok(host.includes(`lb_buffer(value->data, value->length, sizeof(${copy.element.name}), _Alignof(${copy.element.name}))`));
	assert.doesNotMatch(host, /lean_ctor_|lean_obj_tag/);
});

test("parsed WIT and compiled components preserve all independent List signatures", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-list-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCopiedWitModel(listReviewedIr());
	await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	for(const name of ["model.wit", "model.wasm"])
	{
		const document = JSON.parse((await runCopied("wasm-tools", ["component", "wit", name, "--json"], root, process.env)).stdout);
		validateWitListSignatures(document);
		document.interfaces.find(iface => iface.name === "api").functions["reverse-uint32"].result = "bool";
		assert.throws(() => validateWitListSignatures(document));
	}
});

test("WIT copied Lists keep List callback payloads and excessive type nesting closed", () => {
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types[0].callable;
		const type = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "unit" }] };
		if(position === "parameter") callback.parameters[0].type = type; else callback.result.type = type;
		assert.throws(() => compileCopiedWitModel(ir, {}, { callables: true }), /callbacks currently require copied primitive/);
	}
	let type = "uint32";
	for(let depth = 0; depth < 34; depth++) type = { list: type };
	assert.throws(() => compileCopiedWitModel(corpusReviewedIr({ id: "deep" }, [{ name: "Deep.echo", parameters: [type], result: type }])), /at most 32|nesting|depth/i);
});

test("List canonical layouts validate both sides of the flat-argument boundary", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-list-layout-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const functions = [8, 9].map(count => ({ name: `Layouts.wide${count}`, parameters: Array(count).fill({ list: { tuple: ["float64", "bool"] } }), result: { list: "uint64" } }));
	const model = compileCopiedWitModel(corpusReviewedIr({ id: "layouts" }, functions));
	await saveLakeFile(root, "layouts.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "layouts.wat", "-o", "layouts.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "layouts.wasm"], root, process.env);
});
