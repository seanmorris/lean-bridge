#!/usr/bin/env node
/**
 * Require complete retained evidence for one closed owned-Subtype lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkOwnedSubtypeHostedEvidence } from "../tests/helpers/owned-subtype-hosted-evidence.mjs";
import {
	assertOwnedSubtypePromotionIndex, ownedSubtypePromotionArchiveRoot
	, ownedSubtypePromotionLanes
} from "../tests/helpers/owned-subtype-promotion-catalog.mjs";

const usage = `Usage: check-owned-subtype-hosted-evidence.mjs --lane <${ownedSubtypePromotionLanes.map(item => item.lane).join("|")}>`;
const args = process.argv.slice(2);
let lane;
try
{
	assert.equal(args.length, 2, usage);
	assert.equal(args[0], "--lane", usage);
	lane = args[1];
	assert.ok(ownedSubtypePromotionLanes.some(item => item.lane === lane), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}
const root = ownedSubtypePromotionArchiveRoot(lane);
const index = await checkOwnedSubtypeHostedEvidence(lane, root);
assertOwnedSubtypePromotionIndex(lane, index);
process.stdout.write(canonicalJson({
	kind: "owned-subtype-promotion-replay", lane
	, producerCommit: index.producerCommit
	, run: index.hostedRun.runId, job: index.hostedRun.job.id
	, indexSha256: sha256(await readFile(`${root}/index.json`))
	, files: index.files.length + 1
}));
