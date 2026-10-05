/**
 * Installed and wire-level Unicode scalar regression checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { charPoints, charReviewedIr, charSignatures, invalidCharPoints } from "./helpers/char-fixture.mjs";
import { checkInstalledScalars } from "./helpers/component-scalar-install.mjs";
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");

test("real wasm32 scalar validation rejects surrogate, oversized and noncanonical Char slots", async () => {
	const { default: createMain } = await import(pathToFileURL(join(runtimeRoot, "main.mjs")));
	const module = await createMain({ locateFile: path => join(runtimeRoot, path) });
	assert.equal(module._bridge_lean_runtime_init(), 1);
	const slot = module._malloc(16);
	try
	{
		const validate = (point, flags = 0, kind = 16) => {
			const view = new DataView(module.HEAP8.buffer);
			view.setUint32(slot, kind, true); view.setUint32(slot + 4, flags, true); view.setBigUint64(slot + 8, point, true);
			return module._bridge_scalar_slot_validate(slot, 16);
		};
		for(const point of charPoints) assert.equal(validate(BigInt(point)), 0);
		for(const point of invalidCharPoints) assert.equal(validate(point), 3);
		for(let point = 0; point <= 0x110000; point++)
			assert.equal(validate(BigInt(point)), point < 0xd800 || (point > 0xdfff && point < 0x110000) ? 0 : 3);
		for(const flags of [1, 2, 0xffffffff]) assert.equal(validate(65n, flags), 3);
		assert.equal(validate(65n, 0, 4), 3);
	} finally
{ module._free(slot); }
});

test("installed ordinary and reviewed Char APIs preserve Unicode in Node, strict TypeScript and browsers", { timeout: 600_000 }, async t => checkInstalledScalars(t, {
	name: "onboarding-characters", module: "Characters", sourceDir: "characters"
	, consumer: "characters/consumer.mjs"
	, signatures: charSignatures, reviewedIr: charReviewedIr
	, check: "checkCharacters", reportDir: "char-npm"
	, assertResult: result => { assert.deepEqual(result.values, charPoints); assert.equal(result.checks, 1126); }
	, typescript: `import * as api from "onboarding-characters";
const echo: (value: string) => string = api.echo;
const point: (value: string) => number = api.codePoint;
const text: (value: string) => string = api.text;
const sprout: () => string = api.sprout;
const choose: (condition: boolean, left: string, right: string) => string = api.choose;
// @ts-expect-error Char does not accept a numeric code point.
const bad: (value: number) => string = api.echo;
if (echo("🌱") !== "🌱" || point("🌱") !== 0x1f331 || text("\\0") !== "\\0" || sprout() !== "🌱" || choose(false, "a", "🌱") !== "🌱") throw new Error("TypeScript Char result mismatch");
`
}));
