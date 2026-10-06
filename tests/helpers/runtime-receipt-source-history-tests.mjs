/**
 * Authenticate the runtime receipt repair and preserve all existing support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCpanCliControlSource, cpanCliControlChangedPaths } from "./cpan-cli-control-source-history.mjs";
import { pythonFinChangedPaths } from "./python-fin-source-history.mjs";
import { rustFinChangedPaths } from "./rust-fin-source-history.mjs";
import { rubyFinChangedPaths } from "./ruby-fin-source-history.mjs";
import { dotnetFinChangedPaths } from "./dotnet-fin-source-history.mjs";
import { jvmFinChangedPaths } from "./jvm-fin-source-history.mjs";
import { phpFinChangedPaths } from "./php-fin-source-history.mjs";
import { witFinChangedPaths } from "./wit-fin-source-history.mjs";
import { finDistributionChangedPaths } from "./fin-distribution-source-history.mjs";
import { beforeRuntimeReceiptSource, runtimeReceiptChangedPaths
	, runtimeReceiptHistoryPath, reverseRuntimeReceiptUpdate } from "./runtime-receipt-source-history.mjs";

test("Runtime receipt history authenticates exact predecessors and rejects unknown edits", async () => {
	const record = JSON.parse(await readFile(runtimeReceiptHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "b51d6f6378ca9df40f528f2b2fe5bd0d8e97cc5f");
	assert.deepEqual(record.updates.map(item => item.path), runtimeReceiptChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCpanCliControlSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseRuntimeReceiptUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeRuntimeReceiptSource(update.path, source)), update.previousSha256);
		assert.equal(beforeRuntimeReceiptSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeRuntimeReceiptSource(update.path, changed), changed);
		assert.throws(() => reverseRuntimeReceiptUpdate(changed, update));
		assert.throws(() => reverseRuntimeReceiptUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Runtime receipt repair changes only evidence source pins, not support or archives", async () => {
	const path = "docs/type-surface.v1.json", text = await readFile(path, "utf8");
	const current = JSON.parse(text), previous = JSON.parse(beforeRuntimeReceiptSource(path, text));
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
			assert.ok(runtimeReceiptChangedPaths.includes(file.path) || cpanCliControlChangedPaths.includes(file.path) || pythonFinChangedPaths.includes(file.path) || rustFinChangedPaths.includes(file.path) || rubyFinChangedPaths.includes(file.path) || dotnetFinChangedPaths.includes(file.path) || jvmFinChangedPaths.includes(file.path) || phpFinChangedPaths.includes(file.path) || witFinChangedPaths.includes(file.path) || finDistributionChangedPaths.includes(file.path), `${entry.id}: ${file.path}`);
			const source = await readFile(file.path, "utf8");
			assert.equal(file.sha256, sha256(beforeRuntimeReceiptSource(file.path, source)));
			assert.equal(now.files[index].sha256, sha256(source));
			++refreshed;
		}
	}
	assert.ok(refreshed > 0);
	process.stdout.write(`# runtime-receipt refreshed inventory pins: ${refreshed}\n`);
});
