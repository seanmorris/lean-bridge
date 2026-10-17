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
export const inheritedCheckedRecordBrowserProducer = null;
export const inheritedCheckedRecordBrowserNpmChecker = null;
export const inheritedCheckedRecordBrowserConsumer = null;
export const inheritedCheckedRecordBrowserChecker = null;
export const inheritedCheckedRecordBrowserArchiver = null;
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
