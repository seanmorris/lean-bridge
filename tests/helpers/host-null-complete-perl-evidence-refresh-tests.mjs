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

test("HostNull refresh changes only five shared Perl source digests", () => {
	const frozen = structuredClone(document);
	const refreshed = refreshHostNullPerlEvidence(
		document, reference, sha256(source));
	assert.deepEqual(document, frozen);
	assert.equal(validateTypeSurface(refreshed, { irSchema, consumers }), true);
	const before = new Map(document.evidence.map(entry => [entry.id, entry]));
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
	assert.throws(() => refreshHostNullPerlEvidence(document
		, { ...reference, id: "forged" }, digest));
	assert.throws(() => refreshHostNullPerlEvidence(document
		, { ...reference, revision: "forged" }, digest));
	assert.throws(() => refreshHostNullPerlEvidence(document, reference
		, hostNullPerlPreviousSourceSha256));
	const missing = structuredClone(document);
	missing.evidence = missing.evidence.filter(entry =>
		entry.id !== hostNullPerlRequalifiedEvidenceIds[0]);
	assert.throws(() => refreshHostNullPerlEvidence(
		missing, reference, digest));
});
