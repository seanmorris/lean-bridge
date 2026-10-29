/**
 * Prove the optional-parameter promotion-reader pin repair is exact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	typeSurfaceEvidenceFiles
} from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	optionalParameterPromotionIoPath
	, optionalParameterPromotionIoRepairPredecessor
	, repairOptionalParameterPromotionIoPins
} from "./optional-parameter-promotion-io-pin-repair.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("optional promotion reader repair changes exactly 33 live pins", async () => {
	const before = JSON.parse(git(["show"
		, `${optionalParameterPromotionIoRepairPredecessor}:docs/type-surface.v1.json`]));
	const after = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	const sourceSha256 = sha256(await readFile(optionalParameterPromotionIoPath));
	assert.deepEqual(after
		, repairOptionalParameterPromotionIoPins(before, sourceSha256));
	assert.deepEqual(after.observations, before.observations);
	assert.deepEqual(after.evidence.map(item => item.id)
		, before.evidence.map(item => item.id));
	assert.deepEqual(Object.keys(after), Object.keys(before));
	assert.doesNotThrow(() => typeSurfaceEvidenceFiles(after));
});
