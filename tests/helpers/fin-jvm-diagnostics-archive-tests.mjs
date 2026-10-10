/**
 * Keep all original JVM diagnostics in the checkout and reject incomplete archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { assertFinJvmDiagnosticsArchive, finJvmDiagnosticsArchiveRoot } from "./fin-jvm-diagnostics-archive.mjs";

test("JVM diagnostic archive retains all 89 originals including the hosted failure log", async () => {
	const index = await assertFinJvmDiagnosticsArchive();
	assert.deepEqual(index.files.find(file => file.path === "hosted-failure.log"), {
		path: "hosted-failure.log"
		, original: "/app/build/vo1220-jvm-b8765be-114211587262.log"
		, sha256: "4f28f167fb17ecab1c3c1853823e25a34c7ac52d7ead9b88deed8cb725ece693"
		, bytes: 476283
	});
});

test("JVM diagnostic archive refuses each missing or corrupted artifact and index", async t => {
	const indexBytes = await readFile(join(finJvmDiagnosticsArchiveRoot, "index.json"));
	const index = JSON.parse(indexBytes);
	const records = new Map([["index.json", indexBytes]]);
	for(const file of index.files) records.set(file.path, await readFile(join(finJvmDiagnosticsArchiveRoot, file.path)));
	let missing = 0, appended = 0, changed = 0;
	for(const [path, bytes] of records)
	{
		await assert.rejects(assertFinJvmDiagnosticsArchive(async selected => {
			if(selected === path) throw Object.assign(new Error(`Missing ${path}`), { code: "ENOENT" });
			return records.get(selected);
		}), { code: "ENOENT" });
		missing++;
		await assert.rejects(assertFinJvmDiagnosticsArchive(async selected => selected === path ? Buffer.concat([bytes, Buffer.from("\n")]) : records.get(selected)), assert.AssertionError);
		appended++;
		if(bytes.length)
		{
			const corrupted = Buffer.from(bytes); corrupted[0] ^= 1;
			await assert.rejects(assertFinJvmDiagnosticsArchive(async selected => selected === path ? corrupted : records.get(selected)), assert.AssertionError);
			changed++;
		}
	}
	assert.equal(missing, 90); assert.equal(appended, 90); assert.equal(changed, 81);
	t.diagnostic(`${missing} missing-file, ${appended} appended-byte and ${changed} same-length controls rejected`);
});
