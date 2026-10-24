/**
 * Bind recursive PHP replay to its original producer without a live inventory walk.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	phpRecursiveCallableProducer
	, phpRecursiveCallableProducerClosure
	, phpRecursiveCallableProducerEntries
} from "./php-recursive-callable-evidence.mjs";
import {
	beforePhpRecursiveCallables
	, phpRecursiveCallableChangedPaths
	, phpRecursiveCallableHistoryPath
	, reversePhpRecursiveCallableUpdate
} from "./php-recursive-callable-source-history.mjs";
import { beforePhpWasmRecursiveCallables } from "./php-wasm-recursive-callable-source-history.mjs";
import { bytesAtProducer } from "./producer-source.mjs";
import { sha256 } from "./source-history-digest.mjs";

const record = async () => JSON.parse(await readFile(phpRecursiveCallableHistoryPath, "utf8"));

test("recursive PHP producer replay authenticates every imported generator source", async () => {
	const history = await record();
	assert.equal(phpRecursiveCallableProducer, "0af020b28bc69bb97f678a814b7b567eac13c559");
	assert.deepEqual(phpRecursiveCallableProducerEntries, [
		"src/backends/php/callable-graph-package.mjs"
		, "src/backends/php/callable-graph-model.mjs"
	]);
	const paths = phpRecursiveCallableProducerClosure(history.sourceHashes);
	assert.equal(paths.length, 38);
	assert.deepEqual(paths, [...new Set(paths)].sort());
	for(const path of paths)
		assert.equal(sha256(bytesAtProducer(phpRecursiveCallableProducer, path))
			, history.sourceHashes[path], path);
	for(const path of [...phpRecursiveCallableProducerEntries
		, "src/backends/php/callable-graph-runtime.mjs", "src/capsule/node.mjs"]){
		assert.ok(paths.includes(path), path);
		const missing = { ...history.sourceHashes };
		delete missing[path];
		assert.throws(() => phpRecursiveCallableProducerClosure(missing));
		assert.throws(() => phpRecursiveCallableProducerClosure({
			...history.sourceHashes, [path]: "0".repeat(64)
		}));
		}
});

test("recursive PHP history stops at every exact original producer endpoint", async () => {
	const history = await record();
	assert.deepEqual(history.updates.map(update => update.path).sort()
		, [...phpRecursiveCallableChangedPaths].sort());
	for(const update of history.updates)
	{
		const source = bytesAtProducer(phpRecursiveCallableProducer, update.path
			, update.currentSha256).toString("utf8");
		const selected = beforePhpWasmRecursiveCallables(update.path, source, update.currentSha256);
		assert.equal(selected, source, update.path);
		assert.equal(sha256(reversePhpRecursiveCallableUpdate(selected, update))
			, update.previousSha256, update.path);
		assert.equal(sha256(beforePhpRecursiveCallables(update.path, selected, update.previousSha256))
			, update.previousSha256, update.path);
		assert.equal(beforePhpRecursiveCallables(update.path, source, update.currentSha256)
			, source, update.path);
		const unknown = source + "\n/* unrelated */\n";
		assert.equal(beforePhpWasmRecursiveCallables(update.path, unknown, update.currentSha256)
			, unknown, update.path);
		assert.throws(() => reversePhpRecursiveCallableUpdate(selected, {
			...update, previousSha256: "0".repeat(64)
		}));
	}
});
