/**
 * Check route features and distinguish absent APIs from unrelated Rust failures.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nominalPrimitiveSubtypeRustCargoArguments, nominalPrimitiveSubtypeRustApiProbe, checkNominalPrimitiveSubtypeRustApiProbe } from "./nominal-primitive-subtype-rust-install.mjs";

const inputs = ["echo_a", "echo_b", "refuse_unit", "combine", "echo_pair", "echo_event_a", "echo_event_b", "aliases"];

test("primitive-base Rust Cargo features select each route and API independently", () => {
	const common = ["--locked", "--offline", "--target", "x86_64-unknown-linux-gnu"];
	const cases = [["ordinary", "full", []]
		, ["reviewed", "full", ["--features", "reviewed"]]
		, ["ordinary", "result-only", ["--features", "result-only"]]
		, ["reviewed", "result-only", ["--features", "result-only,reviewed"]]];
	for(const [route, mode, features] of cases)
	{
		assert.deepEqual(nominalPrimitiveSubtypeRustCargoArguments(mode, route), [...common, ...features]);
		const changed = nominalPrimitiveSubtypeRustCargoArguments(mode, route); changed.push("--online");
		assert.deepEqual(nominalPrimitiveSubtypeRustCargoArguments(mode, route), [...common, ...features]);
	}
	for(const bad of [undefined, null, "", "unknown", "full,reviewed"])
	{
		assert.throws(() => nominalPrimitiveSubtypeRustCargoArguments(bad, "ordinary"));
		assert.throws(() => nominalPrimitiveSubtypeRustCargoArguments("full", bad));
	}
	assert.equal(nominalPrimitiveSubtypeRustApiProbe, `#[allow(unused_imports)]\nuse nominalprimitivesubtypes::{${inputs.join(", ")}};\nfn main() {}\n`);
});

test("primitive-base Rust API probe accepts only the selected eight missing input functions", () => {
	const finished = success => ({ reason: "build-finished", success });
	const encode = (messages, code) => ({ code, stdout: messages.map(message => JSON.stringify(message)).join("\n") + "\n", stderr: "" });
	assert.deepEqual(checkNominalPrimitiveSubtypeRustApiProbe(encode([finished(true)], 0), "full"), { present: inputs, absent: [] });
	const error = { reason: "compiler-message"
		, message: { level: "error"
			, code: { code: "E0432" }
			, message: inputs.map(name => "`nominalprimitivesubtypes::" + name + "`").join(", ")
			, spans: [{ is_primary: true, file_name: "src/bin/api-probe.rs" }] } };
	assert.deepEqual(checkNominalPrimitiveSubtypeRustApiProbe(encode([error, finished(false)], 101), "result-only"), { present: [], absent: inputs });
	for(const change of [
		messages => { messages[1].success = true; }
		, messages => { messages[0].message.code.code = "E0308"; }
		, messages => { messages[0].message.spans = []; }
		, messages => { messages[0].message.spans[0].file_name = "src/main.rs"; }
		, messages => { messages[0].message.spans[0].is_primary = false; }
		, messages => { messages[0].message.message = messages[0].message.message.replace("echo_a", "echo_unknown"); }
		, messages => { messages[0].message.message += ", `nominalprimitivesubtypes::echo_a`"; }
		, messages => { messages.push(structuredClone(messages[0])); }
		, messages => { messages.push(finished(false)); }
	]) {
		const messages = structuredClone([error, finished(false)]); change(messages);
		assert.throws(() => checkNominalPrimitiveSubtypeRustApiProbe(encode(messages, 101), "result-only"));
	}
	for(const code of [0, 1, null])
		assert.throws(() => checkNominalPrimitiveSubtypeRustApiProbe(encode([error, finished(false)], code), "result-only"));
	assert.throws(() => checkNominalPrimitiveSubtypeRustApiProbe(encode([error, finished(true)], 0), "full"));
	assert.throws(() => checkNominalPrimitiveSubtypeRustApiProbe(encode([finished(true)], 1), "full"));
	assert.throws(() => checkNominalPrimitiveSubtypeRustApiProbe(encode([finished(true)], 0), "unknown"));
});
