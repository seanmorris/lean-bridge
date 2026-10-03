/**
 * Atomically publish the optional extension only from complete original evidence.
 * Supply ordinary/no-host TAP+exit, remaining-three TAP+exit, verifier TAP+exit.
 *
 * @file
 */
import assert from "node:assert/strict";
import { link, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { packOwnedCallbackReports } from "../tests/helpers/owned-callback-result-evidence.mjs";
import { ownedPerlCallbackVariantReports } from "../tests/helpers/owned-perl-callback-result-variant-evidence.mjs";
import { assertOwnedPerlCallbackVariantHandoff } from "../tests/helpers/owned-perl-callback-result-variant-archives.mjs";
import { perlVariantBaseline, perlVariantHistoryPath, perlVariantHistorySha256
	, perlVariantPredecessor } from "../tests/helpers/owned-perl-callback-result-variant-history.mjs";
import { assertPerlVariantAcceptance, perlVariantEvidencePath, perlVariantSourcePaths
	, perlVariantScope, perlVariantExcluded, perlVariantRunSlots
	, perlVariantVerificationCommand } from "../tests/helpers/owned-perl-callback-result-variant-acceptance.mjs";

const arguments_ = process.argv.slice(2);
assert.equal(arguments_.length, 6, "Supply three original TAP path/observed exit pairs.");
const log = async index => {
	const path = arguments_[index * 2], code = arguments_[index * 2 + 1];
	assert.match(code, /^(?:0|[1-9][0-9]*)$/u);
	const exitCode = Number(code); assert.ok(Number.isSafeInteger(exitCode));
	const text = await readFile(path, "utf8"); return { exitCode, sha256: sha256(text), text };
};
const reports = {}, handoffs = {}, directory = "build/owned-perl-callback-result-variants";
for(const name of ownedPerlCallbackVariantReports)
{
	const bytes = await readFile(join(directory, name)), report = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(report), "Preserve exact original report bytes.");
	reports[name] = report;
	handoffs[name] = await assertOwnedPerlCallbackVariantHandoff(report, join(directory, report.savedHandoff.split("/").at(-1)));
}
for(const excluded of perlVariantExcluded) assert.equal(sha256(await readFile(excluded.path)), excluded.sha256);
const sources = {};
for(const path of await perlVariantSourcePaths()) sources[path] = sha256(await readFile(path));
const runs = [];
for(const [index, slot] of perlVariantRunSlots.entries()) runs.push({ ...slot, ...await log(index) });
const record = { schemaVersion: 1, kind: "owned-perl-callback-result-variants"
	, acceptance: "passed"
	, baselineRevision: perlVariantBaseline, previous: perlVariantPredecessor
	, scope: perlVariantScope
	, sourceHistory: { path: perlVariantHistoryPath, sha256: perlVariantHistorySha256 }
	, excluded: perlVariantExcluded, sources, runs
	, verification: { command: perlVariantVerificationCommand, ...await log(2) }
	, handoffs, archive: packOwnedCallbackReports(reports) };
await assertPerlVariantAcceptance(record);
const bytes = JSON.stringify(record, null, 2) + "\n";
const staging = await mkdtemp(join(dirname(perlVariantEvidencePath), ".perl-optional-acceptance-"));
try
{
	const temporary = join(staging, "receipt.json"), handle = await open(temporary, "wx");
	try
	{ await handle.writeFile(bytes); await handle.sync(); }
	finally
	{ await handle.close(); }
	await link(temporary, perlVariantEvidencePath);
}
finally
{ await rm(staging, { recursive: true, force: true }); }
process.stdout.write(`${perlVariantEvidencePath}: ${sha256(bytes)}\n`);
