/**
 * Keep route labels, historical facts and the five-producer reproduction command precise.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { nativeFinReplyPromotionId } from "./native-fin-reply-promotion-references.mjs";
import { clarifyNativeReplyEvidence, clarifyNativeReplyObservation, nativeReplyReviewObservationIds, nativeReplyReviewValidator } from "./native-fin-reply-review-notes.mjs";
import { beforeNativeReplyReviewSource, nativeReplyReviewHistoryPath } from "./native-reply-review-source-history.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { sourceAtFinHistoryRecord, sourceBeforeFinHistoryRecord } from "./source-at-fin-history-milestone.mjs";

const typeSurfacePath = "docs/type-surface.v1.json";
const previous = async () => JSON.parse(await sourceBeforeFinHistoryRecord(
	nativeReplyReviewHistoryPath, typeSurfacePath, beforeNativeReplyReviewSource
));

test("reply review clarifies four existing observations without changing any accepted cell", async () => {
	const baseline = await previous();
	const history = JSON.parse(await readFile(nativeReplyReviewHistoryPath, "utf8"));
	const contracts = typeSurfaceContractsAtProducer(history.predecessorCommit);
	// Compare this historical clarification at its own epoch, before browser signature additions.
	const document = JSON.parse(await sourceAtFinHistoryRecord(
		nativeReplyReviewHistoryPath, typeSurfacePath, beforeNativeReplyReviewSource
	));
	assert.equal(document.observations.length, 490); assert.equal(document.evidence.length, 265);
	assert.deepEqual(document.observations, baseline.observations.map(item => nativeReplyReviewObservationIds.includes(item.id) ? clarifyNativeReplyObservation(item) : item));
	const oldCells = typeSurfaceCells(baseline, contracts), cells = typeSurfaceCells(document, contracts);
	assert.equal(cells.length, oldCells.length);
	for(const [index, cell] of cells.entries())
	{
		const old = oldCells[index];
		if(!nativeReplyReviewObservationIds.includes(cell.observation)) assert.deepEqual(cell, old);
		else
		{
			assert.deepEqual({ ...cell
				, hostType: old.hostType
				, conversionNote: old.conversionNote
				, limitations: old.limitations
				, stages: Object.fromEntries(Object.entries(cell.stages).map(([stage, value]) => [stage, { ...value, note: old.stages[stage].note }])) }, old);
			for(const [stage, value] of Object.entries(cell.stages)) assert.deepEqual({ ...value, note: old.stages[stage].note }, old.stages[stage]);
		}
	}
	const current = document.evidence.find(item => item.id === nativeFinReplyPromotionId);
	const earlier = baseline.evidence.find(item => item.id === nativeFinReplyPromotionId);
	assert.deepEqual(current, clarifyNativeReplyEvidence(earlier, sha256(await readFile(nativeReplyReviewValidator))));
});
