/**
 * Frozen identities for hosted inherited checked-record PHP-Wasm evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordPhpWasmEvidenceSources
} from "./inherited-checked-record-php-wasm-evidence-sources.mjs";
import {
	inheritedCheckedRecordPhpWasmSelections
} from "./inherited-checked-record-php-wasm-selections.mjs";

export const inheritedCheckedRecordPhpWasmEvidence
	= "docs/evidence/inherited-checked-record-php-wasm-20261017";
export const inheritedCheckedRecordPhpWasmProducer
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordPhpWasmChecker
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordPhpWasmArchiver
	= "7cf1c5f993e8cdb1ce68265891b9c00a8950fb7d";
export const inheritedCheckedRecordPhpWasmLoadCeiling = 8;
export { inheritedCheckedRecordPhpWasmSelections };

/** Require all three source identities before reading archived evidence. */
export const inheritedCheckedRecordPhpWasmPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordPhpWasmProducer
		, checker: inheritedCheckedRecordPhpWasmChecker
		, archiver: inheritedCheckedRecordPhpWasmArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record PHP-Wasm ${role} revision first`);
	return revisions;
};

/** Frozen source list for the producer, checker, and archive roles. */
export const inheritedCheckedRecordPhpWasmSelectedSources = () =>
	inheritedCheckedRecordPhpWasmEvidenceSources(
		inheritedCheckedRecordPhpWasmPinnedRevisions()
	);
