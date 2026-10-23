#!/usr/bin/env node
/**
 * Promote the independently replayed PHP-Wasm callback-refinement archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import { validateTypeSurface } from "../src/adoption/type-surface.mjs";
import { generateReferenceDocs } from "./generate-reference-docs.mjs";
import {
	callbackRefinementsPhpWasmPromotionParent
	, callbackRefinementsPhpWasmPromotionPath
	, callbackRefinementsPhpWasmPromotionReference
	, callbackRefinementsPhpWasmInventoryEvidence
	, promoteCallbackRefinementsPhpWasm
	, renderCallbackRefinementsPhpWasmPromotion
} from "../tests/helpers/callback-refinements-php-wasm-promotion.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackRefinementsPhpWasmPromotionParent
	, "PHP-Wasm callback refinement promotion is draft-only at its exact parent");

const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = Object.freeze([
	"docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-callback-refinements-php-wasm-evidence.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/callback-refinements-php-wasm.test.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion.mjs"
	, "tests/helpers/php-wasm-refinement-readme-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-tests.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
const allowed = new Set([
	...sourcePaths, inventoryPath, callbackRefinementsPhpWasmPromotionPath
]);
const status = git(["status", "--porcelain=v1", "-z"])
	.split("\0").filter(Boolean).map(line => line.slice(3));
assert.ok(status.length > 0, "Promotion requires its reviewed draft sources");
for(const path of status)
	assert.ok(allowed.has(path), `Unrelated promotion worktree path: ${path}`);
for(const path of [inventoryPath, callbackRefinementsPhpWasmPromotionPath])
	assert.equal(git(["ls-tree", "--name-only", "HEAD", "--", path]).trim()
		, path === inventoryPath ? path : ""
		, `Unexpected committed promotion output: ${path}`);

const [inventory, irSchema, consumers, reference] = await Promise.all([
	readFile(inventoryPath, "utf8").then(JSON.parse)
	, readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
	, callbackRefinementsPhpWasmPromotionReference()
]);
const live = new Map(await Promise.all(sourcePaths.map(async path => [
	path, sha256(await readFile(path))
])));
let refreshed = 0;
for(const evidence of inventory.evidence)
	for(const file of evidence.files)
		if(live.has(file.path) && file.sha256 !== live.get(file.path))
		{
			file.sha256 = live.get(file.path);
			refreshed++;
		}
assert.ok(refreshed > 0, "Promotion must refresh its changed current-source pins");
const existing = inventory.evidence.filter(item => item.id === reference.id);
assert.ok(existing.length <= 1, `Duplicate evidence: ${reference.id}`);
let promoted;
if(existing.length)
{
	assert.deepEqual(existing[0]
		, callbackRefinementsPhpWasmInventoryEvidence(reference));
	promoted = inventory;
}
else promoted = promoteCallbackRefinementsPhpWasm(inventory, reference);
assert.equal(validateTypeSurface(promoted, { irSchema, consumers }), true);
await writeFile(callbackRefinementsPhpWasmPromotionPath
	, renderCallbackRefinementsPhpWasmPromotion(reference));
await writeFile(inventoryPath, JSON.stringify(promoted, null, 2) + "\n");
await generateReferenceDocs({
	write: true, inventory: { document: promoted, irSchema, consumers }
});
const generated = JSON.parse(await readFile(inventoryPath, "utf8"));
const finalPins = new Map(await Promise.all(sourcePaths.map(async path => [
	path, sha256(await readFile(path))
])));
let generatedPins = 0;
for(const evidence of generated.evidence)
	for(const file of evidence.files)
		if(finalPins.has(file.path) && file.sha256 !== finalPins.get(file.path))
		{
			file.sha256 = finalPins.get(file.path);
			generatedPins++;
		}
if(!existing.length) assert.ok(generatedPins > 0
	, "Generated PHP/reference documentation must refresh source pins");
assert.equal(validateTypeSurface(generated, { irSchema, consumers }), true);
await writeFile(inventoryPath, JSON.stringify(generated, null, 2) + "\n");
process.stdout.write(JSON.stringify({
	evidence: reference.id, hostedRun: reference.hostedRun
	, promotedCells: 8, splitResourceCells: 4
	, refreshedSourcePins: refreshed + generatedPins
}) + "\n");
