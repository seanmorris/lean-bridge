/**
 * Width-specific recursive graph transport, separate from PHP public adapters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedCGraphLayout } from "../src/backends/c/copied-graph-layout.mjs";
import { generateNativeCopiedGraphAdapters } from "../src/backends/c/native-graph-adapters.mjs";
import { recursiveReviewedIr } from "./helpers/recursive-fixture.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { phpLinkedGraphIr } from "./helpers/php-graph-values-fixture.mjs";
import { recursiveCarrierAbi } from "./helpers/recursive-carriers.mjs";
import { checkWasm32RecursiveTransport } from "./helpers/wasm32-recursive-transport.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertWasm32GraphEvidence } from "./helpers/wasm32-graph-receipt.mjs";

test("32-bit graph layouts keep nominal identities and fixed-width scalar storage", () => {
	const ir = recursiveReviewedIr(), before = structuredClone(ir), original = compileCopiedCGraphLayout(ir);
	const layout = compileCopiedCGraphLayout(ir, { wordBits: 32 }); assert.equal(layout.wordBits, 32);
	assert.deepEqual(ir, before); assert.deepEqual(layout.roots, original.roots); assert.deepEqual(layout.boxedGroups, original.boxedGroups);
	for(const node of layout.nodes)
	{
		const previous = original.nodes.find(item => item.id === node.id);
		if(["usize", "isize"].includes(node.ref.name)) assert.equal(node.name, node.ref.name === "usize" ? "uint32_t" : "int32_t");
		else assert.deepEqual(node, previous);
	}
	for(const wordBits of [16, 128, "32", null, NaN])
	{
		assert.throws(() => compileCopiedCGraphLayout(ir, { wordBits }), /machine-word width/);
		assert.throws(() => generateNativeCopiedGraphAdapters(ir, recursiveCarrierAbi(ir), { wordBits }), /machine-word width/);
	}
	const output = generateNativeCopiedGraphAdapters(ir, recursiveCarrierAbi(ir), { wordBits: 32 });
	assert.match(output.source, /sizeof\(size_t\) == 4 && sizeof\(void \*\) == 4/);
	assert.match(output.source, /__builtin_wasm_memory_size/);
	assert.match(output.source, /lean_object_byte_size\(child\)/);
	assert.doesNotMatch(output.source, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/);
});

test("the explicit wasm32 path preserves the original native generated artifacts", () => {
	const fixtures = [recursiveReviewedIr, nativeRecursiveReviewedIr, phpLinkedGraphIr];
	const expected = [
		["fe3fe6beca7a6b22a4b63457230a643ceae519a69be889ffb1036f94e9921bbf", "261b246936743091893815eb0dd8f5c71dab441c1343570d95ec8beec848ad3e"]
		, ["2940d421819c76a49d063282e65f9a287a42751e118af86991b8139c17b74dde", "894b194d91457747ea309b675698a75cec69109d1656f05a1869cbe9eae85b14"]
		, ["e85a5acd5d2465bf3ddd001879bedde5aa39dec4ec0d8dcf75c84172b5f0236d", "758a9138a0d8599e3ba5fa696b6d851dc1e9141f1e88c2090a22286d2eaed0d4"]
	];
	for(const [index, fixture] of fixtures.entries()) for(const [mode, options] of [{}, { initializer: "initialize_LeanBridgeNative0123456789abcdef" }].entries())
	{
		const ir = fixture(), abi = recursiveCarrierAbi(ir);
		const output = generateNativeCopiedGraphAdapters(ir, abi, options);
		assert.equal(sha256(canonicalJson(output)), expected[index][mode]);
		assert.deepEqual(generateNativeCopiedGraphAdapters(ir, abi, { ...options, wordBits: 64 }), output);
	}
});

test("fresh recursive Lean C executes all scalars and ownership faults in the PHP-Wasm heap", {
	skip: process.env.LEAN_BRIDGE_WASM32_RECURSIVE_TEST !== "1", timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-wasm32-recursive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const report = await checkWasm32RecursiveTransport(directory, message => t.diagnostic(message));
	await saveLakeFile("build/recursive", "wasm32-transport.json", canonicalJson(report));
	t.diagnostic(`${report.executions[0].checks} transport assertions, ${report.executions[0].boundaryChecks} wasm32 boundary assertions, repeated in two fresh interpreters`);
});

test("wasm32 graph evidence requires real execution without claiming installed packages", async () => {
	const record = JSON.parse(await readFile("docs/evidence/wasm32-recursive-transport-20260923.json", "utf8"));
	await assertWasm32GraphEvidence(record);
	for(const mutate of [
		report => { report.executions.pop(); }
		, report => { report.executions[0].wordBits = 64; }
		, report => { report.executions[0].boundaryChecks = 0; }
		, report => { report.executions[0].live = 1; }
		, report => { report.installedPackage = true; }
		, report => { report.layoutSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed.report);
		changed.reportSha256 = sha256(canonicalJson(changed.report));
		await assert.rejects(() => assertWasm32GraphEvidence(changed));
	}
	const reSigned = structuredClone(record);
	reSigned.preChangeSources[0].text += "\n// changed\n";
	reSigned.preChangeSources[0].sha256 = sha256(reSigned.preChangeSources[0].text);
	await assert.rejects(() => assertWasm32GraphEvidence(reSigned));
});
