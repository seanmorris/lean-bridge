/**
 * Unit controls for reversible C markers and strict PHP-Wasm entry transcripts.
 * Synthetic traces test the observer; they are not installed-package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { instrumentSubtypeCEntries, restoreSubtypeCEntries, validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";
import { parseSubtypeEntryTrace } from "./php-wasm-subtype-entry-trace.mjs";
import "./php-wasm-subtype-entry-archive-tests.mjs";
import "./php-wasm-subtype-entry-history-tests.mjs";
import "./php-wasm-entry-harness-history-tests.mjs";
import "./php-wasm-subtype-entry-installed-tests.mjs";

const selected = [
	{ symbol: "public_half", kind: "public", label: "half" }
	, { symbol: "checked_even", kind: "constructor", label: "Subtypes.checkedEven" }
	, { symbol: "half_validator", kind: "validator", label: "Subtypes.half:0" }
	, { symbol: "half_adapter", kind: "adapter", label: "Subtypes.half" }
	, { symbol: "half_source", kind: "source", label: "Subtypes.half" }
];
const original = `#define TEXT "int checked_even(int x) {"
/*
int checked_even(int x) { return 1; }
*/
const char *text = "int checked_even(int x) { return 1; }";
int checked_even(int);
int checked_even(int x) {
  return x % 2 == 0;
}
int public_half(
  int x
) {
  if (!checked_even(x)) return -1;
  return x / 2;
}
`;
const marker = (event, kind, label) => `LB_SUBTYPE_ENTRY_V1 ${event} ${kind} ${label}\n`;
const begin = marker("begin", "public", "half"), end = marker("end", "public", "half");
const entry = kind => marker("enter", kind, selected.find(item => item.kind === kind).label);
const rejected = begin + entry("validator") + entry("constructor") + end;
const accepted = begin + entry("validator") + entry("constructor") + entry("adapter") + entry("constructor") + entry("source") + end;

test("PHP-Wasm C entry markers preserve all original bytes and select definitions only", () => {
	const { source, receipt } = instrumentSubtypeCEntries(original, selected);
	assert.deepEqual(receipt.insertions.filter(item => item.kind !== "preamble").map(item => item.symbol).sort(), ["checked_even", "public_half"]);
	assert.equal(restoreSubtypeCEntries(source, receipt), original);
	assert.equal(source.match(/cleanup\(lb_probe_end\)/gu).length, 1);
	assert.ok(source.includes('static void lb_probe_end(const char **label)'));
	assert.doesNotMatch(source, /finstrument-functions|__cyg_profile|__builtin_return_address/u);
	assert.equal(source.split("  return x / 2;\n").length, 2);
	assert.equal(source.split("  if (!checked_even(x)) return -1;\n").length, 2);
	assert.deepEqual(instrumentSubtypeCEntries("int unrelated(void) { return 0; }\n", selected).receipt.insertions, []);
	// Offsets are UTF-16 indices, so masking a supplementary Unicode character must keep both units.
	const unicode = 'const char *unicode = "🙂"; /* α🙂 */\n' + original;
	const instrumented = instrumentSubtypeCEntries(unicode, selected);
	assert.equal(restoreSubtypeCEntries(instrumented.source, instrumented.receipt), unicode);
	assert.ok(instrumented.source.includes('int checked_even(int x) {\n  fputs('));
});

test("PHP-Wasm marker selection refuses duplicate symbols, labels and invalid C identities", () => {
	validateSubtypeEntrySelection(selected);
	for(const invalid of [[], [...selected, selected[0]], [{ ...selected[0], symbol: "f();" }], [{ ...selected[0], label: "bad\ntrace" }], [{ ...selected[0], kind: "guessed" }], [{ ...selected[0], extra: true }], [selected[0], { ...selected[0], symbol: "another" }]])
		assert.throws(() => validateSubtypeEntrySelection(invalid));
	assert.throws(() => instrumentSubtypeCEntries(original + "\nint public_half(int x) { return x; }\n", selected), /duplicate selected definition/u);
	assert.throws(() => instrumentSubtypeCEntries(instrumentSubtypeCEntries(original, selected).source, selected));
});

test("PHP-Wasm C marker restoration refuses corrupt bytes, offsets and digests", () => {
	const { source, receipt } = instrumentSubtypeCEntries(original, selected);
	assert.throws(() => restoreSubtypeCEntries(source + "\n", receipt));
	for(const mutate of [
		value => { value.originalSha256 = "0".repeat(64); }
		, value => { value.probeSha256 = "0".repeat(64); }
		, value => { value.insertions[0].offset--; }
		, value => { value.insertions[0].text += " "; }
		, value => { value.insertions.reverse(); }
		, value => { value.insertions.push(value.insertions[0]); }
		, value => { value.insertions = []; }
	]) {
		const changed = structuredClone(receipt); mutate(changed);
		assert.throws(() => restoreSubtypeCEntries(source, changed));
	}
});

test("PHP-Wasm trace parser distinguishes rejected construction from actual adapter and source entry", () => {
	const calls = parseSubtypeEntryTrace(rejected + accepted, selected);
	assert.equal(calls.length, 2);
	assert.deepEqual(calls[0].counts, { validator: 1, constructor: 1, adapter: 0, source: 0 });
	assert.deepEqual(calls[1].counts, { validator: 1, constructor: 2, adapter: 1, source: 1 });
	assert.deepEqual(calls[0].entries, ["validator", "constructor"].map(kind => ({ kind, label: selected.find(item => item.kind === kind).label })));
	assert.deepEqual(parseSubtypeEntryTrace("", selected), []);
	assert.deepEqual(parseSubtypeEntryTrace(begin + end, selected)[0].counts, { validator: 0, constructor: 0, adapter: 0, source: 0 });
	// A complete independently specified call sequence, not this parser alone, rejects missing instrumentation.
	assert.notDeepEqual(parseSubtypeEntryTrace("", selected), calls);
	assert.notDeepEqual(parseSubtypeEntryTrace(accepted.replace(entry("source"), ""), selected), [calls[1]]);
});

test("PHP-Wasm trace parser refuses incomplete brackets, unknown stderr and out-of-call entries", () => {
	for(const trace of [
		"warning\n" + accepted
		, accepted + "warning\n"
		, accepted + "\n"
		, accepted.slice(0, -1)
		, accepted.replace(end, "")
		, accepted.replace(begin, "")
		, begin + accepted + end
		, end
		, entry("constructor") + accepted
		, accepted + entry("source")
		, accepted + end
		, accepted.replace("end public half", "end public other")
		, accepted.replace("enter source", "begin source")
		, accepted.replace("enter source", "end source")
		, begin + marker("enter", "public", "half") + end
		, accepted.replace("Subtypes.checkedEven", "Subtypes.unknown")
		, "x".repeat(4 * 1024 * 1024 + 1)
	]) assert.throws(() => parseSubtypeEntryTrace(trace, selected));
	assert.throws(() => parseSubtypeEntryTrace(accepted, []));
	assert.throws(() => parseSubtypeEntryTrace(accepted, [...selected, selected[0]]));
	assert.throws(() => parseSubtypeEntryTrace(accepted, [{ kind: "unknown", label: "x" }]));
});
