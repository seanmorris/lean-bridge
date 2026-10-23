/**
 * Keep callback checked-record archives bound to every hosted lane and the
 * exact source closure that produced and verifies it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	callbackCheckedRecordArchiveRevisions
	, callbackCheckedRecordEvidenceSources
	, callbackCheckedRecordHostedEvidenceRoot
	, callbackCheckedRecordHostedLanes
	, callbackCheckedRecordHostedOriginal
} from "./helpers/callback-checked-record-hosted-evidence-sources.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
const hostedRevision = "1".repeat(40);

const expected = Object.freeze({
	browser: ["javascript.mjs", "types.mts"]
	, native: ["c.c", "cpp.cpp"]
	, languages: ["python.py", "ruby.rb", "rust.rs"]
	, perl: ["perl.pl"]
	, dotnet: ["dotnet.cs"]
	, jvm: ["java.java", "kotlin.kt"]
	, "php-native": ["php-native.php"]
	, "wit-wasi": ["wit-wasi.c"]
});

test("callback checked-record archive lanes retain closed source roles", () => {
	assert.deepEqual([...callbackCheckedRecordHostedLanes].sort()
		, Object.keys(expected).sort());
	assert.equal(callbackCheckedRecordHostedEvidenceRoot("browser")
		, "docs/evidence/callback-checked-record-browser-20261023");
	assert.throws(() => callbackCheckedRecordHostedEvidenceRoot("other")
		, assert.AssertionError);
	for(const lane of callbackCheckedRecordHostedLanes)
	{
		const sources = callbackCheckedRecordEvidenceSources(lane, {
			producer: revision, consumer: revision, checker: revision
			, archiver: revision
		});
		assert.deepEqual([...new Set(sources.map(item => item.role))].sort()
			, ["archiver", "checker", "consumer", "producer"]);
		assert.equal(new Set(sources.map(item =>
			`${item.role}/${item.path}`)).size, sources.length);
		for(const source of sources)
		{
			assert.equal(source.revision, revision);
			assert.ok(callbackCheckedRecordHostedOriginal(
				source.revision, source.path).length > 0, source.path);
		}
		for(const name of expected[lane])
			assert.ok(sources.some(item => item.role === "consumer"
				&& item.path.endsWith(`/${name}`)), `${lane}/${name}`);
		for(const path of [
			"scripts/archive-callback-checked-record-evidence.mjs"
			, "tests/helpers/callback-checked-record-hosted-archive.mjs"
			, "tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
		]) assert.ok(sources.some(item => item.role === "archiver"
			&& item.path === path), `${lane}/${path}`);
	}
});

test("callback archive provenance separates hosted execution from replay", () => {
	assert.deepEqual(callbackCheckedRecordArchiveRevisions(
		hostedRevision, revision
	), {
		producer: hostedRevision, consumer: hostedRevision
		, checker: revision, archiver: revision
	});
	assert.throws(() => callbackCheckedRecordArchiveRevisions(
		"HEAD", revision
	), assert.AssertionError);
});

test("callback checked-record source selection rejects open lane and revision input", () => {
	assert.throws(() => callbackCheckedRecordEvidenceSources("other", {
		producer: revision, consumer: revision, checker: revision
		, archiver: revision
	}), assert.AssertionError);
	assert.throws(() => callbackCheckedRecordEvidenceSources("native", {
		producer: revision, consumer: revision, checker: "HEAD"
		, archiver: revision
	}), assert.AssertionError);
});
