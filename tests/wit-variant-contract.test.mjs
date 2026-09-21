/**
 * Variant field contracts and canonical layouts checked by the real parser.
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
import { witVariantReviewedIr, validateWitVariantSignatures, checkWitVariantManifest } from "./helpers/wit-variant-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { callableReviewedIr, callableSignatures } from "./helpers/callable-fixture.mjs";
import { witVariantReadme } from "../src/backends/wit/copied-variants.mjs";

const parse = async (root, model) => {
	await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	return Promise.all(["model.wit", "model.wasm"].map(async name => JSON.parse((await runCopied("wasm-tools", ["component", "wit", name, "--json"], root, process.env)).stdout)));
};

test("WIT variants preserve named families, constructor fields and empty versus Unit payloads", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = witVariantReviewedIr(), model = compileCopiedWitModel(ir);
	assert.equal(model.functions.length, 19); assert.equal(model.wit, generateWitPackage(ir).wit);
	assert.equal(model.manifest.contracts.variants.length, 10); checkWitVariantManifest(model.manifest);
	const readme = witVariantReadme(model);
	assert.match(readme, /\| `Wide` \| `wide` \| 257 \|/); assert.doesNotMatch(readme, /undefined/);
	assert.match(readme, /Empty constructors have no payload/);
	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.equal(compileCopiedWitModel(reordered).wat, model.wat);
	assert.match(model.wit, /%bool: bool/); assert.match(model.wit, /%char: char/);
	for(const doc of await parse(root, model))
	{
		validateWitVariantSignatures(doc);
		const altered = structuredClone(doc), iface = altered.interfaces.find(item => item.name === "native");
		altered.types[iface.types["signal-marker-fields"]].kind.record.fields[0].type = "u8";
		assert.throws(() => validateWitVariantSignatures(altered), /Signal/);
	}
	const host = renderWitHostSource(model, new Uint8Array());
	assert.match(host, /WASMTIME_COMPONENT_VARIANT/); assert.match(host, /value->of.variant.val\) return false/);
	assert.match(host, /wasmtime_component_val_delete\(&converted\)/);
	assert.doesNotMatch(host, /lean_ctor_|lean_obj_tag|lean_alloc_ctor/);
});

test("variant aliases preserve original payload types in text and compiled type graphs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-alias-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = witVariantReviewedIr(), signal = ir.types.find(type => type.name === "Signal");
	assert.equal(ir.types.find(type => type.name === "SignalView").target.id, signal.id);
	const view = { kind: "named", id: "lean:Variants.SignalView" };
	ir.types.find(type => type.name === "Packet").fields[0].type = view;
	ir.types.find(type => type.name === "Nested").cases[2].fields[0].type = view;
	ir.declarations[0].parameters[0].type = view; ir.declarations[0].result.type = view;
	const model = compileCopiedWitModel(ir);
	assert.match(model.wit, /type signal-view = signal;/);
	assert.match(model.wit, /record nested-outcome-fields \{ value: signal-view \}/);
	for(const doc of await parse(root, model))
	{
		const iface = doc.interfaces.find(item => item.name === "native");
		assert.equal(doc.types[iface.types["nested-outcome-fields"]].kind.record.fields[0].type, iface.types["signal-view"]);
		assert.equal(doc.types[iface.types.packet].kind.record.fields[0].type, iface.types["signal-view"]);
	}
});

test("canonical variant tags cross the 256-case boundary with correct payload alignment", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-layout-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const count of [1, 256, 257, 1024])
	{
		const ir = witVariantReviewedIr(), type = ir.types.find(type => type.name === "Mode");
		type.cases = Array.from({ length: count }, (_, index) => ({ name: `case${index}`
			, documentation: type.documentation
			, fields: [{ name: "value", type: { kind: "primitive", name: "uint8" }, mutability: "immutable", documentation: type.documentation }] }));
		ir.declarations = ir.declarations.filter(fn => fn.name === "echo_mode"); ir.types = [type];
		const model = compileCopiedWitModel(ir), alignment = count <= 256 ? 1 : 2, bytes = count <= 256 ? 2 : 4;
		assert.ok(model.wat.includes(`(i32.const ${alignment}) (i32.const ${bytes})`));
		await parse(root, model);
	}
});

test("variant identity, cyclic payloads and normalized member collisions reject", () => {
	for(const mutate of [
		ir => { ir.declarations[0].parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Signal").cases[2].fields[0].type = { kind: "named", id: "lean:Variants.Signal" }; }
		, ir => { const fields = ir.types.find(type => type.name === "Signal").cases[2].fields; fields[0].name = "wordCount"; fields[1].name = "word_count"; }
	]) { const ir = witVariantReviewedIr(); mutate(ir); assert.throws(() => compileCopiedWitModel(ir)); }
});

test("variant scalar joins and both sides of the indirect argument boundary validate", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-joins-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const first of ["uint32", "uint64", "float32", "float64"]) for(const second of ["uint32", "uint64", "float32", "float64"])
	{
		const ir = witVariantReviewedIr(), type = ir.types.find(type => type.name === "Mode");
		type.cases = [first, second].map((name, index) => ({ name: `case${index}`
			, documentation: type.documentation
			, fields: [{ name: "value", type: { kind: "primitive", name }, mutability: "immutable", documentation: type.documentation }] }));
		ir.declarations = ir.declarations.filter(fn => fn.name === "echo_mode"); ir.types = [type];
		const fn = ir.declarations[0], parameter = fn.parameters[0];
		for(const count of [8, 9])
		{
			fn.parameters = Array.from({ length: count }, (_, index) => ({ ...structuredClone(parameter), name: `arg${index}` }));
			await parse(root, compileCopiedWitModel(ir));
		}
	}
});

test("named variants and primitive callable resources occupy distinct component type indices", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-resources-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = witVariantReviewedIr(), callbacks = callableReviewedIr(callableSignatures.filter(fn => ["Callables.callUInt32", "Callables.makeUInt32"].includes(fn.name)));
	for(const key of ["producers", "types", "declarations", "errors"]) ir[key].push(...callbacks[key]);
	const model = compileCopiedWitModel(ir, {}, { callables: true });
	assert.equal(model.resources.length, 2);
	for(const doc of await parse(root, model)) for(const name of ["native", "api"])
	{
		const iface = doc.interfaces.find(item => item.name === name);
		assert.ok(iface.functions["call-uint32"]); assert.ok(iface.functions["make-uint32"]);
		let wide = doc.types[iface.types.wide];
		while(Number.isInteger(wide.kind.type)) wide = doc.types[wide.kind.type];
		assert.equal(wide.kind.variant.cases.length, 257);
		for(const resource of model.resources)
		{
			assert.ok(Number.isInteger(iface.types[resource.witName]));
			assert.notEqual(iface.types[resource.witName], iface.types.wide);
		}
	}
});
