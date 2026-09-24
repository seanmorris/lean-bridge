/**
 * Accept only the copied positions proved by the original installed archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertDotnetCurrentGraphEvidence } from "./dotnet-current-graph-evidence.mjs";
import { assertJvmGraphPackageReports } from "./jvm-graph-receipt.mjs";
import { assertPhpGraphPackageReports } from "./php-graph-receipt.mjs";
import { assertCurrentPhpGraphSources } from "./current-php-graph-evidence.mjs";
import { assertPhpWasmGraphPackageEvidence } from "./php-wasm-graph-receipt.mjs";
import { assertPhpWasmGraphLoadingEvidence } from "./php-wasm-graph-loading-receipt.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";
import { reverseAcceptanceUpdate } from "./recursive-acceptance-updates.mjs";

const paths = {
	dotnet: "docs/evidence/dotnet-current-graph-packages-20260924.json"
	, jvm: "docs/evidence/jvm-recursive-packages-20260923.json"
	, php: "docs/evidence/php-recursive-packages-20260923.json"
	, phpWasm: "docs/evidence/php-wasm-recursive-packages-20260924.json"
	, phpWasmLoading: "docs/evidence/php-wasm-recursive-loading-20260924.json"
	, shared: "docs/evidence/native-shared-regressions-20260924.json"
	, phpWasmShared: "docs/evidence/php-wasm-shared-regressions-20260924.json"
	, phpFamilies: "docs/evidence/php-current-family-regressions-20260924.json"
	, sourceRefresh: "docs/evidence/structured-source-refresh-20260924.json"
};
const sourcePath = reviewed => reviewed ? "reviewed-ir" : "ordinary-source";

/**
 * Bind the acceptance scope, original archive identities and exact doc changes.
 *
 * @param record - Copied-recursion acceptance index, not the full goal's receipt.
 */
export const assertRecursiveManagedAcceptanceIndex = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-managed-installed-acceptance");
	assert.equal(record.finalAcceptance, false);
	assert.equal(record.baselineRevision, "62d98e0521425b4798737c5becbe3e95fbf076ae");
	assert.deepEqual(record.profiles, ["dotnet", "java", "kotlin", "php-native", "php-wasm"]);
	assert.deepEqual(record.positions, ["parameter", "result", "field"]);
	assert.deepEqual(record.paths, ["ordinary-source", "reviewed-ir"]);
	assert.equal(record.acceptedCells, 30);
	assert.deepEqual(record.remaining, ["WIT/WASI copied recursion", "Structured callback and closure payloads", "Explicitly owned resource-containing aggregates", "Final full structured-type acceptance"]);
	assert.deepEqual(Object.keys(record.sources), Object.keys(paths));
	const sources = {};
	for(const [name, path] of Object.entries(paths))
	{
		assert.equal(record.sources[name].path, path);
		const bytes = await readFile(path); assert.equal(sha256(bytes), record.sources[name].sha256);
		sources[name] = JSON.parse(bytes);
	}
	const artifacts = [];
	for(const run of sources.dotnet.reports.packages.observations)
		artifacts.push({ path: `dotnet/${sourcePath(run.reviewed)}/archives/Lean.Recursive.1.0.0.nupkg`, sha256: run.archiveSha256 });
	for(const run of sources.jvm.reports.packages.observations.filter(run => run.profile === "java"))
		for(const file of run.package.artifacts) artifacts.push({ path: `jvm/${sourcePath(run.reviewed)}/${file.path}`, sha256: file.sha256 });
	for(const run of sources.php.reports.packages.observations)
		for(const file of run.package.artifacts) artifacts.push({ path: `php-native/${sourcePath(run.reviewed)}/${file.path}`, sha256: file.sha256 });
	for(const run of sources.phpWasm.report.observations)
		for(const file of run.archives) artifacts.push({ path: `php-wasm/${sourcePath(run.reviewed)}/archives/${file.archive}`, sha256: file.sha256 });
	assert.deepEqual(record.artifacts, artifacts); assert.equal(artifacts.length, 14);
	assert.deepEqual(record.updates.map(update => update.path), ["docs/consume/dotnet.md", "docs/consume/java.md", "docs/consume/kotlin.md", "docs/php.md", "tests/helpers/dotnet-current-graph-evidence.mjs"]);
	const previousDocs = JSON.parse(await readFile("docs/evidence/recursive-documentation-updates-20260924.json"));
	for(const update of record.updates)
	{
		const previous = update.path.startsWith("docs/") ? previousDocs.files[update.path].currentSha256 : sources.dotnet.verifierSources[update.path];
		assert.equal(update.previousSha256, previous);
		reverseAcceptanceUpdate(await readFile(update.path, "utf8"), update);
	}
	return sources;
};

/**
 * Execute the original package verifiers, including sources and failed-call cleanup.
 *
 * @param record - The exact acceptance index under test.
 */
export const assertRecursiveManagedAcceptance = async record => {
	const sources = await assertRecursiveManagedAcceptanceIndex(record);
	await assertDotnetCurrentGraphEvidence(sources.dotnet);
	assertJvmGraphPackageReports(sources.jvm.reports);
	for(const [path, expected] of Object.entries(sources.jvm.sourceHashes)) await assertAdministrativeSourceUpdate(path, expected);
	await assertPhpGraphPackageReports(sources.php.reports);
	await assertCurrentPhpGraphSources(sources.php);
	await assertPhpWasmGraphPackageEvidence(sources.phpWasm);
	await assertPhpWasmGraphLoadingEvidence(sources.phpWasmLoading);
};
