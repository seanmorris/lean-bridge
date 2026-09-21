/**
 * Source alias chains survive text WIT and the executable component's type table.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { validateWitAliasSignatures, witAliasNames } from "./helpers/wit-alias-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("WIT alias contracts retain original sites, fields and target conversion indices", () => {
	const ir = nativeAliasReviewedIr(), model = compileCopiedWitModel(ir);
	assert.equal(model.manifest.aliases.length, 27);
	assert.match(model.wit, /type count = au32;/);
	assert.match(model.wit, /increment: func\(value0: count\) -> other-count;/);
	assert.match(model.wit, /record packet \{ count: count, text: atext, rows: rows, maybe: maybe, outcome: outcome \}/);
	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.equal(model.wit, compileCopiedWitModel(reordered).wit);
	assert.equal(model.wat, compileCopiedWitModel(reordered).wat);
	for(const alias of model.manifest.aliases)
	{
		const original = ir.types.find(type => type.id === alias.id);
		assert.equal(alias.witName, witAliasNames[original.name]);
		assert.deepEqual(alias.target, original.target);
	}
	for(const fn of model.surface.functions)
	{
		const contract = model.manifest.contracts.declarations.find(item => item.id === fn.declaration.id);
		assert.deepEqual(contract.parameters.map(site => site.type), fn.declaration.parameters.map(site => site.type));
		assert.deepEqual(contract.result.type, fn.declaration.result.type);
		for(const [index, site] of fn.parameters.entries())
		{
			const copy = model.surface.copy(fn.declaration.parameters[index].type);
			assert.equal(site.copy.index, copy.index); assert.equal(site.copy.name, copy.name);
		}
		assert.equal(fn.resultCopy.index, model.surface.copy(fn.declaration.result.type).index);
	}
	for(const record of model.manifest.contracts.records)
		assert.deepEqual(record.fields.map(field => field.type), ir.types.find(type => type.id === record.id).fields.map(field => field.type));
});

test("parsed WIT and compiled aliases preserve each named contract and chain", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const model = compileCopiedWitModel(nativeAliasReviewedIr());
	await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	for(const name of ["model.wit", "model.wasm"])
	{
		const document = JSON.parse((await runCopied("wasm-tools", ["component", "wit", name, "--json"], root, process.env)).stdout);
		validateWitAliasSignatures(document);
		const altered = structuredClone(document), native = altered.interfaces.find(iface => iface.name === "native");
		altered.types[native.types.count].kind = { type: "u32" };
		assert.throws(() => validateWitAliasSignatures(altered), /Count/);
		const fields = structuredClone(document), iface = fields.interfaces.find(iface => iface.name === "native");
		fields.types[iface.types.packet].kind.record.fields[0].type = iface.types["other-count"];
		assert.throws(() => validateWitAliasSignatures(fields), /Packet/);
	}
});

test("same-representation containers retain different nested alias contracts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-nesting-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = nativeAliasReviewedIr(), fn = ir.declarations.find(fn => fn.name === "increment");
	for(const site of [fn.parameters[0], fn.result]) site.type = { kind: "apply", constructor: "array", arguments: [site.type] };
	const model = compileCopiedWitModel(ir), projected = model.functions.find(fn => fn.witName === "increment");
	assert.equal(projected.parameters[0].copy.index, projected.resultCopy.index);
	assert.notEqual(projected.parameters[0].copy.witIndex, projected.resultCopy.witIndex);
	await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	for(const name of ["model.wit", "model.wasm"])
		validateWitAliasSignatures(JSON.parse((await runCopied("wasm-tools", ["component", "wit", name, "--json"], root, process.env)).stdout), ir);
});

test("WIT aliases retain ownership, name, cycle and depth admission", () => {
	for(const change of [
		ir => { ir.declarations[0].parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Count").representation = "identity"; }
		, ir => { ir.types.find(type => type.name === "Count").name = "Type"; }
		, ir => { ir.types.find(type => type.name === "Count").name = 'bad" }'; }
		, ir => { ir.types.find(type => type.name === "Count").target = { kind: "named", id: "lean:Aliases.Count" }; }
	]) {
		const ir = nativeAliasReviewedIr(); change(ir);
		assert.throws(() => compileCopiedWitModel(ir));
	}
	const ir = nativeAliasReviewedIr(), alias = ir.types.find(type => type.name === "Rows");
	for(let depth = 0; depth < 33; depth++) alias.target = { kind: "apply", constructor: "list", arguments: [alias.target] };
	assert.throws(() => compileCopiedWitModel(ir), /deep|depth/i);
	assert.equal(compileCopiedWitModel(listReviewedIr()).manifest.aliases, undefined);
});

test("alias names cannot shadow an existing WIT function", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-names-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = nativeAliasReviewedIr(); ir.types.find(type => type.name === "Count").name = "Make";
	ir.declarations.find(fn => fn.name === "label").name = "alias_make";
	const model = compileCopiedWitModel(ir);
	assert.match(model.wit, /type alias-alias-make = au32;/);
	assert.match(model.wit, /make: func\(\) -> alias-alias-make;/);
	assert.match(model.wit, /alias-make: func\(\) -> atext;/);
	assert.equal(model.manifest.aliases.find(alias => alias.name === "Make").witName, "alias-alias-make");
	await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
});

test("copied aliases coexist with primitive callable resource identities", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-callables-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = callableReviewedIr(), alias = nativeAliasReviewedIr().types.find(type => type.name === "OtherCount");
	alias.source = structuredClone(ir.declarations[0].source); ir.types.push(alias);
	const fn = ir.declarations.find(fn => fn.parameters.some(site => site.type.kind === "primitive" && site.type.name === "uint32"));
	fn.parameters.find(site => site.type.kind === "primitive" && site.type.name === "uint32").type = { kind: "named", id: alias.id };
	const model = compileCopiedWitModel(ir, {}, { callables: true });
	assert.equal(model.manifest.aliases.length, 1); assert.ok(model.resources.length > 0);
	await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	const document = JSON.parse((await runCopied("wasm-tools", ["component", "wit", "model.wasm", "--json"], root, process.env)).stdout);
	assert.ok(document.interfaces.find(iface => iface.name === "api").types["other-count"] !== undefined);
});
