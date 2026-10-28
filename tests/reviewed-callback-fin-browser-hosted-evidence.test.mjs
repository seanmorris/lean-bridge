/**
 * Verify the retained reviewed callback-Fin browser artifact independently.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import {
	extractCheckedRecordValueIndexHostedArtifact
} from "./helpers/checked-record-value-index-hosted-archive.mjs";
import {
	reviewedCallbackFinBrowserHostedEvidenceDirectory
} from "./helpers/reviewed-callback-fin-browser-hosted-archive.mjs";
import {
	assertReviewedCallbackFinBrowserHostedEvidence
	, reviewedCallbackFinBrowserHostedIndexPath
} from "./helpers/reviewed-callback-fin-browser-hosted-evidence.mjs";

const indexBytes = await readFile(reviewedCallbackFinBrowserHostedIndexPath);
const index = JSON.parse(indexBytes);
const read = path => readFile(
	join(reviewedCallbackFinBrowserHostedEvidenceDirectory, path)
);

test("retained reviewed callback Fin browser evidence replays independently", async () => {
	assert.equal(indexBytes.toString(), canonicalJson(index));
	const { original } = await assertReviewedCallbackFinBrowserHostedEvidence(
		index, read);
	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-retained-callback-fin-browser-"));
	let extracted;
	try
	{
		const zip = join(temporary, "artifact.zip");
		await writeFile(zip, original);
		extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
		assert.deepEqual(extracted.entries, index.hostedRun.artifact.members);
		for(const name of [
			"acceptance.tap", "r1.json", "r2.json", "runtime-after.json"
			, "runtime-before.json", "verification.json"
		]) assert.deepEqual(await read(`observations/${name}`), await readFile(
			join(extracted.root, "reviewed-callback-fin-browser-ci", name)
		), name);
	}
	finally
	{
		if(extracted) await rm(extracted.root, { recursive: true });
		await rm(temporary, { recursive: true });
	}
});

test("retained reviewed callback Fin evidence refuses identity drift", async () => {
	const changes = [
		value => { value.profiles = ["browser-javascript"]; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.selectedSources[0].revision = "0".repeat(40); }
		, value => { value.accepted.reports[0].review = "R2"; }
		, value => { value.hostedRun.artifact.parts[0].offset = 1; }
	];
	for(const change of changes)
	{
		const altered = structuredClone(index); change(altered);
		await assert.rejects(
			assertReviewedCallbackFinBrowserHostedEvidence(altered, read)
			, assert.AssertionError
		);
	}
});
