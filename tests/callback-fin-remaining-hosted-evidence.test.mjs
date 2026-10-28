/**
 * Verify retained managed/WIT callback-Fin artifacts independently.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	extractCheckedRecordValueIndexHostedArtifact
} from "./helpers/checked-record-value-index-hosted-archive.mjs";
import {
	callbackFinRemainingVerification
} from "./helpers/callback-fin-remaining-ci.mjs";
import {
	callbackFinRemainingHostedEvidenceDirectory
} from "./helpers/callback-fin-remaining-hosted-archive.mjs";
import {
	assertCallbackFinRemainingHostedEvidence
	, assertCallbackFinRemainingHostedIndex
	, callbackFinRemainingHostedIndexPath
} from "./helpers/callback-fin-remaining-hosted-evidence.mjs";
import {
	verifyCallbackFinRetainedPackages
} from "./helpers/callback-fin-retained-packages.mjs";

const indexBytes = await readFile(callbackFinRemainingHostedIndexPath);
const index = JSON.parse(indexBytes);
const read = path => readFile(join(
	callbackFinRemainingHostedEvidenceDirectory, path
));

test("retained managed callback Fin evidence replays every original artifact", async () => {
	assert.equal(indexBytes.toString(), canonicalJson(index));
	await assertCallbackFinRemainingHostedEvidence(index, read);
	for(const lane of index.lanes)
	{
		const parts = [];
		for(const part of lane.hostedRun.artifact.parts)
		{
			const bytes = await read(part.path);
			assert.equal(bytes.length, part.bytes, part.path);
			assert.equal(sha256(bytes), part.sha256, part.path);
			parts.push(bytes);
		}
		const original = Buffer.concat(parts);
		assert.equal(original.length, lane.hostedRun.artifact.bytes);
		assert.equal(sha256(original), lane.hostedRun.artifact.sha256);
		const temporary = await mkdtemp(join(
			tmpdir(), `lean-bridge-retained-callback-fin-${lane.id}-`));
		let extracted;
		try
		{
			const zip = join(temporary, "artifact.zip");
			await writeFile(zip, original);
			extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
			assert.deepEqual(extracted.entries
				, lane.hostedRun.artifact.members);
			const recordsRoot = join(extracted.root
				, `callback-fin-remaining-ci-${lane.id}`);
			const tap = await readFile(join(recordsRoot, "acceptance.tap")
				, "utf8");
			const report = JSON.parse(await readFile(
				join(recordsRoot, "report.json"), "utf8"));
			const checked = {
				...callbackFinRemainingVerification(
					index.producerCommit, lane.profiles, tap, report)
				, retainedPackages: await verifyCallbackFinRetainedPackages(
					recordsRoot, report)
			};
			assert.deepEqual(checked, lane.accepted);
			assert.equal((await readFile(join(recordsRoot
				, "verification.json"))).toString(), canonicalJson(checked));
			for(const name of [
				"acceptance.tap", "report.json", "retained-packages.json"
				, "verification.json"
			]) assert.deepEqual(await read(`observations/${lane.id}/${name}`)
				, await readFile(join(recordsRoot, name)), `${lane.id}/${name}`);
		}
		finally
		{
			if(extracted) await rm(extracted.root, { recursive: true });
			await rm(temporary, { recursive: true });
		}
	}
});

test("retained managed callback Fin evidence refuses identity drift", () => {
	const changes = [
		value => { value.lanes[0].profiles = ["java"]; }
		, value => { value.lanes[0].hostedRun.artifact.parts[0].offset = 1; }
		, value => { value.files[0].sha256 = "not-a-digest"; }
		, value => { value.selectedSources[0].revision = "0".repeat(40); }
		, value => { value.producerCommit = "0".repeat(40); }
	];
	for(const change of changes)
	{
		const altered = structuredClone(index); change(altered);
		assert.throws(() => assertCallbackFinRemainingHostedIndex(altered)
			, assert.AssertionError);
	}
});
