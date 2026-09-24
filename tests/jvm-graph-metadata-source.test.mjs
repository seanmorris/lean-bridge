/**
 * Keep the original JVM metadata execution and compiler checks intact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertJvmGraphMetadataSource, beforeJvmGraphMetadataVerification } from "./helpers/jvm-graph-metadata-source.mjs";

test("JVM metadata verification reconstructs complete original tests and rejects unrelated edits", async () => {
	for(const [receipt, path] of [
		["jvm", "tests/jvm-copied-graph-values.test.mjs"]
		, ["kotlin", "tests/jvm-copied-graph-kotlin.test.mjs"]
	]) {
		const record = JSON.parse(await readFile(`docs/evidence/${receipt}-recursive-values-20260923.json`));
		const source = await readFile(path, "utf8"), expected = record.sourceHashes[path];
		assert.equal(sha256(beforeJvmGraphMetadataVerification(path, source)), expected);
		await assertJvmGraphMetadataSource(path, expected);
		await assert.rejects(() => assertJvmGraphMetadataSource(path, "0".repeat(64)));
		assert.throws(() => beforeJvmGraphMetadataVerification(path, source + source));
		assert.throws(() => beforeJvmGraphMetadataVerification(path, source.replace("await assertJvmGraphMetadataSource(path, hash)", "void hash")));
		assert.notEqual(sha256(beforeJvmGraphMetadataVerification(path, source + "\n// unrelated edit\n")), expected);
	}
	assert.throws(() => beforeJvmGraphMetadataVerification("src/build/compile-jvm-sources.mjs", ""));
});

test("JVM metadata receipts retain every source check after the measured wasm32 layout change", async () => {
	for(const name of ["jvm", "kotlin"])
	{
		const record = JSON.parse(await readFile(`docs/evidence/${name}-recursive-values-20260923.json`));
		for(const [path, hash] of Object.entries(record.sourceHashes)) await assertJvmGraphMetadataSource(path, hash);
	}
});
