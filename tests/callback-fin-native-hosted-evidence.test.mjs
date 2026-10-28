/**
 * Replay the immutable Python/Ruby/Rust and Perl callback-Fin archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	checkCallbackFinNativeHostedEvidence
} from "./helpers/callback-fin-native-hosted-evidence.mjs";

test("native-language callback Fin evidence replays every retained package"
	, async () => {
		const index = await checkCallbackFinNativeHostedEvidence();
		assert.equal(index.producerCommit
			, "be95f599fe2b11c59bc03b4baa48a31eeacf1616");
		assert.equal(index.checkerCommit, index.producerCommit);
		assert.equal(index.archiveCommit
			, "79abff895d0eeb57750bc737c2528ef2787384a9");
		assert.deepEqual(index.lanes.map(lane => [
			lane.id, lane.profiles, lane.accepted.routes, lane.accepted.reports
		]), [
			["languages", ["python", "ruby", "rust"]
				, ["ordinary", "reviewed"], 6]
			, ["perl", ["perl"], ["ordinary", "reviewed"], 16]
		]);
		assert.equal(index.lanes[1].accepted.interpreterCount, 4);
		assert.deepEqual(index.lanes[1].accepted.modes
			, ["prebuilt-only", "build-xs"]);
		for(const lane of index.lanes)
		{
			assert.equal(lane.accepted.retainedPackages.schemaVersion, 1);
			assert.deepEqual(lane.accepted.retainedPackages.routes.map(route =>
				route.route), ["ordinary", "reviewed"]);
			for(const route of lane.accepted.retainedPackages.routes)
			{
				assert.ok(route.archives > 0);
				assert.ok(route.archiveBytes > 0);
				assert.match(route.receiptSha256, /^[a-f0-9]{64}$/u);
			}
		}
	}
);
