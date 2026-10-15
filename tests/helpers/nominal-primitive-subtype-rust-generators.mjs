/**
 * Reuse the frozen Rust generator closure with the primitive fixture's crate name.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalSubtypeRustGenerator, nominalSubtypeRustOriginal } from "./nominal-subtype-rust-generators.mjs";

export const nominalPrimitiveSubtypeRustOriginal = nominalSubtypeRustOriginal;

/**
 * Keep every dependency and generator byte; substitute only the fixture identity.
 *
 * @param revision - Full immutable producer revision.
 */
export const nominalPrimitiveSubtypeRustGenerator = async revision => {
	const original = await nominalSubtypeRustGenerator(revision);
	const before = 'name = "nominalsubtypes"\nversion = "1.0.0"';
	assert.equal(original.lock.split(before).length, 2);
	return Object.freeze({ ...original
		, lock: original.lock.replace(before, 'name = "nominalprimitivesubtypes"\nversion = "1.0.0"') });
};
