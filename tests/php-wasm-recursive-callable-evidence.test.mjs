/**
 * Reject missing wasm32 executions, forged cleanup and unrelated source changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertPhpWasmRecursiveCallableExecution, assertPhpWasmRecursiveCallableIntegration, phpWasmRecursiveCallableExecutionPath } from "./helpers/php-wasm-recursive-callable-evidence.mjs";
import { assertPhpWasmRecursiveProbes } from "./helpers/php-wasm-recursive-callable-probes.mjs";
import { assertPhpWasmRecursivePackages } from "./helpers/php-wasm-recursive-callable-receipt.mjs";
import { beforePhpWasmRecursiveCallables, phpWasmRecursiveCallableHistoryPath, reversePhpWasmRecursiveCallableUpdate } from "./helpers/php-wasm-recursive-callable-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("PHP-Wasm recursive acceptance promotes exactly four cells and preserves source history", async () => {
	await assertPhpWasmRecursiveCallableIntegration(await json(phpWasmRecursiveCallableHistoryPath));
});

test("PHP-Wasm recursive receipts require passing unsuppressed executions", async () => {
	const original = await json(phpWasmRecursiveCallableExecutionPath);
	for(const change of [
		record => { record.generated.exitCode = 1; }
		, record => { record.installed.command += " --import patched.mjs"; }
		, record => { record.generated.text += "edited"; }
		, record => { record.regressions.command = record.installed.command; }
		, record => { delete record.projectionSources["src/build/php-wasm-graph-model.mjs"]; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertPhpWasmRecursiveCallableExecution(changed), change.toString());
	}
});

test("PHP-Wasm recursive package records require original bytes and every loading arrangement", async () => {
	const original = (await json(phpWasmRecursiveCallableExecutionPath)).installed.reports.recursive;
	await assertPhpWasmRecursivePackages(original);
	for(const change of [
		record => { record.observations.pop(); }
		, record => { record.runtimeManifest.pointerBits = 64; }
		, record => { record.observations[0].authorRemoved = false; }
		, record => { record.observations[0].installedFilesUnchanged = false; }
		, record => { record.observations[0].documentation.compiledVerbatim = false; }
		, record => { record.observations[0].producerSources["Structured.lean"].sha256 = "0".repeat(64); }
		, record => { record.observations[0].receipt.copiedGraph.callbacksSha256 = "0".repeat(64); }
		, record => { delete record.observations[0].installedFiles["node_modules/@lean-bridge-test/recursive-callables"]["compiled/src/Api.php"]; }
		, record => { record.observations[0].executions.pop(); }
		, record => { record.observations[0].executions[0].observed.rejections = 0; }
		, record => { record.observations[0].executions[0].phases[0].libraries = ["fake.so", "another.so"]; }
		, record => { record.observations[0].executions[4].documentation.stdout = "42\n"; }
		, record => { record.observations[0].browser.executions.pop(); }
		, record => { record.observations[0].browser.executions[0].requests = record.observations[0].browser.executions[0].requests.filter(item => item.sha256 !== record.observations[0].receipt.wasmLibrary.sha256); }
		, record => { record.observations[0].sources.node = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertPhpWasmRecursivePackages(changed), change.toString());
	}
	const mixed = (await json(phpWasmRecursiveCallableExecutionPath)).installed.reports.mixed;
	mixed.observations[0].executions[0].observed.primitiveChecks = 0;
	await assert.rejects(() => assertPhpWasmRecursivePackages(mixed, true));
});

test("PHP-Wasm recursive probe records require fault coverage, zero owners and specific mutant failures", async () => {
	const original = (await json(phpWasmRecursiveCallableExecutionPath)).generated.report;
	await assertPhpWasmRecursiveProbes(original);
	for(const change of [
		record => { record.installedPackage = true; }
		, record => { record.probeSha256 = "0".repeat(64); }
		, record => { record.observations.pop(); }
		, record => { record.observations[0].faults.recursive.native--; }
		, record => { record.observations[0].ownedFaults.array.zend--; }
		, record => { record.observations[0].stats.nativeLive++; }
		, record => { record.observations[0].capacity--; }
		, record => { record.observations[0].recovered--; }
		, record => { record.ownership.observations[0].tokenHighBitsPreserved = false; }
		, record => { record.ownership.observations[0].stats.borrowedContexts++; }
		, record => { record.ownership.observations[0].contextExhaustionRejections--; }
		, record => { record.bailouts.observations[0].observations.pop(); }
		, record => { record.bailouts.observations[0].observations[0].status = 1; }
		, record => { record.bailouts.observations[0].observations[1].before.zendLive++; }
		, record => { record.construction.observations[0].observations.pop(); }
		, record => { record.construction.observations[0].observations[0].recovered.after.identities++; }
		, record => { record.replies.observations[0].stats.replyChecks--; }
		, record => { record.replies.mutant.rejectedBeforeLeanCopy = false; }
		, record => { record.replies.mutant.stderr = '"status":2 callback_reply_storage_expired memory access out of bounds'; }
		, record => { record.malformed.observations.pop(); }
		, record => { record.malformed.observations[0].stats.retirements--; }
		, record => { record.malformed.mutant.stderr = '"status":2 unrelated failure'; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertPhpWasmRecursiveProbes(changed), change.toString());
	}
});

test("PHP-Wasm recursive source transitions reject unknown edits and substituted predecessors", async () => {
	for(const update of (await json(phpWasmRecursiveCallableHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reversePhpWasmRecursiveCallableUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpWasmRecursiveCallables(update.path, source)), update.previousSha256);
		assert.equal(beforePhpWasmRecursiveCallables(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated */\n";
		assert.equal(beforePhpWasmRecursiveCallables(update.path, unknown), unknown);
		assert.throws(() => reversePhpWasmRecursiveCallableUpdate(unknown, update));
		assert.throws(() => reversePhpWasmRecursiveCallableUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
