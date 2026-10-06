/**
 * Authenticate the JVM scalar Fin change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpFinSource, phpFinChangedPaths } from "./php-fin-source-history.mjs";
import { witFinChangedPaths } from "./wit-fin-source-history.mjs";
import { finDistributionChangedPaths } from "./fin-distribution-source-history.mjs";
import { beforeJvmFinSource, jvmFinChangedPaths
	, jvmFinHistoryPath, reverseJvmFinUpdate } from "./jvm-fin-source-history.mjs";

test("JVM scalar Fin history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(jvmFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "42f5f6be3d9dfb403c7a6aea07bc69ff0a4eb369");
	assert.deepEqual(record.updates.map(item => item.path), jvmFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePhpFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseJvmFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeJvmFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforeJvmFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeJvmFinSource(update.path, changed), changed);
		assert.throws(() => reverseJvmFinUpdate(changed, update));
		assert.throws(() => reverseJvmFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("JVM scalar Fin changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeJvmFinSource(path, text));
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
			assert.ok(jvmFinChangedPaths.includes(file.path) || phpFinChangedPaths.includes(file.path) || witFinChangedPaths.includes(file.path) || finDistributionChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeJvmFinSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# jvm-fin refreshed inventory pins: ${refreshed}\n`);
});
