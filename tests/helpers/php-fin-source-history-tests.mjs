/**
 * Authenticate the PHP scalar Fin change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeWitFinSource, witFinChangedPaths } from "./wit-fin-source-history.mjs";
import { finDistributionChangedPaths } from "./fin-distribution-source-history.mjs";
import { perlFinChangedPaths } from "./perl-fin-source-history.mjs";
import { hostFinEvidenceChangedPaths } from "./host-fin-evidence-source-history.mjs";
import { beforePhpFinSource, phpFinChangedPaths
	, phpFinHistoryPath, reversePhpFinUpdate } from "./php-fin-source-history.mjs";

test("PHP scalar Fin history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(phpFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "849dff2e7f52fe5fc224b04f53884119fbc7312e");
	assert.deepEqual(record.updates.map(item => item.path), phpFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeWitFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforePhpFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforePhpFinSource(update.path, changed), changed);
		assert.throws(() => reversePhpFinUpdate(changed, update));
		assert.throws(() => reversePhpFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("PHP scalar Fin changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(beforeWitFinSource(path, text)), previous = JSON.parse(beforePhpFinSource(path, text));
	for(const key of Object.keys(previous).filter(key => key !== "evidence")) assert.deepEqual(current[key], previous[key], key);
	assert.deepEqual(current.evidence.map(entry => entry.id), previous.evidence.map(entry => entry.id));
	let refreshed = 0;
	for(const [position, entry] of previous.evidence.entries())
	{
		const now = current.evidence[position];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [index, file] of entry.files.entries())
		{
			if(now.files[index].sha256 === file.sha256) continue;
			assert.ok(phpFinChangedPaths.includes(file.path) || witFinChangedPaths.includes(file.path) || finDistributionChangedPaths.includes(file.path) || perlFinChangedPaths.includes(file.path) || hostFinEvidenceChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforePhpFinSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(beforeWitFinSource(file.path, source)));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# php-fin refreshed inventory pins: ${refreshed}\n`);
});
