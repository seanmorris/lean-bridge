/**
 * Retain the stopped producer as failure evidence, never as completed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";

const root = "docs/evidence/fin-container-late-native-disk-20261011";
const expected = "5c078e4bb1c7dde17fccb62d4647f335575608d1b550c53bd5ae744fbec9e888";
const check = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), expected);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(index.kind, "fin-container-late-native-disk-stop-v1");
	assert.equal(index.conclusion, "stopped-for-disk"); assert.equal(index.files.length, 60);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").includes(".."));
		assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	const start = JSON.parse(files.get("start.json")), end = JSON.parse(files.get("end.json"));
	assert.equal(start.revision, index.revision);
	assert.equal(start.environment.LEAN_BRIDGE_FIN_LATE_PROFILES, "python,ruby,rust");
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
	assert.ok(start.minimumMiB >= 2048);
	assert.deepEqual([end.code, end.signal, end.diskStop, end.minimumMiB], [1, null, true, 525]);
	assert.equal(end.tapSha256, sha256(files.get("run.tap")));
	assert.equal(files.get("run.tap").toString(), "TAP version 13\n");
	assert.equal(files.has("records/report.json"), false);
	for(const [profile, count] of [["python", 20158], ["ruby", 20157], ["rust", 20141]])
		for(const suffix of ["before.stdout", "relocated.stdout"])
			assert.equal(files.get(`records/${profile}.${suffix}`).toString(), `fin-container-ok:${count}\n`);
	const inventories = JSON.parse(files.get("scratch-inventory.json"));
	assert.deepEqual(inventories.map(item => item.root), index.retainedRoots);
	assert.equal(inventories.flatMap(item => item.entries).reduce((sum, file) => sum + (file.bytes ?? 0), 0), 2160208787);
	return files;
};

test("disk-stopped native late-input originals remain incomplete and reject corrupt or missing records", async () => {
	const files = await check(path => readFile(`${root}/${path}`));
	files.set("index.json", await readFile(`${root}/index.json`));
	for(const target of files.keys())
	{
		await assert.rejects(check(async path => {
			if(path === target) throw Object.assign(new Error("Missing original"), { code: "ENOENT" });
			return files.get(path);
		}));
		await assert.rejects(check(async path => path === target ? Buffer.from("corrupt") : files.get(path)));
	}
});
