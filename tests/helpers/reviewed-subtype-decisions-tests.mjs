/**
 * Test reviewed constructor mapping without claiming compiler or installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createMetadataRequest } from "../../src/analyze/elaborated-metadata.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { reconcileReviewedSource, reviewedSourceSelection, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import "./reviewed-subtype-decisions-source-history-tests.mjs";
import "./reviewed-subtype-admission-source-history-tests.mjs";

const key = "lean-lang.org/refinements";
const subtype = constructor => ({ kind: "subtype", constructor });
const fin = bound => ({ kind: "fin", bound });
const plain = { ownership: "copy", lifetime: null };
const checked = constructor => ({ ...plain, refinement: { constructor } });
const reviewInput = ir => {
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};
const document = (parameters = ["string"], result = "string", decision = {
	parameters: [subtype("Checks.word")], result: subtype("Checks.word")
}) => {
	const ir = corpusReviewedIr({ id: "checked" }, [{ name: "Checks.echo", parameters, result }]);
	if(decision !== undefined) ir.declarations[0].source.extensions[key] = decision;
	return ir;
};

test("reviewed Subtype selection maps each exact site without mutating its author", () => {
	const ir = document(), original = canonicalJson(ir);
	const contracts = reviewedSubtypeContracts(ir);
	assert.deepEqual(contracts, { "Checks.echo": { parameters: [checked("Checks.word")], result: checked("Checks.word") } });
	assert.equal(canonicalJson(ir), original);
	contracts["Checks.echo"].parameters[0].refinement.constructor = "Checks.changed";
	assert.equal(canonicalJson(ir), original);
	assert.deepEqual(reviewedSubtypeContracts(ir), { "Checks.echo": { parameters: [checked("Checks.word")], result: checked("Checks.word") } });
});

test("result-only and mixed Fin, nominal and unrefined sites keep distinct decisions", () => {
	const resultOnly = document([], "nat", { parameters: [], result: subtype("Checks.even") });
	assert.deepEqual(reviewedSubtypeContracts(resultOnly), { "Checks.echo": { parameters: [], result: checked("Checks.even") } });
	const ir = document(["nat", "nat", { record: "Checks.Box", fields: { digit: "nat" } }, "string"], "string", {
		parameters: [subtype("Checks.even"), fin("10"), null, null], result: null
	});
	ir.types[0].source.extensions["lean-lang.org/nominal-refinements"] = { kind: "record", fields: [fin("4")] };
	const before = canonicalJson(ir);
	assert.deepEqual(reviewedSubtypeContracts(ir), { "Checks.echo": {
		parameters: [checked("Checks.even"), plain, plain, plain], result: plain
	} });
	assert.equal(canonicalJson(ir), before);
	assert.deepEqual(ir.declarations[0].source.extensions[key].parameters[1], fin("10"));
	assert.deepEqual(ir.types[0].source.extensions["lean-lang.org/nominal-refinements"].fields, [fin("4")]);
});

test("unrefined and Fin-only declarations add no constructor selection", () => {
	const ir = document(); delete ir.declarations[0].source.extensions[key];
	assert.equal(reviewedSubtypeContracts(ir), undefined);
	assert.equal(reviewedSubtypeContracts(document(["nat"], "nat", { parameters: [fin("10")], result: fin("10") })), undefined);
	assert.equal(reviewedSubtypeContracts(document([{ array: "nat" }], "nat", { parameters: [{ kind: "array", arguments: [fin("10")] }], result: null })), undefined);
});

test("constructor requests sort deterministically and bind the selected name into invocation identity", () => {
	const ir = document(), second = structuredClone(ir.declarations[0]);
	second.id = "lean:Checks.alpha"; second.source.declaration = "Checks.alpha";
	second.name = "alpha"; second.overloadKey = "Checks.alpha";
	ir.declarations.push(second);
	assert.deepEqual(Object.keys(reviewedSubtypeContracts(ir)), ["Checks.alpha", "Checks.echo"]);
	const context = { toolchain: "test", modules: [] };
	const request = () => createMetadataRequest({ contracts: reviewedSubtypeContracts(ir) }, context);
	const before = request();
	ir.declarations.reverse(); assert.deepEqual(request(), before);
	ir.declarations[0].source.extensions[key].parameters[0].constructor = "Checks.normalizingWord";
	assert.notEqual(request().metadata.invocationIdentitySha256, before.metadata.invocationIdentitySha256);
	assert.equal(request().contracts["Checks.alpha"].parameters[0].refinement.constructor, "Checks.normalizingWord");
});

test("malformed, nested and ownership-bearing Subtype decisions are refused", () => {
	const mutations = [
		ir => { ir.declarations[0].source.extensions[key].extra = "proof"; }
		, ir => { ir.declarations[0].source.extensions[key].parameters = []; }
		, ir => { delete ir.declarations[0].source.extensions[key].result; }
		, ir => { ir.declarations[0].source.extensions[key].parameters[0].proof = "forged"; }
		, ir => { ir.declarations[0].source.extensions[key].parameters[0].constructor = "Checks.word\n"; }
		, ir => { ir.declarations[0].source.extensions[key].parameters[0].constructor = "Checks.word x"; }
		, ir => { ir.declarations[0].source.extensions[key] = { parameters: [null], result: null }; }
		, ir => { ir.declarations[0].parameters[0].type = { kind: "named", id: "lean:Checks.Box" }; }
		, ir => { ir.declarations[0].parameters[0].ownership = "borrow"; }
		, ir => { ir.declarations[0].parameters[0].lifetime = { scope: "call", anchor: null }; }
		, ir => { ir.declarations.push(structuredClone(ir.declarations[0])); }
	];
	for(const mutate of mutations)
	{
		const ir = document(); mutate(ir);
		assert.throws(() => reviewedSubtypeContracts(ir));
	}
	for(const constructor of ["array", "list", "option"])
		assert.throws(() => reviewedSubtypeContracts(document([{ [constructor]: "nat" }], "nat", {
			parameters: [{ kind: constructor, arguments: [subtype("Checks.even")] }]
			, result: null
		})));
});

test("derived constructor selections retain the existing 128-export contract bound", () => {
	const ir = document(), first = ir.declarations[0];
	ir.declarations = Array.from({ length: 129 }, (_, index) => ({ ...structuredClone(first)
		, source: { ...structuredClone(first.source), declaration: `Checks.export${index}` }
	}));
	assert.throws(() => reviewedSubtypeContracts(ir), /at most 128/u);
});

test("reviewed primitive Subtype decisions select their constructors for fresh compilation", () => {
	for(const type of ["nat", "int", "string", "bytes", "uint8", "uint32", "uint64", "bool", "float32", "float64"])
	{
		const ir = document([type], type), review = reviewInput(ir);
		validateReviewedSource(review);
		assert.deepEqual(reviewedSourceSelection(review), {
			exports: ["Checks.echo"], arities: []
			, contracts: { "Checks.echo": { parameters: [checked("Checks.word")], result: checked("Checks.word") } }
		});
	}
});

test("specializations of one generic select independent constructors by public export name", () => {
	const ir = corpusReviewedIr({ id: "checked" }, ["first", "second"].map(name => ({ name: `Checks.${name}`, parameters: ["nat"], result: "nat" })));
	for(const item of ir.declarations)
	{
		item.source.declaration = "Checks.echo";
		item.source.extensions["lean-lang.org/specialization"] = {
			name: `Checks.${item.name}`, declaration: "Checks.echo"
			, types: ["Checks.Even"], application: "@Checks.echo.{0} Checks.Even"
		};
		item.source.extensions[key] = { parameters: [subtype(`Checks.${item.name}Constructor`)], result: subtype(`Checks.${item.name}Constructor`) };
	}
	const selection = reviewedSourceSelection(reviewInput(ir));
	assert.deepEqual(selection.exports, ["Checks.first", "Checks.second"]);
	assert.deepEqual(Object.keys(selection.contracts), ["Checks.first", "Checks.second"]);
	for(const name of ["first", "second"]) assert.deepEqual(selection.contracts[`Checks.${name}`], {
		parameters: [checked(`Checks.${name}Constructor`)]
		, result: checked(`Checks.${name}Constructor`)
	});
	assert.equal(selection.specializations.length, 2);
});

test("review reconciliation authenticates constructor selection and compiled constraints separately", () => {
	const ir = document(), review = reviewInput(ir), selection = reviewedSourceSelection(review);
	const configuration = canonicalJson({ schemaVersion: 1, modules: ["Checks"] });
	const identity = { request: { ...selection, modules: ["Checks"], exportModules: ["Checks"], resources: [] }
		, exportConfigurationSource: configuration
		, exportConfigurationSha256: sha256(configuration) };
	assert.deepEqual(reconcileReviewedSource(review, ir, identity), ir);
	for(const mutate of [
		request => { delete request.contracts; }
		, request => { request.contracts["Checks.echo"].parameters[0].refinement.constructor = "Checks.other"; }
		, request => { request.contracts["Checks.echo"].result.refinement.constructor = "Checks.other"; }
		, request => { request.contracts["Checks.other"] = request.contracts["Checks.echo"]; }
	]) {
		const changed = structuredClone(identity); mutate(changed.request);
		assert.throws(() => reconcileReviewedSource(review, ir, changed), { code: "reviewed-ir-source-mismatch" });
	}
	const compiled = structuredClone(ir);
	compiled.declarations[0].source.extensions[key].result.constructor = "Checks.other";
	assert.throws(() => reconcileReviewedSource(review, compiled, identity), error => {
		assert.equal(error.code, "reviewed-ir-source-mismatch");
		assert.match(error.details.field, /result.constructor$/u);
		return true;
	});
});
