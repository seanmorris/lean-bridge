/**
 * Atomically freeze direct WIT callback evidence from original observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { link, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { packOwnedCallbackReports } from "../tests/helpers/owned-callback-result-evidence.mjs";
import { assertOwnedWitCallbackRuntimeMatrix, assertOwnedWitCallbackRuntimeLogs
	, ownedWitCallbackRuntimeLogs, ownedWitCallbackRuntimeReports } from "../tests/helpers/wit-owned-callback-result-runtime-evidence.mjs";
import { witCallbackRuntimeBaseline } from "../tests/helpers/wit-callback-runtime-staging-history.mjs";
import { assertOwnedWitCallbackAcceptance, ownedWitCallbackEvidencePath
	, ownedWitCallbackPrevious, ownedWitCallbackScope, ownedWitCallbackSourceHistory
	, ownedWitCallbackSourcePaths, ownedWitCallbackVerificationCommand } from "../tests/helpers/owned-wit-callback-result-acceptance.mjs";

const arguments_ = process.argv.slice(2);
assert.equal(arguments_.length, 4,
	"Supply the report root, selected-log root, verifier TAP path and observed exit.");
assert.match(arguments_[3], /^(?:0|[1-9][0-9]*)$/u);
const [reportRoot, logRoot, verificationPath] = arguments_, exitCode = Number(arguments_[3]);
const reports = Object.fromEntries(await Promise.all(ownedWitCallbackRuntimeReports.map(async name =>
	[name, JSON.parse(await readFile(join(reportRoot, name), "utf8"))])));
const logs = Object.fromEntries(await Promise.all(ownedWitCallbackRuntimeLogs.map(async name =>
	[name, await readFile(join(logRoot, name), "utf8")])));
await assertOwnedWitCallbackRuntimeMatrix(reports); assertOwnedWitCallbackRuntimeLogs(logs, reports);
const sources = {};
for(const path of await ownedWitCallbackSourcePaths()) sources[path] = sha256(await readFile(path));
const verificationText = await readFile(verificationPath, "utf8");
const record = {
	schemaVersion: 1, kind: "owned-wit-callback-results", planNode: 1219
	, acceptance: "passed", baselineRevision: witCallbackRuntimeBaseline
	, previous: ownedWitCallbackPrevious
	, sourceHistory: ownedWitCallbackSourceHistory
	, scope: ownedWitCallbackScope, sources, logs
	, verification: { command: ownedWitCallbackVerificationCommand, exitCode
		, sha256: sha256(verificationText), text: verificationText }
	, archive: packOwnedCallbackReports(reports)
};
await assertOwnedWitCallbackAcceptance(record);
const bytes = JSON.stringify(record, null, 2) + "\n";
const staging = await mkdtemp(join(dirname(ownedWitCallbackEvidencePath), ".wit-callback-acceptance-"));
try
{
	const temporary = join(staging, "receipt.json"), handle = await open(temporary, "wx");
	try
	{
		await handle.writeFile(bytes); await handle.sync();
	}
	finally
	{
		await handle.close();
	}
	await link(temporary, ownedWitCallbackEvidencePath);
}
finally
{
	await rm(staging, { recursive: true, force: true });
}
process.stdout.write(`${ownedWitCallbackEvidencePath}: ${sha256(bytes)}\n`);
