/**
 * Cached historical hashes have the same inputs and failures as uncached SHA-256.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 as uncachedSha256 } from "../../src/capsule/node.mjs";
import { createSourceHistoryDigest, sha256 } from "./source-history-digest.mjs";

test("history digests preserve exact Unicode text and rehash mutable bytes", () => {
	let calls = 0;
	const digest = createSourceHistoryDigest(input => { calls++; return uncachedSha256(input); });
	for(const source of ["", "a", "a\0", "🙂", "\ud800", "\ufffd", "é", "e\u0301"])
	{
		const expected = uncachedSha256(source), count = calls;
		assert.equal(digest(source), expected); assert.equal(digest(source), expected);
		assert.equal(sha256(source), expected); assert.equal(calls, count + 1);
	}
	const bytes = Buffer.from("current"), count = calls, first = digest(bytes);
	bytes[0] = 0; assert.notEqual(digest(bytes), first);
	assert.equal(digest(bytes), uncachedSha256(bytes)); assert.equal(calls, count + 3);
});

test("history digest cache independently bounds entries and retained string bytes", () => {
	let calls = 0;
	const entry = createSourceHistoryDigest(input => { calls++; return uncachedSha256(input); }, { maxEntries: 2 });
	entry("a"); entry("b"); entry("a"); entry("c"); entry("a"); assert.equal(calls, 3);
	entry("b"); assert.equal(calls, 4);
	const byte = createSourceHistoryDigest(input => { calls++; return uncachedSha256(input); }, { maxBytes: 130 });
	byte("a"); byte("a"); assert.equal(calls, 5);
	byte("b"); byte("a"); assert.equal(calls, 7);
	byte("oversized"); byte("oversized"); assert.equal(calls, 9);
	byte("a"); assert.equal(calls, 9, "Oversized bypass does not evict a useful digest");
});

test("history digest cache preserves failures, bypasses objects and can be disabled", () => {
	for(const options of [{ maxEntries: 0 }, { maxBytes: 0 }])
	{
		let calls = 0;
		const digest = createSourceHistoryDigest(() => { calls++; return "hash"; }, options);
		digest("same"); digest("same"); assert.equal(calls, 2);
	}
	const failure = new Error("original failure"); let calls = 0;
	const fail = createSourceHistoryDigest(() => { calls++; throw failure; });
	for(let attempt = 0; attempt < 2; attempt++) assert.throws(() => fail("same"), error => error === failure);
	assert.equal(calls, 2);
	const mutable = createSourceHistoryDigest(() => { calls++; return {}; });
	assert.notEqual(mutable("same"), mutable("same")); assert.equal(calls, 4);
	assert.throws(() => createSourceHistoryDigest(null), TypeError);
	for(const key of ["maxBytes", "maxEntries"])
		for(const value of [-1, 0.5, NaN, Infinity, "2", Number.MAX_SAFE_INTEGER + 1])
			assert.throws(() => createSourceHistoryDigest(uncachedSha256, { [key]: value }), TypeError);
});
