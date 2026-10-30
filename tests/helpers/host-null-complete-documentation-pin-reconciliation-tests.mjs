/**
 * Require exact and complete HostNull documentation-pin reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	hostNullCompleteDocumentationPinCount
	, hostNullCompleteDocumentationPinTransitions
	, reconcileHostNullCompleteDocumentationPins
} from "./host-null-complete-documentation-pin-reconciliation.mjs";

const inventory = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const documentPromises = hostNullCompleteDocumentationPinTransitions.map(
	async item => [
		item.path, await readFile(item.path)
	]
);
const documentEntries = await Promise.all(documentPromises);
const documents = new Map(documentEntries);

test("HostNull publication reconciles exactly 70 generated-document pins", () => {
	const current = structuredClone(inventory);
	const stable = reconcileHostNullCompleteDocumentationPins(
		current, documents);
	assert.deepEqual(inventory, current);
	assert.equal(stable.refreshedPins, 0);
	const previous = structuredClone(inventory);
	for(const transition of hostNullCompleteDocumentationPinTransitions)
		for(const entry of previous.evidence)
			for(const file of entry.files)
				if(file.path === transition.path)
					file.sha256 = transition.previousSha256;
	const result = reconcileHostNullCompleteDocumentationPins(
		previous, documents);
	assert.equal(result.refreshedPins
		, hostNullCompleteDocumentationPinCount);
	assert.deepEqual(result.inventory.observations, inventory.observations);
	for(const transition of hostNullCompleteDocumentationPinTransitions)
	{
		const pins = result.inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === transition.path);
		assert.equal(pins.length, transition.pins);
		assert.ok(pins.every(file => file.sha256
			=== sha256(documents.get(transition.path))));
	}
	const reconciled = reconcileHostNullCompleteDocumentationPins(
		result.inventory, documents);
	assert.equal(reconciled.refreshedPins, 0);
});

test("HostNull documentation reconciliation rejects partial or forged pins", () => {
	const forged = structuredClone(inventory);
	forged.evidence.find(entry => entry.files.some(file =>
		file.path === hostNullCompleteDocumentationPinTransitions[0].path))
		.files.find(file => file.path
			=== hostNullCompleteDocumentationPinTransitions[0].path)
		.sha256 = "f".repeat(64);
	assert.throws(() => reconcileHostNullCompleteDocumentationPins(
		forged, documents));
	const missing = new Map(documents); missing.delete(
		hostNullCompleteDocumentationPinTransitions[0].path);
	assert.throws(() => reconcileHostNullCompleteDocumentationPins(
		inventory, missing));
});
