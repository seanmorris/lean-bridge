/** @file */
import assert from "node:assert/strict";
import test from "node:test";
import {
	instrumentPhpWasmCallbackEntries, restorePhpWasmCallbackEntries
	, validatePhpWasmCallbackEntrySelection
} from "./php-wasm-callback-entry-c.mjs";
import { parsePhpWasmCallbackEntryTrace } from "./php-wasm-callback-entry-trace.mjs";

const selected = Object.freeze([
	Object.freeze({ symbol: "lgc_call0", kind: "public", label: "Probe.call" })
	, Object.freeze({ symbol: "ng_recovery_a", kind: "recovery", label: "Probe.recovery" })
	, Object.freeze({ symbol: "lgc_callback0", kind: "callback", label: "Probe.callback" })
	, Object.freeze({ symbol: "body", kind: "closure", label: "Probe.body" })
	, Object.freeze({ symbol: "lgc_cleanup_call0", kind: "cleanup", label: "Probe.cleanup" })
]);

test("callback C markers are reversible and preserve exact call order", () => {
	const original = `static inline int ng_recovery_a(int x) { return x; }
static uint32_t lgc_callback0(void *p) { return p != 0; }
int body(int x) { return x; }
static void lgc_cleanup_call0(void *p) { (void)p; }
static ZEND_FUNCTION(lgc_call0) { lgc_cleanup_call0(NULL); RETURN_NULL(); }
`;
	const { source, receipt } = instrumentPhpWasmCallbackEntries(original, selected);
	assert.equal(receipt.insertions.length, selected.length + 1);
	assert.match(source, /LB_CALLBACK_ENTRY_V1 enter recovery Probe\.recovery/u);
	assert.match(source, /LB_CALLBACK_ENTRY_V1 begin public Probe\.call/u);
	assert.equal(restorePhpWasmCallbackEntries(source, receipt), original);
	const trace = [
		"LB_CALLBACK_ENTRY_V1 begin public Probe.call"
		, "LB_CALLBACK_ENTRY_V1 enter recovery Probe.recovery"
		, "LB_CALLBACK_ENTRY_V1 enter callback Probe.callback"
		, "LB_CALLBACK_ENTRY_V1 enter closure Probe.body"
		, "LB_CALLBACK_ENTRY_V1 enter cleanup Probe.cleanup"
		, "LB_CALLBACK_ENTRY_V1 end public Probe.call", ""
	].join("\n");
	const [call] = parsePhpWasmCallbackEntryTrace(trace, selected);
	assert.equal(call.publicName, "Probe.call");
	assert.deepEqual(call.entries.map(item => item.kind)
		, ["recovery", "callback", "closure", "cleanup"]);
	assert.equal(call.counts.recovery, 1); assert.equal(call.counts.cleanup, 1);
});

test("callback entry validation and parser refuse open or malformed traces", () => {
	assert.throws(() => validatePhpWasmCallbackEntrySelection([
		...selected, { ...selected[0], label: "Probe.other" }
	]), /Expected values to be strictly equal/u);
	assert.throws(() => instrumentPhpWasmCallbackEntries(
		"static int body(int x) { return x; }\nstatic int body(int x) { return x; }\n"
		, [{ symbol: "body", kind: "closure", label: "Probe.body" }]
	), /duplicate selected definition/u);
	assert.deepEqual(parsePhpWasmCallbackEntryTrace("", selected), []);
	assert.throws(() => parsePhpWasmCallbackEntryTrace(
		"LB_CALLBACK_ENTRY_V1 enter callback Probe.callback\n", selected
	), /outside a public call/u);
	assert.throws(() => parsePhpWasmCallbackEntryTrace(
		"LB_CALLBACK_ENTRY_V1 begin public Probe.call\n", selected
	), /missing callback public end/u);
});
