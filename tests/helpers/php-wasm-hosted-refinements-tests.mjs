/**
 * Retain actual hosted refinement evidence without treating unrelated artifact members as coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { phpWasmHostedRoot, readPhpWasmHostedArchive, assertPhpWasmHostedReports } from "./php-wasm-hosted-refinements.mjs";
import { readPhpWasmHostedMembers } from "./php-wasm-hosted-artifact.mjs";

test("hosted PHP-Wasm archive binds successful job, original ZIP and both refinement routes", async () => {
	const { files, members } = await readPhpWasmHostedArchive();
	assert.equal(members.size, 111);
	assert.deepEqual(await assertPhpWasmHostedReports(members), { directFinExecutions: 48, subtypeExecutions: 24, instrumentedEntryConfigurations: 24 });
	for(const changed of [Buffer.alloc(0), Buffer.concat([files.get("artifact.zip"), Buffer.from("extra")])])
		assert.throws(() => readPhpWasmHostedMembers(changed));
	const changed = Buffer.from(files.get("artifact.zip")); changed[100] ^= 1;
	assert.throws(() => readPhpWasmHostedMembers(changed));
});

test("hosted PHP-Wasm archive rejects every missing or corrupted original", async () => {
	const { index, files } = await readPhpWasmHostedArchive();
	files.set("index.json", await readFile(`${phpWasmHostedRoot}/index.json`));
	const read = async path => { const bytes = files.get(path.slice(phpWasmHostedRoot.length + 1)); assert.ok(bytes); return bytes; };
	for(const name of ["index.json", ...index.files.map(item => item.path)])
	{
		const target = `${phpWasmHostedRoot}/${name}`;
		await assert.rejects(readPhpWasmHostedArchive(async path => {
			if(path === target) throw Object.assign(new Error("Missing original"), { code: "ENOENT" });
			return read(path);
		}));
		await assert.rejects(readPhpWasmHostedArchive(async path => path === target ? Buffer.from("corrupt") : read(path)));
	}
});

test("hosted PHP-Wasm reports require both source routes, original probe inputs and zero-skip TAP", async () => {
	const { members } = await readPhpWasmHostedArchive();
	const paths = ["php-wasm-subtype-entry/run.tap"
		, ...["ordinary", "reviewed"].flatMap(route => [
		`php-wasm-fin-direct/${route}.json`
		, `php-wasm-subtype/${route}.json`
		, `php-wasm-subtype-entry/${route}/report.json`
		, `php-wasm-subtype-entry/${route}/build-0/model.json`
		, `php-wasm-subtype-entry/${route}/build-1/observation.json`
		])
	];
	for(const path of paths)
	{
		const changed = new Map(members); changed.delete(path);
		await assert.rejects(assertPhpWasmHostedReports(changed));
	}
	const changed = new Map(members), path = "php-wasm-subtype-entry/run.tap";
	changed.set(path, Buffer.from(members.get(path).toString().replace("# skipped 0", "# skipped 1")));
	await assert.rejects(assertPhpWasmHostedReports(changed));
});
