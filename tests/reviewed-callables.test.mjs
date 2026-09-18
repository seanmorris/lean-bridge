/**
 * Test reviewed callable admission and reconciliation policy. These synthetic
 * documents test guards, not execution evidence; perl-callables installs Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reconcileReviewedSource, reviewedSourceSelection, validateReviewedSource } from "../src/analyze/reviewed-source.mjs";
import { assertComponentSignature } from "../src/abi/component-scalars.mjs";
import { compilePrimitiveCSurface } from "../src/backends/c/primitive-surface.mjs";
import { callableArities, callablePrimitives, callableReviewedIr, callableReviewInput } from "./helpers/callable-fixture.mjs";

test("reviewed primitive callables preserve distinct signatures and derive returned-closure arities", () => {
	const review = callableReviewInput(), document = validateReviewedSource(review);
	assert.equal(document.types.length, 38);
	assert.equal(document.declarations.length, 58);
	assert.deepEqual(Object.fromEntries(reviewedSourceSelection(review).arities), callableArities);
	for(const [, name] of callablePrimitives)
		assert.equal(document.types.filter(type => type.callable.result.type.name === name).length, 2);
});

test("reviewed callable admission does not enable npm scalars or copied C adapters", () => {
	const document = callableReviewedIr();
	assert.throws(() => assertComponentSignature(document.declarations[0]), { code: "unsupported-component-signature" });
	assert.throws(() => compilePrimitiveCSurface(document), { code: "unsupported-native-c-signature" });
});

for(const [label, change] of Object.entries({
	"retained callback": document => { document.declarations[0].parameters[1].ownership = "lease"; document.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "transferred closure": document => { document.declarations[2].result.ownership = "transfer"; }
	, "once-only invocation": document => { document.types[0].callable.invocation = "once"; }
	, "no re-entry": document => { document.types[0].callable.reentry = "disallowed"; }
	, "immediate disposal": document => { document.types[0].callable.selfDisposal = "reject"; }
	, "async delivery": document => { document.types[0].callable.resultMode = "promise"; document.types[0].callable.effects.push("async"); }
	, "callback failure omission": document => { document.types[0].callable.failure = { mode: "none", errors: [], unexpected: "poison-runtime" }; document.types[0].callable.effects = []; }
	, "forged callback identity": document => { document.types[0].source.declaration = "Forged.Callback"; }
	, "forged callback name": document => { document.types[0].name = "Forged"; }
	, "copied callable array": document => { document.declarations[2].result = { type: { kind: "apply", constructor: "array", arguments: [document.declarations[2].result.type] }, ownership: "lease", lifetime: { scope: "explicit", anchor: null } }; }
})) test(`reviewed callables reject unsupported ${label}`, () => {
	const document = callableReviewedIr(); change(document);
	assert.throws(() => validateReviewedSource(callableReviewInput(document)), { code: "reviewed-ir-build-unsupported" });
});

for(const position of ["parameter", "result"]) test(`reviewed copied-container callback ${position} remains unsupported`, () => {
	const document = callableReviewedIr(), definition = document.types[0];
	const site = position === "parameter" ? definition.callable.parameters[0] : definition.callable.result;
	site.type = { kind: "apply", constructor: "array", arguments: [site.type] };
	const signature = { parameters: definition.callable.parameters.map(item => item.type), result: definition.callable.result.type };
	const old = definition.id, name = `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`;
	definition.name = name; definition.id = `bridge:${name}`; definition.source.declaration = name;
	for(const declaration of document.declarations)
		for(const item of [...declaration.parameters, declaration.result]) if(item.type.id === old) item.type.id = definition.id;
	assert.throws(() => validateReviewedSource(callableReviewInput(document)), { code: "reviewed-ir-build-unsupported" });
});

const input = () => {
	const document = callableReviewedIr(), review = callableReviewInput(document);
	const config = canonicalJson({ schemaVersion: 1, modules: ["Callables"] });
	return { document, review
		, identity: { exportConfigurationSource: config
			, exportConfigurationSha256: sha256(config)
			, request: { exportModules: ["Callables"]
				, ...reviewedSourceSelection(review), resources: [] } } };
};

test("reviewed closure arities remain bound to the exact compiler selection", () => {
	const { document, review, identity } = input();
	assert.equal(reconcileReviewedSource(review, document, identity).declarations.length, 58);
	for(const arities of [[], [["Callables.makeUnit", 0]], identity.request.arities.toReversed()])
		assert.throws(() => reconcileReviewedSource(review, document, { ...identity, request: { ...identity.request, arities } }), { code: "reviewed-ir-source-mismatch" });
});

test("fresh callback type, ownership, error and closure result drift reject before adapters", () => {
	const { document, review, identity } = input();
	for(const change of [
		value => { value.types[0].callable.parameters[0].type.name = "char"; }
		, value => { value.types[0].callable.result.type.name = "usize"; }
		, value => { value.types[1].callable.result.type.name = "isize"; }
		, value => { value.types[0].callable.invocation = "once"; }
		, value => { value.declarations[0].parameters[1].ownership = "lease"; value.declarations[0].parameters[1].lifetime.scope = "explicit"; }
		, value => { value.declarations[2].result.lifetime.scope = "runtime"; }
		, value => { value.errors[0].category = "domain"; }
	]) {
		const compiled = structuredClone(document); change(compiled);
		assert.throws(() => reconcileReviewedSource(review, compiled, identity), { code: "reviewed-ir-source-mismatch" });
	}
});
