#!/usr/bin/env node
/**
 * Materialize the hosted .NET zero-payload checked-record promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import {
	promoteZeroPayloadDotnet, reconcileZeroPayloadDotnetPromotionPins
	, zeroPayloadDotnetPromotionIds, zeroPayloadDotnetPromotionParent
	, zeroPayloadDotnetPromotionReferences
} from "../tests/helpers/zero-payload-checked-record-dotnet-promotion.mjs";

const path = "docs/type-surface.v1.json";
const options = process.argv.slice(2);
assert.ok(options.every(option => option === "--from-parent")
	, "Only --from-parent is supported");
const original = JSON.parse(options.includes("--from-parent")
	? execFileSync("git", ["show", `${zeroPayloadDotnetPromotionParent}:${path}`]
		, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
	: await readFile(path, "utf8"));
assert.equal(zeroPayloadDotnetPromotionParent
	, "0f71a0fd939172d767c96743ca59e203f075943c");
const alreadyPromoted = zeroPayloadDotnetPromotionIds.every(id =>
	original.evidence.some(item => item.id === id));
await writeFile(path, JSON.stringify(alreadyPromoted
	? await reconcileZeroPayloadDotnetPromotionPins(original)
	: await promoteZeroPayloadDotnet(original
		, await zeroPayloadDotnetPromotionReferences()), null, 2) + "\n");
