/**
 * Validate current recursive NuGet executions without rewriting old receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertDotnetGraphPackageReports } from "./dotnet-graph-receipt.mjs";
import { assertDotnetFamilyRegressions } from "./dotnet-installed-regressions.mjs";
import { beforeDotnetCurrentPackageVerification } from "./native-shared-test-updates.mjs";
import { beforeRecursiveAcceptance } from "./recursive-acceptance-updates.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const graphTest = "tests/dotnet-graph-package.test.mjs";
const normalizeConsumer = (inventory, sized) => {
	for(const name of ["Consumer.dll", "Consumer.pdb"])
	{
		const file = inventory[name];
		assert.match(sized ? file.sha256 : file, /^[a-f0-9]{64}$/);
		if(sized)
		{
			assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
			file.sha256 = "consumer-build-digest";
		}
		else inventory[name] = "consumer-build-digest";
	}
};
const comparable = reports => {
	assertDotnetGraphPackageReports(reports);
	const result = structuredClone(reports);
	for(const run of result.packages.observations) normalizeConsumer(run.deployment, true);
	normalizeConsumer(result.composition.deployment, false);
	for(const pkg of result.conflicts.packages) normalizeConsumer(pkg.deployment, false);
	// The raw digest was verified above. Only downstream test application bytes
	// vary; archive, library, installed assembly and input-source identities stay.
	delete result.reproducibility.originalReportSha256;
	return result;
};

/**
 * Compare every installed graph observation, including original archive bytes.
 *
 * @param current - The four freshly executed package reports.
 * @param previous - The unchanged previous package observations.
 */
export const assertRepeatedDotnetGraphs = (current, previous) => assert.deepEqual(comparable(current), comparable(previous));

export const dotnetGraphVerifierPaths = [
	"tests/dotnet-current-graphs.test.mjs"
	, "tests/helpers/dotnet-current-graph-evidence.mjs"
	, "tests/helpers/dotnet-graph-receipt.mjs"
	, "tests/helpers/native-shared-test-updates.mjs"
];

/**
 * Bind production and installed-test sources separately from receipt checkers.
 *
 * @param previous - Original authenticated recursive NuGet package receipt.
 */
export const dotnetGraphExecutionPaths = previous => [...new Set([
	...Object.keys(previous.sourceHashes).filter(path =>
		!/^tests\/dotnet-(?:aliases|callables|collections|compounds|lists|variants)\.test\.mjs$/.test(path)
		&& !["tests/helpers/dotnet-installed-regressions.mjs"
			, "tests/helpers/dotnet-shared-regressions.mjs"
			, "tests/helpers/dotnet-source-history.mjs"
			, "tests/helpers/native-dotnet-graph-regression.mjs"
			, "tests/helpers/dotnet-graph-receipt.mjs"].includes(path))
	, "src/backends/c/copied-graph-layout.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
])].sort();

/**
 * Require five executed gates, exact current sources and unchanged old packages.
 *
 * @param record - Fresh current-source execution record.
 */
export const assertDotnetCurrentGraphEvidence = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "dotnet-current-graph-packages"); assert.equal(record.finalAcceptance, false);
	assert.equal(record.installedPackage, true); assert.equal(record.wordBits, 64);
	assert.equal(record.packageGlibcFloor, "2.38");
	assert.equal(record.previous.path, "docs/evidence/dotnet-recursive-packages-20260923.json");
	const bytes = await readFile(record.previous.path); assert.equal(sha256(bytes), record.previous.sha256);
	const previous = JSON.parse(bytes);
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), dotnetGraphExecutionPaths(previous));
	for(const [path, expected] of Object.entries(record.sourceHashes))
	{
		let source = await readFile(path, "utf8");
		source = beforeWitPackageIntegration(path, source, expected);
		if(path === "docs/consume/dotnet.md") source = beforeRecursiveAcceptance(path, source, expected);
		if(path === graphTest)
		{
			const executionSource = beforeDotnetCurrentPackageVerification(source);
			assert.notEqual(executionSource, source, "Current graph receipt verification must stay enabled");
			source = executionSource;
		}
		assert.equal(sha256(source), expected, path);
	}
	assert.deepEqual(Object.keys(record.verifierSources).sort(), dotnetGraphVerifierPaths);
	for(const [path, expected] of Object.entries(record.verifierSources))
		assert.equal(sha256(beforeRecursiveAcceptance(path, await readFile(path, "utf8"), expected)), expected, path);
	assert.equal(record.reportsSha256, sha256(canonicalJson(record.reports)));
	assert.equal(previous.reportSha256, sha256(canonicalJson(previous.reports)));
	assertRepeatedDotnetGraphs(record.reports, previous.reports);
	assert.equal(record.familyRegressions.path, "docs/evidence/dotnet-current-family-regressions-20260924.json");
	assert.equal(sha256(await readFile(record.familyRegressions.path)), record.familyRegressions.sha256);
	await assertDotnetFamilyRegressions();
	assert.equal(sha256(record.log.text), record.log.sha256);
	assert.match(record.log.text, /# tests 5\n# suites 0\n# pass 5\n# fail 0\n# cancelled 0\n# skipped 0/);
	const gates = [
		"recursive C\\# package assemblies compile and cold invalid calls never load assets"
		, "ordinary and reviewed recursive NuGet archives install and run without Lean or the SDK"
		, "recursive and ordinary installed NuGet packages share retirement and allow mixed C++ builds"
		, "independent recursive NuGet builds reproduce the original installed archives"
		, "original NuGet coordinate conflicts reject before loading and identical builds compose"
	];
	for(const [index, name] of gates.entries()) assert.ok(record.log.text.includes(`ok ${index + 1} - ${name}\n`), name);
	return { record, previous };
};

/**
 * Preserve the old receipt's observations while proving current-source equivalence.
 *
 * @param previous - The original receipt being checked by the graph contract test.
 */
export const assertCurrentDotnetGraphPackages = async previous => {
	const record = JSON.parse(await readFile("docs/evidence/dotnet-current-graph-packages-20260924.json"));
	const evidence = await assertDotnetCurrentGraphEvidence(record);
	assert.deepEqual(previous, evidence.previous);
};
