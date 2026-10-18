/**
 * The hosted supplemental primitive-base archive must fail closed until every
 * revision and retained-byte identity is pinned.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNominalPrimitiveSupplementEvidence
	, nominalPrimitiveSupplementArchiver
	, nominalPrimitiveSupplementChecker
	, nominalPrimitiveSupplementEvidence
	, nominalPrimitiveSupplementEvidenceSha256
	, nominalPrimitiveSupplementPinnedRevisions
	, nominalPrimitiveSupplementProducer
} from "./nominal-primitive-subtype-supplement-evidence.mjs";

const revisions = [
	nominalPrimitiveSupplementProducer, nominalPrimitiveSupplementChecker
	, nominalPrimitiveSupplementArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& nominalPrimitiveSupplementEvidenceSha256 !== null;
const script = "scripts/archive-nominal-primitive-subtype-supplement-evidence.mjs";

test("supplemental primitive-base hosted evidence fails closed before every pin", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => nominalPrimitiveSupplementPinnedRevisions()
		, /Pin the supplemental primitive-base archiver revision/u);
	await assert.rejects(checkNominalPrimitiveSupplementEvidence()
		, /Pin the supplemental primitive-base archiver revision/u);
	await assert.rejects(access(nominalPrimitiveSupplementEvidence), { code: "ENOENT" });
	for(const args of [[], ["--root"], ["--root", "relative"], ["--other", "/absolute"]])
	{
		const run = spawnSync(process.execPath, [script, ...args], {
			encoding: "utf8", env: { PATH: process.env.PATH }
		});
		assert.notEqual(run.status, 0); assert.match(run.stderr
			, /Usage: archive-nominal-primitive-subtype-supplement-evidence/u);
	}
});

test("supplemental primitive-base evidence authenticates the hosted ZIP and every replay", {
	skip: !pinned && "Runs after the hosted archive is pinned", timeout: 120_000
}, async () => {
	const checked = await checkNominalPrimitiveSupplementEvidence();
	assert.deepEqual({
		tests: checked.records.tests, npm: checked.records.npm
		, python: checked.records.python, browser: checked.records.browser
		, browserObservations: checked.records.browserObservations
	}, { tests: 11, npm: 2, python: 4, browser: 6, browserObservations: 102 });
	assert.equal(checked.hostedRun.artifact.id, 12122167697);
	for(const target of [
		"index.json", "api/run.json", "api/artifact.zip", "api/job.log"
		, "artifact/run.tap", "artifact/npm/ordinary/report.json"
		, "artifact/python/3.12/reviewed/report.json"
		, "artifact/browser/reviewed/browser-react/observations.json"
		, "sources/producer/tests/fixtures/nominal-primitive-subtype-consumers/javascript-supplement.mjs"
	]) await assert.rejects(checkNominalPrimitiveSupplementEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSupplementEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}), undefined, target);
});
