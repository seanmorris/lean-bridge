/**
 * Check route features and distinguish absent APIs from unrelated Rust failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inheritedCheckedRecordRustCargoArguments, inheritedCheckedRecordRustApiProbe, checkInheritedCheckedRecordRustApiProbe, waitInheritedCheckedRecordRustResources } from "./inherited-checked-record-rust-install.mjs";

const inputs = [
	"first", "normalized", "pair", "aliased", "nested", "echo"
];

test("inherited checked-record Rust Cargo features select each route and API independently", () => {
	const common = ["--locked", "--offline", "--target", "x86_64-unknown-linux-gnu"];
	const cases = [["ordinary", "full", []]
		, ["reviewed", "full", ["--features", "reviewed"]]
		, ["ordinary", "result-only", ["--features", "result-only"]]
		, ["reviewed", "result-only", ["--features", "result-only,reviewed"]]];
	for(const [route, mode, features] of cases)
	{
		assert.deepEqual(inheritedCheckedRecordRustCargoArguments(mode, route), [...common, ...features]);
		const changed = inheritedCheckedRecordRustCargoArguments(mode, route); changed.push("--online");
		assert.deepEqual(inheritedCheckedRecordRustCargoArguments(mode, route), [...common, ...features]);
	}
	for(const bad of [undefined, null, "", "unknown", "full,reviewed"])
	{
		assert.throws(() => inheritedCheckedRecordRustCargoArguments(bad, "ordinary"));
		assert.throws(() => inheritedCheckedRecordRustCargoArguments("full", bad));
	}
	assert.equal(inheritedCheckedRecordRustApiProbe, `#[allow(unused_imports)]\nuse inheritedcheckedrecords::{${inputs.join(", ")}};\nfn main() {}\n`);
});

test("inherited checked-record Rust offline installation preserves the producer load ceiling", async () => {
	const calls = [], notify = () => {}, expected = { observations: [], waits: 0 };
	const wait = async (root, options) => { calls.push({ root, options }); return expected; };
	assert.equal(await waitInheritedCheckedRecordRustResources("records", 8, { wait, notify }), expected);
	assert.deepEqual(calls, [{ root: "records", options: { maxLoad: 8, notify } }]);
	for(const maxLoad of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])
		assert.throws(() => waitInheritedCheckedRecordRustResources("records", maxLoad, { wait, notify }), /positive finite host-load ceiling/u);
});

test("inherited checked-record Rust API probe accepts only the selected six missing input functions", () => {
	const finished = success => ({ reason: "build-finished", success });
	const encode = (messages, code) => ({ code, stdout: messages.map(message => JSON.stringify(message)).join("\n") + "\n", stderr: "" });
	assert.deepEqual(checkInheritedCheckedRecordRustApiProbe(encode([finished(true)], 0), "full"), { present: inputs, absent: [] });
	const error = { reason: "compiler-message"
		, message: { level: "error"
			, code: { code: "E0432" }
			, message: inputs.map(name => "`inheritedcheckedrecords::" + name + "`").join(", ")
			, spans: [{ is_primary: true, file_name: "src/bin/api-probe.rs" }] } };
	assert.deepEqual(checkInheritedCheckedRecordRustApiProbe(encode([error, finished(false)], 101), "result-only"), { present: [], absent: inputs });
	for(const change of [
		messages => { messages[1].success = true; }
		, messages => { messages[0].message.code.code = "E0308"; }
		, messages => { messages[0].message.spans = []; }
		, messages => { messages[0].message.spans[0].file_name = "src/main.rs"; }
		, messages => { messages[0].message.spans[0].is_primary = false; }
		, messages => { messages[0].message.message = messages[0].message.message.replace("nested", "in_unknown"); }
		, messages => { messages[0].message.message += ", `inheritedcheckedrecords::first`"; }
		, messages => { messages.push(structuredClone(messages[0])); }
		, messages => { messages.push(finished(false)); }
	]) {
		const messages = structuredClone([error, finished(false)]); change(messages);
		assert.throws(() => checkInheritedCheckedRecordRustApiProbe(encode(messages, 101), "result-only"));
	}
	for(const code of [0, 1, null])
		assert.throws(() => checkInheritedCheckedRecordRustApiProbe(encode([error, finished(false)], code), "result-only"));
	assert.throws(() => checkInheritedCheckedRecordRustApiProbe(encode([error, finished(true)], 0), "full"));
	assert.throws(() => checkInheritedCheckedRecordRustApiProbe(encode([finished(true)], 1), "full"));
	assert.throws(() => checkInheritedCheckedRecordRustApiProbe(encode([finished(true)], 0), "unknown"));
});
