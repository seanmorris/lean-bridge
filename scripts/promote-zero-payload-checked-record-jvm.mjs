#!/usr/bin/env node
/**
 * Materialize the hosted Java/Kotlin zero-payload checked-record promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	promoteZeroPayloadJvm, reconcileZeroPayloadJvmPromotionPins
	, zeroPayloadJvmPromotionIds, zeroPayloadJvmPromotionParent
	, zeroPayloadJvmPromotionReferences
} from "../tests/helpers/zero-payload-checked-record-jvm-promotion.mjs";

const path = "docs/type-surface.v1.json";
const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--from-parent")
	, "Only --from-parent is supported");
const original = JSON.parse(options.includes("--from-parent")
	? execFileSync("git", ["show", `${zeroPayloadJvmPromotionParent}:${path}`]
		, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
	: await readFile(path, "utf8"));
assert.equal(zeroPayloadJvmPromotionParent
	, "c34c5fefbc93c5d7ad9a2dbdce9094cc2c64417f");
const alreadyPromoted = zeroPayloadJvmPromotionIds.every(id =>
	original.evidence.some(item => item.id === id));
await writeFile(path, JSON.stringify(alreadyPromoted
	? await reconcileZeroPayloadJvmPromotionPins(original)
	: await promoteZeroPayloadJvm(original
		, await zeroPayloadJvmPromotionReferences()), null, 2) + "\n");
