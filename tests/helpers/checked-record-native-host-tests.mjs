/**
 * Check exact payload-only generation before recording any installed host claim.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nativeFinRefinements, nativeFinSummary, nativeRefinementReadme } from "../../src/backends/native/fin-refinements.mjs";
import { checkedRecordNativeProfiles, checkedRecordNativeModels, checkedRecordNativeGenerators, checkedRecordNativeInput } from "./checked-record-native-hosts.mjs";
import { refinementsKey } from "./checked-record-fixture.mjs";
import { copiedPythonConversions, copiedPythonTypes } from "../../src/backends/python/copied-conversions.mjs";
import { copiedRustConversions, copiedRustTypes } from "../../src/backends/rust/copied-conversions.mjs";
import { copiedRubyConversions } from "../../src/backends/ruby/copied-conversions.mjs";
import { copiedConversions, copiedNativeTypes } from "../../src/backends/dotnet/copied-conversions.mjs";
import { copiedJvmConversions } from "../../src/backends/jvm/copied-conversions.mjs";
import { copiedPhpConversions, copiedPhpDefinitions, copiedPhpChecks } from "../../src/backends/php/copied-conversions.mjs";
import { renderWitConversions } from "../../src/backends/wit/copied-conversions.mjs";

test("checked-record host conversions retain ordinary record layouts and copy ownership", () => {
	const renderers = { python: [copiedPythonTypes, copiedPythonConversions]
		, rust: [copiedRustTypes, copiedRustConversions]
		, ruby: [copiedRubyConversions]
		, dotnet: [copiedNativeTypes, copiedConversions]
		, java: [copiedJvmConversions]
		, kotlin: [copiedJvmConversions]
		, "php-native": [copiedPhpDefinitions, copiedPhpChecks, copiedPhpConversions]
		, "wit-wasi": [renderWitConversions] };
	for(const profile of checkedRecordNativeProfiles) for(const resultOnly of [false, true])
	{
		const ir = checkedRecordNativeInput("reviewed-ir", resultOnly), payload = structuredClone(ir);
		// Compare host copies with unconstrained records of the same payload shape.
		// This synthetic comparison does not authorize erasing a real Lean contract.
		for(const type of payload.types) delete type.source.extensions["lean-lang.org/erased-proofs"];
		for(const declaration of payload.declarations) delete declaration.source.extensions[refinementsKey];
		const checked = checkedRecordNativeModels[profile](ir), plain = checkedRecordNativeModels[profile](payload);
		for(const render of renderers[profile])
		{
			const actual = render(checked), expected = render(plain);
			assert.equal(actual, expected, `${profile}/${resultOnly}/${render.name}`);
			assert.ok(actual.length > 100);
		}
		const layout = model => model.surface.copies.filter(copy => copy.record).map(copy => ({
			name: copy.record.name, size: copy.size, alignment: copy.alignment
			, fields: copy.fields.map(field => ({ name: field.name, offset: field.offset, index: field.type.index }))
		}));
		assert.deepEqual(layout(checked), layout(plain), profile);
	}
});

test("every checked-record native host generates both source routes with payload-only named types", () => {
	for(const profile of checkedRecordNativeProfiles) for(const route of ["ordinary-source", "reviewed-ir"])
	{
		const ir = checkedRecordNativeInput(route), before = structuredClone(ir);
		const model = checkedRecordNativeModels[profile](ir);
		const records = model.surface.copies.filter(copy => copy.record);
		assert.deepEqual(records.map(copy => [copy.record.name, copy.fields.map(field => field.name)]), [
			["Interval", ["lo", "hi"]], ["Triple", ["data"]], ["Percent", ["value"]]
		]);
		assert.equal(model.surface.functions.length, 8);
		for(const fn of model.surface.functions)
		{
			const declaration = ir.declarations.find(item => item.id === fn.declaration.id);
			assert.deepEqual(fn.declaration, declaration);
			assert.equal(fn.parameters.length, declaration.parameters.length);
		}
		const files = checkedRecordNativeGenerators[profile](ir), readme = files["README.md"];
		for(const constructor of ["mkInterval", "mkTriple", "sortedTriple", "mkPercent"])
			assert.ok(readme.includes(`CheckedRecords.${constructor}`), `${profile}/${route}/${constructor}`);
		assert.ok(readme.includes("only their payload fields"), profile);
		assert.ok(readme.includes("without changing the caller's record"), profile);
		assert.ok(readme.includes("result projects proof-backed record payload fields"), profile);
		assert.doesNotMatch(readme, /reviewed Binding IR is not supported/u);
		assert.ok(Object.keys(files).some(path => profile === "wit-wasi" ? path.endsWith(".c") : path !== "README.md" && path !== "binding-manifest.json"));
		assert.deepEqual(ir, before, `${profile} must not mutate reviewed constructor choices`);
	}
});

test("result-only checked records project payloads in every native host without inventing a constructor", () => {
	for(const profile of checkedRecordNativeProfiles) for(const route of ["ordinary-source", "reviewed-ir"])
	{
		const ir = checkedRecordNativeInput(route, true), model = checkedRecordNativeModels[profile](ir);
		assert.equal(model.surface.functions.length, 1);
		assert.deepEqual(model.surface.copies.filter(copy => copy.record).map(copy => copy.record.name), ["Triple"]);
		const files = checkedRecordNativeGenerators[profile](ir), readme = files["README.md"];
		assert.ok(readme.includes("result projects proof-backed record payload fields"), profile);
		assert.ok(readme.includes("No proof object or input constructor is needed for a result-only export"), profile);
		assert.doesNotMatch(readme, /checked by|CheckedRecords\.mk/u);
		assert.deepEqual(nativeFinRefinements(ir.declarations[0], ir.types), { parameters: [null], result: { kind: "checked-record", constructor: null } });
	}
});

test("checked-record native summaries preserve per-site constructor choices and other refinements", () => {
	const ir = checkedRecordNativeInput("reviewed-ir"), find = name => ir.declarations.find(item => item.name === name);
	assert.equal(nativeFinSummary(find("firstOf"), ["value0"], ir.types), "value0 checked by CheckedRecords.mkTriple");
	assert.equal(nativeFinSummary(find("smallest"), ["value0"], ir.types), "value0 checked by CheckedRecords.sortedTriple");
	assert.equal(nativeFinSummary(find("span"), ["value0", "value1"], ir.types), "value0 checked by CheckedRecords.mkInterval; value1 checked by CheckedRecords.mkInterval");
	const mixed = structuredClone(find("scale"));
	mixed.source.extensions[refinementsKey].parameters[0] = { kind: "fin", bound: "10" };
	assert.equal(nativeFinSummary(mixed, ["value0", "value1"], ir.types), "value0 < 10; value1 checked by CheckedRecords.mkTriple; result projects proof-backed record payload fields");
	const readme = nativeRefinementReadme([mixed], "EXACT FIN PARAGRAPH", "test packages", ir.types);
	assert.ok(readme.startsWith("EXACT FIN PARAGRAPH\n\n"));
	assert.ok(readme.includes("Checked records cross as generated record values"));
});

test("native checked-record documentation refuses missing, misplaced and invented constructors", () => {
	for(const mutate of [ir => { delete ir.declarations[0].source.extensions[refinementsKey]; }
		, ir => { ir.declarations[0].source.extensions[refinementsKey].parameters[0] = null; }
		, ir => { ir.declarations[0].source.extensions[refinementsKey].parameters[0].constructor = "bad constructor"; }
		, ir => { delete ir.types[0].source.extensions["lean-lang.org/erased-proofs"]; }
		, ir => { ir.declarations[0].source.extensions[refinementsKey].result = { kind: "checked-record", constructor: "CheckedRecords.mkInterval" }; }]) {
		for(const generate of Object.values(checkedRecordNativeGenerators))
		{
			const ir = checkedRecordNativeInput("reviewed-ir"); mutate(ir);
			assert.throws(() => generate(ir), TypeError);
		}
		}
	assert.throws(() => checkedRecordNativeInput("unknown"), TypeError);
});

test("native Subtype package documentation names reviewed constructor reconciliation", () => {
	const ir = checkedRecordNativeInput("reviewed-ir"), declaration = structuredClone(ir.declarations[0]);
	declaration.parameters[0].type = { kind: "primitive", name: "nat" };
	declaration.source.extensions[refinementsKey].parameters[0] = { kind: "subtype", constructor: "Library.checkedEven" };
	const readme = nativeRefinementReadme([declaration], "", "native packages");
	assert.ok(readme.includes("Reviewed APIs select the constructor and reconcile it with fresh Lean compilation"));
	assert.ok(readme.includes("Subtype inside records, variants or callbacks is not supported"));
	assert.doesNotMatch(readme, /reviewed Binding IR is not supported/u);
});

test("all native package readers opt into checked-record mirrors without admitting refined callbacks", async () => {
	for(const host of ["python", "rust", "ruby", "dotnet", "jvm", "php", "wit"])
	{
		const source = await readFile(`src/build/native-${host}-artifacts.mjs`, "utf8");
		assert.ok(source.includes("{ copiedGraphs: true, nativeRefinements: true, nativeCheckedRecords: true }"), host);
		assert.doesNotMatch(source, /nativeCallbackRefinements: true/u);
	}
	const source = await readFile("src/build/native-c-projection.mjs", "utf8");
	assert.ok(source.includes('nativeCheckedRecords: targets.every(target => ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native", "wit-wasi"].includes(target))'));
	assert.ok(source.includes('nativeCallbackRefinements: targets.every(target => ["c", "cpp"].includes(target))'));
	const artifact = await readFile("src/build/native-artifacts.mjs", "utf8");
	assert.ok(artifact.includes("nativeCheckedRecords = false"));
	assert.ok(artifact.includes('code: "native-checked-records-unavailable"'));
});
