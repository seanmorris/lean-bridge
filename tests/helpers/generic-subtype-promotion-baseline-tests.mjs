/**
 * Authenticate immutable regression inputs without freezing production code.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	assertGenericSubtypePromotionBaseline, genericSubtypePromotionBaselinePath
	, genericSubtypePromotionBaselineText, genericSubtypePromotionBaselineDocumentation
} from "./generic-subtype-promotion-baseline.mjs";
import { renderGenericSubtypeDocumentation } from "./generic-subtype-documentation.mjs";
import { gitSourceBytes, readSmallHistorySource } from "./source-history-stream.mjs";

const record = JSON.parse(await readFile(genericSubtypePromotionBaselinePath, "utf8"));

test("generic promotion baseline authenticates the complete immutable input selection", async () => {
	assert.equal(assertGenericSubtypePromotionBaseline(record), record);
	assert.equal(record.sources.length, 17);
	const sources = await genericSubtypePromotionBaselineDocumentation();
	assert.equal(Object.keys(sources).length, 14);
	const rendered = renderGenericSubtypeDocumentation(sources);
	assert.ok(Object.values(rendered).every(source => source.includes("hosted generic-Subtype matrix")));
	assert.ok(Object.values(sources).every(source => !source.includes("hosted generic-Subtype matrix")));
	const schema = JSON.parse(await genericSubtypePromotionBaselineText("schema/binding-ir.schema.json"));
	assert.equal(schema.properties.schemaVersion.const, 3);
});

test("generic promotion baseline rejects missing, reordered and substituted identities", async () => {
	for(const mutate of [
		value => { value.sourceCommit = "0".repeat(40); }
		, value => { value.sources.pop(); }
		, value => { value.sources.reverse(); }
		, value => { value.sources[0].path = "../escape"; }
		, value => { value.sources[0].bytes = -1; }
		, value => { value.sources[0].sha256 = "invalid"; }
		, value => { value.sources[0].unchecked = true; }
		, value => { value.extra = true; }
	]) {
		const value = structuredClone(record); mutate(value);
		assert.throws(() => assertGenericSubtypePromotionBaseline(value), assert.AssertionError);
	}
	for(const field of ["bytes", "sha256"])
	{
		const value = structuredClone(record), selected = value.sources[1];
		selected[field] = field === "bytes" ? selected.bytes + 1 : "0".repeat(64);
		await assert.rejects(genericSubtypePromotionBaselineText(selected.path, value), assert.AssertionError);
	}
	await assert.rejects(genericSubtypePromotionBaselineText("docs/type-surface.v1.json"));
	await assert.rejects(genericSubtypePromotionBaselineText("unknown.md"));
});

test("historical source streaming rejects invalid Git selection and child failure", async () => {
	const empty = { bytes: 0, sha256: sha256("") };
	await assert.rejects(readSmallHistorySource(gitSourceBytes("HEAD", "file"), empty));
	await assert.rejects(readSmallHistorySource(gitSourceBytes(record.sourceCommit, "../file"), empty));
	await assert.rejects(readSmallHistorySource(gitSourceBytes("0".repeat(40), "file"), empty)
		, /Git source read failed/u);
});

test("small historical sources retain hard size and UTF-8 bounds", async () => {
	const value = Buffer.from("λ ◆ 🭼\n"), expected = { bytes: value.length, sha256: sha256(value) };
	assert.equal(await readSmallHistorySource(Readable.from([value]), expected), value.toString());
	await assert.rejects(readSmallHistorySource(Readable.from([value]), expected, 1));
	await assert.rejects(readSmallHistorySource(Readable.from([value, value]), expected));
	await assert.rejects(readSmallHistorySource(Readable.from([value.subarray(1)]), expected));
	const invalid = Buffer.from([0xff]);
	await assert.rejects(readSmallHistorySource(Readable.from([invalid])
		, { bytes: 1, sha256: sha256(invalid) }), /encoded data/u);
});
