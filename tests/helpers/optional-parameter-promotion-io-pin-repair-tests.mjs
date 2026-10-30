/**
 * Prove the optional-parameter promotion-reader pin repair is exact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
import {
	optionalParameterPromotionIoPinRepairImplementation
} from "./optional-parameter-promotion-io-pin-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("optional promotion reader repair changes exactly 33 milestone pins", () => {
	const before = JSON.parse(git(["show"
		, `${optionalParameterPromotionIoRepairPredecessor}:docs/type-surface.v1.json`]));
	const after = JSON.parse(git(["show"
		, `${optionalParameterPromotionIoPinRepairImplementation}:docs/type-surface.v1.json`]));
	const sourceSha256 = sha256(git(["show"
		, `${optionalParameterPromotionIoPinRepairImplementation}:${optionalParameterPromotionIoPath}`]));
	assert.deepEqual(after
		, repairOptionalParameterPromotionIoPins(before, sourceSha256));
	assert.deepEqual(after.observations, before.observations);
	assert.deepEqual(after.evidence.map(item => item.id)
		, before.evidence.map(item => item.id));
	assert.deepEqual(Object.keys(after), Object.keys(before));
	assert.doesNotThrow(() => typeSurfaceEvidenceFiles(after));
});
