/**
 * Add only the archived ordinary C/C++ host-reply direction to existing callback evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinReplyArchive, finReplyArchiveDirectory, finReplyInstalledRevision } from "./native-fin-reply-evidence.mjs";

export const nativeFinReplyPromotionId = "native-callback-fin-host-replies-installed";
export const nativeFinReplyPromotionReceipt = { path: `${finReplyArchiveDirectory}/receipt.json`, sha256: "ba6506d36753dd8c5ed6aea487609c0cacafb9c6a3b82898443fd8d70a7e1830" };
export const nativeFinReplyPromotionObservationIds = ["callback-fin-c-ordinary-source", "callback-fin-cpp-ordinary-source"];
export const nativeFinReplyPromotionValidators = ["tests/helpers/native-fin-reply-promotion-references.mjs", "tests/helpers/native-fin-reply-evidence.mjs"];
export const nativeFinReplyPromotionDirections = "Ordinary C/C++ host-produced replies retain Fin bounds inside Option, Array, List, tested nested containers, products, records and active Except/variant branches when the selected failure value contains no Fin inhabitant.";
export const nativeFinReplyPromotionFailure = "A rejected reply preserves the first boundary error, suppresses later host callbacks and leaves caller output unchanged. Lean may continue with a typed Fin-free containment value; earlier effects are not rolled back and no default Fin is substituted.";
export const nativeFinReplyPromotionLimit = "Bare Fin replies and selected failure constructors needing a Fin remain refused, as do callback Subtype and checked records. This report does not establish reviewed host replies, other native hosts, recursive or generic refined replies, asynchronous or retained callbacks, or installed dispatch counters.";
export const nativeFinReplyPromotionEnvironment = "Local Node 22.23.3, Lean 4.32.2, GCC/G++ 12.2.0 and measured glibc 2.36, with declared floor 2.36. Hosted CI and other release floors are not established. Package archive hashes are retained, not the binary archives; selected producer sources are not a complete dependency closure.";
export const nativeFinReplyPromotionInstalled = "The original ordinary-source host-reply packages pass C 81 and C++ 74 checks, reproduce from two author roots and install offline after source removal with a compiler-free consumer PATH. Both forked children exit 5 before any host call. This installed run has no dispatch or sanitizer instrumentation.";
export const nativeFinReplyPromotionWrapper = "The separate C wrapper run at 65f7dd7 removes the Fin 5 reply walk and observes Lean's independent refusal for maybe/twice. Its ASan/UBSan instrument the wrapper and consumer only, not the Lean component or runtimes; it supplies no source-entry counter, installed-package or C++ sanitizer claim.";
const originalDirections = "Earlier callback evidence covers arguments to returned Lean closures, Lean-produced closure results and Lean-produced arguments to host callbacks.";
const originalExecution = "The earlier callback report passes C 297 and C++ 283 checks. Only its ordinary C closure cases measure public lease entry, checked adapter and source body; C++ dispatch is unmeasured. The new host-reply report contributes only the contained callback-result direction.";

/**
 * Authenticate original archived bytes without reading absolute producer paths or Git objects.
 *
 * @param read - Reader replaceable by corruption controls.
 */
export const nativeFinReplyPromotionReference = async (read = readFile) => {
	const bytes = await read(nativeFinReplyPromotionReceipt.path);
	assert.equal(sha256(bytes), nativeFinReplyPromotionReceipt.sha256);
	const receipt = JSON.parse(bytes);
	const archived = async path => {
		assert.ok(path.startsWith(`${finReplyArchiveDirectory}/`) && !path.split("/").includes(".."), path);
		return read(path);
	};
	await assertFinReplyArchive(receipt, archived);
	assert.equal(receipt.producers.installed.revision, finReplyInstalledRevision);
	const report = JSON.parse(await archived(receipt.producers.installed.report));
	return { id: nativeFinReplyPromotionId, revision: finReplyInstalledRevision
		, command: "source scripts/env.sh && LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST=1 LEAN_BRIDGE_NATIVE_FIN_REPLY_TEST=1 LEAN_BRIDGE_FIN_REPLY_PROFILES=c,cpp LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 node --test --test-concurrency=1 --test-name-pattern='fresh Lean|generated C wrapper execution: C reply walks|relocated source-free C and C\\+\\+ packages check every host reply' tests/native-fin-callbacks.test.mjs"
		, scope: [nativeFinReplyPromotionDirections, nativeFinReplyPromotionFailure, nativeFinReplyPromotionInstalled, nativeFinReplyPromotionLimit, nativeFinReplyPromotionEnvironment, nativeFinReplyPromotionWrapper, "The command reproduces the current tests; the archived outputs identify their original producers separately."].join(" ")
		, files: [nativeFinReplyPromotionReceipt, ...receipt.artifacts.map(({ path, sha256 }) => ({ path, sha256 }))]
		, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path: `${nativeFinReplyPromotionId}/${path}`, sha256 })) };
};

/**
 * Reconcile one existing observation, preserving its parameter representation and original evidence.
 *
 * @param previous - Exact observation before this milestone.
 */
export const nativeFinReplyPromotionObservation = previous => {
	assert.ok(nativeFinReplyPromotionObservationIds.includes(previous.id));
	const profile = previous.id === nativeFinReplyPromotionObservationIds[0] ? "c" : "cpp";
	assert.deepEqual(previous.profiles, [profile]); assert.equal(previous.path, "ordinary-source");
	assert.deepEqual(previous.shapes, ["fin"]); assert.deepEqual(previous.positions, ["callback-parameter", "callback-result"]);
	const result = structuredClone(previous), representation = profile === "c" ? "GMP mpz values" : "boost::multiprecision::cpp_int values";
	result.scope = `${originalDirections} ${nativeFinReplyPromotionDirections}`;
	result.hostTypes.fin["callback-result"] = `${representation} for Lean-produced leased-closure results and checked host replies inside the tested Fin-free-containment shapes`;
	const notes = {
		analysis: "Original callback bounds remain compiler-owned. Ordinary-source host-reply admission additionally requires a typed Fin-free failure value."
		, generation: "Original closure/callback conversions remain checked. Host-reply callback identity includes bounds and result refinements; C checks active reply leaves before copying."
		, compilation: "Original source signatures are preserved. Lean independently reconstructs each host-reply Fin using its decidable bound proof and exports typed failure constructors."
		, packaging: `Earlier callback packages retain their separately recorded environment. ${nativeFinReplyPromotionInstalled} ${nativeFinReplyPromotionEnvironment}`
		, installedExecution: `${originalExecution} ${nativeFinReplyPromotionInstalled} ${nativeFinReplyPromotionFailure} ${nativeFinReplyPromotionLimit}`
	};
	assert.deepEqual(Object.keys(previous.stages), Object.keys(notes));
	for(const [stage, entry] of Object.entries(result.stages))
	{
		assert.deepEqual(entry.evidence, ["native-callback-fin-ordinary-installed"]); assert.equal(entry.state, "passed");
		entry.evidence.push(nativeFinReplyPromotionId); entry.note = notes[stage];
	}
	result.limitations = [nativeFinReplyPromotionLimit
		, nativeFinReplyPromotionEnvironment, nativeFinReplyPromotionWrapper
		, previous.limitations[1], previous.limitations[2]];
	result.conversionNotes = { fin: `${result.scope} ${nativeFinReplyPromotionFailure} ${nativeFinReplyPromotionLimit}` };
	return result;
};
