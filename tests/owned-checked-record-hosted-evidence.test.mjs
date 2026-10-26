/**
 * Authenticate the independently schedulable owned checked-record replays.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ownedCheckedRecordHostedLaneNames } from "./helpers/owned-checked-record-hosted-contracts.mjs";
import { ownedCheckedRecordReplayPartitions } from "./helpers/owned-checked-record-hosted-replay-tests.mjs";

test("owned checked-record replay partitions cover every hosted lane once", () => {
	assert.deepEqual(ownedCheckedRecordReplayPartitions
		, ownedCheckedRecordHostedLaneNames);
	assert.equal(new Set(ownedCheckedRecordReplayPartitions).size
		, ownedCheckedRecordHostedLaneNames.length);
});
