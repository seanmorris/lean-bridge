/**
 * Require complete HostNull publication to repair only the recognized live
 * source-pin split and to tolerate the already-completed Perl repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	hostNullPerlPreviousSourceSha256, hostNullPerlRequalifiedEvidenceIds
	, hostNullPerlSharedSource
} from "./host-null-complete-perl-evidence-refresh.mjs";
import {
	hostNullCompleteSourcePinEvidenceIds
	, hostNullTypeDocsEvidenceCount, hostNullTypeDocsPreviousSourceSha256
	, hostNullTypeDocsSharedSource, hostNullTypeDocsStalePinCount
	, reconcileHostNullCompleteSourcePins
} from "./host-null-complete-source-pin-reconciliation.mjs";

const [document, perlSource, typeDocsSource] = await Promise.all([
	readFile("docs/type-surface.v1.json", "utf8").then(JSON.parse)
	, readFile(hostNullPerlSharedSource)
	, readFile(hostNullTypeDocsSharedSource)
]);
const reference = Object.freeze({
	id: "hosted-host-null-complete-installed", revision: "a".repeat(40)
});
const current = Object.freeze({
	perl: sha256(perlSource), typeDocs: sha256(typeDocsSource)
});

test("HostNull publication reconciles the one remaining current-source split", () => {
	const frozen = structuredClone(document);
	const selected = hostNullCompleteSourcePinEvidenceIds(document);
	assert.equal(selected.length, 135);
	const result = reconcileHostNullCompleteSourcePins(
		document, reference, current);
	assert.deepEqual(document, frozen);
	assert.deepEqual(result.retainedEvidenceIds, selected);
	assert.equal(result.refreshedPins, hostNullTypeDocsStalePinCount);
	assert.equal(result.refreshedEvidence, hostNullTypeDocsStalePinCount);
	assert.deepEqual(result.inventory.observations, document.observations);
	const typeDocs = result.inventory.evidence.flatMap(entry =>
		entry.files.filter(file => file.path === hostNullTypeDocsSharedSource));
	assert.equal(typeDocs.length, hostNullTypeDocsEvidenceCount);
	assert.deepEqual(new Set(typeDocs.map(file => file.sha256))
		, new Set([current.typeDocs]));
	for(const id of hostNullPerlRequalifiedEvidenceIds)
	{
		const file = result.inventory.evidence.find(entry => entry.id === id)
			.files.find(item => item.path === hostNullPerlSharedSource);
		assert.equal(file.sha256, current.perl, id);
	}
});

test("HostNull publication accepts the exact older Perl pins and rejects unknown ones", () => {
	const previous = structuredClone(document);
	for(const id of hostNullPerlRequalifiedEvidenceIds)
	{
		const file = previous.evidence.find(entry => entry.id === id)
			.files.find(item => item.path === hostNullPerlSharedSource);
		file.sha256 = hostNullPerlPreviousSourceSha256;
	}
	const result = reconcileHostNullCompleteSourcePins(
		previous, reference, current);
	assert.equal(result.refreshedPins
		, hostNullTypeDocsStalePinCount + hostNullPerlRequalifiedEvidenceIds.length);
	assert.equal(result.refreshedEvidence
		, hostNullTypeDocsStalePinCount
			+ hostNullPerlRequalifiedEvidenceIds.length - 2);
	const forged = structuredClone(document);
	forged.evidence.find(entry => entry.id === hostNullPerlRequalifiedEvidenceIds[0])
		.files.find(item => item.path === hostNullPerlSharedSource)
		.sha256 = "f".repeat(64);
	assert.throws(() => reconcileHostNullCompleteSourcePins(
		forged, reference, current));
	const forgedDocs = structuredClone(document);
	forgedDocs.evidence.find(entry => entry.files.some(file =>
		file.path === hostNullTypeDocsSharedSource)).files.find(file =>
		file.path === hostNullTypeDocsSharedSource).sha256 = "e".repeat(64);
	assert.throws(() => reconcileHostNullCompleteSourcePins(
		forgedDocs, reference, current));
	assert.throws(() => reconcileHostNullCompleteSourcePins(document
		, { ...reference, id: "forged" }, current));
	assert.throws(() => reconcileHostNullCompleteSourcePins(document
		, reference, { ...current, typeDocs: hostNullTypeDocsPreviousSourceSha256 }));
});
