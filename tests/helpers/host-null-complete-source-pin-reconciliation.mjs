/**
 * Reconcile the exact current-source pins that precede complete HostNull
 * publication. Earlier Core repair may already have advanced the shared Perl
 * validator, while direct proof-erasure publication introduced the current
 * type-document generator beside older evidence pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	hostNullPerlPreviousSourceSha256, hostNullPerlRequalifiedEvidenceIds
	, hostNullPerlSharedSource
} from "./host-null-complete-perl-evidence-refresh.mjs";

export const hostNullTypeDocsSharedSource
	= "scripts/generate-type-docs.mjs";
export const hostNullTypeDocsPreviousSourceSha256
	= "a63a20974d519554c073ab4b13653d8c887398de23de5bc31c4a691ca080f61f";
export const hostNullTypeDocsEvidenceCount = 132;
export const hostNullTypeDocsStalePinCount = 131;
export const hostNullPublishedTypeDocsEvidenceCount = 133;
export const hostNullPublishedSourcePinEvidenceCount = 136;

const publicationState = inventory => {
	const published = inventory.evidence.some(entry =>
		entry.id === "hosted-host-null-complete-installed");
	return Object.freeze({
		published
		, typeDocsEvidenceCount: published
			? hostNullPublishedTypeDocsEvidenceCount
			: hostNullTypeDocsEvidenceCount
		, sourcePinEvidenceCount: published
			? hostNullPublishedSourcePinEvidenceCount : 135
		, staleTypeDocsPinCount: published ? 0 : hostNullTypeDocsStalePinCount
	});
};

const exactReference = reference => {
	assert.equal(reference.id, "hosted-host-null-complete-installed");
	assert.match(reference.revision, /^[a-f0-9]{40}$/u);
};

/**
 * Select every complete evidence entry needed for the bounded refresh.
 *
 * @param inventory - Complete type-surface inventory.
 */
export const hostNullCompleteSourcePinEvidenceIds = inventory => {
	assert.ok(Array.isArray(inventory?.evidence));
	const state = publicationState(inventory);
	const perl = new Set(hostNullPerlRequalifiedEvidenceIds);
	const selected = inventory.evidence.filter(entry =>
		perl.has(entry.id) || entry.files.some(file =>
			file.path === hostNullTypeDocsSharedSource));
	assert.equal(selected.filter(entry => entry.files.some(file =>
		file.path === hostNullTypeDocsSharedSource)).length
	, state.typeDocsEvidenceCount);
	for(const id of perl)
		assert.equal(selected.filter(entry => entry.id === id).length, 1, id);
	assert.equal(new Set(selected.map(entry => entry.id)).size, selected.length);
	assert.equal(selected.length, state.sourcePinEvidenceCount);
	return Object.freeze(selected.map(entry => entry.id));
};

/**
 * Advance only recognized stale Perl and type-document source pins. Already
 * current pins remain byte-identical; unknown intermediates fail closed.
 *
 * @param inventory - Full retained evidence projection.
 * @param reference - Independently replayed complete HostNull reference.
 * @param current - Exact current source digests.
 * @param current.perl - Shared Perl validator digest.
 * @param current.typeDocs - Type-document generator digest.
 */
export const reconcileHostNullCompleteSourcePins = (
	inventory, reference, current
) => {
	exactReference(reference);
	assert.deepEqual(Object.keys(current).sort(), ["perl", "typeDocs"]);
	for(const digest of Object.values(current))
		assert.match(digest, /^[a-f0-9]{64}$/u);
	assert.notEqual(current.perl, hostNullPerlPreviousSourceSha256);
	assert.notEqual(current.typeDocs, hostNullTypeDocsPreviousSourceSha256);
	const state = publicationState(inventory);
	const retainedEvidenceIds = hostNullCompleteSourcePinEvidenceIds(inventory);
	const retained = new Set(retainedEvidenceIds);
	const refreshed = structuredClone(inventory);
	let refreshedPins = 0;
	const refreshedEvidence = new Set();
	let typeDocsPins = 0, staleTypeDocsPins = 0;
	for(const entry of refreshed.evidence)
	{
		if(!retained.has(entry.id)) continue;
		const perlFiles = entry.files.filter(file =>
			file.path === hostNullPerlSharedSource);
		if(hostNullPerlRequalifiedEvidenceIds.includes(entry.id))
		{
			assert.equal(perlFiles.length, 1, entry.id);
			const file = perlFiles[0];
			assert.ok([hostNullPerlPreviousSourceSha256, current.perl]
				.includes(file.sha256), entry.id);
			if(file.sha256 !== current.perl)
			{
				file.sha256 = current.perl;
				refreshedPins++; refreshedEvidence.add(entry.id);
			}
		}
		const typeDocsFiles = entry.files.filter(file =>
			file.path === hostNullTypeDocsSharedSource);
		assert.ok(typeDocsFiles.length <= 1, entry.id);
		if(typeDocsFiles.length === 0) continue;
		typeDocsPins++;
		const file = typeDocsFiles[0];
		assert.ok([hostNullTypeDocsPreviousSourceSha256, current.typeDocs]
			.includes(file.sha256), entry.id);
		if(file.sha256 !== current.typeDocs)
		{
			file.sha256 = current.typeDocs;
			staleTypeDocsPins++; refreshedPins++;
			refreshedEvidence.add(entry.id);
		}
	}
	assert.equal(typeDocsPins, state.typeDocsEvidenceCount);
	assert.equal(staleTypeDocsPins, state.staleTypeDocsPinCount);
	assert.ok(refreshedPins >= state.staleTypeDocsPinCount);
	return Object.freeze({
		inventory: refreshed, retainedEvidenceIds
		, refreshedEvidence: refreshedEvidence.size, refreshedPins
	});
};
