/**
 * Freeze one completed six-case installed WIT callback-result run.
 *
 * @file
 */
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { packOwnedCallbackReports } from "../tests/helpers/owned-callback-result-evidence.mjs";
import { assertInstalledWitCallbackAcceptance, assertInstalledWitCallbackLog
	, assertInstalledWitCallbackReport, installedWitCallbackCommand
	, installedWitCallbackEvidencePath, installedWitCallbackPrevious
	, installedWitCallbackReports, installedWitCallbackScope
	, installedWitCallbackSourcePaths } from "../tests/helpers/owned-wit-callback-result-installed-acceptance.mjs";

const root = "build/owned-wit-callback-result-packaging";
const reports = {};
for(const name of installedWitCallbackReports)
{
	reports[name] = JSON.parse(await readFile(`${root}/${name}`, "utf8"));
	assertInstalledWitCallbackReport(name, reports[name]);
}
const log = await readFile(`${root}.log`, "utf8");
assertInstalledWitCallbackLog(log, reports);
const sources = {};
for(const path of await installedWitCallbackSourcePaths()) sources[path] = sha256(await readFile(path));
const record = { schemaVersion: 1, kind: "owned-wit-callback-result-packages"
	, planNode: 1219, acceptance: "passed"
	, implementationRevision: "3c06ada4d719597316d28b3f57bb5dbaa8104116"
	, previous: installedWitCallbackPrevious
	, scope: installedWitCallbackScope
	, sources
	, log: { command: installedWitCallbackCommand, sha256: sha256(log), text: log }
	, archive: packOwnedCallbackReports(reports) };
await writeFile(installedWitCallbackEvidencePath, canonicalJson(record));
await assertInstalledWitCallbackAcceptance(record);
process.stdout.write(`${installedWitCallbackEvidencePath} ${sha256(canonicalJson(record))}\n`);
