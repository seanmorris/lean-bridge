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
import { beforeFinProductsSource } from "./fin-products-source-history.mjs";
import { beforePerlFinXsAuditSource, perlFinXsAuditChangedPaths, perlFinXsAuditHistoryPath, reversePerlFinXsAuditUpdate } from "./perl-fin-xs-audit-source-history.mjs";

test("Perl Fin XS audit authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(perlFinXsAuditHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "ea48a43c7008e10f2bf8fa7e3b7a28e2462396c9");
	assert.deepEqual(record.updates.map(update => update.path), perlFinXsAuditChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeFinProductsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePerlFinXsAuditUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePerlFinXsAuditSource(update.path, source)), update.previousSha256);
		assert.equal(beforePerlFinXsAuditSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforePerlFinXsAuditSource(update.path, changed), changed);
		assert.throws(() => reversePerlFinXsAuditUpdate(changed, update));
		assert.throws(() => reversePerlFinXsAuditUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Perl Fin XS audit changes current source pins without inventing installed evidence", async () => {
	const path = "docs/type-surface.v1.json", source = beforeFinProductsSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforePerlFinXsAuditSource(path, source));
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
			assert.ok(perlFinXsAuditChangedPaths.includes(file.path));
			const bytes = beforeFinProductsSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforePerlFinXsAuditSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
});
