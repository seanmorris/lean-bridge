/**
 * Keep the current C/C++ host-reply documentation contract eager.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	nativeFinReplyPromotionDirections, nativeFinReplyPromotionFailure
	, nativeFinReplyPromotionLimit
} from "./native-fin-reply-promotion-references.mjs";

test("C/C++ conversion tables distinguish ordinary contained host replies from earlier reviewed closure directions", async () => {
	for(const profile of ["c", "cpp"])
	{
		const text = await readFile(`docs/consume/${profile}.md`, "utf8"), row = text.split("\n").find(line => line.startsWith("| `Fin n` |"));
		for(const required of [nativeFinReplyPromotionDirections, nativeFinReplyPromotionFailure, nativeFinReplyPromotionLimit]) assert.ok(row.includes(required), required);
		assert.ok(text.includes("../evidence/native-fin-replies-20261008/receipt.json"));
		assert.ok(row.includes("callback-result coverage here means results produced by Lean"), "retain the separate reviewed observation's direction");
	}
});
