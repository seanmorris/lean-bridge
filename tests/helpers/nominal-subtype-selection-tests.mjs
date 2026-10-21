/**
 * Constructor syntax preserves nominal member identity and independent position gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { projectionCheckedSelection, validateCheckedRefinementSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import { compilerExportSelection, exportContractProblem, validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { validateNativeType } from "../../src/analyze/native-types.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { nominalSelectionContracts, selectedCase, selectedConstructor, selectedEnvelope, selectedEvent, selectedField, selectedRecord, selectedSite, selectedTree, selectedVariant } from "./nominal-subtype-selection-fixture.mjs";

const configuration = refinement => ({ schemaVersion: 1, contracts: { "Library.run": { parameters: [selectedSite(refinement)] } } });

test("nominal selection syntax names every field and case in source order", async () => {
	const selections = [selectedEnvelope("plusOne")
		, selectedEvent("plusOne", "plusTwo")
		, ...Object.values(nominalSelectionContracts()).flatMap(contract => contract.parameters.map(site => site.refinement).filter(Boolean))];
	for(const selection of selections)
	{
		const config = configuration(selection), before = structuredClone(config);
		assert.equal(validateExportConfiguration(config), config);
		await assertJsonSchema("lean-export-configuration", config);
		assert.deepEqual(compilerExportSelection(config).contracts, config.contracts);
		assert.deepEqual(config, before);
	}
});

test("nominal selectors reject missing, duplicate, empty and invented members", async () => {
	const choice = selectedConstructor("plusOne");
	const invalid = [
		selectedRecord("", selectedField("payload", choice))
		, selectedRecord("Library.Record\n", selectedField("payload", choice))
		, selectedRecord("Library.Record", selectedField("payload", null))
		, selectedRecord("Library.Record")
		, selectedRecord("Library.Record", selectedField("payload", choice), selectedField("payload", choice))
		, selectedRecord("Library.Record", selectedField("payload", choice), selectedField("wrong.name", choice))
		, selectedRecord("Library.Record", { name: "payload", refinement: choice, trusted: true })
		, selectedVariant("Library.Event", selectedCase("empty"))
		, selectedVariant("Library.Event", selectedCase("value", selectedField("payload", choice)), selectedCase("value", selectedField("payload", choice)))
		, selectedVariant("Library.Event", { name: "value", fields: [selectedField("payload", choice)], constructor: "Library.Event.value" })
		, { ...selectedEnvelope("plusOne"), predicate: "True" }
	];
	for(const value of invalid)
	{
		assert.throws(() => validateCheckedRefinementSelection(value), /Invalid checked refinement selection/);
		await assert.rejects(() => assertJsonSchema("lean-export-configuration", configuration(value)));
	}
	// JSON Schema cannot express uniqueness by just one property of unequal objects.
	assert.throws(() => validateCheckedRefinementSelection(selectedRecord("Library.Record",
		selectedField("payload", choice), selectedField("payload", null))));
	assert.throws(() => validateCheckedRefinementSelection(selectedVariant("Library.Event",
		selectedCase("value", selectedField("payload", choice)), selectedCase("value"))));
});

test("nominal selector budgets include member wrappers and never invoke accessor fields", () => {
	const choice = selectedConstructor("plusOne");
	const sparse = [selectedField("payload", choice)]; sparse.length = 2;
	const getter = Object.defineProperty({ name: "payload" }, "refinement", { get: () => { throw new Error("getter ran"); } });
	const getterArray = [selectedField("payload", choice)];
	Object.defineProperty(getterArray, "1", { get: () => { throw new Error("getter ran"); } });
	for(const fields of [sparse, [getter], getterArray])
		assert.throws(() => validateCheckedRefinementSelection({ kind: "record", name: "Library.Record", fields }), /Invalid checked refinement selection/);
	const nest = count => {
		let value = choice;
		for(let index = 0; index < count; index++) value = selectedRecord("Library.Record", selectedField("next", value));
		return value;
	};
	validateCheckedRefinementSelection(nest(32));
	assert.throws(() => validateCheckedRefinementSelection(nest(33)));
	const fields = Array.from({ length: 1024 }, (_, index) => selectedField(`field${index}`, index ? null : choice));
	const wide = selectedRecord("Library.Record", ...fields);
	validateCheckedRefinementSelection(wide);
	assert.throws(() => validateCheckedRefinementSelection(selectedTree("tuple", wide, wide)));
	assert.throws(() => validateCheckedRefinementSelection(selectedRecord("Library.Record", ...fields, selectedField("overflow", null))));
	const cycle = selectedRecord("Library.Record", selectedField("next", null)); cycle.fields[0].refinement = cycle;
	assert.throws(() => validateCheckedRefinementSelection(cycle));
});

test("projection choices retain nominal identity and member order independently of Fin bounds", () => {
	const base = { kind: "primitive", name: "nat" };
	const refined = constructor => ({ kind: "refinement", base, predicate: { kind: "subtype", constructor: `NominalConversion.${constructor}` } });
	const record = {
		kind: "record", name: "NominalConversion.Envelope"
		, fields: [{ name: "payload", type: refined("plusOne") }
			, { name: "digit", type: { kind: "refinement", base, predicate: { kind: "fin", bound: "3" } } }]
	};
	const parameter = { kind: "alias", name: "Library.Alias", target: record };
	const projection = { status: "supported", parameters: [{ type: parameter }], result: base };
	const before = structuredClone(projection), selection = selectedEnvelope("plusOne");
	assert.deepEqual(projectionCheckedSelection(parameter), selection);
	assert.equal(exportContractProblem(configuration(selection).contracts["Library.run"], projection), null);
	const mutations = [value => { value.name = "Library.Other"; }
		, value => { value.fields.reverse(); }
		, value => { value.fields[0].name = "other"; }
		, value => { value.fields[0].refinement.constructor = "NominalConversion.plusTwo"; }
		, value => { value.fields.pop(); }
		, value => { value.fields.push(selectedField("extra", null)); }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(selection); mutate(changed);
		assert.match(exportContractProblem(configuration(changed).contracts["Library.run"], projection), /does not match/);
	}
	const variant = {
		kind: "variant", name: "Library.Event"
		, cases: [{ name: "empty", fields: [] }
			, { name: "box", fields: [{ name: "value", type: parameter }] }]
	};
	assert.deepEqual(projectionCheckedSelection(variant), selectedVariant("Library.Event",
		selectedCase("empty"), selectedCase("box", selectedField("value", selection))));
	assert.equal(projectionCheckedSelection({ ...record, fields: record.fields.slice(1) }), null);
	assert.deepEqual(projection, before);
});

test("nominal native admission preserves callback direction, generic Fin and nested-site gates", () => {
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const type = {
		kind: "record", name: "Library.Record", lean: "Library.Record"
		, constructor: "Library.Record.mk", abi
		, fields: [{ name: "value", projection: "Library.Record.value"
			, type: {
				kind: "refinement", abi
				, base: { kind: "primitive", name: "nat", lean: "Nat", abi }
				, predicate: { kind: "subtype", constructor: "Library.checked" }
			}
		}]
	};
	const selection = projectionCheckedSelection(type);
	validateExportConfiguration(configuration(selection));
	validateNativeType(type, 0, false, "parameter");
	assert.throws(() => validateNativeType(type, 1), /Subtype refinements require/u);
	assert.throws(() => validateNativeType({ kind: "callback", parameters: [type], result: type.fields[0].type.base, abi }, 0, false, "parameter"), /invalid Subtype refinement/u);
	const produced = structuredClone(type);
	produced.fields[0].type.predicate.constructor = null;
	validateNativeType({ kind: "callback", parameters: [produced], result: type.fields[0].type.base, abi }, 0, false, "parameter");
	const generic = {
		...type, name: "Library.Instance", lean: "Library.Instance"
		, constructor: "Library.Generic.mk"
		, provenance: { structure: "Library.Generic", arguments: [type.fields[0].type.base] }
	};
	validateNativeType(generic, 0, false, "parameter");
	const fin = structuredClone(generic);
	fin.fields[0].type.predicate = { kind: "fin", bound: "3" };
	assert.throws(() => validateNativeType(fin, 0, false, "parameter"), /Fin refinements require/u);
});
