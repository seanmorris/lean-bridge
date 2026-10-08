/**
 * Keep all native host-reply acceptance gates executable and their evidence retained.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nativeCiCommands, nativeCiRecordScript, nativeCiSteps } from "./native-ci-isolation.mjs";

const command = "LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST=1 LEAN_BRIDGE_FIN_CALLBACK_PROFILES=c,cpp LEAN_BRIDGE_NATIVE_FIN_REPLY_TEST=1 LEAN_BRIDGE_FIN_REPLY_PROFILES=c,cpp node --test --test-reporter=tap --test-concurrency=1 tests/native-fin-callbacks.test.mjs";
const fresh = [
	"fresh Lean admits every safe direction and compiles the generated adapter"
	, "fresh Lean refuses a host callback's result without a Fin-free failure value and admits one with it"
	, "fresh Lean admits every checked host reply family and compiles each typed reconstruction"
];
const transcript = "build/native-fin-replies/acceptance.tap";
const assertions = fresh.map(name => `          rg "^ok [0-9]+ - ${name}$" ${transcript}\n`);
const reports = ["build/native-fin-callbacks/c-cpp.json", "build/native-fin-replies/c-bypass.json", "build/native-fin-replies/installed-c-cpp.json"];

/**
 * Check the live C-family shard, not a rewound historical workflow.
 *
 * @param workflow - Complete current workflow source.
 */
const validate = workflow => {
	const steps = nativeCiSteps(workflow);
	const gate = steps.find(step => step.id === "type_corpus_c_family");
	assert.equal(gate.condition, "matrix.profile == 'c-family'");
	const commands = nativeCiCommands(gate);
	assert.ok(commands.includes(`          ${command} | tee ${transcript}\n`));
	assert.ok(commands.indexOf("          mkdir -p build/native-fin-replies\n") >= 0);
	assert.ok(commands.indexOf("          set -o pipefail\n") >= 0);
	assert.ok(commands.indexOf("          set -o pipefail\n") < commands.indexOf(command));
	for(const assertion of assertions) assert.ok(commands.includes(assertion));
	for(const report of reports) assert.ok(commands.includes(`          test -s ${report}\n`));
	const upload = steps.find(step => step.name === "Upload installed C and C++ corpus observations");
	assert.equal(upload.condition, "always() && matrix.profile == 'c-family'");
	assert.match(upload.text, /^ {12}build\/native-fin-replies\/\n/mu);
	assert.match(upload.text, /^ {10}if-no-files-found: error$/mu);
	assert.ok(nativeCiRecordScript(workflow, "c-family").includes(command));
};

test("C-family CI runs fresh Lean, checked/stripped wrappers and installed reply packages, preserving reports", async () => {
	validate(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("native Fin reply CI rejects skipped producers, missing reports and lost failure artifacts", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const mutations = [
		...["LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST=1 ", "LEAN_BRIDGE_FIN_CALLBACK_PROFILES=c,cpp ", "LEAN_BRIDGE_NATIVE_FIN_REPLY_TEST=1 ", "LEAN_BRIDGE_FIN_REPLY_PROFILES=c,cpp ", "--test-reporter=tap ", "--test-concurrency=1 "].map(text => [command, command.replace(text, "")])
		, ...assertions.map(line => [line, ""])
		, [`          set -o pipefail\n          ${command}`, `          ${command}`]
		, [` | tee ${transcript}\n`, "\n"]
		, ...reports.map(report => [`          test -s ${report}\n`, ""])
		, ["            build/native-fin-replies/\n", ""]
		, [`              consumer_command="$consumer_command && ${command}"\n`, ""]
	];
	for(const [before, after] of mutations)
	{
		const changed = workflow.replace(before, after);
		assert.notEqual(changed, workflow, before);
		assert.throws(() => validate(changed), undefined, before);
	}
});

test("fresh-Lean CI transcript assertions reject skipped, absent and failing compiler tests", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const checks = assertions.map(line => {
		assert.ok(workflow.includes(line));
		return new RegExp(line.match(/rg "(.+)"/u)[1], "mu");
	});
	const tap = fresh.map((name, index) => `ok ${index + 1} - ${name}`).join("\n");
	assert.ok(checks.every(check => check.test(tap)));
	for(const [index, name] of fresh.entries())
		for(const changed of [
			tap.replace(`ok ${index + 1} - ${name}`, `ok ${index + 1} - ${name} # SKIP`)
			, tap.replace(`ok ${index + 1} - ${name}`, "")
			, tap.replace(`ok ${index + 1} - ${name}`, `not ok ${index + 1} - ${name}`)
		]) assert.ok(!checks.every(check => check.test(changed)));
});
