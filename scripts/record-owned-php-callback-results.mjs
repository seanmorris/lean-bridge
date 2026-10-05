/**
 * Atomically freeze native-PHP callback acceptance from original observations.
 * Supply the complete package-evidence TAP path and its independently observed exit.
 *
 * @file
 */
import assert from "node:assert/strict";
import { link, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { packOwnedCallbackReports } from "../tests/helpers/owned-callback-result-evidence.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPhpInstalledMatrix, readOwnedPhpInstalledEvidence } from "../tests/helpers/owned-php-callback-result-package-evidence.mjs";
import { phpCallbackInstalledBaseline, phpCallbackInstalledHistoryPath
	, phpCallbackInstalledHistorySha256 } from "../tests/helpers/php-callback-installed-staging-history.mjs";
import { assertOwnedPhpCallbackAcceptance, ownedPhpCallbackEvidencePath
	, ownedPhpCallbackHandoffIdentity, ownedPhpCallbackPrevious
	, ownedPhpCallbackRuntime, ownedPhpCallbackScope, ownedPhpCallbackSourcePaths
	, ownedPhpCallbackVerificationCommand } from "../tests/helpers/owned-php-callback-result-acceptance.mjs";

const arguments_ = process.argv.slice(2);
assert.equal(arguments_.length, 2, "Supply the original package-evidence TAP path and observed exit.");
assert.match(arguments_[1], /^(?:0|[1-9][0-9]*)$/u);
const exitCode = Number(arguments_[1]); assert.ok(Number.isSafeInteger(exitCode));
const verificationText = await readFile(arguments_[0], "utf8");
const evidence = await readOwnedPhpInstalledEvidence();
await assertOwnedPhpInstalledMatrix(evidence);
const sources = {};
for(const path of await ownedPhpCallbackSourcePaths()) sources[path] = sha256(await readFile(path));
const handoffs = Object.fromEntries(Object.entries(evidence.reports)
	.map(([name, item]) => [name, ownedPhpCallbackHandoffIdentity(item)]));
const record = {
	schemaVersion: 1, kind: "owned-php-callback-results", planNode: 1219
	, acceptance: "passed", baselineRevision: phpCallbackInstalledBaseline
	, previous: ownedPhpCallbackPrevious, scope: ownedPhpCallbackScope
	, sourceHistory: { path: phpCallbackInstalledHistoryPath, sha256: phpCallbackInstalledHistorySha256 }
	, runtimeEvidence: ownedPhpCallbackRuntime, sources
	, logs: evidence.logs
	, verification: { command: ownedPhpCallbackVerificationCommand
		, exitCode, sha256: sha256(verificationText), text: verificationText }
	, handoffs, archive: packOwnedCallbackReports(evidence.reports)
};
await assertOwnedPhpCallbackAcceptance(record);
const bytes = JSON.stringify(record, null, 2) + "\n";
const staging = await mkdtemp(join(dirname(ownedPhpCallbackEvidencePath), ".php-callback-acceptance-"));
try
{
	const temporary = join(staging, "receipt.json"), handle = await open(temporary, "wx");
	try
	{ await handle.writeFile(bytes); await handle.sync(); }
	finally
	{ await handle.close(); }
	await link(temporary, ownedPhpCallbackEvidencePath);
}
finally
{ await rm(staging, { recursive: true, force: true }); }
process.stdout.write(`${ownedPhpCallbackEvidencePath}: ${sha256(bytes)}\n`);
