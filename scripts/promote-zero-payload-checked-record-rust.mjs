#!/usr/bin/env node
/**
 * Materialize the hosted Rust zero-payload checked-record promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	promoteZeroPayloadRust, reconcileZeroPayloadRustPromotionPins
	, zeroPayloadRustPromotionIds, zeroPayloadRustPromotionParent
	, zeroPayloadRustPromotionReferences
} from "../tests/helpers/zero-payload-checked-record-rust-promotion.mjs";

const path = "docs/type-surface.v1.json";
const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--from-parent")
	, "Only --from-parent is supported");
const original = JSON.parse(options.includes("--from-parent")
	? execFileSync("git", ["show", `${zeroPayloadRustPromotionParent}:${path}`]
		, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
	: await readFile(path, "utf8"));
assert.equal(zeroPayloadRustPromotionParent
	, "7e292652ee56efb8e201a52628385498ef2febf9");
const alreadyPromoted = zeroPayloadRustPromotionIds.every(id =>
	original.evidence.some(item => item.id === id));
await writeFile(path, JSON.stringify(alreadyPromoted
	? await reconcileZeroPayloadRustPromotionPins(original)
	: await promoteZeroPayloadRust(original
		, await zeroPayloadRustPromotionReferences()), null, 2) + "\n");
