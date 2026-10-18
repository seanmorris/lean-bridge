/**
 * Source-only controls for inherited checked-record Perl model mutations.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	inheritedCheckedRecordPerlModelMutations
} from "./inherited-checked-record-perl-controls.mjs";

test("inherited checked-record Perl controls keep mode-specific mutations", () => {
	assert.deepEqual(inheritedCheckedRecordPerlModelMutations("full")
		.map(([label]) => label), [
		"wrong native word width", "omitted export", "changed extractor"
		, "changed Fin bound", "invented result constructor"
		, "unreviewed parameter constructor"]
	);
	assert.deepEqual(inheritedCheckedRecordPerlModelMutations("result-only")
		.map(([label]) => label), [
		"wrong native word width", "omitted export", "changed extractor"
		, "changed Fin bound", "invented result constructor"]
	);
	assert.throws(() => inheritedCheckedRecordPerlModelMutations("unknown"));
});
