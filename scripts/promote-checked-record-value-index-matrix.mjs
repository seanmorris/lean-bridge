#!/usr/bin/env node
/** Materialize the remaining hosted value-index matrix at its exact parent. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	checkedRecordValueIndexMatrixPromotionBaseline
	, checkedRecordValueIndexMatrixPromotionParent
	, checkedRecordValueIndexMatrixPromotionReferences
	, promoteCheckedRecordValueIndexMatrix
} from "../tests/helpers/checked-record-value-index-matrix-promotion.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexMatrixPromotionParent
	, "Value-index matrix promotion is draft-only at its exact parent");
const path = "docs/type-surface.v1.json";
const baseline = checkedRecordValueIndexMatrixPromotionBaseline();
const promoted = await promoteCheckedRecordValueIndexMatrix(
	baseline, await checkedRecordValueIndexMatrixPromotionReferences());
const current = JSON.parse(await readFile(path, "utf8"));
const stable = inventory => {
	const value = structuredClone(inventory);
	for(const entry of value.evidence) for(const file of entry.files)
		file.sha256 = "source-pin";
	return value;
};
assert.ok(JSON.stringify(stable(current)) === JSON.stringify(stable(baseline))
	|| JSON.stringify(stable(current)) === JSON.stringify(stable(promoted))
	, "Never overwrite unrelated type-surface changes");
await writeFile(path, JSON.stringify(promoted, null, 2) + "\n");
process.stdout.write(
	"Promoted twelve hosted native/managed routes into twenty exact cells.\n");
