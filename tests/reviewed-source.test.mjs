/**
 * Reviewed contracts cannot supply compiler facts or silently lose decisions.
 * Synthetic metadata here tests admission only, not compiled execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { validateReviewedSource, verifyReviewedSourceInputs } from "../src/analyze/reviewed-source.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";

const component = { id: "sample@1.0.0", name: "sample", version: "1.0.0" };
const reviewInput = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source), semanticSha256: hashBindingIr(document) };
};
const fixture = (change = () => {}) => {
	const input = { ...nativeMetadataFixture(), component };
	const document = structuredClone(createNativeModel(input).bindingIr);
	document.producers[0].extensions = {};
	for(const declaration of document.declarations) declaration.source.extensions = {};
	document.documentation.summary = "Author's public API.";
	document.declarations[0].documentation.summary = "Reviewed increment.";
	document.declarations[0].parameters[0].name = "amount";
	change(document);
	const configuration = { schemaVersion: 1, modules: ["Sample"] };
	const identity = input.sourceIdentity;
	identity.exportConfigurationSource = canonicalJson(configuration);
	identity.exportConfigurationSha256 = sha256(identity.exportConfigurationSource);
	identity.reviewedBindingIr = reviewInput(document);
	const { metadata, ...selection } = identity.request;
	identity.request = createMetadataRequest(selection, {
		toolchain: metadata.toolchain, modules: metadata.modules
		, leanCompilerSha256: identity.leanCompilerSha256
		, extractorSha256: identity.extractorSha256
		, reviewedBindingIrSha256: sha256(canonicalJson(identity.reviewedBindingIr))
	});
	input.metadata.producer.invocationIdentitySha256 = identity.request.metadata.invocationIdentitySha256;
	return input;
};

test("compiler-checked review preserves annotations, not claimed compiler evidence", () => {
	const input = fixture(), model = createNativeModel(input);
	assert.equal(model.schemaVersion, 3);
	assert.equal(model.bindingIr.documentation.summary, "Author's public API.");
	assert.equal(model.bindingIr.declarations[0].documentation.summary, "Reviewed increment.");
	assert.equal(model.bindingIr.declarations[0].parameters[0].name, "amount");
	assert.deepEqual(model.bindingIr.declarations[0].source.extensions["lean-lang.org/theorem-references"], ["Sample.increment_spec"]);
	assert.equal(model.exports[0].module, "Sample");
	assert.equal(model.bindingIrSha256, hashBindingIr(model.bindingIr));
	assert.notEqual(model.bindingIrSha256, input.sourceIdentity.reviewedBindingIr.semanticSha256);
	assert.deepEqual(createNativeModel(structuredClone(input)), model);
});

for(const [label, change] of Object.entries({
	"parameter type": ir => { ir.declarations[0].parameters[0].type.name = "uint64"; }
	, "result type": ir => { ir.declarations[0].result.type.name = "uint64"; }
	, "host name": ir => { ir.declarations[0].name = "renamed"; }
	, "component": ir => { ir.component.version = "2.0.0"; ir.component.id = "sample@2.0.0"; }
	, "overload": ir => { ir.declarations[0].overloadKey = "renamed"; }
})) test(`reviewed ${label} mismatch fails against compiler facts`, () => {
	assert.throws(() => createNativeModel(fixture(change)), { code: "reviewed-ir-source-mismatch" });
});

for(const [label, change] of Object.entries({
	"default": ir => { ir.declarations[0].parameters[0].optional = true; ir.declarations[0].parameters[0].default = { kind: "integer", value: "1" }; }
	, "effect": ir => { ir.declarations[0].effects = ["async"]; ir.declarations[0].resultMode = "promise"; }
	, "claimed theorem": ir => { ir.declarations[0].source.extensions["lean-lang.org/theorem-references"] = ["Forged.proof"]; }
	, "producer extension": ir => { ir.producers[0].extensions["example.org/decision"] = true; }
})) test(`unsupported reviewed ${label} is not discarded`, () => {
	assert.throws(() => createNativeModel(fixture(change)), { code: "reviewed-ir-build-unsupported" });
});

test("review input, raw bytes and invocation identity are all bound", () => {
	const input = fixture();
	const review = input.sourceIdentity.reviewedBindingIr;
	const inputs = [{ path: review.path, bytes: Buffer.byteLength(review.source), sha256: review.sourceSha256 }];
	verifyReviewedSourceInputs(input.sourceIdentity, inputs);
	for(const change of [
		value => { value.source += " "; }
		, value => { value.semanticSha256 = "a".repeat(64); }
		, value => { value.path = "../api.binding-ir.json"; }
		, value => { value.claimedVerified = true; }
	]) {
		const changed = structuredClone(review); change(changed);
		assert.throws(() => validateReviewedSource(changed), { code: "reviewed-ir-source-mismatch" });
	}
	assert.throws(() => verifyReviewedSourceInputs(input.sourceIdentity, []), { code: "reviewed-ir-source-mismatch" });
	assert.throws(() => verifyReviewedSourceInputs({}, inputs), { code: "reviewed-ir-source-mismatch" });
	const changed = structuredClone(input);
	changed.sourceIdentity.reviewedBindingIr.source += " ";
	assert.throws(() => createNativeModel(changed), { code: "invalid-native-elaboration" });
	const unauthorized = structuredClone(input);
	unauthorized.sourceIdentity.exportConfigurationSource = canonicalJson({ schemaVersion: 1, modules: ["Other"] });
	unauthorized.sourceIdentity.exportConfigurationSha256 = sha256(unauthorized.sourceIdentity.exportConfigurationSource);
	assert.throws(() => createNativeModel(unauthorized), { code: "reviewed-ir-source-mismatch" });
});
