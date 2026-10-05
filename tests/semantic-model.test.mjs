/**
 * Check shared lowering using synthetic reports, without claiming execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { createElaboratedSemanticModel, elaboratedComponent, sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { projectPerlNames } from "../src/backends/perl/naming.mjs";

const component = elaboratedComponent({ name: "Sample", version: "1.0.0" });
const native = () => ({ ...nativeMetadataFixture(), component, moduleName: "LeanBridge::Sample" });
const lower = input => createElaboratedSemanticModel({ metadata: input.metadata
	, request: input.sourceIdentity.request, component
	, elaborationSha256: "9".repeat(64) });
const scalar = () => {
	const input = native();
	const { metadata: context, ...selection } = input.sourceIdentity.request;
	delete selection.profile; delete selection.resources; delete selection.arities;
	input.sourceIdentity.request = createMetadataRequest(selection, {
		toolchain: context.toolchain, modules: context.modules
		, leanCompilerSha256: input.sourceIdentity.leanCompilerSha256
		, extractorSha256: input.sourceIdentity.extractorSha256
	});
	input.metadata.profile = "component-scalars-v1";
	input.metadata.producer.invocationIdentitySha256 = input.sourceIdentity.request.metadata.invocationIdentitySha256;
	for(const declaration of input.metadata.modules[0].declarations)
	{
		const { projection } = declaration;
		projection.bindingShape = "pure-function";
		const copy = type => ({ kind: type.kind, name: type.name });
		projection.parameters = projection.parameters.map(p => ({ ...p, type: copy(p.type) }));
		projection.result = copy(projection.result);
	}
	return input;
};

test("native and scalar compiler profiles lower to the same source API", () => {
	const n = createNativeModel(native()), s = lower(scalar());
	assert.equal(n.schemaVersion, 2);
	assert.notEqual(n.bindingIrSha256, s.semanticSha256, "Compiler evidence remains profile-specific");
	assert.deepEqual(sourceApiIdentity(n.bindingIr), sourceApiIdentity(s.document));
	assert.equal(n.bindingIr.component.id, "sample@1.0.0");
	assert.deepEqual(n.bindingIr.errors, [], "Pure APIs do not acquire callback errors");
});

test("Perl names and module choices cannot change source semantics", () => {
	const input = native(), other = { ...input, moduleName: "LeanBridge::Different" };
	assert.deepEqual(createNativeModel(input).bindingIr, createNativeModel(other).bindingIr);
	const declarations = [{ name: "Example.incrementWord" }];
	assert.equal(projectPerlNames(input.moduleName, declarations)[0].publicName, "increment_word");
	assert.equal(declarations[0].name, "Example.incrementWord");
	assert.equal(declarations[0].publicName, undefined);
	assert.throws(() => projectPerlNames(input.moduleName, [...declarations, { name: "Other.increment_word" }]), /collision/);
	assert.throws(() => projectPerlNames("LeanBridge::Runtime", declarations), /reserved/);
});

test("API comparison excludes locations and producer identities but binds declarations and contracts", () => {
	const original = lower(scalar()).document, expected = sourceApiIdentity(original).sha256;
	const relocated = structuredClone(original);
	relocated.producers[0].extensions["lean-lang.org/elaboration-sha256"] = "f".repeat(64);
	relocated.declarations[0].source.extensions["lean-lang.org/source-position"].path = "root/Sample.lean";
	assert.equal(sourceApiIdentity(relocated).sha256, expected);
	for(const change of [
		ir => { ir.declarations[0].name = "other"; }
		, ir => { ir.declarations[0].parameters[0].type.name = "uint64"; }
		, ir => { ir.declarations[0].source.extensions["lean-lang.org/theorem-references"] = []; }
		, ir => { ir.declarations[0].source.extensions["lean-lang.org/export-contract"] = { effects: [] }; }
	]) {
		const changed = structuredClone(original); change(changed);
		assert.notEqual(sourceApiIdentity(changed).sha256, expected);
	}
});

test("shared lowering rejects stale reports, forged ABI types and invalid selections", () => {
	const input = native();
	for(const change of [
		value => { value.metadata.producer.invocationIdentitySha256 = "0".repeat(64); }
		, value => { value.metadata.modules[0].declarations[0].projection.result.abi.cType = "void *"; }
		, value => { value.metadata.modules[0].declarations[0].selected = false; }
	]) {
		const changed = structuredClone(input); change(changed);
		assert.throws(() => lower(changed));
	}
	const options = { metadata: input.metadata
		, request: input.sourceIdentity.request
		, component, elaborationSha256: "9".repeat(64) };
	assert.throws(() => createElaboratedSemanticModel({ ...options, include: ["Other.missing"] }), /admitted/);
	assert.throws(() => createElaboratedSemanticModel({ ...options, include: ["Sample.increment", "Sample.increment"] }), /admitted/);
	const empty = createElaboratedSemanticModel({ ...options, include: [] });
	assert.deepEqual(empty.document.declarations, []);
	assert.equal(empty.semanticSha256, null);
	assert.throws(() => sourceApiIdentity(empty.document), /non-empty/);
});
