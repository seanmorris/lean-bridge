#!/usr/bin/env node
/**
 * Materialize hosted PHP-Wasm value-index promotion at its exact parent.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	checkedRecordValueIndexPhpWasmPromotionBaseline
	, checkedRecordValueIndexPhpWasmPromotionParent
	, checkedRecordValueIndexPhpWasmPromotionReferences
	, promoteCheckedRecordValueIndexPhpWasm
} from "../tests/helpers/checked-record-value-index-php-wasm-promotion.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexPhpWasmPromotionParent
	, "Hosted PHP-Wasm value-index promotion is draft-only at its exact parent");

const path = "docs/type-surface.v1.json";
const baseline = checkedRecordValueIndexPhpWasmPromotionBaseline();
const promoted = await promoteCheckedRecordValueIndexPhpWasm(
	baseline, await checkedRecordValueIndexPhpWasmPromotionReferences()
);
const current = JSON.parse(await readFile(path, "utf8"));
const stable = inventory => {
	const value = structuredClone(inventory);
	for(const entry of value.evidence) for(const file of entry.files)
		file.sha256 = "source-pin";
	return value;
};
assert.ok(
	JSON.stringify(stable(current)) === JSON.stringify(stable(baseline))
	|| JSON.stringify(stable(current)) === JSON.stringify(stable(promoted))
	, "Never overwrite unrelated type-surface changes"
);
await writeFile(path, JSON.stringify(promoted, null, 2) + "\n");
process.stdout.write(
	"Promoted four hosted PHP-Wasm value-index routes into four exact cells.\n"
);
