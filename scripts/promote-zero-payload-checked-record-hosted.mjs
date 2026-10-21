#!/usr/bin/env node
/**
 * Materialize the six independently verified hosted zero-payload lanes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	promoteZeroPayloadHosted, reconcileZeroPayloadHostedPromotionPins
	, zeroPayloadHostedPromotionIds, zeroPayloadHostedPromotionParent
	, zeroPayloadHostedPromotionReferences
} from "../tests/helpers/zero-payload-checked-record-hosted-promotion.mjs";

const path = "docs/type-surface.v1.json";
const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--from-parent")
	, "Only --from-parent is supported");
const original = JSON.parse(options.includes("--from-parent")
	? execFileSync("git", ["show", `${zeroPayloadHostedPromotionParent}:${path}`]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 })
	: await readFile(path, "utf8"));
assert.equal(zeroPayloadHostedPromotionParent
	, "e434aaffaeda338c7abbb13c439466a4f7fb4a17");
const alreadyPromoted = zeroPayloadHostedPromotionIds.every(id =>
	original.evidence.some(item => item.id === id));
await writeFile(path, JSON.stringify(alreadyPromoted
	? await reconcileZeroPayloadHostedPromotionPins(original)
	: await promoteZeroPayloadHosted(original
		, await zeroPayloadHostedPromotionReferences()), null, 2) + "\n");
