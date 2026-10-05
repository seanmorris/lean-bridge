/**
 * Explicit 32-bit ownership transport and byte-identical existing native output.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedNativeValueLayout } from "../src/backends/native/owned-value-layout.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { ownedNativeValueRuntime } from "../src/backends/native/owned-value-runtime.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { checkOwnedWasm32Transport } from "./helpers/owned-wasm32-transport.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const inputs = async () => JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8")).inputs;

test("wasm32 owned layouts preserve nominal identities and reject ambiguous machine widths", async () => {
	const fixtures = await inputs();
	for(const input of Object.values(fixtures))
	{
		const original = generateOwnedNativeValueAdapters(input), before = structuredClone(input);
		const generated = generateOwnedNativeValueAdapters({ ...input, wordBits: 32 });
		assert.deepEqual(input, before); assert.equal(generated.layout.wordBits, 32);
		assert.deepEqual(generated.carriers, original.carriers);
		assert.deepEqual(generated.layout.model, original.layout.model);
		for(const node of generated.layout.nodes)
		{
			const previous = original.layout.nodes.find(item => item.id === node.id);
			if(node.kind === "primitive" && ["usize", "isize"].includes(node.name))
				assert.deepEqual(node, { ...previous, cName: node.name === "usize" ? "uint32_t" : "int32_t" });
			else assert.deepEqual(node, previous);
		}
		assert.match(generated.source, /sizeof\(void \*\) == 4 && sizeof\(size_t\) == 4/);
		assert.match(generated.source, /__builtin_wasm_memory_size/);
		assert.doesNotMatch(generated.source, /lean_ctor_(?:get|set)|lean_alloc_ctor/);
	}
	const ir = ownedAggregateReviewedIr();
	for(const wordBits of [16, 128, "32", null, NaN, true])
	{
		assert.throws(() => compileOwnedNativeValueLayout(ir, { wordBits }), /machine-word width/);
		assert.throws(() => generateOwnedNativeValueAdapters({ ...fixtures.scalars, wordBits }), /machine-word width/);
		assert.throws(() => ownedNativeValueRuntime({ depth: 128 }, wordBits), /machine-word width/);
	}
});

test("wasm32 selection preserves all existing 64-bit owned adapters byte for byte", async () => {
	const fixtures = await inputs();
	const expected = {
		aggregates: ["cfa22f95cef0f31a374566ec95a80e181e53ae679493b0b57d5526bbc2f4a292", "0c69375a6e86840d92f9879e46647a370e7373b1cde98c0b875fb6c271a12cea"]
		, scalars: ["d1f2157c86d92f7fa3e10881ef7b6f7118718b01c2bd9cc22a14349f972caa02", "859d4c009fbab6e889b28e41c631c2bc39f89719bccc595aa8c2aeb750c824af"]
	};
	for(const [name, input] of Object.entries(fixtures)) for(const hostCallbacks of [false, true])
	{
		const output = generateOwnedNativeValueAdapters({ ...input, hostCallbacks });
		assert.equal(sha256(canonicalJson(output)), expected[name][Number(hostCallbacks)]);
		assert.deepEqual(generateOwnedNativeValueAdapters({ ...input, hostCallbacks, wordBits: 64 }), output);
	}
});

for(const fixture of ["owned-scalars", "owned-aggregates"])
	test(`fresh ${fixture} executes ownership, scalar and failure checks inside PHP-Wasm`, {
		skip: process.env.LEAN_BRIDGE_OWNED_WASM32_TEST !== "1", timeout: 600000
	}, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-owned-wasm32-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const report = await checkOwnedWasm32Transport(directory, fixture, message => t.diagnostic(message));
		await saveLakeFile("build/owned-wasm32", `${fixture}.json`, canonicalJson(report));
		t.diagnostic(JSON.stringify(report.executions));
	});
