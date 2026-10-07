/**
 * Core regression repairs preserve historical receipts and support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeRefinementCiFollowupSource } from "./refinement-ci-followup-source-history.mjs";
import { beforeReviewedScalarHostsSource, reviewedScalarHostsChangedPaths, reviewedScalarHostsHistoryPath, reverseReviewedScalarHostsUpdate } from "./reviewed-scalar-hosts-source-history.mjs";

test("Reviewed scalar host gates authenticate each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedScalarHostsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e2bd4b0e3e8b670576144c11409981beadc83522");
	assert.deepEqual(record.updates.map(update => update.path), reviewedScalarHostsChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeRefinementCiFollowupSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedScalarHostsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedScalarHostsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedScalarHostsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedScalarHostsSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedScalarHostsUpdate(changed, update));
		assert.throws(() => reverseReviewedScalarHostsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Reviewed scalar host gates change current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforeRefinementCiFollowupSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeReviewedScalarHostsSource(path, source));
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [index, entry] of previous.evidence.entries())
	{
		const now = current.evidence[index], strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [position, file] of entry.files.entries())
		{
			if(file.sha256 === now.files[position].sha256) continue;
			assert.ok(reviewedScalarHostsChangedPaths.includes(file.path));
			const bytes = beforeRefinementCiFollowupSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforeReviewedScalarHostsSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
