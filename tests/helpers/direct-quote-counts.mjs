/** @file Independent broker observations for managed incoming-function clients. */
import assert from "node:assert/strict";

export const directQuoteLabels=["baseline","success","error","held","lease","errorLease","nested","fresh","afterThreadExit"];
export const directQuoteCases=["success","error","lease","errorLease","nested","fresh"];

/**
 * Verify every completed call restores the warmed session, not just final cleanup.
 *
 * @param counts - Snapshot counts from the independent broker observer.
 */
export const verifyDirectQuoteCounts=counts=>{
	assert.deepEqual(Object.keys(counts),directQuoteLabels);
	assert.equal(counts.baseline,1);
	assert.ok(Number.isSafeInteger(counts.held) && counts.held>counts.baseline);
	for(const key of directQuoteCases) assert.equal(counts[key],counts.baseline,key);
	assert.equal(counts.afterThreadExit,0);
};
