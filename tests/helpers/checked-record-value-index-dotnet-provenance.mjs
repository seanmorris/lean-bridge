/**
 * Frozen identities for hosted value-index checked-record .NET evidence.
 * Null pins keep both archive validation and support claims fail-closed.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	checkedRecordValueIndexDotnetEvidenceSources
} from "./checked-record-value-index-dotnet-evidence-sources.mjs";

export const checkedRecordValueIndexDotnetEvidence
	= "docs/evidence/checked-record-value-index-dotnet-20261018";
export const checkedRecordValueIndexDotnetProducer
	= "59d50c538589be9f2fd2460a7e4a1d383130ff00";
export const checkedRecordValueIndexDotnetConsumer
	= "59d50c538589be9f2fd2460a7e4a1d383130ff00";
export const checkedRecordValueIndexDotnetChecker
	= "59d50c538589be9f2fd2460a7e4a1d383130ff00";
export const checkedRecordValueIndexDotnetArchiver
	= "48bf81cd13da3c526d6ad7f37cb968e5a5a4a948";
export const checkedRecordValueIndexDotnetEvidenceLoadCeiling = 6;
export const checkedRecordValueIndexDotnetEvidenceFloor = "2.38";
export const checkedRecordValueIndexDotnetSelections = Object.freeze([
	"ordinary-source", "reviewed-ir"
	, "result-only-ordinary-source", "result-only-reviewed-ir"
]);

/** Require all four source identities before reading archived evidence. */
export const checkedRecordValueIndexDotnetPinnedRevisions = () => {
	const revisions = {
		producer: checkedRecordValueIndexDotnetProducer
		, consumer: checkedRecordValueIndexDotnetConsumer
		, checker: checkedRecordValueIndexDotnetChecker
		, archiver: checkedRecordValueIndexDotnetArchiver
	};
	for(const [role, revision] of Object.entries(revisions))
		assert.match(revision ?? "", /^[a-f0-9]{40}$/u
			, `Pin the value-index checked-record .NET ${role} revision first`);
	return revisions;
};

/** Frozen source list for producer, consumer, checker, and archiver roles. */
export const checkedRecordValueIndexDotnetSelectedSources = () =>
	checkedRecordValueIndexDotnetEvidenceSources(
		checkedRecordValueIndexDotnetPinnedRevisions());
