/**
 * Actual wasm32 word semantics, independent of the Node or browser host width.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { wordReviewedIr, wordScalarSignatures } from "./helpers/word-fixture.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";

test("wasm32 platform word slots reject overflow, wrong tags and noncanonical sign extension", async () => {
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
	const module = await createMain({ locateFile: path => join(runtimeRoot, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1);
	assert.equal(module._bridge_scalar_word_bits(), 32);
	const slot = module._malloc(16);
	try
	{
		const validate = (kind, bits, flags = 0) => {
			const view = new DataView(module.HEAP8.buffer);
			view.setUint32(slot, kind, true); view.setUint32(slot + 4, flags, true);
			view.setBigUint64(slot + 8, BigInt.asUintN(64, bits), true);
			return module._bridge_scalar_slot_validate(slot, kind);
		};
		for(const bits of [0n, 1n, 0x80000000n, 0xffffffffn]) assert.equal(validate(17, bits), 0);
		for(const bits of [-1n, 0x100000000n, 0x100000041n]) assert.equal(validate(17, bits), 3);
		for(const bits of [-0x80000000n, -1n, 0n, 0x7fffffffn]) assert.equal(validate(18, bits), 0);
		for(const bits of [-0x80000001n, 0x80000000n, 0xffffffffn, 0x100000000n]) assert.equal(validate(18, bits), 3);
		for(const kind of [17, 18]) for(const flags of [1, 2, 0xffffffff]) assert.equal(validate(kind, 1n, flags), 3);
		assert.equal(validate(19, 1n), 3);
	} finally
	{ module._free(slot); }
});

test("installed platform integers keep wasm32 ranges in Node, strict TypeScript and browser callers", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "words", module: "Words", sourceDir: "words"
	, consumer: "word-consumers/checks.mjs"
	, signatures: wordScalarSignatures, reviewedIr: wordReviewedIr
	, check: "checkWords", reportDir: "word-npm"
	, requiredRuntimeSymbol: "bridge_scalar_word_bits"
	, assertResult: result => { assert.equal(result.wordBits, 32); assert.equal(result.checks, 2217); }
	, typescript: `import * as api from "words";
const unsigned: (value: number) => number = api.keepUnsigned;
const signed: (value: number) => number = api.keepSigned;
// @ts-expect-error wasm32 words use number, not bigint.
const wrong: (value: bigint) => bigint = api.keepUnsigned;
if (unsigned(0xffffffff) !== 0xffffffff || signed(-0x80000000) !== -0x80000000 || api.wordBits() !== 32 || api.advanceSigned(0x7fffffff) !== -0x80000000) throw new Error("Platform integer TypeScript mismatch");
`
}));
