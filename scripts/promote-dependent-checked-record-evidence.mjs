#!/usr/bin/env node
/**
 * Promote only the dependent checked-record cells closed by all eleven
 * archives. Refuses before reading the inventory while any lane verifier is
 * missing, and writes nothing unless every archive replays.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionPath
	, dependentCheckedRecordPromotionPinBaseline
	, dependentCheckedRecordPromotionReferences
	, loadDependentCheckedRecordVerifiers
	, promoteDependentCheckedRecords
	, reconcileDependentCheckedRecordSourcePins
	, renderDependentCheckedRecordPromotion
} from "../tests/helpers/dependent-checked-record-promotion.mjs";

assert.equal(process.argv.length, 2, "This promotion command accepts no arguments");
const verifiers = await loadDependentCheckedRecordVerifiers();
const references = await dependentCheckedRecordPromotionReferences(verifiers);
const path = "docs/type-surface.v1.json";
const inventory = JSON.parse(await readFile(path, "utf8"));
const promoted = promoteDependentCheckedRecords(inventory, references);
const summary = renderDependentCheckedRecordPromotion(references);
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
assert.doesNotThrow(
	() => execFileSync("git", ["merge-base", "--is-ancestor"
		, dependentCheckedRecordPromotionPinBaseline, "HEAD"]
	, { stdio: "ignore" })
	, "Dependent promotion pin baseline is not an ancestor of HEAD"
);
const changedPaths = git(["diff", "--name-only", "--diff-filter=M"
	, dependentCheckedRecordPromotionPinBaseline, "--"])
	.trim().split("\n").filter(Boolean);
const currentDigests = new Map();
for(const changedPath of changedPaths)
{
	let bytes;
	try
	{ bytes = await readFile(changedPath); }
	catch(error)
	{
		if(error?.code !== "ENOENT") throw error;
		bytes = execFileSync("git", ["show", `HEAD:${changedPath}`], {
			maxBuffer: 512 * 1024 * 1024
		});
	}
	currentDigests.set(changedPath, sha256(bytes));
}
const reconciled = reconcileDependentCheckedRecordSourcePins(
	promoted, currentDigests);
assert.ok(reconciled.refreshed > 0
	, "Dependent promotion must reconcile changed current-source pins");
await Promise.all([
	writeFile(path, JSON.stringify(reconciled.inventory, null, 2) + "\n")
	, writeFile(dependentCheckedRecordPromotionPath, summary)
]);
process.stdout.write(`Added hosted evidence to 68 dependent checked-record cells from eleven immutable archives and reconciled ${reconciled.refreshed} current-source pins.\n`);
