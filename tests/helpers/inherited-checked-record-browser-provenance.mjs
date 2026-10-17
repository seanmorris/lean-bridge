/**
 * Frozen identities for inherited checked-record npm/browser evidence.
 * Null pins make both archiving and verification fail closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	inheritedCheckedRecordBrowserEvidenceSources
} from "./inherited-checked-record-browser-evidence-sources.mjs";

export const inheritedCheckedRecordBrowserEvidence
	= "docs/evidence/inherited-checked-record-browser-20261017";
export const inheritedCheckedRecordBrowserProducer
	= "a1b07e11c3c05f4efb5d2facf5f0d98efe2baa33";
export const inheritedCheckedRecordBrowserNpmChecker
	= "a1b07e11c3c05f4efb5d2facf5f0d98efe2baa33";
export const inheritedCheckedRecordBrowserConsumer
	= "a1b07e11c3c05f4efb5d2facf5f0d98efe2baa33";
export const inheritedCheckedRecordBrowserChecker
	= "a1b07e11c3c05f4efb5d2facf5f0d98efe2baa33";
export const inheritedCheckedRecordBrowserArchiver
	= "b60f994450a8e45cc6d7023ecdb7cdc9c85bfbb2";
export const inheritedCheckedRecordBrowserLoadCeiling = 8;

/** Require all five source identities before reading archived evidence. */
export const inheritedCheckedRecordBrowserPinnedRevisions = () => {
	const revisions = {
		producer: inheritedCheckedRecordBrowserProducer
		, npmChecker: inheritedCheckedRecordBrowserNpmChecker
		, consumer: inheritedCheckedRecordBrowserConsumer
		, checker: inheritedCheckedRecordBrowserChecker
		, archiver: inheritedCheckedRecordBrowserArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the inherited checked-record browser ${role} revision first`);
	return revisions;
};

/** Frozen source list for all producer, consumer, checker and archive roles. */
export const inheritedCheckedRecordBrowserSelectedSources = () =>
	inheritedCheckedRecordBrowserEvidenceSources(
		inheritedCheckedRecordBrowserPinnedRevisions());
