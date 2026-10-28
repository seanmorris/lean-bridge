/**
 * Replay the immutable hosted reviewed Fin Wasm-entry archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkReviewedFinWasmEntryHostedEvidence
} from "./helpers/reviewed-fin-wasm-entry-hosted-evidence.mjs";

test("reviewed Fin Wasm-entry evidence replays both hosted legs"
	, async () => {
		const index = await checkReviewedFinWasmEntryHostedEvidence();
		assert.equal(index.producerCommit
			, "f12e40df7226d716573c4e86ba6f1e90ff3b797d");
		assert.equal(index.checkerCommit, index.producerCommit);
		assert.equal(index.archiveCommit
			, "7f7c4f6e39096ff1f0572d1c881b629309699f10");
		assert.deepEqual(index.legs.map(leg => ({
			mode: leg.mode
			, runId: leg.hostedRun.runId
			, runConclusion: leg.hostedRun.runConclusion
			, jobId: leg.hostedRun.job.id
			, artifactId: leg.hostedRun.artifact.id
			, accepted: leg.accepted
		})), [
			{
				mode: "original", runId: 40642520558
				, runConclusion: "success", jobId: 122663697044
				, artifactId: 12797590918
				, accepted: {
					"original-ordinary-scalar": 53
					, "original-ordinary-structural": 53
					, "original-reviewed-scalar": 53
					, "original-reviewed-structural": 53
				}
			}
			, {
				mode: "probe", runId: 40642520558
				, runConclusion: "success", jobId: 122663697044
				, artifactId: 12797845385
				, accepted: {
					"probe-ordinary-scalar": 53
					, "probe-ordinary-structural": 53
					, "probe-reviewed-scalar": 53
					, "probe-reviewed-structural": 53
				}
			}
		]);
	}
);
