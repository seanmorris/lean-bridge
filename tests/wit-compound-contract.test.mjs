/**
 * Real parser validation of copied WIT compounds and their admission boundary.
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
import { compoundReviewedIr } from "./helpers/compound-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { validateWitCompoundSignatures } from "./helpers/wit-compound-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("WIT compounds use native options, results and binary tuples", () => {
	const ir = compoundReviewedIr(), model = compileCopiedWitModel(ir);
	assert.equal(model.functions.length, 64);
	assert.equal(model.surface.copies.filter(copy => copy.compound).length, 103);
	assert.equal(model.wit, generateWitPackage(ir).wit);
	assert.deepEqual(model.manifest.deferred, []);
	assert.equal(model.wat, compileCopiedWitModel(structuredClone(ir)).wat);
	const host = renderWitHostSource(model, new Uint8Array());
	for(const pattern of [/WASMTIME_COMPONENT_OPTION/, /WASMTIME_COMPONENT_RESULT/, /WASMTIME_COMPONENT_TUPLE/, /has_value > 1/, /is_ok > 1/, /wasmtime_component_val_delete\(&converted\)/]) assert.match(host, pattern);
});

test("parsed WIT and compiled components preserve every independent compound signature", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-compound-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCopiedWitModel(compoundReviewedIr());
	await saveLakeFile(root, "model.wit", model.wit);
	await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	for(const name of ["model.wit", "model.wasm"])
		validateWitCompoundSignatures(JSON.parse((await runCopied("wasm-tools", ["component", "wit", name, "--json"], root, process.env)).stdout));
});

test("WIT compounds still reject compound callback payloads", () => {
	for(const constructor of ["option", "result", "tuple"]) for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types[0].callable;
		const type = { kind: "apply", constructor, arguments: Array.from({ length: constructor === "option" ? 1 : 2 }, () => ({ kind: "primitive", name: "unit" })) };
		if(position === "parameter") callback.parameters[0].type = type; else callback.result.type = type;
		assert.throws(() => compileCopiedWitModel(ir, {}, { callables: true }), /callbacks currently require copied primitive/);
	}
});

test("canonical variant joins validate every core scalar pairing and the indirect argument boundary", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-compound-layout-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const functions = [];
	for(const ok of ["uint32", "uint64", "float32", "float64"]) for(const error of ["uint32", "uint64", "float32", "float64"])
	{
		const type = { result: [ok, error] };
		functions.push({ name: `Layouts.join_${ok}_${error}`, parameters: [type], result: type });
	}
	for(const count of [8, 9])
	{
		const type = { option: "uint64" };
		functions.push({ name: `Layouts.wide${count}`, parameters: Array(count).fill(type), result: type });
	}
	const mixed = { result: [{ tuple: ["float32", { option: "unit" }] }, { tuple: ["float64", "string"] }] };
	functions.push({ name: "Layouts.mixed", parameters: [mixed], result: mixed });
	const model = compileCopiedWitModel(corpusReviewedIr({ id: "layouts" }, functions));
	await saveLakeFile(root, "layouts.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "layouts.wat", "-o", "layouts.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "layouts.wasm"], root, process.env);
	// Removing the discriminator must make the generated core signature invalid.
	const mutant = model.wat.replace("(param i32 i32 i32)", "(param i32 i32)");
	assert.notEqual(mutant, model.wat);
	await saveLakeFile(root, "mutant.wat", mutant);
	await runCopied("wasm-tools", ["parse", "mutant.wat", "-o", "mutant.wasm"], root, process.env);
	await assert.rejects(runCopied("wasm-tools", ["validate", "mutant.wasm"], root, process.env), /type mismatch|incompatible|expected/);
});
