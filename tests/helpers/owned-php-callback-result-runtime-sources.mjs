/**
 * Reconstruct PHP callback sources; opaque compiler products remain observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPhpCalls } from "../../src/backends/php/owned-calls.mjs";
import { generateOwnedAggregateCarriers } from "../../src/build/owned-aggregate-carriers.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";

const hash = value => sha256(canonicalJson(value));
const witness = `import Owned
@[export owned_test_record_identity]
def recordIdentity (_ : Unit) : Array (Owned.Bundle → Owned.Bundle) := #[fun value => value]
@[export owned_test_tree_identity]
def treeIdentity (_ : Unit) : Array (Owned.Tree → Owned.Tree) := #[fun value => value]
`;
const nativeProbe = (c, model, transferred) => {
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	if(transferred) assert.equal(c.source.split(handoff).length, 2);
	return `#include <stdlib.h>
#include <stddef.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;${transferred ? "\nstatic size_t handoffs = 0;" : ""}
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${transferred ? c.source.replace(handoff, handoff + "\n  ++handoffs;") : c.source}
${model.nativeSource}
size_t owned_test_live(void) { return live; }
${transferred ? "size_t owned_test_handoffs(void) { return handoffs; }\n" : ""}\
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
`;
};
const reconstructed = new Map();

/**
 * Bind observed compiler identities to authored inputs and regenerate adapters.
 *
 * @param mode - Required ordinary or reviewed source route.
 * @param variant - Required no-host, host or combined capability shape.
 * @param item - Untrusted direct report.
 * @param baseline - Independently hash-authenticated original observation.
 */
export const assertOwnedPhpCallbackRuntimeSources = async (mode, variant, item, baseline) => {
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const options = { hostCallbacks, callbackResultAnchors: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	assert.deepEqual(item.options, options);
	const { metadata, sourceIdentity: identity, component, ...extra } = item.input;
	assert.deepEqual(extra, {});
	assert.deepEqual(component, { id: "owned-aggregates@1.0.0", name: "owned-aggregates", version: "1.0.0" });
	// These compiler/extractor output baselines are authenticated observations,
	// not claims that this reader reruns Lean, C compilation or linking.
	assert.equal(hash(metadata), hash(baseline.input.metadata));
	assert.equal(hash(identity), hash(baseline.input.sourceIdentity));
	assert.equal(identity.leanVersion, "4.32.2");
	assert.equal(identity.leanCommit, "f3b06c705e6c85f5314019d5d3baab0fec5b580c");
	assert.equal(identity.leanCompilerSha256, "e8baaa71855a616dc351028f3ad2200051b0671f423a1696a100e809302d5550");
	assert.equal(identity.extractorSha256, sha256(beforeFinRefinementSource("src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"), identity.extractorSha256)));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")
		+ (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource);
	assert.equal(identity.sourceTreeSha256, sha256(lean));
	assert.equal(identity.modules.length, 1); assert.equal(identity.modules[0].module, "Owned");
	assert.deepEqual(identity.modules[0].source, { path: "Owned.lean", sha256: sha256(lean) });
	const configuration = mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	assert.equal(identity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(identity.exportConfigurationSha256, hash(configuration));
	assert.equal(Boolean(identity.reviewedBindingIr), mode === "reviewed");
	if(mode === "reviewed")
	{
		const reviewed = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(identity.reviewedBindingIr.source, canonicalJson(reviewed));
		assert.equal(identity.reviewedBindingIr.sourceSha256, hash(reviewed));
	}
	const key = hash({ input: item.input, options });
	if(!reconstructed.has(key))
	{
		const c = generateOwnedCPackage({ ...item.input, ...options, valueCopies: true, identityEquality: combined });
		const model = generateOwnedPhpCalls(c.values.native.model.bindingIr, options);
		assert.equal(model.c.callbacks.filter(callback => callback.anchor !== undefined).length, 4);
		assert.equal(model.functions.filter(fn => fn.receiver === 0).length, combined ? 5 : 0);
		assert.equal(model.functions.filter(fn => fn.transfers?.length).length, combined ? 2 : 0);
		assert.equal(model.c.copies.length, 20);
		const carriers = generateOwnedAggregateCarriers({ ...item.input, hostCallbacks });
		let helpers = await readFile("tests/fixtures/structured-types/owned-php-calls-probe.php", "utf8");
		if(combined) helpers = helpers
			.replace("size_t owned_test_live(void);", "size_t owned_test_live(void);\\nsize_t owned_test_handoffs(void);")
			.replace("global $model;", "global $model, $visited; $visited[$name] = true;");
		helpers = helpers.replace("$item instanceof Resource", "$item instanceof Resource || $item instanceof LeanOwnedAggregates\\Value");
		reconstructed.set(key, { c, model, carriers, helpers, native: nativeProbe(c, model, combined) });
	}
	const generated = reconstructed.get(key);
	assert.deepEqual(item.generated, Object.fromEntries(Object.entries(generated.model.files).map(([path, text]) => [path, sha256(text)])));
	assert.equal(item.nativeSourceSha256, sha256(generated.native));
	assert.equal(item.publicHeaderSha256, sha256(generated.model.c.header));
	assert.equal(item.helpersSha256, sha256(generated.helpers));
	assert.equal(item.compiledInputs["Owned.lean"], sha256(lean));
	assert.equal(item.compiledInputs["Witness.lean"], sha256(witness));
	assert.equal(item.compiledInputs["public-api.c"], sha256(generated.native));
	if(hostCallbacks) assert.equal(item.compiledInputs["Callbacks.c"], sha256(generated.carriers.callbackSource));
	return generated;
};
