/**
 * Authenticate the Perl live-receipt evidence repair without changing frozen installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinSource } from "./native-fin-source-history.mjs";
import { beforePerlEvidenceRepairSource, perlEvidenceRepairChangedPaths
	, perlEvidenceRepairHistoryPath, reversePerlEvidenceRepairUpdate } from "./perl-evidence-repair-source-history.mjs";

test("Perl evidence repair history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(perlEvidenceRepairHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "4affa1bcf6727a550db59ab845394f425cc26882");
	assert.deepEqual(record.updates.map(item => item.path), perlEvidenceRepairChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeNativeFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePerlEvidenceRepairUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePerlEvidenceRepairSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforePerlEvidenceRepairSource(update.path, changed), changed);
		assert.throws(() => reversePerlEvidenceRepairUpdate(changed, update));
		assert.throws(() => reversePerlEvidenceRepairUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
