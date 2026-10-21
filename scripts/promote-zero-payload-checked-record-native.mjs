#!/usr/bin/env node
/**
 * Materialize the hosted C/C++ zero-payload checked-record promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	promoteZeroPayloadNative, reconcileZeroPayloadNativePromotionPins
	, zeroPayloadNativePromotionIds, zeroPayloadNativePromotionParent
	, zeroPayloadNativePromotionReferences
} from "../tests/helpers/zero-payload-checked-record-native-promotion.mjs";

const path = "docs/type-surface.v1.json";
const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--from-parent")
	, "Only --from-parent is supported");
const original = JSON.parse(options.includes("--from-parent")
	? execFileSync("git", ["show", `${zeroPayloadNativePromotionParent}:${path}`]
		, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
	: await readFile(path, "utf8"));
assert.equal(zeroPayloadNativePromotionParent
	, "54e040d40391ddb8e23b9764c1a75765abb0f458");
const alreadyPromoted = zeroPayloadNativePromotionIds.every(id =>
	original.evidence.some(item => item.id === id));
await writeFile(path, JSON.stringify(alreadyPromoted
	? await reconcileZeroPayloadNativePromotionPins(original)
	: await promoteZeroPayloadNative(original
		, await zeroPayloadNativePromotionReferences()), null, 2) + "\n");
