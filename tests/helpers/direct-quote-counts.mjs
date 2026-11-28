/** @file Independent broker observations for managed incoming-function clients. */
import assert from "node:assert/strict";

export const directQuoteLabels=["baseline","success","error","held","lease","errorLease","nested","fresh","afterThreadExit"];
export const directQuoteCases=["success","error","lease","errorLease","nested","fresh"];

/**
 * Verify every completed call restores the warmed session, not just final cleanup.
 *
 * @param counts - Snapshot counts from the independent broker observer.
 * @param options - Expected quiescent count and name of the observed shutdown boundary.
 * @param options.baseline - Live identities when the warmed binding owns no application values.
 * @param options.closed - Final observation label (a binding close is not a thread exit).
 */
export const verifyDirectQuoteCounts=(counts,{baseline=1,closed="afterThreadExit"}={})=>{
	assert.deepEqual(Object.keys(counts),[...directQuoteLabels.slice(0,-1),closed]);
	assert.equal(counts.baseline,baseline);
	assert.ok(Number.isSafeInteger(counts.held) && counts.held>counts.baseline);
	for(const key of directQuoteCases) assert.equal(counts[key],counts.baseline,key);
	assert.equal(counts[closed],0);
};
