/**
 * Save an immutable Perl receipt only after complete execution verification.
 * Supply original TAP paths and observed exits in ownedPerlCallbackRuns order,
 * followed by the complete evidence suite. Never synthesize a missing TAP log.
 *
 * @file
 */
import assert from "node:assert/strict";
import { link, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { packOwnedCallbackReports } from "../tests/helpers/owned-callback-result-evidence.mjs";
import { ownedPerlCallbackResultReports } from "../tests/helpers/owned-perl-callback-result-ci.mjs";
import { ownedPerlCallbackBaseline, ownedPerlCallbackHistoryPath
	, ownedPerlCallbackHistorySha256 } from "../tests/helpers/owned-perl-callback-result-history.mjs";
import { assertOwnedPerlCallbackAcceptance, ownedPerlCallbackEvidencePath
	, ownedPerlCallbackPrevious, ownedPerlCallbackRuns, ownedPerlCallbackScope
	, ownedPerlCallbackSourcePaths } from "../tests/helpers/owned-perl-callback-result-acceptance.mjs";

const arguments_ = process.argv.slice(2);
assert.equal(arguments_.length, (ownedPerlCallbackRuns.length + 1) * 2,
	"Supply original TAP path and observed exit pairs: contracts, direct, faults, lifetime, mutants, sanitizers, installed, combined-release, verification");
const log = async index => {
	const path = arguments_[index * 2], code = arguments_[index * 2 + 1];
	assert.match(code, /^(?:0|[1-9][0-9]*)$/u, "Expected an observed process exit code");
	const exitCode = Number(code); assert.ok(Number.isSafeInteger(exitCode));
	const text = await readFile(path, "utf8"); return { exitCode, sha256: sha256(text), text };
};
const sources = {};
for(const path of await ownedPerlCallbackSourcePaths()) sources[path] = sha256(await readFile(path));
const reports = {};
const overrides = {
	"owned-perl-callback-results": "REPORTS"
	, "owned-perl-callback-result-faults": "FAULT_REPORTS"
	, "owned-perl-callback-result-lifetime": "LIFETIME_REPORTS"
	, "owned-perl-callback-result-mutants": "MUTANT_REPORTS"
	, "owned-perl-callback-result-sanitizers": "SANITIZER_REPORTS"
};
for(const path of ownedPerlCallbackResultReports)
{
	const key = overrides[basename(dirname(path))]; assert.ok(key);
	const root = process.env["LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_" + key];
	reports[path] = JSON.parse(await readFile(root ? join(root, basename(path)) : path, "utf8"));
}
const runs = [];
for(const [index, run] of ownedPerlCallbackRuns.entries()) runs.push({ ...run, ...await log(index) });
const record = {
	schemaVersion: 1, kind: "owned-perl-callback-results", planNode: 1219
	, acceptance: "passed", baselineRevision: ownedPerlCallbackBaseline
	, previous: ownedPerlCallbackPrevious, scope: ownedPerlCallbackScope
	, sourceHistory: { path: ownedPerlCallbackHistoryPath, sha256: ownedPerlCallbackHistorySha256 }
	, sources, runs
	, verification: { command: "npm run test:owned-perl-callback-evidence", ...await log(ownedPerlCallbackRuns.length) }
	, archive: packOwnedCallbackReports(reports)
};
await assertOwnedPerlCallbackAcceptance(record);
const bytes = JSON.stringify(record, null, 2) + "\n";
const staging = await mkdtemp(join(dirname(ownedPerlCallbackEvidencePath), ".perl-callback-acceptance-"));
try
{
	const temporary = join(staging, "receipt.json"), handle = await open(temporary, "wx");
	try
	{ await handle.writeFile(bytes); await handle.sync(); }
	finally
	{ await handle.close(); }
	await link(temporary, ownedPerlCallbackEvidencePath);
}
finally
{ await rm(staging, { recursive: true, force: true }); }
process.stdout.write(`${ownedPerlCallbackEvidencePath}: ${sha256(bytes)}\n`);
