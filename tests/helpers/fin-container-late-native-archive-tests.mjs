/**
 * Original native acceptance archives and refusal of missing/corrupted producer records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { finLateNativeArchive, readFinLateNativeArchive } from "./fin-container-late-native-archive.mjs";

test("complete native late-input archive binds all nine hosts, both Python floors and original runs", async () => {
	const { index, files } = await readFinLateNativeArchive();
	assert.equal(index.runs.length, 8);
	assert.ok(index.files.length > 200);
	files.set("index.json", await readFile(`${finLateNativeArchive}/index.json`));
	const read = async path => { const value = files.get(path.slice(finLateNativeArchive.length + 1)); assert.ok(value); return value; };
	await assert.rejects(readFinLateNativeArchive(async path => path.endsWith("/index.json") ? Buffer.from("corrupt") : read(path)));
	await assert.rejects(readFinLateNativeArchive(async path => {
		if(path.endsWith("/index.json")) throw Object.assign(new Error("Missing index"), { code: "ENOENT" });
		return read(path);
	}));
	for(const file of index.files)
	{
		const target = `${finLateNativeArchive}/${file.path}`;
		await assert.rejects(readFinLateNativeArchive(async path => {
			if(path === target) throw Object.assign(new Error("Missing original"), { code: "ENOENT" });
			return read(path);
		}));
		await assert.rejects(readFinLateNativeArchive(async path => path === target ? Buffer.from("corrupt") : read(path)));
	}
});
