/**
 * Independent plan controls for graph and flat copied entry families.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { componentRecordDefinitions } from "../../src/abi/component-records.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	nominalPrimitiveSubtypePhpWasmReview
} from "./nominal-primitive-subtype-php-wasm-fixture.mjs";
import {
	recursiveCheckedRecordPhpWasmReview
} from "./recursive-checked-record-php-wasm-fixture.mjs";
import {
	phpWasmIndexedRefinementEntryFamilies, phpWasmIndexedRefinementEntrySpec
} from "./php-wasm-indexed-refinement-entry-fixtures.mjs";
import { phpWasmRefinementEntryPlan } from "./php-wasm-refinement-entry-plan.mjs";
import { phpWasmGraphRefinementEntrySelection } from "./php-wasm-refinement-entry-selection.mjs";
import { phpWasmRefinementEntrySource } from "./php-wasm-refinement-entry-source.mjs";
import { phpWasmRefinementEntrySourceFixture } from "./php-wasm-refinement-entry-source-fixtures.mjs";
import { recursiveSubtypeReview } from "./recursive-subtype-fixture.mjs";
import { readFile } from "node:fs/promises";

const fixtureModel = family => {
	const nominal = family.startsWith("nominal-");
	const indexed = phpWasmIndexedRefinementEntryFamilies.includes(family);
	const indexedSpec = indexed ? phpWasmIndexedRefinementEntrySpec(family, "reviewed") : null;
	const bindingIr = indexed ? indexedSpec.review : nominal
		? nominalPrimitiveSubtypePhpWasmReview(family === "nominal-result-only" ? "result-only" : "full")
		: family === "recursive-subtype" ? recursiveSubtypeReview()
			: recursiveCheckedRecordPhpWasmReview("recursive");
	const module = indexed ? indexedSpec.module : nominal ? "NominalPrimitiveSubtypes"
		: family === "recursive-subtype" ? "RecursiveSubtypes" : "RecursiveCheckedRecords";
	const exports = bindingIr.declarations.map(item => ({
		bindingId: item.id
		, symbol: `lean_bridge_${sha256(bindingIr.component.id + "\0" + item.id).slice(0, 24)}`
		, parameters: item.parameters.map(site => site.type)
		, result: item.result.type, resultMode: item.resultMode
	}));
	const copiedGraph = { schemaVersion: 1
		, types: componentRecordDefinitions(bindingIr, true), exports };
	return {
		schemaVersion: 5, profile: "php-wasm-copied-v1"
		, pointerBits: 32, byteOrder: "little", component: bindingIr.component
		, bindingIr, copiedGraph
		, exports: bindingIr.declarations.map((declaration, index) => ({
			bindingId: declaration.id, symbol: `${exports[index].symbol}_lean`
			, name: declaration.source.declaration, module
			, parameters: declaration.parameters.map(() => ({}))
			, ...declaration.source.extensions["lean-lang.org/refinements"] ? {
				refinements: declaration.source.extensions["lean-lang.org/refinements"]
			} : {}
		}))
	};
};

const flatPlanSelection = (family, sourceEntries) => {
	const ir = phpWasmIndexedRefinementEntrySpec(family, "reviewed").review;
	const selected = structuredClone(sourceEntries), lean = [];
	const checked = value => {
		const values = [];
		const visit = item => {
			if(!item || typeof item !== "object") return;
			if(item.kind === "checked-record" && typeof item.constructor === "string")
				values.push(item.constructor);
			else for(const child of Object.values(item))
				if(Array.isArray(child)) child.forEach(visit); else visit(child);
		};
		visit(value); return values;
	};
	for(const [index, declaration] of ir.declarations.entries())
	{
		selected.push({ symbol: `lb_call${index}`, kind: "public", label: declaration.name });
		const adapter = `lb_flat_adapter_${index}`;
		selected.push({ symbol: adapter, kind: "adapter", label: declaration.source.declaration });
		lean.push(`@[export ${adapter}]`, `def adapter${index} := _root_.${declaration.source.declaration}`);
		const trees = declaration.source.extensions["lean-lang.org/refinements"]?.parameters ?? [];
		for(const [parameter, tree] of trees.entries()) for(const [leaf, constructor] of checked(tree).entries())
		{
			const suffix = leaf || tree?.kind !== "checked-record" ? `_${leaf}` : "";
			const symbol = `lb_flat_adapter_${index}_refinement_${parameter}${suffix}`;
			selected.push({ symbol, kind: "validator"
				, label: `${declaration.source.declaration}:refinement_${parameter}${suffix}` });
			lean.push(`@[export ${symbol}]`, `def validator${index}_${parameter}_${leaf} := _root_.${constructor}`);
		}
	}
	return { selected, generated: { leanSource: lean.join("\n") + "\n" } };
};

const plan = async family => {
	const marker = phpWasmRefinementEntrySourceFixture(family);
	const source = phpWasmRefinementEntrySource(await readFile(marker.path, "utf8"), marker);
	const selection = phpWasmIndexedRefinementEntryFamilies.includes(family)
		? flatPlanSelection(family, source.entries)
		: phpWasmGraphRefinementEntrySelection(fixtureModel(family), source.entries);
	return phpWasmRefinementEntryPlan(family, selection.selected, selection.generated.leanSource);
};

test("every graph entry family has a closed semantic call plan", async () => {
	for(const family of [
		"nominal-full", "nominal-result-only", "recursive-subtype"
		, "recursive-checked-record"
	]) {
		const value = await plan(family);
		assert.equal(value.family, family); assert.equal(value.scope, "separate-instrumented-probe");
		assert.ok(value.selected.length > value.cases.length);
		assert.ok(value.cases.every(item => item.call.counts.adapter === (item.outcome === "accepted" ? 1 : 0)));
		assert.ok(value.cases.every(item => item.call.counts.source > 0 === (item.outcome === "accepted")));
		assert.ok(value.cases.some(item => item.control === "constructor-free"));
		if(family !== "nominal-result-only")
		{
			assert.ok(value.cases.some(item => item.control === "first-refusal" && item.outcome === "refused"));
			assert.ok(value.cases.some(item => item.control === "recovery" && item.outcome === "accepted"));
			assert.ok(value.cases.some(item => item.control === "active-branch" || item.control === "repeated-fields"));
		}
		else assert.ok(value.cases.every(item => item.call.counts.constructor === 0));
	}
});

test("checked-record refusal plans name compiler-authenticated diagnostic validators", async () => {
	const value = await plan("recursive-checked-record");
	const first = value.cases.find(item => item.control === "first-refusal");
	const record = value.cases.find(item => item.control === "record-refusal");
	assert.equal(first.call.entries.filter(item => item.label.includes(":graph_refinement_0_")).length, 2);
	assert.equal(record.call.entries.filter(item => item.label.includes(":graph_refinement_0_")).length, 2);
	assert.notDeepEqual(first.call.entries, record.call.entries);
	for(const item of [...first.call.entries, ...record.call.entries].filter(item => item.kind === "validator"))
		assert.ok(value.selected.some(selected => selected.kind === item.kind && selected.label === item.label));
});

test("dependent, indexed and zero-payload plans separate checks from proof-erased results", async () => {
	for(const family of phpWasmIndexedRefinementEntryFamilies)
	{
		const value = await plan(family);
		assert.equal(value.family, family);
		assert.ok(value.cases.every(item => item.call.counts.source > 0
			=== (item.outcome === "accepted")));
		assert.ok(value.cases.every(item => item.call.counts.adapter
			=== (item.outcome === "accepted" ? 1 : 0)));
		if(family.endsWith("-result-only"))
			assert.ok(value.cases.every(item => item.call.counts.constructor === 0));
		else
		{
			assert.ok(value.cases.some(item => item.outcome === "refused"));
			assert.ok(value.cases.some(item => item.call.counts.constructor > 0));
		}
	}
	const dependent = await plan("dependent-full");
	const dependentRefusal = dependent.cases.find(item => item.control === "first-refusal");
	assert.ok(dependentRefusal.call.entries.some(item => item.label.includes(":refinement_0")));
	assert.ok(dependentRefusal.call.entries.every(item => !item.label.includes(":graph_refinement_")));
	const indexed = await plan("value-index-full");
	for(const control of ["bool-refusal", "string-refusal", "nat-refusal"])
		assert.ok(indexed.cases.find(item => item.control === control)
			.call.entries.some(item => item.label.includes(":refinement_0")), control);
	const empty = await plan("zero-payload-full");
	assert.ok(empty.cases.find(item => item.control === "first-refusal")
		.call.entries.some(item => item.kind === "constructor"
			&& item.label.endsWith(".mkAbsent")));
	assert.equal(empty.cases.find(item => item.control === "inactive-branch")
		.call.entries.filter(item => item.kind === "validator").length, 0);
	assert.equal(empty.cases.find(item => item.control === "active-branch")
		.call.entries.filter(item => item.kind === "validator").length, 1);
});

test("graph entry plans refuse incomplete compiler selections and generated source drift", async () => {
	const family = "recursive-checked-record", marker = phpWasmRefinementEntrySourceFixture(family);
	const source = phpWasmRefinementEntrySource(await readFile(marker.path, "utf8"), marker);
	const selection = phpWasmGraphRefinementEntrySelection(fixtureModel(family), source.entries);
	for(const selected of [selection.selected.slice(1), selection.selected.filter(item => item.kind !== "constructor")])
		assert.throws(() => phpWasmRefinementEntryPlan(family, selected, selection.generated.leanSource));
	assert.throws(() => phpWasmRefinementEntryPlan(family, selection.selected
		, selection.generated.leanSource.replace("_root_.RecursiveCheckedRecords.mkPacket", "_root_.RecursiveCheckedRecords.changed")));
});
