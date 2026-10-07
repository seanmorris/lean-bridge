/**
 * Authored Fin admission and comparison using explicit synthetic compiler facts.
 * Installed execution is covered separately, never inferred from these tests.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { createMetadataRequest } from "../../src/analyze/elaborated-metadata.mjs";
import { assertReviewedFin } from "../../src/analyze/reviewed-refinements.mjs";
import { reviewedSourceSelection, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { createNativeModel } from "../../src/build/native-model.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";
import { nativeMetadataFixture } from "./native-metadata.mjs";
import { nativeFinReviewedIr } from "./reviewed-fin-fixture.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";

const key = "lean-lang.org/refinements";
const fin = bound => ({ kind: "fin", bound });
const wrap = (kind, child) => ({ kind, arguments: [child] });
const decision = (parameter = fin("10"), result = parameter) => ({ parameters: [parameter], result });
const document = (transport = "nat", constraints = decision()) => {
	const ir = corpusReviewedIr({ id: "sample" }, [{ name: "Sample.increment", parameters: [transport], result: transport }]);
	ir.declarations[0].source.extensions[key] = constraints;
	return ir;
};
const reviewInput = ir => {
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
const nativeFin = bound => ({ kind: "refinement", base: nat, predicate: fin(bound), abi: nat.abi });
const container = (kind, element) => ({ kind, element, abi: { ...nat.abi, heap: true } });
const aliasDocument = (bound = "10") => {
	const ir = document({ array: "nat" });
	delete ir.declarations[0].source.extensions[key];
	const target = ir.declarations[0].result.type;
	ir.types.push({
		id: "lean:Sample.Digits", name: "Digits", kind: "alias"
		, representation: "copied", mutability: "immutable"
		, typeParameters: [], fields: [], target
		, resource: null, callable: null, cases: [], host: null
		, documentation: { summary: "Reviewed digits.", details: "" }, assurance: []
		, source: { producer: "corpusReview", declaration: "Sample.Digits"
			, extensions: { "lean-lang.org/nominal-refinements": { kind: "alias", target: wrap("array", fin(bound)) } } } });
	ir.declarations[0].parameters[0].type = { kind: "named", id: "lean:Sample.Digits" };
	ir.declarations[0].result.type = { kind: "named", id: "lean:Sample.Digits" };
	return ir;
};
const nativeFixture = (ir, parameter = nativeFin("10"), result = parameter) => {
	const fixture = nativeMetadataFixture();
	const projection = fixture.metadata.modules[0].declarations[0].projection;
	projection.parameters[0].type = parameter;
	projection.result = result;
	const identity = fixture.sourceIdentity;
	identity.reviewedBindingIr = reviewInput(ir);
	identity.exportConfigurationSource = canonicalJson({ schemaVersion: 1, modules: ["Sample"] });
	identity.exportConfigurationSha256 = sha256(identity.exportConfigurationSource);
	const { metadata, ...selection } = identity.request;
	identity.request = createMetadataRequest(selection, {
		toolchain: metadata.toolchain
		, modules: metadata.modules
		, leanCompilerSha256: identity.leanCompilerSha256
		, extractorSha256: identity.extractorSha256
		, reviewedBindingIrSha256: sha256(canonicalJson(identity.reviewedBindingIr))
	});
	fixture.metadata.producer.invocationIdentitySha256 = identity.request.metadata.invocationIdentitySha256;
	return { ...fixture, component: ir.component };
};

test("the independent installed Fin fixture supplies a valid reviewed selection", () => {
	const ir = nativeFinReviewedIr();
	validateReviewedSource(reviewInput(ir));
	assert.deepEqual(reviewedSourceSelection(reviewInput(ir)), {
		exports: ["NativeFin.impossible", "NativeFin.label", "NativeFin.mirror", "NativeFin.only", "NativeFin.succHuge", "NativeFin.twice", "NativeFin.wrap"]
		, arities: []
	});
});

test("the independent container fixture keeps alias and structural constraints at distinct sites", () => {
	const ir = finContainerReviewedIr();
	validateReviewedSource(reviewInput(ir));
	assert.equal(reviewedSourceSelection(reviewInput(ir)).exports.length, 8);
	assert.deepEqual(ir.types.map(type => [type.id, type.kind]), [["lean:FinContainers.Digits", "alias"]]);
	assert.deepEqual(ir.types[0].source.extensions["lean-lang.org/nominal-refinements"], { kind: "alias", target: wrap("array", fin("10")) });
	const mirror = ir.declarations.find(declaration => declaration.name === "mirrorAll");
	assert.equal(mirror.parameters[0].type.id, "lean:FinContainers.Digits");
	assert.deepEqual(mirror.source.extensions, {});
	const flatten = ir.declarations.find(declaration => declaration.name === "flatten");
	assert.deepEqual(flatten.source.extensions[key], decision(null, wrap("option", wrap("list", fin("10")))));
	assert.equal(flatten.parameters[0].type.arguments[0].id, "lean:FinContainers.Digits");
});

test("independently authored Fin bounds reconcile with exact native compiler decisions", () => {
	for(const bound of ["0", "1", "10", "1180591620717411303424"])
	{
		const ir = document("nat", decision(fin(bound)));
		validateReviewedSource(reviewInput(ir));
		assert.deepEqual(reviewedSourceSelection(reviewInput(ir)), { exports: ["Sample.increment"], arities: [] });
		const model = createNativeModel(nativeFixture(ir, nativeFin(bound)), { refinements: true });
		assert.equal(model.schemaVersion, 3);
		assert.deepEqual(model.exports[0].refinements, decision(fin(bound)));
		assert.deepEqual(model.bindingIr.declarations[0].source.extensions[key], decision(fin(bound)));
		assert.deepEqual(model.bindingIr.declarations[0].source.extensions["lean-lang.org/theorem-references"], ["Sample.increment_spec"]);
		assert.equal(model.bindingIr.declarations[0].parameters[0].name, "value0");
		assert.equal(model.bindingIr.producers[0].adapter, "lean-bridge-elaborator");
	}
});

test("reviewed structural Fin preserves every nested bound and constraint position", () => {
	const cases = [
		["array", "list", "option"]
		, ["list", "option", "array"]
		, ["option", "array", "list"]];
	for(const kinds of cases)
	{
		const transport = kinds.reduceRight((value, kind) => ({ [kind]: value }), "nat");
		const refinement = kinds.reduceRight((value, kind) => wrap(kind, value), fin("10"));
		const native = kinds.reduceRight((value, kind) => container(kind, value), nativeFin("10"));
		const ir = document(transport, decision(refinement));
		const model = createNativeModel(nativeFixture(ir, native), { refinements: true });
		assert.deepEqual(model.exports[0].refinements, decision(refinement));
	}
	for(const [parameter, result] of [[fin("10"), null], [null, fin("10")]])
	{
		const ir = document("nat", decision(parameter, result));
		const model = createNativeModel(nativeFixture(ir, parameter ? nativeFin("10") : nat, result ? nativeFin("10") : nat), { refinements: true });
		assert.deepEqual(model.exports[0].refinements, decision(parameter, result));
	}
});

test("a reviewed alias retains its named transport and exact target bound", () => {
	const target = container("array", nativeFin("10"));
	const alias = { kind: "alias", name: "Sample.Digits", lean: "Sample.Digits", target, abi: target.abi };
	const ir = aliasDocument(), model = createNativeModel(nativeFixture(ir, alias), { refinements: true });
	assert.deepEqual(model.bindingIr.types[0].source.extensions, ir.types[0].source.extensions);
	assert.deepEqual(model.exports[0].refinements, decision(wrap("array", fin("10"))));
	assert.equal(model.bindingIr.declarations[0].parameters[0].type.id, "lean:Sample.Digits");
	assert.equal(model.exports[0].parameters[0].type.kind, "array");
	assert.throws(() => createNativeModel(nativeFixture(aliasDocument("11"), alias), { refinements: true }), { code: "reviewed-ir-source-mismatch" });
	delete ir.types[0].source.extensions["lean-lang.org/nominal-refinements"];
	assert.throws(() => createNativeModel(nativeFixture(ir, alias), { refinements: true }), { code: "reviewed-ir-source-mismatch" });
	const invalidValues = [
		null, { kind: "alias", target: null }
		, { kind: "record", fields: [fin("10")] }
		, { kind: "alias", target: wrap("array", { kind: "subtype", constructor: "Sample.check" }) }];
	for(const refinement of invalidValues)
	{
		const invalid = aliasDocument(); invalid.types[0].source.extensions["lean-lang.org/nominal-refinements"] = refinement;
		assert.throws(() => validateReviewedSource(reviewInput(invalid)), { code: "reviewed-ir-build-unsupported" });
	}
});

test("malformed reviewed constraints fail before selecting compiler exports", () => {
	const invalid = [
		null, [], {}, { parameters: [fin("10")] }, { ...decision(), extra: true }
		, { parameters: [], result: fin("10") }, decision(null, null)
		, decision({ kind: "subtype", constructor: "Sample.checked" })
		, decision({ ...fin("10"), evidence: "forged" })
		, decision(wrap("option", null)), decision(wrap("option", fin("10")))
		, ...["", "01", "-1", "1.0", "1e3", 10].map(bound => decision(fin(bound)))];
	for(const constraints of invalid)
		assert.throws(() => reviewedSourceSelection(reviewInput(document("nat", constraints))), { code: "reviewed-ir-build-unsupported" });
	for(const transport of ["int", "uint64", "string", { array: "nat" }])
		assert.throws(() => validateReviewedSource(reviewInput(document(transport))), { code: "reviewed-ir-build-unsupported" });
	const nestedSubtype = document({ option: "nat" }, decision(wrap("option", { kind: "subtype", constructor: "Sample.checked" })));
	assert.throws(() => validateReviewedSource(reviewInput(nestedSubtype)), { code: "reviewed-ir-build-unsupported" });
});

test("reviewed Fin validation bounds nesting and retains partial product decisions", () => {
	const tree = count => Array.from({ length: count }).reduce(value => wrap("option", value), fin("10"));
	const type = count => Array.from({ length: count }).reduce(value => ({ kind: "apply", constructor: "option", arguments: [value] }), { kind: "primitive", name: "nat" });
	for(const depth of [0, 1, 32]) assertReviewedFin({ parameters: [{ type: type(depth) }], result: { type: type(depth) } }, decision(tree(depth)));
	assert.throws(() => assertReviewedFin({ parameters: [{ type: type(33) }], result: { type: type(33) } }, decision(tree(33))));
	for(const kind of ["tuple", "result"])
	{
		const ir = document({ [kind]: ["nat", "string"] }, decision({ kind, arguments: [fin("10"), null] }));
		validateReviewedSource(reviewInput(ir));
		const invalid = structuredClone(ir);
		invalid.declarations[0].source.extensions[key].result.arguments.reverse();
		assert.throws(() => validateReviewedSource(reviewInput(invalid)), { code: "reviewed-ir-build-unsupported" });
	}
});

test("reviewed bounds cannot overwrite, invent or discard compiler constraints", () => {
	const mutations = [
		ir => { ir.declarations[0].source.extensions[key].parameters[0].bound = "11"; }
		, ir => { ir.declarations[0].source.extensions[key].result.bound = "9"; }
		, ir => { ir.declarations[0].source.extensions[key].parameters[0] = null; }
		, ir => { ir.declarations[0].source.extensions[key].result = null; }
		, ir => { delete ir.declarations[0].source.extensions[key]; }];
	for(const mutate of mutations)
	{
		const ir = document(); mutate(ir);
		assert.throws(() => createNativeModel(nativeFixture(ir), { refinements: true }), error => {
			assert.equal(error.code, "reviewed-ir-source-mismatch");
			assert.match(error.details.field, /source\.extensions\.lean-lang.org\/refinements/);
			return true;
		});
	}
	assert.throws(() => createNativeModel(nativeFixture(document(), nat), { refinements: true }), { code: "reviewed-ir-source-mismatch" });
	// A valid review does not override the selected native profile's capability.
	assert.throws(() => createNativeModel(nativeFixture(document())), { code: "native-refinements-unsupported" });
});

test("Fin admission does not authorize compiler evidence or nominal and callable decisions", () => {
	const mutations = [
		ir => { ir.declarations[0].source.extensions["lean-lang.org/theorem-references"] = ["Sample.forged"]; }
		, ir => { ir.declarations[0].source.extensions["lean-lang.org/specialization"] = {}; }
		, ir => { ir.producers[0].extensions[key] = decision(); }];
	for(const mutate of mutations)
	{
		const ir = document(); mutate(ir);
		assert.throws(() => validateReviewedSource(reviewInput(ir)), { code: "reviewed-ir-build-unsupported" });
	}
	const box = { record: "Sample.Box", fields: { value: "nat" } };
	const record = document(box), callable = callableReviewedIr();
	delete record.declarations[0].source.extensions[key];
	for(const ir of [record, callable])
	{
		ir.types[0].source.extensions[key] = decision();
		assert.throws(() => validateReviewedSource(reviewInput(ir)), { code: "reviewed-ir-build-unsupported" });
	}
	const subtype = { kind: "refinement", base: nat, predicate: { kind: "subtype", constructor: "Sample.checked" }, abi: nat.abi };
	assert.throws(() => createNativeModel(nativeFixture(document(), subtype), { refinements: true }), { code: "native-refinements-unsupported" });
});
