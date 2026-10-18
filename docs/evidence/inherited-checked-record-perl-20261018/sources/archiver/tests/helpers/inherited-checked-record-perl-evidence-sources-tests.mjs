/**
 * Authenticate the inherited checked-record Perl evidence source closure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	inheritedCheckedRecordPerlEvidenceOriginal
	, inheritedCheckedRecordPerlEvidenceSources
} from "./inherited-checked-record-perl-evidence-sources.mjs";

test("inherited checked-record Perl evidence names every producer and verifier source", {
	timeout: 120_000
}, async () => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf8"
	}).trim();
	const sources = await inheritedCheckedRecordPerlEvidenceSources({
		producer: revision, checker: revision, archiver: revision
	});
	assert.ok(sources.length > 100);
	assert.equal(new Set(sources.map(item =>
		`${item.role}:${item.path}`)).size, sources.length);
	for(const item of sources)
	{
		assert.ok(["producer", "checker", "archiver"].includes(item.role));
		assert.equal(item.revision, revision);
		assert.ok(inheritedCheckedRecordPerlEvidenceOriginal(
			item.revision, item.path
		).length > 0);
	}
	for(const [role, path] of [
		["producer", ".github/workflows/inherited-checked-record-perl.yml"]
		, ["producer", "scripts/build-perl-toolchains.mjs"]
		, ["producer", "tests/fixtures/inherited-checked-record-consumers/perl.pl"]
		, ["producer", "tests/helpers/inherited-checked-record-perl-model.pl"]
		, ["checker", "scripts/check-inherited-checked-record-perl-ci.mjs"]
		, ["archiver", "scripts/archive-inherited-checked-record-perl-evidence.mjs"]
		, ["archiver", "tests/inherited-checked-record-perl-evidence.test.mjs"]
	]) assert.ok(sources.some(item =>
		item.role === role && item.path === path), `${role}:${path}`);
});
