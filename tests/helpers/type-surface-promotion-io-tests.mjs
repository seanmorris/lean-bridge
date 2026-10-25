/**
 * Exercise bounded inventory staging with inert, schema-valid evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { readPromotionInventory, stageEvidenceRefresh, stagePromotionInventory }
	from "./type-surface-promotion-io.mjs";

const contracts = {
	irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"))
	, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"))
};
// Read only the small independent classification header, not the large ledger.
const input = createReadStream("docs/type-surface.v1.json");
let prefix = "";
try
{
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		if(line === '  "evidence": [') break;
		prefix += line + "\n";
		assert.ok(prefix.length < 100_000);
	}
}
finally
{
	input.destroy();
}
const classification = JSON.parse(prefix + '  "evidence": [],\n  "observations": []\n}\n');
classification.baseline.exclusions = [];
const entry = id => ({
	id, kind: "test", revision: "0".repeat(40), command: "Inert fixture"
	, scope: "Synthetic reference construction only: λ, ◆, 🭼."
	, files: [{ path: "fixture/first.mjs", sha256: "0".repeat(64) }
		, { path: "fixture/second.mjs", sha256: "1".repeat(64) }]
	, artifacts: []
});
const fixture = () => ({ ...structuredClone(classification)
	, evidence: [entry("first"), entry("second")] });
const bytes = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const read = (value, limits) => readPromotionInventory(
	Readable.from([Buffer.isBuffer(value) ? value : bytes(value)]), contracts, limits);

test("promotion inventory validates every file before projecting evidence", async () => {
	const value = fixture(), original = bytes(value);
	const result = await read(original);
	assert.deepEqual(result.source, { bytes: original.length, sha256: sha256(original) });
	assert.equal(result.document.evidence.length, 2);
	assert.ok(result.document.evidence.every(item => item.files.length === 1));
	assert.deepEqual(result.document.observations, value.observations);
	for(const mutate of [
		item => { item.files[1].sha256 = "invalid"; }
		, item => { item.files[1].path = "../escape"; }
		, item => { item.files[1].path = item.files[0].path; }
		, item => { item.unreviewed = true; }
	]) {
		const corrupt = fixture(); mutate(corrupt.evidence[1]);
		await assert.rejects(read(corrupt), assert.AssertionError);
	}
});

test("promotion inventory rejects malformed canonical input and budgets", async () => {
	const source = bytes(fixture()).toString();
	for(const changed of [source.slice(0, -1), source.replaceAll("\n", "\r\n")
		, source.replace('    },\n    {', '    }\n    {')
		, source.replace('  ],\n  "observations"', '  ,],\n  "observations"')
		, source.replace('      "id": "first",', '      "id": "first",\n      "id": "first",')
		, source.replace('  "observations": []', '  "observations": [],\n  "observations": []')
		, source.slice(0, source.indexOf('  "evidence": ['))])
		await assert.rejects(read(Buffer.from(changed)));
	await assert.rejects(read(Buffer.from([0xff, 0x0a])), /encoded data/u);
	await assert.rejects(read(fixture(), { line: 10 }), /line limit/u);
	await assert.rejects(read(fixture(), { section: 100 }), /prefix limit/u);
});

test("promotion inventory retains only explicitly selected complete evidence", async () => {
	const value = fixture();
	const result = await read(value, { retainEvidence: ["second"] });
	assert.equal(result.document.evidence[0].files.length, 1);
	assert.deepEqual(result.document.evidence[1], value.evidence[1]);
	for(const retainEvidence of [null, "second", ["missing"], ["second", "second"]
		, [""], [1], Array.from({ length: 9 }, (_, index) => String(index))])
		await assert.rejects(read(value, { retainEvidence }));
	value.evidence[1].files[1].sha256 = "invalid";
	await assert.rejects(read(value, { retainEvidence: ["second"] }));
});

test("promotion inventory handles UTF-8 chunk boundaries and complete manifests", async () => {
	const value = fixture();
	for(let index = 0; index < 2_000; index++) value.evidence[0].files.push({
		path: `fixture/extra-${index}.mjs`, sha256: "2".repeat(64)
	});
	const original = bytes(value), chunks = [];
	for(let offset = 0; offset < original.length; offset += 7)
		chunks.push(original.subarray(offset, offset + 7));
	const result = await readPromotionInventory(Readable.from(chunks), contracts);
	assert.equal(result.source.sha256, sha256(original));
	assert.equal(result.document.evidence[0].files.length, 1);
	assert.equal(value.evidence[0].files.length, 2_002);
});

const directory = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-inventory-promotion-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	return root;
};

test("promotion inventory staging preserves full old evidence and Unicode offsets", async t => {
	const root = await directory(t), source = join(root, "source.json");
	const target = join(root, "staged.json"), value = fixture();
	await writeFile(source, bytes(value));
	const original = await read(value), promoted = structuredClone(original.document);
	promoted.evidence.push(entry("new"));
	const identity = await stagePromotionInventory(source, target, original, promoted);
	const expected = bytes({ ...value, evidence: [...value.evidence, entry("new")] });
	assert.deepEqual(await readFile(target), expected);
	assert.deepEqual(identity, { bytes: expected.length, sha256: sha256(expected) });
	assert.deepEqual(await readFile(source), bytes(value));
});

test("promotion inventory staging refuses drift and preserves existing destinations", async t => {
	const root = await directory(t), source = join(root, "source.json");
	const target = join(root, "staged.json"), value = fixture();
	const original = await read(value), promoted = structuredClone(original.document);
	promoted.evidence.push(entry("new"));
	await writeFile(source, bytes(value));
	await assert.rejects(stagePromotionInventory(source, target, original, promoted, 100)
		, /file size limit/u);
	assert.deepEqual(await readdir(root), ["source.json"]);
	const corrupt = structuredClone(value); corrupt.evidence[0].scope += " changed";
	await writeFile(source, bytes(corrupt));
	await assert.rejects(stagePromotionInventory(source, target, original, promoted)
		, /changed after preflight/u);
	assert.deepEqual(await readdir(root), ["source.json"]);
	await writeFile(source, bytes(value));
	await writeFile(target, "Keep this user file");
	await assert.rejects(stagePromotionInventory(source, target, original, promoted)
		, { code: "EEXIST" });
	assert.equal(await readFile(target, "utf8"), "Keep this user file");
	const invalid = structuredClone(promoted); invalid.evidence[0].scope += " rewrite";
	await assert.rejects(stagePromotionInventory(source, target, original, invalid)
		, /metadata must remain unchanged/u);
	const wrong = structuredClone(promoted); wrong.profiles[0].context += " rewrite";
	await assert.rejects(stagePromotionInventory(source, target, original, wrong));
});

test("evidence refresh preserves full unselected entries and every support byte", async t => {
	const root = await directory(t), source = join(root, "source.json");
	const target = join(root, "staged.json"), value = fixture();
	await writeFile(source, bytes(value));
	const original = await read(value), refreshed = structuredClone(original.document);
	const replacement = { ...entry("second"), scope: "Updated evidence: λ, 🭼, ◆."
		, revision: "b".repeat(40) };
	refreshed.evidence[1] = replacement;
	const identity = await stageEvidenceRefresh(source, target, original, refreshed);
	const expected = bytes({ ...value, evidence: [value.evidence[0], replacement] });
	assert.deepEqual(await readFile(target), expected);
	assert.deepEqual(identity, { bytes: expected.length, sha256: sha256(expected) });
	assert.deepEqual(await readFile(source), bytes(value));
	assert.equal((await read(expected)).document.evidence[0].files.length, 1);
	assert.equal(JSON.parse(expected).evidence[0].files.length, 2);
});

test("evidence refresh rejects support changes, replacement drift and malformed selections", async t => {
	const root = await directory(t), source = join(root, "source.json");
	const target = join(root, "staged.json"), value = fixture();
	await writeFile(source, bytes(value));
	const original = await read(value), refreshed = structuredClone(original.document);
	refreshed.evidence[0] = { ...entry("first"), scope: "New evidence" };
	for(const mutate of [
		item => { item.profiles[0].context += " changed"; }
		, item => { item.evidence.push(entry("new")); }
		, item => { item.evidence.pop(); }
		, item => { item.evidence.reverse(); }
		, item => { item.observations.push({ id: "new-support" }); }
		, item => { item.evidence[0].files[1].sha256 = "invalid"; }
	]) {
		const changed = structuredClone(refreshed); mutate(changed);
		await assert.rejects(stageEvidenceRefresh(source, target, original, changed));
	}
	await assert.rejects(stageEvidenceRefresh(source, target, original, original.document)
		, /must replace evidence/u);
	const invalid = { ...original, evidenceRanges: original.evidenceRanges.toReversed() };
	await assert.rejects(stageEvidenceRefresh(source, target, invalid, refreshed));
	await assert.rejects(stageEvidenceRefresh(source, target, original, refreshed, 100)
		, /file size limit/u);
	await writeFile(source, bytes({ ...value, evidence: [entry("first"), { ...entry("second"), scope: "Changed after preflight" }] }));
	await assert.rejects(stageEvidenceRefresh(source, target, original, refreshed)
		, /changed after preflight/u);
	assert.deepEqual(await readdir(root), ["source.json"]);
	await writeFile(source, bytes(value));
	await writeFile(target, "Keep this user file");
	await assert.rejects(stageEvidenceRefresh(source, target, original, refreshed), { code: "EEXIST" });
	assert.equal(await readFile(target, "utf8"), "Keep this user file");
});
