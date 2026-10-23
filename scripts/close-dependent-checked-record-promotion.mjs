#!/usr/bin/env node
/**
 * Close the documentation and current-source pins omitted by the dependent
 * checked-record promotion milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { generateReferenceDocs } from "./generate-reference-docs.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import {
	reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	auditTypeSurfaceArchivePins, reconcileTypeSurfaceArchivePins
} from "../tests/helpers/type-surface-archive-pins.mjs";

const implementationBase = "f9885da2a7949d938a50a8ed480f74f510c4eb1d";
const inventoryPath = "docs/type-surface.v1.json";
const pinnedSourcePaths = Object.freeze([
	"scripts/generate-type-docs.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/type-surface-docs.test.mjs"
]);

assert.equal(process.argv.length, 2, "This closure command accepts no arguments");
assert.equal(execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim(), implementationBase
, "Dependent promotion closure requires its exact promoted base");

const [document, irSchema, consumers] = await Promise.all([
	Promise.resolve(execFileSync("git", ["show"
		, `${implementationBase}:${inventoryPath}`], {
		encoding: "utf8", maxBuffer: 512 * 1024 * 1024
		}
	)).then(JSON.parse)
	, readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const archiveMismatches = await auditTypeSurfaceArchivePins(document);
const transitionCounts = new Map();
for(const item of archiveMismatches)
{
	assert.equal(item.expectedSha256.length, 1, item.path);
	const transition = `${item.expectedSha256[0]} -> ${item.actualSha256}`;
	transitionCounts.set(transition, (transitionCounts.get(transition) ?? 0) + 1);
}
assert.deepEqual(Object.fromEntries([...transitionCounts].sort()), {
	"451646e853124f4f7cc21ebc800b19abd088c76eaf9cafe12beb85f9b87080e8 -> ec3230c12ddafd091c609ef46660a8779a776f216aca7eeab8f65a42303c6c31": 36
	, "51536d691adaeaf385cc673ee673f48ee5e5d1e6be3737322d4bec4bdf6c37c1 -> 817cbd8df4fe8e79a23ad950e0f7dca1ba7d8f165d1111f9201487290e19f0e9": 10
	, "df096dd40d21d2cdea35c701e1eb225767328b80416f4b0c8720313473aa5e1d -> cb816bbac181df5080038a96c7a3ba7564f42179c527e5f0383be866ee3dfff6": 36
});
const archivePins = reconcileTypeSurfaceArchivePins(
	document, archiveMismatches);
assert.equal(archivePins.repairedPaths, 82);
const sourceDigests = new Map();
for(const path of pinnedSourcePaths)
	sourceDigests.set(path, sha256(await readFile(path)));
const sourcePins = reconcileDependentCheckedRecordSourcePins(
	archivePins.inventory, sourceDigests);
assert.equal(sourcePins.refreshed, 137
	, "Dependent promotion closure must refresh its exact source pins");
const documents = await generateReferenceDocs({
	root: process.cwd(), write: true
	, inventory: { document: sourcePins.inventory, irSchema, consumers }
});
const documentDigests = new Map();
for(const path of Object.keys(documents))
	documentDigests.set(path, sha256(await readFile(path)));
const documentPins = reconcileDependentCheckedRecordSourcePins(
	sourcePins.inventory, documentDigests);
assert.ok(documentPins.refreshed > 0
	, "Dependent promotion closure must refresh generated-document pins");
await writeFile(inventoryPath
	, JSON.stringify(documentPins.inventory, null, 2) + "\n");
process.stdout.write(`Closed dependent checked-record documentation with ${sourcePins.refreshed} source and ${documentPins.refreshed} generated-document pins.\n`);
