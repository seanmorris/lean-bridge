/**
 * Reconstruct receiver runtime artifacts and require independent lifetime checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPhpCalls } from "../../src/backends/php/owned-calls.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedJvmPlainReceiverSource } from "./owned-jvm-receiver-fixture.mjs";
import { ownedPhpReceiverProbe, ownedPhpPlainReceiverProbe, ownedPhpRetiredIdentityProbe, ownedPhpUnanchoredReceiverProbe } from "./owned-php-receiver-fixture.mjs";
import { ownedPhpWasmReceiverHistoricalBytes } from "./owned-php-wasm-receiver-history.mjs";

export const ownedPhpReceiverCommand = "npm run test:owned-php-receivers";
export const ownedPhpReceiverScope = Object.freeze({
	profiles: ["php-native"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedComposer: true, publicExports: 27, receiverExports: 16
	, anchoredResults: 20, consumingExports: 4, callerModes: ["weak", "strict"]
	, nominalWholeOwners: true, methods: "camel-case"
	, properties: "read-only-virtual-properties", originalOwnerTransfers: true
	, receiverAndParameterAnchors: true, recursiveValues: true, emptyValues: true
	, sharedRoots: true, independentRetains: true, canonicalIdentity: true
	, expiredEqualityRejected: true, retiredRuntimeEqualityRejected: true
	, resourceOnlyExecuted: true, resourceOnlyInstalled: true
	, unanchoredCallbacksExecuted: true, hostCallbacksOptional: true
	, callbackReentry: true, returnedClosures: true
	, phpAllocationFaults: true, nativeAllocationFaults: true
	, retainedExceptions: true, parsedNegativeVariants: 9
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, independentBuild: true
	, documentationExecuted: true, combinedCRelease: true
	, automaticShutdown: true, privateGmp: true
	, callbackResultAnchors: false, wasm: false, docker: false
	, otherConsumerBindings: false, installedSupportPromotions: 0
});

/**
 * Match compiler inputs to the authored library and exact admitted capabilities.
 *
 * @param item - One runtime or installed report.
 * @param options - Expected case, never inferred from a report's claim.
 * @param options.plain - Require resource-only exports without callback transport.
 * @param options.unanchored - Require callback exports without result anchors.
 * @param options.consuming - Require explicit original-owner transfers.
 */
export const ownedPhpReceiverModel = async (item, { plain = false, unanchored = false, consuming = true } = {}) => {
	assert.ok(["ordinary", "reviewed"].includes(item.mode));
	assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256
		, sha256(lean + (plain ? ownedJvmPlainReceiverSource : ownedRustReceiverSource)));
	assert.equal(item.input.sourceIdentity.extractorSha256, sha256(ownedPhpWasmReceiverHistoricalBytes(
		"src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"))));
	const capabilities = { receiverExports: true, hostCallbacks: !plain
		, transferredInputs: consuming, anchoredResults: !plain && !unanchored };
	const model = createCompiledNativeModel(item.input, {
		ownedGraphs: true, ownedReceiverExports: true
		, ownedHostCallbacks: !plain
		, ownedInputTransfers: consuming, ownedAnchoredResults: !plain && !unanchored
	});
	assert.equal(model.schemaVersion, 10);
	assert.equal(model.exports.length, plain ? consuming ? 5 : 4 : 27);
	assert.equal(model.ownedGraph.receiverExports.exports.length, plain ? consuming ? 4 : 3 : 16);
	assert.equal(model.ownedGraph.resultAnchors?.exports.length, plain || unanchored ? undefined : 20);
	assert.equal(model.ownedGraph.inputTransfers?.exports.length, consuming ? plain ? 1 : 4 : undefined);
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), !plain);
	return { model, capabilities };
};

