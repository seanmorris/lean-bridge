/**
 * Keep publication pages and their exact live inventory hashes transactional.
 * Synthetic pin fixtures do not establish hosted archive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { phpWasmEntryProbeDocumentationPaths, renderPhpWasmEntryProbeDocumentation } from "./php-wasm-refinement-entry-publication-docs.mjs";
import { stagePhpWasmEntryProbePins } from "./php-wasm-refinement-entry-publication-pins.mjs";
import { gitSourceBytes } from "./source-history-stream.mjs";

const updates = () => Object.values(phpWasmEntryProbeDocumentationPaths).map((path, index) => ({ path
	, previous: String(index + 1).repeat(64)
	, current: String(index + 5).repeat(64) }));
const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });
const fixture = () => {
	const references = updates().slice(0, 3).map(update => ({ path: update.path, sha256: update.previous }));
	const files = [...references, references[0]
		, { path: "unrelated.mjs", sha256: "a".repeat(64) }];
	return { evidence: [{ id: "synthetic-λ", files, artifacts: structuredClone(references) }]
		, observations: [{ note: "unchanged 🧮" }] };
};
const setup = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-pins-"));
	t.after(() => rm(root, { recursive: true, force: true })); return root;
};

test("PHP-Wasm publication pins preserve every byte except selected live documentation hashes", async t => {
	const root = await setup(t), original = fixture(), bytes = Buffer.from(canonicalJson(original));
	const destination = join(root, "staged.json"), selected = updates();
	const input = Readable.from(Array.from(bytes, byte => Buffer.from([byte])));
	const result = await stagePhpWasmEntryProbePins(input, destination, identity(bytes), selected);
	const expected = structuredClone(original);
	for(const file of expected.evidence[0].files)
	{
		const update = selected.find(update => update.path === file.path);
		if(update) file.sha256 = update.current;
	}
	const rendered = await readFile(destination);
	assert.equal(rendered.toString(), canonicalJson(expected));
	assert.deepEqual({ bytes: result.bytes, sha256: result.sha256 }, identity(rendered));
	assert.deepEqual(result.pins.map(pin => pin.count), [2, 1, 1, 0]);
	assert.deepEqual(JSON.parse(rendered).evidence[0].artifacts, original.evidence[0].artifacts);
});

test("PHP-Wasm publication pins refuse stale or malformed input and remove only fresh staging", async t => {
	const root = await setup(t), bytes = Buffer.from(canonicalJson(fixture()));
	const destination = join(root, "staged.json"), exact = identity(bytes);
	for(const [input, selected, expected] of [
		[bytes, updates().map(update => ({ ...update, previous: "f".repeat(64) })), exact]
		, [bytes, updates(), { ...exact, sha256: "0".repeat(64) }]
		, [bytes, updates(), { ...exact, bytes: bytes.length - 1 }]
		, [bytes.subarray(0, -1), updates(), identity(bytes.subarray(0, -1))]
		, [Buffer.from([0xff, 10]), updates(), identity(Buffer.from([0xff, 10]))]
	]) {
		await assert.rejects(stagePhpWasmEntryProbePins(Readable.from([input]), destination, expected, selected));
		assert.deepEqual(await readdir(root), []);
	}
	await writeFile(destination, "keep", { flag: "wx" });
	await assert.rejects(stagePhpWasmEntryProbePins(Readable.from([bytes]), destination, exact, updates()), { code: "EEXIST" });
	assert.equal(await readFile(destination, "utf8"), "keep");
});

test("PHP-Wasm publication pins restrict replacement authority to all four distinct pages", async t => {
	const root = await setup(t), bytes = Buffer.from(canonicalJson(fixture()));
	for(const mutate of [
		value => { value.pop(); }
		, value => { value[1] = value[0]; }
		, value => { value[0].path = "unrelated.mjs"; }
		, value => { value[0].current = "invalid"; }
		, value => { value[0].current = value[0].previous; }
		, value => { value[0].extra = true; }
	]) {
		const selected = updates(); mutate(selected);
		await assert.rejects(stagePhpWasmEntryProbePins(Readable.from([bytes]), join(root, "staged.json"), identity(bytes), selected));
		assert.deepEqual(await readdir(root), []);
	}
});

test("PHP-Wasm publication pins reproduce the 29-pin predecessor regression", async t => {
	const root = await setup(t), sources = {};
	// Execute today's refresher against immutable input data, not an old checker.
	// Keep the regression valid after the documentation is actually published.
	const predecessor = "febe63cfcf0d5e1c5ae0df11c3e6a56bb25d9c57";
	for(const [page, path] of Object.entries(phpWasmEntryProbeDocumentationPaths))
		sources[page] = execFileSync("git", ["show", predecessor + ":" + path]
			, { encoding: "utf8", maxBuffer: 1024 ** 2 });
	const evidence = { id: "php-wasm-refinement-entry-hosted-probes", kind: "test"
		, revision: "a003269808c43a2a3a509a23c8a8ab8def07b610"
		, files: [{ path: "docs/evidence/php-wasm-entry-hosted-20261025/index.json", sha256: "a".repeat(64) }] };
	const rendered = renderPhpWasmEntryProbeDocumentation(sources, evidence);
	const selected = Object.entries(phpWasmEntryProbeDocumentationPaths).map(([page, path]) => ({ path
		, previous: sha256(Buffer.from(sources[page]))
		, current: sha256(Buffer.from(rendered[page])) }));
	const inventory = "docs/type-surface.v1.json";
	const { promotionFileIdentity } = await import("./promotion-file-transaction.mjs");
	const hash = createHash("sha256"); let bytes = 0;
	for await(const chunk of gitSourceBytes(predecessor, inventory))
	{
		hash.update(chunk); bytes += chunk.length;
	}
	const source = { bytes, sha256: hash.digest("hex") };
	const result = await stagePhpWasmEntryProbePins(gitSourceBytes(predecessor, inventory), join(root, "staged.json"), source, selected);
	assert.equal(result.pins.reduce((sum, pin) => sum + pin.count, 0), 29);
	assert.equal(result.bytes, source.bytes);
	assert.notEqual(result.sha256, source.sha256);
	const inverse = selected.map(update => ({ path: update.path, previous: update.current, current: update.previous }));
	const restored = await stagePhpWasmEntryProbePins(createReadStream(join(root, "staged.json")), join(root, "restored.json")
		, { bytes: result.bytes, sha256: result.sha256 }, inverse);
	assert.equal(restored.sha256, source.sha256);
	assert.deepEqual(await promotionFileIdentity(join(root, "restored.json")), source);
});
