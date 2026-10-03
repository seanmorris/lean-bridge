/**
 * Freeze completed JVM reports only after their source-bound verifier passes.
 * Supply a retained TAP path and its observed process exit code for each run,
 * in ownedJvmCallbackRuns order, then for test:owned-jvm-callback-evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { link, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { packOwnedCallbackReports } from "../tests/helpers/owned-callback-result-evidence.mjs";
import { ownedJvmCallbackResultReports } from "../tests/helpers/owned-jvm-callback-result-ci.mjs";
import { ownedJvmCallbackBaseline, ownedJvmCallbackHistoryPath
	, ownedJvmCallbackHistorySha256 } from "../tests/helpers/owned-jvm-callback-result-history.mjs";
import { assertOwnedJvmCallbackAcceptance, ownedJvmCallbackEvidencePath
	, ownedJvmCallbackPrevious, ownedJvmCallbackRuns, ownedJvmCallbackScope
	, ownedJvmCallbackSourcePaths } from "../tests/helpers/owned-jvm-callback-result-acceptance.mjs";

const arguments_ = process.argv.slice(2);
assert.equal(arguments_.length, (ownedJvmCallbackRuns.length + 1) * 2,
	"Supply TAP path and observed exit code pairs: direct, mixed, lifetime, sanitizers, installed, combined-release, verification");
const log = async index => {
	const path = arguments_[index * 2], code = arguments_[index * 2 + 1];
	assert.match(code, /^(?:0|[1-9][0-9]*)$/u, "Expected an observed process exit code");
	const exitCode = Number(code); assert.ok(Number.isSafeInteger(exitCode));
	const text = await readFile(path, "utf8");
	return { exitCode, sha256: sha256(text), text };
};
const sources = {};
for(const path of await ownedJvmCallbackSourcePaths()) sources[path] = sha256(await readFile(path));
const reports = {};
for(const path of ownedJvmCallbackResultReports) reports[path] = JSON.parse(await readFile(path, "utf8"));
const runs = [];
for(const [index, run] of ownedJvmCallbackRuns.entries()) runs.push({ ...run, ...await log(index) });
const record = {
	schemaVersion: 1, kind: "owned-jvm-callback-results", planNode: 1219
	, acceptance: "passed", baselineRevision: ownedJvmCallbackBaseline
	, previous: ownedJvmCallbackPrevious, scope: ownedJvmCallbackScope
	, sourceHistory: { path: ownedJvmCallbackHistoryPath, sha256: ownedJvmCallbackHistorySha256 }
	, sources, runs
	, verification: { command: "npm run test:owned-jvm-callback-evidence", ...await log(ownedJvmCallbackRuns.length) }
	, archive: packOwnedCallbackReports(reports)
};
await assertOwnedJvmCallbackAcceptance(record);
const bytes = JSON.stringify(record, null, 2) + "\n";
const staging = await mkdtemp(join(dirname(ownedJvmCallbackEvidencePath), ".jvm-callback-acceptance-"));
try
{
	const temporary = join(staging, "receipt.json"), handle = await open(temporary, "wx");
	try
	{ await handle.writeFile(bytes); await handle.sync(); }
	finally
	{ await handle.close(); }
	// A same-filesystem link publishes complete bytes and refuses an existing receipt.
	await link(temporary, ownedJvmCallbackEvidencePath);
}
finally
{ await rm(staging, { recursive: true, force: true }); }
process.stdout.write(`${ownedJvmCallbackEvidencePath}: ${sha256(bytes)}\n`);
