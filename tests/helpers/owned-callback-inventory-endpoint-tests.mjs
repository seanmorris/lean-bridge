/**
 * Exercise callback inventory stops with the small original producer snapshots.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { bytesAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedCppCallbackResults } from "./owned-cpp-callback-result-history.mjs";
import {
	beforeCallbackInventoryRepair, readCallbackInventoryHistory
	, reverseCallbackInventoryUpdate
} from "./owned-callback-inventory-history.mjs";

test("callback inventory repair selects every exact original endpoint and rejects forged transitions", () => {
	const history = readCallbackInventoryHistory();
	for(const update of history.updates)
	{
		const current = bytesAtProducer("a48d4d3ca089aa2c0cd4d625a809df94ff2cf629"
			, update.path, update.currentSha256).toString("utf8");
		const selected = beforeOwnedCppCallbackResults(update.path, current, update.currentSha256);
		assert.equal(selected, current, update.path);
		const previous = beforeCallbackInventoryRepair(update.path, selected, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCallbackInventoryUpdate(update.path, current, update), previous, update.path);
		assert.equal(beforeCallbackInventoryRepair(update.path, previous, update.previousSha256), previous);
		assert.equal(beforeCallbackInventoryRepair(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrelated */\n";
		assert.equal(beforeCallbackInventoryRepair(update.path, unknown, update.previousSha256), unknown);
		for(const key of ["currentSha256", "previousSha256"])
			assert.throws(() => reverseCallbackInventoryUpdate(update.path, current, {
				...update, [key]: "0".repeat(64)
			}));
	}
});
