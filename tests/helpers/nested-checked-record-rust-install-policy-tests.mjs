/**
 * Check route features and distinguish absent APIs from unrelated Rust failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nestedCheckedRecordRustCargoArguments, nestedCheckedRecordRustApiProbe, checkNestedCheckedRecordRustApiProbe, waitNestedCheckedRecordRustResources } from "./nested-checked-record-rust-install.mjs";

const inputs = [
	"first", "second", "pair", "in_array", "in_list", "in_option"
	, "in_product", "in_except", "in_holder", "in_choice", "echo_array"
];

test("nested checked-record Rust Cargo features select each route and API independently", () => {
	const common = ["--locked", "--offline", "--target", "x86_64-unknown-linux-gnu"];
	const cases = [["ordinary", "full", []]
		, ["reviewed", "full", ["--features", "reviewed"]]
		, ["ordinary", "result-only", ["--features", "result-only"]]
		, ["reviewed", "result-only", ["--features", "result-only,reviewed"]]];
	for(const [route, mode, features] of cases)
	{
		assert.deepEqual(nestedCheckedRecordRustCargoArguments(mode, route), [...common, ...features]);
		const changed = nestedCheckedRecordRustCargoArguments(mode, route); changed.push("--online");
		assert.deepEqual(nestedCheckedRecordRustCargoArguments(mode, route), [...common, ...features]);
	}
	for(const bad of [undefined, null, "", "unknown", "full,reviewed"])
	{
		assert.throws(() => nestedCheckedRecordRustCargoArguments(bad, "ordinary"));
		assert.throws(() => nestedCheckedRecordRustCargoArguments("full", bad));
	}
	assert.equal(nestedCheckedRecordRustApiProbe, `#[allow(unused_imports)]\nuse nestedcheckedrecords::{${inputs.join(", ")}};\nfn main() {}\n`);
});

test("nested checked-record Rust offline installation preserves the producer load ceiling", async () => {
	const calls = [], notify = () => {}, expected = { observations: [], waits: 0 };
	const wait = async (root, options) => { calls.push({ root, options }); return expected; };
	assert.equal(await waitNestedCheckedRecordRustResources("records", 8, { wait, notify }), expected);
	assert.deepEqual(calls, [{ root: "records", options: { maxLoad: 8, notify } }]);
	for(const maxLoad of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])
		assert.throws(() => waitNestedCheckedRecordRustResources("records", maxLoad, { wait, notify }), /positive finite host-load ceiling/u);
});

test("nested checked-record Rust API probe accepts only the selected eleven missing input functions", () => {
	const finished = success => ({ reason: "build-finished", success });
	const encode = (messages, code) => ({ code, stdout: messages.map(message => JSON.stringify(message)).join("\n") + "\n", stderr: "" });
	assert.deepEqual(checkNestedCheckedRecordRustApiProbe(encode([finished(true)], 0), "full"), { present: inputs, absent: [] });
	const error = { reason: "compiler-message"
		, message: { level: "error"
			, code: { code: "E0432" }
			, message: inputs.map(name => "`nestedcheckedrecords::" + name + "`").join(", ")
			, spans: [{ is_primary: true, file_name: "src/bin/api-probe.rs" }] } };
	assert.deepEqual(checkNestedCheckedRecordRustApiProbe(encode([error, finished(false)], 101), "result-only"), { present: [], absent: inputs });
	for(const change of [
		messages => { messages[1].success = true; }
		, messages => { messages[0].message.code.code = "E0308"; }
		, messages => { messages[0].message.spans = []; }
		, messages => { messages[0].message.spans[0].file_name = "src/main.rs"; }
		, messages => { messages[0].message.spans[0].is_primary = false; }
		, messages => { messages[0].message.message = messages[0].message.message.replace("in_holder", "in_unknown"); }
		, messages => { messages[0].message.message += ", `nestedcheckedrecords::first`"; }
		, messages => { messages.push(structuredClone(messages[0])); }
		, messages => { messages.push(finished(false)); }
	]) {
		const messages = structuredClone([error, finished(false)]); change(messages);
		assert.throws(() => checkNestedCheckedRecordRustApiProbe(encode(messages, 101), "result-only"));
	}
	for(const code of [0, 1, null])
		assert.throws(() => checkNestedCheckedRecordRustApiProbe(encode([error, finished(false)], code), "result-only"));
	assert.throws(() => checkNestedCheckedRecordRustApiProbe(encode([error, finished(true)], 0), "full"));
	assert.throws(() => checkNestedCheckedRecordRustApiProbe(encode([finished(true)], 1), "full"));
	assert.throws(() => checkNestedCheckedRecordRustApiProbe(encode([finished(true)], 0), "unknown"));
});
