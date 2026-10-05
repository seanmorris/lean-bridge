/**
 * Check finite owned graph projections without claiming installed execution.
 * Original ownership contracts remain separate from canonical transport types.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const signatures = document => {
	const ref = id => typeof id === "string" || id === null ? id : document.types[id].name ?? shape(document.types[id].kind);
	const shape = kind => {
		if(kind === "resource") return kind;
		if(kind.type !== undefined) return { type: ref(kind.type) };
		if(kind.list !== undefined) return { list: ref(kind.list) };
		if(kind.option !== undefined) return { option: ref(kind.option) };
		if(kind.result) return { result: [ref(kind.result.ok), ref(kind.result.err)] };
		if(kind.tuple) return { tuple: kind.tuple.types.map(ref) };
		if(kind.record) return { record: kind.record.fields.map(field => ({ name: field.name, type: ref(field.type) })) };
		if(kind.enum) return { enum: kind.enum.cases.map(branch => branch.name) };
		if(kind.variant) return { variant: kind.variant.cases.map(branch => ({ name: branch.name, type: ref(branch.type) })) };
		if(kind.handle) return Object.fromEntries(Object.entries(kind.handle).map(([key, type]) => [key, ref(type)]));
		assert.fail(`Unexpected canonical type ${JSON.stringify(kind)}`);
	};
	return Object.fromEntries(["native", "api"].map(name => {
		const iface = document.interfaces.find(iface => iface.name === name); assert.ok(iface);
		return [name, {
			types: Object.fromEntries(Object.entries(iface.types).map(([name, id]) => [name, shape(document.types[id].kind)]))
			, functions: Object.fromEntries(Object.entries(iface.functions).map(([name, fn]) => [
				name, {
				parameters: fn.params.map(site => ({ name: site.name, type: ref(site.type) }))
				, result: ref(fn.result)
				}
			]))
		}];
	}));
};
const compile = async (t, model) => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-owned-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "model.wit", model.wit); await saveLakeFile(root, "model.wat", model.wat);
	await runCopied("wasm-tools", ["parse", "model.wat", "-o", "model.wasm"], root, process.env);
	await runCopied("wasm-tools", ["validate", "model.wasm"], root, process.env);
	const decode = async path => JSON.parse((await runCopied("wasm-tools", ["component", "wit", path, "--json"], root, process.env)).stdout);
	const [source, binary] = await Promise.all([decode("model.wit"), decode("model.wasm")]);
	assert.deepEqual(signatures(binary), signatures(source)); return binary;
};
const handles = copy => copy.aliasTarget ? handles(copy.aliasTarget) : copy.resource ? [copy]
	: copy.element ? handles(copy.element) : copy.variant ? copy.cases.flatMap(branch => branch.fields.flatMap(field => handles(field.type)))
		: copy.fields.flatMap(field => handles(field.type));

test("owned WIT graph keeps original contracts and distinct input/output ownership", async t => {
	const ir = ownedAggregateReviewedIr(), original = canonicalJson(ir);
	const model = compileOwnedWitGraphModel(ir);
	assert.equal(canonicalJson(ir), original); assert.equal(canonicalJson(model.model.bindingIr), original);
	assert.equal(model.manifest.bindingIrSha256, sha256(canonicalizeJsonValue(ir)));
	assert.equal(model.functions.length, 26); assert.equal(model.resources.length, 5);
	assert.equal(model.manifest.assuranceScope, "original-lean-binding-ir");
	assert.deepEqual(model.manifest.graph.limits, { depth: 128, visits: 262144, bytes: 16777216, retained: 4096 });
	for(const fn of model.functions)
	{
		assert.ok(fn.parameters.flatMap(site => handles(site.copy)).every(handle => handle.borrowed));
		assert.ok(handles(fn.resultCopy).every(handle => !handle.borrowed));
		if(!fn.resource)
		{
			const original = model.model.declarations.find(declaration => declaration.id === fn.declaration.id);
			const contract = model.manifest.declarations.find(declaration => declaration.id === fn.declaration.id);
			assert.deepEqual(contract.parameters.map(({ witType, ...site }, index) => {
				assert.equal(witType, fn.parameters[index].copy.wit); return site;
			}), original.parameters);
			const { witType, ...result } = contract.result;
			assert.equal(witType, fn.resultCopy.wit); assert.deepEqual(result, original.result);
		}
	}
	const copied = model.functions.find(fn => fn.declaration.name === "payload").resultCopy;
	assert.equal(handles(copied).length, 0, "copied roots must not carry unrelated identity tables");
	const tree = model.graph.values.get("input:lean:Owned.Tree");
	assert.equal(tree.tables.length, 2);
	const row = tree.tables.find(table => table.node.id === "lean:Owned.Tree").row;
	assert.deepEqual(row.cases.map(branch => branch.witName), ["leaf", "branch"]);
	assert.equal(row.cases[0].fields[0].type.identity, "lean:Owned.Ticket");
	assert.equal(row.cases[0].fields[0].type.borrowed, true);
	assert.deepEqual(row.cases[1].fields[0].type.fields.map(field => field.type.wit), ["u32"]);
	await compile(t, model);
});

test("owned WIT aliases preserve resource, scalar and container identities", async t => {
	const ir = ownedAggregateReviewedIr(), alias = ir.types.find(type => type.name === "BundleAlias");
	const cases = [["TicketAlias", { kind: "named", id: "lean:Owned.Ticket" }]
		, ["FunctionAlias", { kind: "named", id: ir.types.find(type => type.kind === "callback").id }]
		, ["BytesAlias", { kind: "primitive", name: "bytes" }]
		, ["UnitAlias", { kind: "primitive", name: "unit" }]];
	for(const [name, target] of cases)
	{
		const id = `lean:Owned.${name}`, copied = target.kind === "primitive";
		ir.types.push({ ...alias, id, name, representation: copied ? "copied" : "identity", target });
		const template = ir.declarations.find(declaration => declaration.name === "retainTicket");
		ir.declarations.push({ ...template, id: `lean:Owned.echo${name}`
			, name: `echo${name}`
			, overloadKey: `Owned.echo${name}`
			, parameters: template.parameters.map(site => ({ ...site, type: { kind: "named", id }
				, ownership: copied ? "copy" : "borrow"
				, lifetime: copied ? null : site.lifetime }))
			, result: { ...template.result, type: { kind: "named", id }
				, ownership: copied ? "copy" : "lease"
				, lifetime: copied ? null : template.result.lifetime } });
	}
	const model = compileOwnedWitGraphModel(ir);
	assert.match(model.wit, /type ticket-alias-input = borrow<identity-ticket>/u);
	assert.match(model.wit, /type ticket-alias-output = own<identity-ticket>/u);
	assert.ok(model.functions.find(fn => fn.declaration.name === "echoTicketAlias").parameters[0].copy.aliasTarget.borrowed);
	await compile(t, model);
});

test("owned WIT type numbering is stable under original definition order", () => {
	const ir = ownedAggregateReviewedIr(), baseline = compileOwnedWitGraphModel(ir, { name: "owned-fixture" });
	ir.types.reverse(); const reordered = compileOwnedWitGraphModel(ir, { name: "owned-fixture" });
	assert.equal(reordered.wit, baseline.wit); assert.equal(reordered.wat, baseline.wat);
	assert.notEqual(reordered.manifest.bindingIrSha256, baseline.manifest.bindingIrSha256);
});

test("unsupported ownership sites do not silently become leased results", () => {
	const ir = ownedAggregateReviewedIr(), primary = ir.declarations.find(declaration => declaration.name === "primary");
	primary.result.ownership = "borrow"; primary.result.lifetime = { scope: "parameter", anchor: "arg0" };
	assert.throws(() => compileOwnedWitGraphModel(ir), /explicit output leases/u);
	const transfer = ownedAggregateReviewedIr().declarations.find(declaration => declaration.name === "echoRecord");
	transfer.parameters[0].ownership = "transfer"; transfer.parameters[0].lifetime = { scope: "explicit", anchor: null };
	const moved = ownedAggregateReviewedIr(); moved.declarations = [transfer];
	assert.throws(() => compileOwnedWitGraphModel(moved), /call-scoped input borrows/u);
});
