/**
 * Verify bounded JSON comparison semantics and diagnostics.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertJsonEqual, firstJsonDifference
} from "./bounded-json-equality.mjs";

test("bounded JSON equality accepts every JSON shape and ignores key order", () => {
	const actual = {
		text: "value", number: 3, boolean: true, nil: null
		, nested: [{ z: 1, a: [false, "end"] }]
	};
	const expected = {
		nested: [{ a: [false, "end"], z: 1 }], nil: null
		, boolean: true, number: 3, text: "value"
	};
	assert.equal(firstJsonDifference(actual, expected), undefined);
	assert.doesNotThrow(() => assertJsonEqual(actual, expected));
});

test("bounded JSON equality reports the first exact path", () => {
	assert.equal(firstJsonDifference(
		{ rows: [{ value: 1 }, { value: 2 }] }
		, { rows: [{ value: 1 }, { value: 3 }] }
	), "$.rows[1].value: 2 !== 3");
	for(const [actual, expected, pattern] of [
		[[1], [1, 2], /\$: length 1 !== 2/u]
		, [{ a: 1 }, { b: 1 }, /\$: unexpected key "a"/u]
		, [{ a: 1 }, [1], /\$: object !== array/u]
		, [Object.create(null), {}, /\$: non-JSON object/u]
	]) assert.throws(() => assertJsonEqual(actual, expected, "contract")
		, pattern);
});

test("bounded JSON equality never renders a complete wide value", () => {
	const actual = { rows: Array.from({ length: 100_000 }, (_, index) => index) };
	const expected = structuredClone(actual);
	expected.rows[expected.rows.length - 1] = -1;
	let message = "";
	try
	{ assertJsonEqual(actual, expected, "large inventory"); }
	catch(error)
	{
		assert.ok(error instanceof assert.AssertionError);
		message = error.message;
	}
	assert.match(message, /large inventory: \$\.rows\[99999\]: 99999 !== -1/u);
	assert.ok(message.length < 256, message.length);
});
