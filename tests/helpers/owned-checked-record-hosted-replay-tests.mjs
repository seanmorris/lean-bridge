/**
 * Register one retained owned checked-record archive replay per test process.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { ownedCheckedRecordHostedLaneNames } from "./owned-checked-record-hosted-contracts.mjs";
import { checkOwnedCheckedRecordHostedEvidence } from "./owned-checked-record-hosted-evidence.mjs";

export const ownedCheckedRecordReplayPartitions
	= Object.freeze([...ownedCheckedRecordHostedLaneNames]);

/**
 * Register the retained replay for exactly one hosted lane.
 *
 * @param lane - Hosted lane name.
 * @param prefix - Exact retained archive prefix declared by the partition.
 */
export const registerOwnedCheckedRecordHostedReplay = (lane, prefix) => {
	assert.ok(ownedCheckedRecordReplayPartitions.includes(lane), lane);
	assert.equal(prefix, ["owned", "checked", "record", lane, "hosted", ""]
		.join("-"));
	const roots = readdirSync("docs/evidence", { withFileTypes: true })
		.filter(entry => entry.isDirectory() && new RegExp(
			`^${prefix}\\d{8}$`, "u")
			.test(entry.name))
		.map(entry => `docs/evidence/${entry.name}`);
	test(`retained ${lane} owned checked-record hosted evidence replays`, {
		skip: roots.length === 0, timeout: 600_000
	}, async () => {
		for(const root of roots)
			await checkOwnedCheckedRecordHostedEvidence(lane, root);
	});
};
