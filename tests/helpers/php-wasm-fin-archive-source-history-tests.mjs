/**
 * PHP-Wasm Fin archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeGenericRecordBrowserArchiveSource } from "./generic-record-browser-archive-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpWasmFinArchiveSource, phpWasmFinArchiveChangedPaths, phpWasmFinArchiveHistoryPath, reversePhpWasmFinArchiveUpdate } from "./php-wasm-fin-archive-source-history.mjs";

test("PHP-Wasm Fin archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(phpWasmFinArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "fc8dbefc5a365b3b19c797ff95067656603c69b5");
	assert.deepEqual(record.updates.map(update => update.path), phpWasmFinArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeGenericRecordBrowserArchiveSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpWasmFinArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpWasmFinArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforePhpWasmFinArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforePhpWasmFinArchiveSource(update.path, changed), changed);
		assert.throws(() => reversePhpWasmFinArchiveUpdate(changed, update));
		assert.throws(() => reversePhpWasmFinArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
