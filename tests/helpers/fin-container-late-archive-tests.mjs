/**
 * Verify retained original successes and failures, never inferred broader support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { finJvmHostedArchive, finLateWitArchive, readFinJvmHostedArchive, readFinLateWitArchive } from "./fin-container-late-archives.mjs";

for(const [root, reader, count] of [[finLateWitArchive, readFinLateWitArchive, 54], [finJvmHostedArchive, readFinJvmHostedArchive, 19]])
{
	test(`original archive authenticates its complete measured scope: ${root}`, async () => {
		const result = await reader();
		assert.equal(result.index.files.length, count);
	});
	test(`archive refuses missing and corrupted originals: ${root}`, async t => {
		const index = JSON.parse(await readFile(`${root}/index.json`));
		const paths = [`${root}/index.json`, ...index.files.map(file => `${root}/${file.path}`), ...(index.references ?? []).map(file => file.path)];
		const saved = new Map(await Promise.all(paths.map(async path => [path, await readFile(path)])));
		let controls = 0;
		for(const target of paths)
		{
			await assert.rejects(() => reader(async path => {
				if(path === target) throw new Error(`Missing original: ${target}`);
				assert.ok(saved.has(path), path); return saved.get(path);
			}));
			const changed = Buffer.concat([saved.get(target), Buffer.from("\n")]);
			await assert.rejects(() => reader(async path => {
				assert.ok(saved.has(path), path);
				return path === target ? changed : saved.get(path);
			}));
			controls += 2;
		}
		t.diagnostic(`${controls} missing/corrupted original controls refused`);
	});
}