const nativeProbe = (c, calls, transferred) => {
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
${calls.nativeSource}
size_t owned_test_live(void) { return live; }
${transferred ? "size_t owned_test_handoffs(void) { return handoffs; }\n" : ""}\
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
`;
};

const mutations = calls => {
	const parameter = calls.functions.find(fn => fn.name === "chooseTicket").publicParameters[1];
	return [
		["last-root", "src/Internal/OwnedRuntime.php", "if (--$this->roots === 0) $this->invalidate();", "--$this->roots;"]
		, ["share-is-independent", "src/Api.php", "return new static($lease, $type, $payload, $retain);", "return $this->retain();"]
		, ["retain-is-shared", "src/Api.php", "return $retain($payload);", "return $this->share();"]
		, ["wrapper-identity", "src/Internal/OwnedRuntime.php", "return ($this->equalCall)($this, $other);", "return $this === $other;"]
		, ["callback-never-expires", "src/Internal/OwnedRuntime.php", "if (isset($this->scope)) $this->scope->active = false;", "/* broken: scope remains active */"]
		, ["receiver-anchor-is-copy", "src/Api.php", "return retain_ticket($this);", "return retain_ticket(copy_value($this));"]
		, ["parameter-anchor-is-receiver", "src/Api.php", `return choose_ticket($this->get(), $${parameter});`, "return choose_ticket($this->get(), $this);"]
		, ["consume-copied-receiver", "src/Api.php", "return transfer_ticket($this);", "return transfer_ticket($this->retain());"]
		, ["erase-nominal-owner", "src/Internal/Values.php", `\\${calls.namespace}\\TicketValue::class`, `\\${calls.namespace}\\Value::class`]
	].map(([name, path, before, after]) => {
		assert.equal(calls.files[path].split(before).length, 2, name);
		return { name, path, sourceSha256: sha256(calls.files[path].replace(before, after)), parsed: true, semanticRejection: true };
	});
};

/**
 * Bind every runtime observation to regenerated C/PHP and unchanged probes.
 *
 * @param record - Both full cases, four plain cases and both unanchored cases.
 */
export const assertOwnedPhpReceiverRuntime = async record => {
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.unanchored.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.plain.map(item => [item.mode, item.consuming]), [
		["ordinary", false], ["reviewed", false]
		, ["ordinary", true], ["reviewed", true]
	]);
	for(const item of [...record.runtime, ...record.plain, ...record.unanchored])
	{
		const plain = record.plain.includes(item), unanchored = record.unanchored.includes(item);
		const consuming = plain ? item.consuming : true;
		const { model, capabilities } = await ownedPhpReceiverModel(item, { plain, unanchored, consuming });
		const calls = generateOwnedPhpCalls(model.bindingIr, capabilities);
		const c = generateOwnedCPackage({ ...item.input, ...capabilities, identityEquality: true });
		assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
		assert.equal(item.publicHeaderSha256, sha256(c.publicHeader));
		assert.equal(item.nativeSourceSha256, sha256(nativeProbe(c, calls, consuming)));
		assert.deepEqual(item.generated, Object.fromEntries(Object.entries(calls.files).map(([path, source]) => [path, sha256(source)])));
		const source = plain ? ownedPhpPlainReceiverProbe(consuming) : unanchored ? ownedPhpUnanchoredReceiverProbe : await ownedPhpReceiverProbe();
		assert.equal(item.consumerSha256, sha256(source));
		assert.equal(item.observed.live, 0); assert.equal(item.observed.identities, 0);
		if(plain)
		{
			assert.equal(item.anchoredResults, false); assert.equal(item.hostCallbacks, false);
			assert.equal(item.observed.checks, consuming ? 26 : 25);
			assert.deepEqual(item.retired, { checks: 5, live: 0, identities: 0 });
			assert.equal(item.retiredConsumerSha256, sha256(ownedPhpRetiredIdentityProbe));
		}
		else if(unanchored)
		{
			assert.equal(item.resultAnchors, false);
			assert.deepEqual(item.observed, { checks: 13, live: 0, identities: 0 });
		}
		else
		{
			assert.equal(item.observed.checks, 2380); assert.equal(item.observed.heldErrors, 379);
			assert.deepEqual(item.weakObserved, item.observed);
			assert.deepEqual(item.observed.functions, calls.functions.map(fn => fn.name).sort());
			assert.deepEqual(item.observed.faults, {
				borrow: { php: { before: 75, after: 0 }, native: { before: 109, after: 0 } }
				, move: { php: { before: 20, after: 55 }, native: { before: 13, after: 89 } }
				, mixed: { php: { before: 7, after: 4 }, native: { before: 2, after: 2 } }
			});
			assert.deepEqual(item.mutants, mutations(calls));
		}
	}
};
