/**
 * Keep callback Subtype archives bound to every hosted lane and the
 * exact source closure that produced and verifies it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	callbackSubtypeEvidenceSources
	, callbackSubtypeHostedLanes
	, callbackSubtypeHostedOriginal
} from "./helpers/callback-subtype-hosted-evidence-sources.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();

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

test("callback Subtype archive lanes retain closed source roles", () => {
	assert.deepEqual([...callbackSubtypeHostedLanes].sort()
		, Object.keys(expected).sort());
	for(const lane of callbackSubtypeHostedLanes)
	{
		const sources = callbackSubtypeEvidenceSources(lane, {
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
			assert.ok(callbackSubtypeHostedOriginal(
				source.revision, source.path).length > 0, source.path);
		}
		for(const name of expected[lane])
			assert.ok(sources.some(item => item.role === "consumer"
				&& item.path.endsWith(`/${name}`)), `${lane}/${name}`);
		for(const path of [
			"scripts/archive-callback-subtype-evidence.mjs"
			, "tests/helpers/callback-subtype-hosted-archive.mjs"
			, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
		]) assert.ok(sources.some(item => item.role === "archiver"
			&& item.path === path), `${lane}/${path}`);
	}
});

test("callback Subtype source selection rejects open lane and revision input", () => {
	assert.throws(() => callbackSubtypeEvidenceSources("other", {
		producer: revision, consumer: revision, checker: revision
		, archiver: revision
	}), assert.AssertionError);
	assert.throws(() => callbackSubtypeEvidenceSources("native", {
		producer: revision, consumer: revision, checker: "HEAD"
		, archiver: revision
	}), assert.AssertionError);
});
