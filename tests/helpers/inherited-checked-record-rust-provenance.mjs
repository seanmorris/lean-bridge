/**
 * Frozen identities for hosted inherited checked-record Rust evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordRustEvidenceSources
} from "./inherited-checked-record-rust-evidence-sources.mjs";

export const inheritedCheckedRecordRustEvidence
	= "docs/evidence/inherited-checked-record-rust-20261017";
export const inheritedCheckedRecordRustProducer
	= "d9e8b1198061273eb65b47753f76dec7522aa8bc";
export const inheritedCheckedRecordRustChecker
	= "d9e8b1198061273eb65b47753f76dec7522aa8bc";
export const inheritedCheckedRecordRustArchiver
	= "a1b07e11c3c05f4efb5d2facf5f0d98efe2baa33";
export const inheritedCheckedRecordRustEvidenceLoadCeiling = 8;
export const inheritedCheckedRecordRustEvidenceFloor = "2.38";
export const inheritedCheckedRecordRustSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordRustPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordRustProducer
		, checker: inheritedCheckedRecordRustChecker
		, archiver: inheritedCheckedRecordRustArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record Rust ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordRustSelectedSources = () =>
	inheritedCheckedRecordRustEvidenceSources(
		inheritedCheckedRecordRustPinnedRevisions());
