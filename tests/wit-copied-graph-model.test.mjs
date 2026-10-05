/**
 * Recursive Lean contracts become finite typed WIT, not resources or byte blobs.
 * Grammar checks include the executable forwarding component, not a type package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitGraphModel } from "../src/backends/wit/copied-graph-model.mjs";
import { renderWitGraphHostHeader, renderWitGraphHostSource } from "../src/backends/wit/copied-graph-host.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { beforeWitGraphRegistration, reverseWitGraphRegistration } from "./helpers/wit-graph-source-lineage.mjs";

const parse = async (t, model) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "model.wit", model.wit);
	await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "--features", "component-model", "model.wasm"], root, process.env);
	return Promise.all(["model.wit", "model.wasm"].map(async file => JSON.parse((await runCopied("wasm-tools", ["component", "wit", file, "--json"], root, process.env)).stdout)));
};

const signatures = document => {
	const ref = value => typeof value === "string" || value === null ? value : document.types[value].name ?? shape(document.types[value].kind);
	const shape = kind => {
		if(kind.type !== undefined) return { type: ref(kind.type) };
		if(kind.list !== undefined) return { list: ref(kind.list) };
		if(kind.option !== undefined) return { option: ref(kind.option) };
		if(kind.result) return { result: [ref(kind.result.ok), ref(kind.result.err)] };
		if(kind.tuple) return { tuple: kind.tuple.types.map(ref) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: ref(field.type) })) };
		if(kind.enum) return { enum: kind.enum.cases.map(branch => branch.name) };
		if(kind.variant) return { variant: kind.variant.cases.map(branch => ({ name: branch.name, type: ref(branch.type) })) };
		assert.fail(`Unexpected type ${JSON.stringify(kind)}`);
	};
	return Object.fromEntries(["native", "api"].map(name => {
		const iface = document.interfaces.find(item => item.name === name);
		return [name, {
			functions: Object.fromEntries(Object.entries(iface.functions).map(([name, fn]) => [name, { parameters: fn.params.map(site => ({ name: site.name, type: ref(site.type) })), result: ref(fn.result) }]))
			, types: Object.fromEntries(Object.entries(iface.types).map(([name, index]) => [name, shape(document.types[index].kind)])) }];
	}));
};

test("recursive WIT graph preserves the complete native corpus and original contracts", async t => {
	const ir = nativeRecursiveReviewedIr(), original = structuredClone(ir), model = compileCopiedWitGraphModel(ir);
	assert.deepEqual(ir, original);
	assert.deepEqual(model.ir, original);
	assert.equal(model.manifest.bindingIrSha256, hashBindingIr(ir));
	assert.notEqual(model.manifest.bindingIrSha256, model.manifest.graph.wireBindingIrSha256);
	assert.equal(model.wire.functions.length, 18);
	assert.equal(model.tables.length, 19);
	assert.equal(model.nodes.filter(node => node.kind === "primitive").length, 19);
	assert.deepEqual(model.wire.resources, []);
	assert.deepEqual(model.wireIr.assurance, []);
	assert.ok([...model.wireIr.types, ...model.wireIr.declarations].every(item => !item.assurance.length && item.source.producer === "witCopiedGraph"));
	assert.equal(model.manifest.assuranceScope, "original-lean-binding-ir");
	assert.deepEqual(model.manifest.graph.limits, { valueDepth: 128, valueNodes: 262144, copyBytes: 16777216 });
	assert.doesNotMatch(model.wit, /\bresource\b|list<u8>.*nodes/);
	assert.match(model.wit, /%bool: bool/);
	assert.match(model.wit, /word-max: func\(value0: u64\) -> bool/);
	assert.match(model.wit, /signed-min: func\(value0: s64\) -> bool/);
	assert.match(model.wat, /canon lower/);
	assert.match(model.wat, /canon lift/);
	for(const original of ir.types)
	{
		const contract = model.manifest.graph.types.find(item => item.id === original.id);
		assert.deepEqual(contract.fields, original.fields);
		assert.deepEqual(contract.cases, original.cases);
		assert.deepEqual(contract.target, original.target);
	}
	const [text, binary] = await parse(t, model);
	assert.deepEqual(signatures(binary), signatures(text));
	const native = signatures(binary).native;
	for(const node of model.tables)
	{
		const contract = model.manifest.graph.nodes[node.index];
		assert.deepEqual(native.types[contract.referenceType], { record: [{ name: "index", type: "u32" }] });
		if(contract.valueType) assert.deepEqual(native.types[contract.valueType], { record: [{ name: "root", type: contract.referenceType }, { name: "nodes", type: model.manifest.graph.arena }] });
	}
});

test("recursive WIT projection is stable under definition order and isolates generated names", () => {
	const ir = nativeRecursiveReviewedIr(), model = compileCopiedWitGraphModel(ir);
	ir.types.reverse();
	assert.equal(compileCopiedWitGraphModel(ir).wat, model.wat);
	assert.equal(compileCopiedWitGraphModel(ir).wit, model.wit);
	const alias = ir.types.find(item => item.name === "TreeAlias");
	alias.name = "LbGraphRef0";
	const renamed = compileCopiedWitGraphModel(ir);
	assert.match(renamed.wit, /lb-graph-x/);
	assert.equal(renamed.manifest.graph.types.find(item => item.id === alias.id).name, alias.name);
	assert.equal(renamed.wire.functions.length, 18);
});

test("recursive WIT keeps empty constructors, present Unit, wide fields and uninhabited types", async t => {
	const model = compileCopiedWitGraphModel(nativeRecursiveReviewedIr());
	const marker = model.nodes.find(node => node.ref.id === "lean:Recursive.Marker");
	assert.deepEqual(marker.rowCopy.cases.map(branch => [branch.witName, branch.fields.length]), [["empty", 0], ["unit", 1], ["next", 1]]);
	const wide = model.nodes.find(node => node.ref.id === "lean:Recursive.Wide");
	assert.equal(wide.rowCopy.cases[0].fields.length, 256);
	const never = model.nodes.find(node => node.ref.id === "lean:Recursive.Never");
	assert.equal(never.rowCopy.cases[0].fields[0].type.wit, never.referenceCopy.wit);
	const empty = model.nodes.find(node => node.ref.id === "lean:Recursive.EmptyRecord");
	assert.equal(empty.rowCopy.fields.length, 0);
	const [text] = await parse(t, model);
	assert.deepEqual(signatures(text).native.types[empty.rowCopy.wit], { enum: ["empty"] });
});

test("recursive WIT rejects invalid ownership, aliases, names and target coordinates", () => {
	for(const mutate of [
		ir => { ir.declarations[0].parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(item => item.name === "TreeAlias").target.id = "lean:Recursive.TreeAlias"; }
		, ir => { ir.types.find(item => item.name === "Scalars").fields[1].name = "unit"; }
		, ir => { ir.declarations[0].effects = ["async"]; }
	]) { const ir = nativeRecursiveReviewedIr(); mutate(ir); assert.throws(() => compileCopiedWitGraphModel(ir)); }
	assert.throws(() => compileCopiedWitGraphModel(nativeRecursiveReviewedIr(), { name: "../outside" }));
});

test("source alias chains stay explicit without adding runtime nesting or recursive WIT types", async t => {
	const ir = nativeRecursiveReviewedIr(), template = ir.types.find(type => type.kind === "alias");
	let target = { kind: "named", id: "lean:Recursive.Tree" };
	for(let index = 0; index < 80; ++index)
	{
		const alias = { ...structuredClone(template), id: `lean:Recursive.Link${index}`, name: `Link${index}`, target };
		ir.types.push(alias); target = { kind: "named", id: alias.id };
	}
	ir.declarations[0].parameters[0].type = target;
	const model = compileCopiedWitGraphModel(ir);
	assert.equal(model.manifest.graph.types.find(type => type.name === "Link79").target.id, "lean:Recursive.Link78");
	assert.equal(model.nodes.length, 38);
	const [text, binary] = await parse(t, model);
	assert.deepEqual(signatures(binary), signatures(text));
});

test("primitive-only functions retain direct scalar signatures", async t => {
	const ir = corpusReviewedIr({ id: "simple" }, [{ name: "Simple.echo", parameters: ["usize"], result: "isize" }]);
	const model = compileCopiedWitGraphModel(ir);
	assert.equal(model.tables.length, 0);
	assert.equal(model.manifest.graph.arena, null);
	assert.match(model.wit, /echo: func\(value0: u64\) -> s64/);
	const [text, binary] = await parse(t, model);
	assert.deepEqual(signatures(binary), signatures(text));
});

test("generated host validates before Wasmtime and typed calls retain owned results", () => {
	const model = compileCopiedWitGraphModel(nativeRecursiveReviewedIr());
	const source = renderWitGraphHostSource(model, new Uint8Array()), header = renderWitGraphHostHeader(model);
	assert.match(header, /recursive_wasmtime_value_grow/);
	assert.ok(source.indexOf("lb_scope_close(&validation.memory)") < source.indexOf("wasmtime_component_func_call"));
	const typed = source.slice(source.indexOf("wasmtime_error_t *recursive_wasmtime_value_"));
	assert.doesNotMatch(typed, /recursive_[a-z_]+_graph\(/);
	assert.match(typed, /recursive_wasmtime_call\(session, "grow"/);
	assert.match(typed, /converted\._bridge_owner = output\.memory\.allocations/);
	assert.match(source, /if \(!output.memory.failure\) lean_bridge_native_runtime_retire\(\)/);
});

test("WIT development registration restores complete old metadata and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile("docs/evidence/wit-recursive-registration-20260924.json"));
	assert.equal(record.finalAcceptance, false);
	assert.equal(record.baselineRevision, "976103871e12f617fd868f6e9b6b6db7a3b31866");
	assert.equal(record.updates.length, 9);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseWitGraphRegistration(source, update)), update.previousSha256);
		assert.equal(sha256(beforeWitGraphRegistration(update.path, source, update.previousSha256)), update.previousSha256);
		assert.throws(() => reverseWitGraphRegistration(source + "\nunrelated\n", update));
		assert.throws(() => reverseWitGraphRegistration(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseWitGraphRegistration(source, { ...update, path: "src/build/native-project.mjs" }));
		if(update.addedLines) assert.throws(() => reverseWitGraphRegistration(source, { ...update, addedLines: [...update.addedLines, update.addedLines[0]] }));
		if(update.edits) assert.throws(() => reverseWitGraphRegistration(source, { ...update, edits: [] }));
	}
});
