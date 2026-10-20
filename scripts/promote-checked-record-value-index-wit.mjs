#!/usr/bin/env node
/**
 * Materialize hosted WIT/WASI value-index promotion at its exact parent.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	checkedRecordValueIndexWitPromotionBaseline
	, checkedRecordValueIndexWitPromotionParent
	, checkedRecordValueIndexWitPromotionReferences
	, promoteCheckedRecordValueIndexWit
} from "../tests/helpers/checked-record-value-index-wit-promotion.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexWitPromotionParent
	, "Hosted WIT/WASI value-index promotion is draft-only at its exact parent");

const path = "docs/type-surface.v1.json";
const baseline = checkedRecordValueIndexWitPromotionBaseline();
const promoted = await promoteCheckedRecordValueIndexWit(
	baseline, await checkedRecordValueIndexWitPromotionReferences()
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
	"Promoted four hosted WIT/WASI value-index routes into four exact cells.\n"
);
