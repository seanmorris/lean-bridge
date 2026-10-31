/**
 * Authenticate the downstream type-surface receipt and JVM repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { beforeConsumerTypeSurfaceDocumentationContractRepairSource }
	from "./consumer-type-surface-documentation-contract-repair-source-history.mjs";
import { compileCallableJvmGraphPackageModel }
	from "../../src/backends/jvm/callable-graph-model.mjs";
import { generateCallableJvmGraphPackage }
	from "../../src/backends/jvm/callable-graph-package.mjs";
import {
	beforeConsumerTypeSurfaceReceiptRepairSource
	, consumerTypeSurfaceReceiptRepairHistoryAdditions
	, consumerTypeSurfaceReceiptRepairHistoryPath
	, consumerTypeSurfaceReceiptRepairImplementation
	, consumerTypeSurfaceReceiptRepairImplementationPaths
	, consumerTypeSurfaceReceiptRepairIntegrationPaths
	, consumerTypeSurfaceReceiptRepairPredecessor
	, reverseConsumerTypeSurfaceReceiptRepairUpdate
} from "./consumer-type-surface-receipt-repair-source-history.mjs";
import { instrumentJvmRecursiveCallbacks }
	from "./jvm-recursive-callable-instrument.mjs";
import { nativeRecursiveCallableReviewedIr }
	from "./native-recursive-callable-fixture.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerTypeSurfaceReceiptRepairHistoryPath, "utf8"));

test("downstream receipt repair records both independent exact-head failures"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-type-surface-receipt-repair-v1");
		assert.equal(history.predecessorCommit
			, consumerTypeSurfaceReceiptRepairPredecessor);
		assert.equal(history.implementationCommit
			, consumerTypeSurfaceReceiptRepairImplementation);
		assert.deepEqual(history.failedRun, { workflow: 41209387856 });
		assert.deepEqual(history.failures.map(item => ({
			job: item.job, name: item.name, step: item.step
			, missingEvidence: item.missingEvidence
		})), [{
			job: 124566906989, name: "Managed consumer (jvm)"
			, step: "Enforce managed consumer support"
			, missingEvidence:
				"docs/evidence/browser-callback-fin-20261008/ordinary.json"
		}
		, {
			job: 124566907106, name: "PHP-Wasm corpus (values)"
			, step: "Enforce PHP-Wasm corpus"
			, missingEvidence:
				"docs/evidence/browser-callback-fin-20261008/ordinary.json"
		}]);
		assert.equal(history.failures[0].instrumentationError
			, "stubs: undefined");
		assert.equal(history.failures[1].derivedUploadFailures, true);
		assert.deepEqual(history.rootCauses.map(item => item.kind)
			, ["sparse-evidence-corpus", "generated-jvm-indentation"]);
	}
);

test("downstream receipt repair reverses every implementation and integration source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(item => item.path)
			, consumerTypeSurfaceReceiptRepairImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, consumerTypeSurfaceReceiptRepairIntegrationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				consumerTypeSurfaceReceiptRepairImplementation, update.path), update)
				, true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, consumerTypeSurfaceReceiptRepairImplementation
					+ ":" + update.path]);
			assert.equal(reverseConsumerTypeSurfaceReceiptRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerTypeSurfaceReceiptRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("downstream receipt repair fans one authenticated corpus into every sparse consumer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.receipt, {
			producer: "type-surface-authentication"
			, artifact: "consumer-type-surface-${{ github.sha }}"
			, path: "build/consumer-type-surface/receipt.json"
			, reviewedConsumer: "reviewed-ir-admission"
			, metadataConsumers: [
				"browser-consumer", "host-null-systems", "managed-consumers"
				, "native-c-family-values", "native-consumers", "node-consumers"
				, "owned-jvm-values", "owned-wit-receivers", "php-consumers"
				, "php-multi-profile", "php-wasm-callback-results"
				, "php-wasm-consumers", "php-wasm-corpus"
				, "php-wasm-receivers", "reviewed-fin-wasm-entry"
				, "wasi-consumer"
			]
		});
		const workflow = git(["show"
			, consumerTypeSurfaceReceiptRepairImplementation
				+ ":.github/workflows/consumer-matrix.yml"]);
		assert.match(workflow
			, /node scripts\/create-core-type-surface-evidence-receipt[.]mjs/u);
		assert.equal(workflow.split(
			"needs: type-surface-authentication").length - 1, 17);
		assert.equal(workflow.split(
			"uses: actions/download-artifact@v8").length - 1, 17);
		assert.equal(workflow.split(
			"LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT=$GITHUB_WORKSPACE/build/consumer-type-surface/receipt.json"
		).length - 1, 17);
	}
);

test("downstream receipt repair instruments all generated JVM stub anchors"
	, async () => {
		const history = await record();
		const ir = nativeRecursiveCallableReviewedIr();
		const compiled = compileCallableJvmGraphPackageModel(ir);
		const generated = generateCallableJvmGraphPackage(ir);
		const instrumented = instrumentJvmRecursiveCallbacks(
			generated, compiled.namespace);
		const path = "src/main/java/"
			+ compiled.namespace.replaceAll(".", "/")
			+ "/_CallableGraphRuntime.java";
		const stubs = [...generated[path].matchAll(
			/^([ \t]+)(var stub = [^\n]+;)$/gm)];
		assert.deepEqual(history.jvmInstrumentation, {
			runtimePath: path, stubAnchors: 36, instrumentedStubs: 36
			, indentationPreserved: true
		});
		assert.equal(stubs.length, 36);
		assert.equal(instrumented.edits.stubs, 36);
		for(const stub of stubs)
			assert.ok(instrumented.files[path].includes(stub[0] + "\n"
				+ stub[1] + "GraphFaultProbe.tick();"));
	}
);

test("downstream receipt repair refreshes exactly 96 live citations"
	, async () => {
		const history = await record();
		assert.equal(history.liveFiles, 2661);
		assert.equal(history.refreshedPins, 96);
		assert.equal(history.remainingMismatches, 0);
		assert.equal(history.missingLiveFiles, 0);
		assert.deepEqual(history.currentSourcePins.map(item => ({
			path: item.path, count: item.count
		})), [{
			path: ".github/workflows/consumer-matrix.yml", count: 92
		}
		, {
			path: "tests/helpers/jvm-recursive-callable-instrument.mjs", count: 1
		}
		, {
			path: "tests/jvm-recursive-callable-contract.test.mjs", count: 3
		}]);
		let restored = beforeConsumerTypeSurfaceDocumentationContractRepairSource(
			"docs/type-surface.v1.json"
			, await readFile("docs/type-surface.v1.json", "utf8"));
		for(const pin of history.currentSourcePins)
		{
			assert.equal(restored.split(pin.current).length - 1
				, pin.count, pin.path);
			restored = restored.replaceAll(pin.current, pin.previous);
		}
		assert.equal(restored, git(["show"
			, consumerTypeSurfaceReceiptRepairImplementation
				+ ":docs/type-surface.v1.json"]));
	}
);

test("downstream receipt repair preserves the frozen #1220 model"
	, async () => {
		const history = await record();
		assert.deepEqual(history.exactModel, {
			sha256:
				"1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("downstream receipt repair authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerTypeSurfaceReceiptRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerTypeSurfaceReceiptRepairImplementation
				+ ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerTypeSurfaceReceiptRepairUpdate(current, forged));
	}
);

test("downstream receipt repair writer refuses another record", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-type-surface-receipt-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-type-surface-receipt-repair-source-history-20261031[.]json/u);
});
