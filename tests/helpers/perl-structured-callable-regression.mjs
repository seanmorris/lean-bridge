/**
 * Synthetic code-generation regressions, separate from installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";

const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const word = { kind: "primitive", name: "uint32", lean: "UInt32"
	, abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: false } };
const unit = { kind: "primitive", name: "unit", lean: "Unit", abi: { ...abi, heap: false } };
const bool = { kind: "primitive", name: "bool", lean: "Bool"
	, abi: { cType: "uint8_t", box: "lean_box", unbox: "lean_unbox", heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi };
const unary = (kind, element) => ({ kind, element, abi });
const pair = (kind, left, right) => ({ kind, arguments: [left, right], abi });
const record = (name, fields) => ({ kind: "record", name: `Sample.${name}`
	, lean: `Sample.${name}`, constructor: `Sample.${name}.mk`, abi
	, fields: fields.map(([field, type]) => ({ name: field, type, projection: `Sample.${name}.${field}` })) });
const variant = () => ({
	kind: "variant", name: "Sample.Signal", lean: "Sample.Signal", abi
	, cases: [
		{ name: "idle", constructor: "Sample.Signal.idle", fields: [] }
		, { name: "data", constructor: "Sample.Signal.data"
			, fields: [{ name: "value", type: unary("option", text) }] }
	]
});

const model = (inputType, resultType = inputType) => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = inputType; projection.result = resultType;
	return createNativeModel({ ...input, moduleName: "LeanBridge::Sample"
		, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } });
};

export const perlStructuredRegressionModels = {
	callables: () => model({ kind: "callback", parameters: [word], result: word, abi }, word)
	, collections: () => model(record("Envelope", [
		["label", text]
		, ["rows", unary("array", unary("array", record("Cell", [["value", word]])))]
	]))
	, compounds: () => model(pair("tuple", unary("option", unary("option", unit)),
		pair("result", word, unary("array", text))))
	, lists: () => model(unary("list", pair("result", pair("tuple", word, text), text)))
	, aliases: () => model({ kind: "alias", name: "Sample.Scores"
		, lean: "Sample.Scores"
		, target: unary("list", word), abi })
	, variants: () => model(variant())
	, scalars: () => model(record("Scalars", [["unit", unit], ["flag", bool]
		, ["missing", unary("option", unit)]
		, ["flags", unary("array", bool)], ["values", unary("array", unit)]]))
};
export const perlStructuredRegressionReceipt = { library: "libcomponent_test.so"
	, nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64)
	, initializer: "initialize_Sample" };

/**
 * Exercise copied shapes in both host-callback and returned-closure positions.
 * These synthetic metadata models are not installed-package evidence.
 *
 * @param position - Select the exported callback parameter or returned closure.
 */
export const perlStructuredContractModels = position => {
	assert.ok(["parameter", "result"].includes(position));
	const shapes = { array: unary("array", unary("option", text))
		, list: unary("list", pair("result", pair("tuple", word, text), text))
		, option: unary("option", unary("option", unit))
		, result: pair("result", unary("option", word), unary("array", text))
		, tuple: pair("tuple", text, pair("tuple", word, unit))
		, record: record("Payload", [["rows", unary("array", text)]])
		, variant: variant()
		, alias: { kind: "alias", name: "Sample.Alias", lean: "Sample.Alias"
			, target: record("Payload", [["rows", unary("array", text)]]), abi } };
	return Object.fromEntries(Object.entries(shapes).map(([name, type]) => {
		const callback = { kind: "callback", parameters: [type], result: type, abi };
		return [name, position === "parameter" ? model(callback, type) : model(type, callback)];
	}));
};

/**
 * Reconstruct only the three explicit writable-scalar output repairs.
 *
 * @param source - Current generated XS, never a runtime binary.
 */
export const perlScalarStoragePredecessor = source => {
	let previous = source;
	const repairs = {};
	for(const [name, current, old] of [
		["absentOption", "if (!present) return lbp_mortal(newSV(0));", "if (!present) return &PL_sv_undef;"]
		, ["unit", "return lbp_mortal(newSV(0));", "return &PL_sv_undef;"]
		, ["bool", "return lbp_mortal(newSVsv(boolSV(value != 0)));", "return boolSV(value != 0);"]
	]) {
		repairs[name] = previous.split(current).length - 1;
		previous = previous.replaceAll(current, old);
	}
	return { source: previous, repairs };
};

/**
 * Compare all files with independent predecessor bytes and explicit scalar repairs.
 *
 * @param record - Frozen predecessor source identities and synthetic outputs.
 */
export const assertPerlStructuredCodegenRegression = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "perl-structured-codegen-regression");
	assert.match(record.baselineRevision, /^[a-f0-9]{40}$/u);
	assert.equal(record.syntheticModels, true); assert.equal(record.installedAcceptance, false);
	assert.deepEqual(record.fixtures.map(fixture => fixture.name), Object.keys(perlStructuredRegressionModels));
	for(const fixture of record.fixtures)
	{
		const selected = perlStructuredRegressionModels[fixture.name]();
		assert.equal(fixture.modelSha256, sha256(canonicalJson(selected)));
		const files = generatePerlBindingPackage(selected, perlStructuredRegressionReceipt);
		assert.deepEqual(fixture.files, Object.fromEntries(Object.entries(files)
			.map(([path, source]) => [path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])));
		const restored = perlScalarStoragePredecessor(files["Component.xs"]);
		const previous = { ...files, "Component.xs": restored.source };
		assert.deepEqual(fixture.predecessorFiles, Object.fromEntries(Object.entries(previous)
			.map(([path, source]) => [path, { bytes: Buffer.byteLength(source), sha256: sha256(source) }])));
		assert.deepEqual(fixture.scalarStorageRepairs, restored.repairs);
		assert.equal(fixture.identicalToPredecessor, restored.source === files["Component.xs"]);
	}
};
