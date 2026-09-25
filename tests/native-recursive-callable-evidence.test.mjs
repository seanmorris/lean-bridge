/**
 * Reject incomplete recursive C-family evidence and unrelated historical edits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertNativeRecursiveCallableExecution, assertNativeRecursiveCallableIntegration, nativeRecursiveCallableExecutionPath } from "./helpers/native-recursive-callable-evidence.mjs";
import { beforeNativeRecursiveCallables, nativeRecursiveCallableHistoryPath, reverseNativeRecursiveCallableUpdate } from "./helpers/native-recursive-callable-source-history.mjs";
import { assertNativeRecursiveCallableCodegen, nativeRecursiveCallableCodegenPath } from "./helpers/native-recursive-callable-regression.mjs";
import { beforeClosureThreadLifetime } from "./helpers/closure-thread-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("copied graph adapters remain identical and header changes stay within private ABI names", async () => {
	const record = await json(nativeRecursiveCallableCodegenPath);
	assertNativeRecursiveCallableCodegen(record);
	for(const mutate of [
		value => { value.native.pop(); }
		, value => { value.native[0].previousFiles["graph.c"].sha256 = "0".repeat(64); }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].changes.pop(); }
		, value => { value.packages[1].changes.at(-1).previous += "\n"; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		assert.throws(() => assertNativeRecursiveCallableCodegen(changed));
	}
});

test("recursive C-family acceptance preserves earlier receipts and promotes eight cells", async () => {
	await assertNativeRecursiveCallableIntegration(await json(nativeRecursiveCallableHistoryPath));
});

test("recursive C-family evidence rejects missing paths, cleanup checks and deployments", async () => {
	const original = await json(nativeRecursiveCallableExecutionPath);
	await assertNativeRecursiveCallableExecution(original);
	for(const mutate of [
		record => { record.scope.profiles.push("rust"); }
		, record => { record.scope.ownedResourceAggregates = true; }
		, record => { record.c.reports.pop(); }
		, record => { record.cpp.reports.pop(); }
		, record => { record.native.reports.pop(); }
		, record => { record.installed.text = record.installed.text.replace("# skipped 0", "# skipped 1"); record.installed.sha256 = sha256(record.installed.text); }
		, record => { record.c.reports[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.c.reports[0].relocatedBeforeInstallation = false; }
		, record => { record.c.reports[0].consumerSha256 = "0".repeat(64); }
		, record => { record.c.reports[0].result.wrongThreads--; }
		, record => { record.c.reports[0].result.wrongProcesses--; }
		, record => { record.c.reports[0].result.optionCases--; }
		, record => { record.c.reports[0].result.nestedResultCases--; }
		, record => { record.c.reports[0].result.acceptedDepths--; }
		, record => { record.c.reports[0].faults.trackedLiveAllocationsAtExit++; }
		, record => { record.c.reports[0].faults.trackedAllocationsRestoredAfterEveryCheckpoint = false; }
		, record => { record.c.reports[0].faults.startupLeakBaselineUnchanged = false; }
		, record => { record.c.reports[0].faults.rejectedMutations.pop(); }
		, record => { record.c.reports[0].faults.result.activeDisposals--; }
		, record => { record.c.reports[0].faults.result.faults[0].nativeFailures--; }
		, record => { record.c.reports[0].faults.result.faults[0].gmpCases--; }
		, record => { record.cpp.reports[0].safety.rejected.pop(); }
		, record => { record.cpp.reports[0].safety.archivesRemoved = false; }
		, record => { record.cpp.reports[0].safety.startupLeakBaseline.bytes++; }
		, record => { record.cpp.reports[0].result.allocationFailures--; }
		, record => { record.cpp.reports[0].result.recycledThreadChecks--; }
		, record => { record.cpp.reports[0].combined.reports.pop(); }
		, record => { record.cpp.reports[0].combined.reports[0].observed.runtimeInitializations++; }
		, record => { record.cpp.reports[0].combined.reports[0].observed.identities++; }
		, record => { record.cpp.reports[0].companionC.result.edgeRejections--; }
		, record => { record.native.reports[0].calls.rejectedMutations.pop(); }
		, record => { record.native.reports[0].calls.retirementChecks.pop(); }
		, record => { record.documentation.report.reports.pop(); }
		, record => { record.documentation.report.reports[0].headersAndArchivesRemoved = false; }
		, record => { record.documentation.report.reports[0].consumerSourceSha256 = "0".repeat(64); }
		, record => { record.documentation.report.reports[0].publisherSourceSha256 = "0".repeat(64); }
		, record => { record.copiedRegression.report.reports.pop(); }
		, record => { record.copiedRegression.report.reports[0].sourceFreeChecks--; }
		, record => { record.copiedRegression.report.reports[0].headersRemovedBeforeExecution = false; }
	]) {
		const altered = structuredClone(original); mutate(altered);
		await assert.rejects(() => assertNativeRecursiveCallableExecution(altered));
	}
});

test("recursive C-family source transitions reject unknown bytes and predecessor hashes", async () => {
	const record = await json(nativeRecursiveCallableHistoryPath);
	for(const update of record.updates)
	{
		const source = beforeClosureThreadLifetime(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeRecursiveCallables(update.path, source, update.currentSha256), source);
		const altered = source + "\n// unrelated\n";
		assert.equal(beforeNativeRecursiveCallables(update.path, altered), altered);
		assert.throws(() => reverseNativeRecursiveCallableUpdate(altered, update));
		assert.throws(() => reverseNativeRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
