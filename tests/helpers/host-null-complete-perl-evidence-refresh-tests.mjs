/**
 * Admit only the exact five-entry Perl validator refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { validateTypeSurface } from "../../src/adoption/type-surface.mjs";
import {
	hostNullPerlPreviousSourceSha256, hostNullPerlRequalifiedEvidenceIds
	, hostNullPerlSharedSource
	, refreshHostNullPerlEvidence
} from "./host-null-complete-perl-evidence-refresh.mjs";

const [document, irSchema, consumers, source] = await Promise.all([
	readFile("docs/type-surface.v1.json", "utf8").then(JSON.parse)
	, readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
	, readFile(hostNullPerlSharedSource)
]);
const reference = Object.freeze({
	id: "hosted-host-null-complete-installed", revision: "a".repeat(40)
});
const previousDocument = structuredClone(document);
for(const id of hostNullPerlRequalifiedEvidenceIds)
{
	const entry = previousDocument.evidence.find(item => item.id === id);
	assert.ok(entry, id);
	const files = entry.files.filter(file =>
		file.path === hostNullPerlSharedSource);
	assert.equal(files.length, 1, id);
	assert.equal(files[0].sha256, sha256(source), id);
	files[0].sha256 = hostNullPerlPreviousSourceSha256;
}

test("HostNull refresh changes only five shared Perl source digests", () => {
	const frozen = structuredClone(previousDocument);
	const refreshed = refreshHostNullPerlEvidence(
		previousDocument, reference, sha256(source));
	assert.deepEqual(previousDocument, frozen);
	assert.equal(validateTypeSurface(refreshed, { irSchema, consumers }), true);
	assert.deepEqual(refreshed, document);
	const before = new Map(previousDocument.evidence.map(entry => [entry.id, entry]));
	const changed = refreshed.evidence.filter(entry =>
		JSON.stringify(entry) !== JSON.stringify(before.get(entry.id)));
	assert.deepEqual(changed.map(entry => entry.id)
		, hostNullPerlRequalifiedEvidenceIds);
	for(const entry of changed)
	{
		const previous = before.get(entry.id);
		assert.deepEqual(Object.keys(entry), Object.keys(previous));
		for(const key of Object.keys(entry))
			if(key !== "files") assert.deepEqual(entry[key], previous[key], key);
		const altered = entry.files.filter((file, index) =>
			JSON.stringify(file) !== JSON.stringify(previous.files[index]));
		assert.deepEqual(altered, [{
			path: hostNullPerlSharedSource, sha256: sha256(source)
		}]);
	}
	assert.deepEqual(refreshed.observations, document.observations);
});

test("HostNull Perl refresh rejects incomplete or forged inputs", () => {
	const digest = sha256(source);
	assert.throws(() => refreshHostNullPerlEvidence(previousDocument
		, { ...reference, id: "forged" }, digest));
	assert.throws(() => refreshHostNullPerlEvidence(previousDocument
		, { ...reference, revision: "forged" }, digest));
	assert.throws(() => refreshHostNullPerlEvidence(previousDocument, reference
		, hostNullPerlPreviousSourceSha256));
	const missing = structuredClone(previousDocument);
	missing.evidence = missing.evidence.filter(entry =>
		entry.id !== hostNullPerlRequalifiedEvidenceIds[0]);
	assert.throws(() => refreshHostNullPerlEvidence(
		missing, reference, digest));
});
