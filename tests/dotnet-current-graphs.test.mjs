/**
 * Require current-source recursive NuGet receipts and unchanged released bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertRepeatedDotnetGraphs, assertDotnetCurrentGraphEvidence } from "./helpers/dotnet-current-graph-evidence.mjs";
import { beforeDotnetCurrentPackageVerification } from "./helpers/native-shared-test-updates.mjs";

test("repeated NuGet graph evidence isolates downstream binaries and preserves all package identities", async () => {
	const previous = JSON.parse(await readFile("docs/evidence/dotnet-recursive-packages-20260923.json")).reports;
	const snapshot = structuredClone(previous), current = structuredClone(previous);
	for(const run of current.packages.observations)
		for(const name of ["Consumer.dll", "Consumer.pdb"]) run.deployment[name].sha256 = "0".repeat(64);
	for(const deployment of [current.composition.deployment, ...current.conflicts.packages.map(pkg => pkg.deployment)])
		for(const name of ["Consumer.dll", "Consumer.pdb"]) deployment[name] = "0".repeat(64);
	current.reproducibility.originalReportSha256 = sha256(canonicalJson(current.packages));
	assertRepeatedDotnetGraphs(current, previous);
	assert.deepEqual(previous, snapshot);
	for(const change of [
		run => { run.packages.observations[0].archiveSha256 = "0".repeat(64); run.reproducibility.observations[0].archiveSha256 = "0".repeat(64); }
		, run => { run.packages.observations[0].deployment["LeanBridge.Recursive.dll"].sha256 = "0".repeat(64); }
		, run => { run.packages.observations[0].deployment["Consumer.dll"].bytes++; }
		, run => { run.packages.observations[0].deployment["Consumer.pdb"].sha256 = "invalid"; }
		, run => { run.packages.observations[0].publicCallerSha256 = "0".repeat(64); }
		, run => { run.packages.observations[0].documentation.sourceSha256 = "0".repeat(64); }
		, run => { run.packages.observations[0].checks--; }
		, run => { run.composition.sourceSha256 = "0".repeat(64); }
		, run => { run.composition.scenarios.pop(); }
		, run => { run.composition.deployment["Consumer.dll"] = "invalid"; }
		, run => { run.conflicts.packages[0].pkg.artifacts[0].sha256 = "0".repeat(64); }
		, run => { run.conflicts.packages[0].deployment["LeanBridge.GraphCollision.dll"] = "0".repeat(64); }
		, run => { run.conflicts.rejectsBeforeComponentLoad = false; }
		, run => { run.conflicts.probeSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(previous); change(changed);
		changed.reproducibility.originalReportSha256 = sha256(canonicalJson(changed.packages));
		assert.throws(() => assertRepeatedDotnetGraphs(changed, previous));
	}
});

test("current NuGet graph packages bind all five gates and unchanged source and archive evidence", async () => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-current-graph-packages-20260924.json"));
	await assertDotnetCurrentGraphEvidence(record);
	for(const change of [
		run => { run.previous.sha256 = "0".repeat(64); }
		, run => { delete run.sourceHashes["src/backends/managed/package-audit.mjs"]; }
		, run => { run.sourceHashes["src/backends/managed/package-audit.mjs"] = "0".repeat(64); }
		, run => { run.verifierSources["tests/helpers/dotnet-current-graph-evidence.mjs"] = "0".repeat(64); }
		, run => { run.reports.packages.observations.pop(); }
		, run => { run.familyRegressions.sha256 = "0".repeat(64); }
		, run => { run.packageGlibcFloor = "2.36"; }
		, run => { run.log.text = run.log.text.replace("# skipped 0", "# skipped 1"); }
		, run => { run.log.text = run.log.text.replaceAll("independent recursive NuGet builds", "different test"); }
		, run => { run.finalAcceptance = true; }
	]) {
		const changed = structuredClone(record); change(changed);
		changed.reports.reproducibility.originalReportSha256 = sha256(canonicalJson(changed.reports.packages));
		changed.reportsSha256 = sha256(canonicalJson(changed.reports));
		changed.log.sha256 = sha256(changed.log.text);
		await assert.rejects(() => assertDotnetCurrentGraphEvidence(changed));
	}
});

test("current NuGet checker integration preserves the complete executed test module", async () => {
	const path = "tests/dotnet-graph-package.test.mjs", source = await readFile(path, "utf8");
	const record = JSON.parse(await readFile("docs/evidence/dotnet-current-graph-packages-20260924.json"));
	const previous = beforeDotnetCurrentPackageVerification(source);
	assert.notEqual(source, previous);
	assert.equal(sha256(previous), record.sourceHashes[path]);
	assert.equal(beforeDotnetCurrentPackageVerification(previous), previous);
	assert.notEqual(sha256(beforeDotnetCurrentPackageVerification(source + "\n// unrelated change\n")), record.sourceHashes[path]);
	assert.throws(() => beforeDotnetCurrentPackageVerification(source + source));
	assert.throws(() => beforeDotnetCurrentPackageVerification(source.replace("\tawait assertCurrentDotnetGraphPackages(record);\n", "")));
});
