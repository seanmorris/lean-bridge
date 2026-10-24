/**
 * Check retained Rust generation without unpacking the hosted binary archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import test from "node:test";
import { sha256 } from "./source-history-digest.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { bytesAtProducer } from "./producer-source.mjs";
import {
	checkZeroPayloadRustGeneratedSources, zeroPayloadRustGeneratorEntries
} from "./zero-payload-checked-record-rust-report.mjs";

const root = "docs/evidence/zero-payload-checked-record-rust-20261021";
const indexSha256 = "47a71983922b4b079c577de03ea31e5ba94b3a148d0331fe258f26b6682a6903";

const archive = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes);
	assert.equal(index.producerCommit, "a6173cade3bbe158baa1a5695e3e93e1037359b0");
	const files = new Map(index.files.map(file => [file.path, file]));
	const read = async path => {
		const expected = files.get(path);
		assert.ok(expected && expected.bytes < 1024 * 1024, path);
		let retained;
		try
		{ retained = await readFile(`${root}/${path}`); }
		catch(error)
		{
			if(error.code !== "ENOENT") throw error;
			// Sparse worktrees retain these small, hash-pinned records in Git.
			retained = execFileSync("git", ["show", `HEAD:${root}/${path}`]
				, { maxBuffer: 1024 * 1024 });
		}
		assert.equal(retained.length, expected.bytes, path);
		assert.equal(sha256(retained), expected.sha256, path);
		return retained;
	};
	return { index, files, read };
};

const selection = async (retained, route) => {
	const read = path => retained.read(`${route}/records/${path}`);
	const model = JSON.parse(await read("build-0/model.json"));
	const receipt = JSON.parse(await read("build-0/package-set-receipt.json"));
	const crate = JSON.parse(await read("crate.json"));
	return { read
		, options: { producerCommit: retained.index.producerCommit
			, model, evidence: crate.evidence, pkg: receipt.packages[0] } };
};

test("zero-payload Rust replay binds every generator dependency to retained producer sources", async () => {
	const { index, files } = await archive();
	assert.deepEqual(zeroPayloadRustGeneratorEntries, [
		"src/backends/rust/copied-values.mjs", "src/analyze/package-metadata.mjs"
	]);
	const visited = new Set();
	const visit = path => {
		if(visited.has(path)) return;
		visited.add(path);
		assert.ok(index.selectedSources.some(item => item.role === "producer"
			&& item.revision === index.producerCommit && item.path === path), path);
		const expected = files.get(`sources/producer/${path}`);
		assert.ok(expected, path);
		const bytes = bytesAtProducer(index.producerCommit, path, expected.sha256);
		assert.equal(bytes.length, expected.bytes, path);
		if(path.endsWith(".json")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of zeroPayloadRustGeneratorEntries) visit(entry);
	assert.ok(visited.size > zeroPayloadRustGeneratorEntries.length);
});

test("zero-payload Rust replays every generated source for all four retained author routes", async () => {
	const retained = await archive();
	assert.deepEqual(retained.index.runs.map(run => run.route).sort(), [
		"ordinary-source", "result-only-ordinary-source"
		, "result-only-reviewed-ir", "reviewed-ir"
	]);
	for(const { route } of retained.index.runs)
	{
		const { read, options } = await selection(retained, route);
		const checked = new Set();
		await checkZeroPayloadRustGeneratedSources(async path => {
			checked.add(path); return read(path);
		}, options);
		assert.ok(checked.has("package/README.md"), route);
		assert.ok(checked.has("package/Cargo.toml"), route);
		assert.ok(checked.has("package/src/lib.rs"), route);
		assert.ok(checked.has("package/binding-manifest.json"), route);
	}
});

test("zero-payload Rust replay rejects changed sources and a different producer", async () => {
	const retained = await archive();
	const { read, options } = await selection(retained, "ordinary-source");
	await checkZeroPayloadRustGeneratedSources(read, options);
	for(const target of ["README.md", "Cargo.toml", "src/lib.rs", "binding-manifest.json"])
	{
		let changed = false;
		await assert.rejects(checkZeroPayloadRustGeneratedSources(async path => {
			const bytes = await read(path);
			if(path !== `package/${target}`) return bytes;
			changed = true;
			return Buffer.concat([bytes, Buffer.from("changed")]);
		}, options), error => {
			assert.equal(error.code, "ERR_ASSERTION");
			assert.equal(error.message.split("\n")[0], target);
			return true;
		});
		assert.equal(changed, true, target);
	}
	await assert.rejects(checkZeroPayloadRustGeneratedSources(read, {
		...options, producerCommit: "ebd4d7e73417939efb973688a5fb434651a6f2c9"
	}), { code: "ERR_ASSERTION", message: /^README\.md\n/u });
	await assert.rejects(checkZeroPayloadRustGeneratedSources(read, {
		...options, producerCommit: "HEAD"
	}), { code: "ERR_ASSERTION" });
});
