/**
 * Retain exact Fin reports from the already authenticated ff71335 artifact ZIPs and Git sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertHostedArrayArchive, hostedArrayDirectory, hostedArrayReceiptSha256 } from "../tests/helpers/generic-record-array-hosted-evidence.mjs";
import { strictArtifactZipMembers } from "../tests/helpers/hosted-specialization-evidence.mjs";
import { assertFinHostedContents, finHostedDirectory, finHostedFamilies, finHostedRevision, finHostedSelections } from "../tests/helpers/fin-native-hosted-evidence.mjs";

assert.ok(process.argv.slice(2).every(option => option === "--check"), "Only --check is accepted");
const arrays = JSON.parse(await readFile(`${hostedArrayDirectory}/receipt.json`));
await assertHostedArrayArchive(arrays);
const pending = new Map(), sources = [], reports = [], paths = new Set([
	".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/build/native-model.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/abi/refinements.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/backends/wit/fin-refinements.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-fixture-installed.mjs"
]);
for(const [family, fixture] of Object.entries(finHostedFamilies))
{
	for(const path of [`tests/${fixture.directory}.test.mjs`, `tests/helpers/fin-${family}-install.mjs`, `tests/helpers/fin-${family}-dispatch.mjs`, `tests/helpers/reviewed-fin-${family}-fixture.mjs`]) paths.add(path);
	for(const directory of [`tests/fixtures/onboarding/${fixture.directory}`, `tests/fixtures/fin-${family}-consumers`])
		for(const path of execFileSync("git", ["ls-tree", "-r", "--name-only", finHostedRevision, "--", directory], { encoding: "utf8" }).trim().split("\n")) paths.add(path);
}
for(const path of [...paths].sort())
{
	const bytes = execFileSync("git", ["show", `${finHostedRevision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
	const archivePath = `${finHostedDirectory}/sources/${path}.txt`;
	pending.set(archivePath, bytes); sources.push({ path, archivePath, bytes: bytes.length, sha256: sha256(bytes) });
}
for(const group of arrays.groups)
{
	const selections = finHostedSelections(group.name);
	const members = strictArtifactZipMembers(await readFile(`${hostedArrayDirectory}/${group.name}.zip`), selections.map(item => item.member));
	for(const selection of selections)
	{
		const bytes = members.get(selection.member), path = `${finHostedDirectory}/${group.name}/${selection.member}`;
		pending.set(path, bytes);
		reports.push({ selection
			, path
			, bytes: bytes.length
			, sha256: sha256(bytes)
			, artifactId: group.artifactId
			, jobId: group.jobId
			, checks: JSON.parse(bytes).reports.map(row => [row.profile, row.checks]) });
	}
}
const receipt = { schemaVersion: 1
	, kind: "native-fin-hosted"
	, planNodes: [1441, 1442]
	, revision: finHostedRevision, runId: arrays.runId
	, archive: { path: `${hostedArrayDirectory}/receipt.json`, sha256: hostedArrayReceiptSha256 }
	, sources, reports
	, scope: { reports: 78
		, observations: 90
		, profiles: 11
		, python: ["3.11.17", "3.12.15"]
		, perl: ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]
		, routes: ["ordinary-source", "reviewed-ir"], measuredDispatchProfiles: ["c"]
		, packageArchivesRetained: false
		, supportPromotion: false
		, closesPlanNodes: false
		, sourceSnapshots: "Selected original fixtures, consumers, producers and implementation sources, not a complete transitive source archive."
		, runtimeFloor: "Packages declare glibc 2.38; the hosted job is not execution on a minimum-libc machine."
		, compilerFreePath: "Author/build roots and producer tools are absent during consumption; consumer compilers remain available where required."
		, remaining: "Original per-host case audit and inventory/documentation reconciliation; no browser, PHP-Wasm, Subtype, generic or recursive acceptance inferred." }
};
const bytes = Buffer.from(canonicalJson(receipt)); pending.set(`${finHostedDirectory}/receipt.json`, bytes);
const result = await assertFinHostedContents(receipt, path => pending.has(path) ? Promise.resolve(pending.get(path)) : readFile(path));
for(const [path, bytes] of pending)
{
	if(process.argv.includes("--check"))
	{
		assert.deepEqual(await readFile(path), bytes, path); continue;
	}
	await mkdir(dirname(path), { recursive: true });
	try
	{
		await writeFile(path, bytes, { flag: "wx" });
	}
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.deepEqual(await readFile(path), bytes, `${path} already holds different bytes`);
	}
}
console.log(JSON.stringify({ ...result, receiptSha256: sha256(bytes) }));
