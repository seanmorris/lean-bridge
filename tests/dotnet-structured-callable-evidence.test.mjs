/**
 * Require original installed NuGet assemblies and exact source transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertDotnetStructuredCallableExecution, assertDotnetStructuredCallableIntegration, dotnetStructuredCallableExecutionPath } from "./helpers/dotnet-structured-callable-evidence.mjs";
import { beforeDotnetStructuredCallables, dotnetStructuredCallableHistoryPath, reverseDotnetStructuredCallableUpdate } from "./helpers/dotnet-structured-callable-source-history.mjs";
import { beforeJvmStructuredCallables } from "./helpers/jvm-structured-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("C# structured acceptance binds original NuGet archives and preserves predecessor receipts", async () => {
	await assertDotnetStructuredCallableIntegration(await json(dotnetStructuredCallableHistoryPath));
});

test("C# structured execution rejects missing paths, failures, types and documentation", async () => {
	const original = await json(dotnetStructuredCallableExecutionPath);
	await assertDotnetStructuredCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("ruby"); }
		, record => { record.scope.recursiveCallbacks = true; }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.reports.pop(); }
		, record => { record.reports[0].signatures.pop(); }
		, record => { record.reports[0].installation.runtimeVersion = "unverified runtime"; }
		, record => { record.reports[0].installation.faults.shapes.pop(); }
		, record => { record.reports[0].installation.faults.shapes[0].faults = 0; }
		, record => { record.reports[0].installation.faults.isolatedInstrumentedProjection = false; }
		, record => { record.reports[0].installation.handoffRemovedBeforeExecution = false; }
		, record => { record.reports[0].installation.installedFilesUnchanged = false; }
		, record => { record.reports[0].installation.publicTypes.rejected.pop(); }
		, record => { record.reports[0].installation.publicTypes.rejected[0].codes = ["CS0000"]; }
		, record => { record.reports[0].installation.publicTypes.assemblySha256 = "0".repeat(64); }
		, record => { record.reports[0].installation.documentation.sdkFreeExecution = false; }
		, record => { record.reports[0].installation.documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.primitiveReports.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertDotnetStructuredCallableExecution(altered));
	}
});

test("C# structured integration rejects changed history or extra promoted cells", async () => {
	const original = await json(dotnetStructuredCallableHistoryPath);
	for(const mutate of [
		record => { record.inventory.installed++; }
		, record => { record.previous.sha256 = "0".repeat(64); }
		, record => { record.codegen.sha256 = "0".repeat(64); }
		, record => { record.updates.pop(); }
		, record => { record.sourceHashes["src/backends/dotnet/copied-model.mjs"] = "0".repeat(64); }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertDotnetStructuredCallableIntegration(altered));
	}
});

test("C# structured source history preserves unrelated source drift", async () => {
	const record = await json(dotnetStructuredCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforeJvmStructuredCallables(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseDotnetStructuredCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeDotnetStructuredCallables(update.path, source)), update.previousSha256);
		assert.notEqual(sha256(beforeDotnetStructuredCallables(update.path, source + "\n// unrelated\n")), update.previousSha256);
		assert.throws(() => reverseDotnetStructuredCallableUpdate(source + "\n// unrelated\n", update));
	}
});
