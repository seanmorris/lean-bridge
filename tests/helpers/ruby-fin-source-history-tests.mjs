/**
 * Authenticate the Ruby scalar Fin change and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeDotnetFinSource, dotnetFinChangedPaths } from "./dotnet-fin-source-history.mjs";
import { jvmFinChangedPaths } from "./jvm-fin-source-history.mjs";
import { phpFinChangedPaths } from "./php-fin-source-history.mjs";
import { witFinChangedPaths } from "./wit-fin-source-history.mjs";
import { beforeRubyFinSource, rubyFinChangedPaths
	, rubyFinHistoryPath, reverseRubyFinUpdate } from "./ruby-fin-source-history.mjs";

test("Ruby scalar Fin history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(rubyFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e067ea0f2c69ac0606afd9660aabd1d1da887ff6");
	assert.deepEqual(record.updates.map(item => item.path), rubyFinChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeDotnetFinSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRubyFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRubyFinSource(update.path, source)), update.previousSha256);
		assert.equal(beforeRubyFinSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeRubyFinSource(update.path, changed), changed);
		assert.throws(() => reverseRubyFinUpdate(changed, update));
		assert.throws(() => reverseRubyFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Ruby scalar Fin changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeRubyFinSource(path, text));
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
			assert.ok(rubyFinChangedPaths.includes(file.path) || dotnetFinChangedPaths.includes(file.path) || jvmFinChangedPaths.includes(file.path) || phpFinChangedPaths.includes(file.path) || witFinChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeRubyFinSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# ruby-fin refreshed inventory pins: ${refreshed}\n`);
});
