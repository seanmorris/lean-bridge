/**
 * Reviewed v4 admission and independent C execution against freshly compiled Lean.
 * Synthetic projections exercise rejection only, never count as execution evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { canonicalizeJsonValue, parseBindingIr } from "../src/binding-ir/canonical.mjs";
import { validateReviewedSource, assertReviewedSourceConfiguration } from "../src/analyze/reviewed-source.mjs";
import { validateReviewedOwnedSource, reviewedOwnedSourceSelection, readReviewedOwnedSource
	, verifyReviewedOwnedSourceInputs, reconcileReviewedOwnedSource } from "../src/analyze/reviewed-owned-source.mjs";
import { generateOwnedAggregateCarriers } from "../src/build/owned-aggregate-carriers.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const capture = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source)
		, semanticSha256: sha256(canonicalizeJsonValue(document)) };
};
const annotated = () => {
	const document = structuredClone(ownedAggregateReviewedIr());
	document.documentation = { summary: "Reviewed resource API.", details: "Explicit result owners." };
	document.declarations.find(item => item.name === "echoRecord").parameters[0].name = "bundle";
	document.types.find(item => item.kind === "callback").callable.parameters[0].name = "incoming";
	document.types.find(item => item.name === "Bundle").fields[0].documentation = { summary: "Main ticket.", details: "" };
	const choice = document.types.find(item => item.name === "Choice");
	choice.cases[1].documentation = { summary: "A single retained ticket.", details: "" };
	choice.cases[1].fields[0].documentation = { summary: "Ticket owned by the result.", details: "" };
	document.errors[0].documentation = { summary: "Host callback failure after cleanup.", details: "" };
	return document;
};
// Deliberately synthetic. Fresh compilation and independently written C checks
// run in the enabled test below; these objects only exercise reconciliation.
const fixture = () => {
	const document = annotated(), review = capture(document), compiled = structuredClone(document);
	compiled.producers = [{ id: "compiler", adapter: "compiler-test"
		, adapterVersion: 1, tool: "Synthetic admission test", toolVersion: "1"
		, extensions: { "example.org/identity": "fresh-test" } }];
	for(const item of [...compiled.types, ...compiled.declarations])
	{
		item.source.producer = "compiler";
		item.source.extensions = { "lean-lang.org/theorem-references": ["Owned.primary_bundle"] };
		item.documentation = { summary: "Compiler annotation.", details: "" };
	}
	compiled.declarations.forEach(item => { item.effects.sort(); item.parameters.forEach((parameter, index) => { parameter.name = `arg${index}`; }); });
	const config = { schemaVersion: 1, modules: ["Owned"] };
	const sourceIdentity = { reviewedBindingIr: review
		, exportConfigurationSource: canonicalJson(config)
		, exportConfigurationSha256: sha256(canonicalJson(config))
		, request: { exportModules: ["Owned"], ...reviewedOwnedSourceSelection(review) } };
	return { document, review, compiled, sourceIdentity };
};

test("owned review owns resource selection and policy without admitting v4 to v3", () => {
	const document = annotated(), review = capture(document);
	assert.deepEqual(validateReviewedOwnedSource(review), document);
	assert.deepEqual(reviewedOwnedSourceSelection(review), {
		exports: document.declarations.map(item => item.source.declaration).sort()
		, resources: ["Owned.Ticket"]
		, arities: [["Owned.makeRecord", 1], ["Owned.makeRecursive", 1]]
		, ownedAggregates: document.aggregatePolicy
	});
	assert.throws(() => validateReviewedSource(review), { code: "consumer-upgrade-required" });
	assert.throws(() => parseBindingIr(review.source), { code: "consumer-upgrade-required" });
	assert.throws(() => assertReviewedSourceConfiguration({ schemaVersion: 1, ownedAggregates: document.aggregatePolicy }), { code: "export-configuration-reviewed-ir" });
});

test("owned reconciliation preserves nested annotations and compiled provenance", () => {
	const { document, review, compiled, sourceIdentity } = fixture();
	const before = structuredClone({ document, review, compiled, sourceIdentity });
	const actual = reconcileReviewedOwnedSource(review, compiled, sourceIdentity);
	assert.deepEqual(actual.producers, compiled.producers);
	assert.deepEqual(actual.documentation, document.documentation);
	for(const collection of ["declarations", "types"])
		for(const item of actual[collection])
		{
			assert.deepEqual(item.source, compiled[collection].find(value => value.id === item.id).source);
			assert.deepEqual(item.documentation, document[collection].find(value => value.id === item.id).documentation);
		}
	assert.equal(actual.declarations.find(item => item.name === "echoRecord").parameters[0].name, "bundle");
	assert.deepEqual(actual.types.find(item => item.name === "Choice").cases, document.types.find(item => item.name === "Choice").cases);
	assert.equal(actual.types.find(item => item.kind === "callback").callable.parameters[0].name, "incoming");
	assert.deepEqual(actual.errors, document.errors);
	assert.deepEqual({ document, review, compiled, sourceIdentity }, before);
});

for(const [label, mutate] of Object.entries({
	"record field order": ir => { ir.types.find(item => item.name === "Bundle").fields.reverse(); }
	, "variant branch order": ir => { ir.types.find(item => item.name === "Choice").cases.reverse(); }
	, "nominal field name": ir => { ir.types.find(item => item.name === "Bundle").fields[0].name = "other"; }
	, "nominal ownership policy": ir => { ir.types.find(item => item.name === "Bundle").aggregate.fallback = "none"; }
	, "resource disposal fallback": ir => { ir.types.find(item => item.name === "Ticket").resource.fallback = "none"; }
	, "resource cycles policy": ir => { ir.types.find(item => item.name === "Ticket").resource.cycles = "no-back-edges"; }
	, "alias target": ir => { ir.types.find(item => item.name === "BundleAlias").target = { kind: "named", id: "lean:Owned.Tree" }; }
	, "host export name": ir => { ir.declarations[0].name = "renamed"; }
	, "primitive width": ir => { ir.declarations[0].parameters[0].type.name = "uint64"; }
})) test(`owned review rejects ${label} drift without discarding it`, () => {
	const { document, compiled, sourceIdentity } = fixture(); mutate(document);
	const review = capture(document); sourceIdentity.reviewedBindingIr = review;
	assert.throws(() => reconcileReviewedOwnedSource(review, compiled, sourceIdentity), { code: "reviewed-ir-source-mismatch" });
});

for(const [label, mutate] of Object.entries({
	"claimed theorem": ir => { ir.declarations[0].source.extensions["lean-lang.org/theorem-references"] = ["Forged.proof"]; }
	, "claimed layout": ir => { ir.types[0].source.extensions["example.org/layout"] = { tag: 17 }; }
	, "producer evidence": ir => { ir.producers[0].extensions["example.org/compiler"] = true; }
	, "optional parameter": ir => { ir.declarations[0].parameters[0].optional = true; ir.declarations[0].parameters[0].default = { kind: "integer", value: "1" }; }
	, "host callback parameter transfer": ir => { ir.types.find(item => item.kind === "callback").callable.parameters[0].ownership = "transfer"; }
	, "promise": ir => { ir.declarations[0].resultMode = "promise"; ir.declarations[0].effects.push("async"); }
	, "silenced callback failure": ir => { ir.types.find(item => item.kind === "callback").callable.failure = { mode: "none", errors: [], unexpected: "poison-runtime" }; }
})) test(`owned review rejects unsupported ${label} before compilation`, () => {
	const document = annotated(); mutate(document);
	assert.throws(() => validateReviewedOwnedSource(capture(document)));
});

test("owned review binds raw bytes, inventory, module authorization and exact selection", async t => {
	const { document, review, compiled, sourceIdentity } = fixture();
	const input = { path: review.path, bytes: Buffer.byteLength(review.source), sha256: review.sourceSha256 };
	verifyReviewedOwnedSourceInputs(sourceIdentity, [input]);
	for(const mutate of [
		value => { value.source += " "; }
		, value => { value.semanticSha256 = "a".repeat(64); }
		, value => { value.path = "../api.binding-ir.json"; }
		, value => { value.claimedVerified = true; }
	]) {
		const changed = structuredClone(review); mutate(changed);
		assert.throws(() => validateReviewedOwnedSource(changed), { code: "reviewed-ir-source-mismatch" });
	}
	for(const inputs of [[], [input, input], [{ ...input, bytes: input.bytes + 1 }], [{ ...input, sha256: "a".repeat(64) }]])
		assert.throws(() => verifyReviewedOwnedSourceInputs(sourceIdentity, inputs), { code: "reviewed-ir-source-mismatch" });
	assert.throws(() => verifyReviewedOwnedSourceInputs({}, [input]), { code: "reviewed-ir-source-mismatch" });
	for(const mutate of [
		value => { value.request.exportModules = ["Other"]; }
		, value => { value.request.resources = []; }
		, value => { value.request.exports.pop(); }
		, value => { value.request.arities = []; }
		, value => { value.request.ownedAggregates.fallback = "none"; }
		, value => { value.request.contracts = {}; }
		, value => { value.request.specializations = []; }
		, value => { value.exportConfigurationSha256 = "a".repeat(64); }
		, value => { value.reviewedBindingIr.source += " "; }
	]) {
		const changed = structuredClone(sourceIdentity); mutate(changed);
		assert.throws(() => reconcileReviewedOwnedSource(review, compiled, changed), { code: "reviewed-ir-source-mismatch" });
	}
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-review-capture-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await saveLakeFile(directory, review.path, review.source);
	const inventory = { inputs: [input], configurationRecord: { configuration: { schemaVersion: 1, modules: ["Owned"] } } };
	assert.deepEqual(await readReviewedOwnedSource(directory, inventory), review);
	await assert.rejects(() => readReviewedOwnedSource(directory, { ...inventory, inputs: [input, input] }), { code: "reviewed-ir-build-unsupported" });
	await assert.rejects(() => readReviewedOwnedSource(directory, inventory, AbortSignal.abort()), { name: "AbortError" });
	for(const field of ["exports", "resources", "arities", "contracts", "ownedAggregates"])
	{
		const configuration = { ...inventory.configurationRecord.configuration, [field]: field === "ownedAggregates" ? document.aggregatePolicy
			: ["exports", "resources"].includes(field) ? ["Owned.Ticket"] : {} };
		await assert.rejects(() => readReviewedOwnedSource(directory, { ...inventory, configurationRecord: { configuration } }), { code: "export-configuration-reviewed-ir" });
	}
	await saveLakeFile(directory, review.path, review.source + " ");
	await assert.rejects(() => readReviewedOwnedSource(directory, inventory), { code: "reviewed-ir-source-mismatch" });
});

test("fresh Lean verifies independently reviewed ownership before public C execution", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const review = annotated(), compiled = await compileOwnedAggregateFixture(t, { reviewedIr: review });
	const generated = generateOwnedCPackage({ metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: review.component });
	assert.equal(generated.layout.model.bindingIr.documentation.summary, review.documentation.summary);
	assert.ok(generated.layout.model.bindingIr.declarations.find(item => item.name === "bundle")
		.source.extensions["lean-lang.org/theorem-references"].includes("Owned.primary_bundle"));
	assert.notDeepEqual(generated.layout.model.bindingIr.producers, review.producers);
	assert.notEqual(generated.layout.model.bindingIrSha256, compiled.sourceIdentity.reviewedBindingIr.semanticSha256);
	for(const type of review.types.filter(item => item.callable))
		assert.deepEqual(generated.layout.model.bindingIr.types.find(item => item.id === type.id).callable.parameters.map(item => item.name)
			, type.callable.parameters.map(item => item.name));
	const instrumentation = `#include <stddef.h>
extern void *owned_test_allocate(size_t);
extern void owned_test_free(void *);
#define LB_OWNED_ALLOC owned_test_allocate
#define LB_OWNED_FREE owned_test_free
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/")
			? instrumentation + source + `
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
  return snapshot.live_identities;
}
void owned_test_retire(void) { lean_bridge_native_runtime_retire(); }
` : source);
	const source = await readFile("tests/fixtures/structured-types/owned-public-values.c", "utf8");
	const run = await compiled.compile("reviewed-public-values", source, false, ["public-api.c", "-lgmp"]);
	const result = await run(); assert.equal(result.stderr, "");
	const checks = JSON.parse(result.stdout);
	assert.ok(checks.checks >= 2000); assert.ok(checks.failures >= 40);
	assert.equal(checks.live, 0); assert.equal(checks.identities, 0);
	const sanitized = await compiled.compile("reviewed-public-values-sanitized", source, true, ["public-api.c", "-lgmp"]);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	const normalize = value => value.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS");
	assert.deepEqual(JSON.parse(exercised.stdout), checks);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	const stale = structuredClone(compiled.sourceIdentity); stale.reviewedBindingIr.source += " ";
	assert.throws(() => generateOwnedAggregateCarriers({ metadata: compiled.metadata, sourceIdentity: stale, component: review.component }), { code: "invalid-native-elaboration" });
	// Run the real extractor again with the changed review's own request identity.
	// This must reject shape drift, rather than an obsolete invocation digest.
	const changed = annotated(); changed.types.find(item => item.name === "Choice").cases.reverse();
	const changedInput = await compiled.extractReviewed(changed);
	assert.throws(() => generateOwnedAggregateCarriers(changedInput), { code: "reviewed-ir-source-mismatch" });
	await saveLakeFile(resolve("build/owned-aggregate-native"), "reviewed-shape-negative-inputs.json", canonicalJson(changedInput));
	const report = { checks
		, bindingIrSha256: generated.layout.model.bindingIrSha256
		, reviewedSourceSha256: compiled.sourceIdentity.reviewedBindingIr.sourceSha256
		, reviewedSemanticSha256: compiled.sourceIdentity.reviewedBindingIr.semanticSha256
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, headerSha256: sha256(generated.publicHeader)
		, adapterSha256: sha256(generated.source), probeSha256: sha256(source)
		, staleReviewRejected: true, orderedShapeDriftRejected: true
		, startupLeakBaseline: normalize(cold.stderr).replaceAll(compiled.directory, "<probe>") };
	await saveLakeFile(resolve("build/owned-aggregate-native"), "reviewed-public-c.json", canonicalJson(report));
	t.diagnostic(JSON.stringify(report));
});
