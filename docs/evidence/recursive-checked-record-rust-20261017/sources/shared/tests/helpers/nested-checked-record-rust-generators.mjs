/**
 * Reuse the frozen Rust generator closure with the nested fixture's crate name.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalSubtypeRustGenerator, nominalSubtypeRustOriginal } from "./nominal-subtype-rust-generators.mjs";

export const nestedCheckedRecordRustOriginal = nominalSubtypeRustOriginal;

/**
 * Keep every dependency and generator byte; substitute only the fixture identity.
 *
 * @param revision - Full immutable producer revision.
 */
export const nestedCheckedRecordRustGenerator = async revision => {
	const original = await nominalSubtypeRustGenerator(revision);
	const before = 'name = "nominalsubtypes"\nversion = "1.0.0"';
	assert.equal(original.lock.split(before).length, 2);
	return Object.freeze({ ...original
		, lock: original.lock.replace(before, 'name = "nestedcheckedrecords"\nversion = "1.0.0"') });
};
