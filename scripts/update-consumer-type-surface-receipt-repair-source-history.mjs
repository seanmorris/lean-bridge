#!/usr/bin/env node
/**
 * Record the downstream type-surface receipt and JVM instrumentation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileCallableJvmGraphPackageModel }
	from "../src/backends/jvm/callable-graph-model.mjs";
import { generateCallableJvmGraphPackage }
	from "../src/backends/jvm/callable-graph-package.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import {
	consumerTypeSurfaceReceiptRepairHistoryAdditions
	, consumerTypeSurfaceReceiptRepairHistoryPath
	, consumerTypeSurfaceReceiptRepairImplementation
	, consumerTypeSurfaceReceiptRepairImplementationPaths
	, consumerTypeSurfaceReceiptRepairIntegrationPaths
	, consumerTypeSurfaceReceiptRepairPredecessor
} from "../tests/helpers/consumer-type-surface-receipt-repair-source-history.mjs";
import { instrumentJvmRecursiveCallbacks }
	from "../tests/helpers/jvm-recursive-callable-instrument.mjs";
import { nativeRecursiveCallableReviewedIr }
	from "../tests/helpers/native-recursive-callable-fixture.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-type-surface-receipt-repair-source-history.mjs");
assert.equal(existsSync(consumerTypeSurfaceReceiptRepairHistoryPath), false
	, consumerTypeSurfaceReceiptRepairHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerTypeSurfaceReceiptRepairImplementation);
assert.equal(git(["rev-parse"
	, consumerTypeSurfaceReceiptRepairImplementation + "^"]).trim()
, consumerTypeSurfaceReceiptRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerTypeSurfaceReceiptRepairPredecessor
	, consumerTypeSurfaceReceiptRepairImplementation, "--"])
, [...consumerTypeSurfaceReceiptRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerTypeSurfaceReceiptRepairPredecessor
	, consumerTypeSurfaceReceiptRepairImplementation, "--"]), []);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerTypeSurfaceReceiptRepairIntegrationPaths])
, [...consumerTypeSurfaceReceiptRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerTypeSurfaceReceiptRepairHistoryAdditions])
, [...consumerTypeSurfaceReceiptRepairHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const beforeInventory = git(["show"
	, consumerTypeSurfaceReceiptRepairImplementation + ":" + inventoryPath]);
const afterInventory = await readFile(inventoryPath, "utf8");
const pinPaths = [
	".github/workflows/consumer-matrix.yml"
	, "tests/helpers/jvm-recursive-callable-instrument.mjs"
	, "tests/jvm-recursive-callable-contract.test.mjs"
];
const expectedPinCounts = [92, 1, 3];
const currentSourcePins = pinPaths.map((path, index) => ({
	path, count: expectedPinCounts[index]
	, previous: sha256(git(["show"
		, consumerTypeSurfaceReceiptRepairPredecessor + ":" + path]))
	, current: sha256(git(["show"
		, consumerTypeSurfaceReceiptRepairImplementation + ":" + path]))
}));
let restored = afterInventory;
for(const pin of currentSourcePins)
{
	assert.equal(afterInventory.split(pin.current).length - 1, pin.count
		, pin.path);
	assert.equal(afterInventory.includes(pin.previous), false, pin.path);
	restored = restored.replaceAll(pin.current, pin.previous);
}
assert.equal(restored, beforeInventory);

const document = JSON.parse(afterInventory);
const liveFiles = typeSurfaceEvidenceFiles(document).filter(file =>
	!file.path.startsWith("docs/evidence/"));
const mismatches = [], missing = [];
for(let offset = 0; offset < liveFiles.length; offset += 16)
{
	const batch = liveFiles.slice(offset, offset + 16);
	const actual = await Promise.all(batch.map(async file => {
		try
		{
			return createHash("sha256").update(
				await readFile(file.path)).digest("hex");
		}
		catch(error)
		{ missing.push({ path: file.path, code: error.code }); return null; }
	}));
	for(const [index, file] of batch.entries())
		if(actual[index] !== null && actual[index] !== file.sha256)
			mismatches.push({
				path: file.path, actual: actual[index], expected: file.sha256
			});
}
assert.equal(liveFiles.length, 2661);
assert.deepEqual(missing, []);
assert.deepEqual(mismatches, []);

const workflow = git(["show"
	, consumerTypeSurfaceReceiptRepairImplementation
		+ ":.github/workflows/consumer-matrix.yml"]);
const starts = [...workflow.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gmu)];
const jobs = new Map(starts.map((match, index) => [
	match[1]
	, workflow.slice(match.index
		, starts[index + 1]?.index ?? workflow.length)
]));
const receiptConsumers = [
	"browser-consumer", "host-null-systems", "managed-consumers"
	, "native-c-family-values", "native-consumers", "node-consumers"
	, "owned-jvm-values", "owned-wit-receivers", "php-consumers"
	, "php-multi-profile", "php-wasm-callback-results"
	, "php-wasm-consumers", "php-wasm-corpus", "php-wasm-receivers"
	, "reviewed-fin-wasm-entry", "wasi-consumer"
];
const producer = jobs.get("type-surface-authentication");
assert.match(producer
	, /node scripts\/create-core-type-surface-evidence-receipt[.]mjs/u);
assert.match(producer
	, /name: consumer-type-surface-\$\{\{ github[.]sha \}\}/u);
for(const name of ["reviewed-ir-admission", ...receiptConsumers])
{
	const job = jobs.get(name);
	assert.match(job, /^ {4}needs: type-surface-authentication$/mu, name);
	assert.match(job, /^ {8}uses: actions\/download-artifact@v8$/mu, name);
	assert.match(job
		, /LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT=\$GITHUB_WORKSPACE\/build\/consumer-type-surface\/receipt[.]json/u
		, name);
}

const ir = nativeRecursiveCallableReviewedIr();
const compiled = compileCallableJvmGraphPackageModel(ir);
const generated = generateCallableJvmGraphPackage(ir);
const instrumented = instrumentJvmRecursiveCallbacks(
	generated, compiled.namespace);
const runtimePath = "src/main/java/"
	+ compiled.namespace.replaceAll(".", "/") + "/_CallableGraphRuntime.java";
const stubs = [...generated[runtimePath].matchAll(
	/^([ \t]+)(var stub = [^\n]+;)$/gm)];
assert.equal(stubs.length, 36);
assert.equal(instrumented.edits.stubs, stubs.length);
for(const stub of stubs)
	assert.ok(instrumented.files[runtimePath].includes(stub[0] + "\n"
		+ stub[1] + "GraphFaultProbe.tick();"));

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, consumerTypeSurfaceReceiptRepairImplementation + ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of consumerTypeSurfaceReceiptRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerTypeSurfaceReceiptRepairPredecessor
		, consumerTypeSurfaceReceiptRepairImplementation
		, { maximumEditBytes: 256 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-type-surface-receipt-repair-"));
try
{
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", consumerTypeSurfaceReceiptRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerTypeSurfaceReceiptRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", consumerTypeSurfaceReceiptRepairImplementation
	], { input: "Authenticate downstream type-surface receipt repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerTypeSurfaceReceiptRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerTypeSurfaceReceiptRepairImplementation
			, integrationCommit, { maximumEditBytes: 256 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of consumerTypeSurfaceReceiptRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(consumerTypeSurfaceReceiptRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-type-surface-receipt-repair-v1"
		, predecessorCommit: consumerTypeSurfaceReceiptRepairPredecessor
		, implementationCommit: consumerTypeSurfaceReceiptRepairImplementation
		, failedRun: { workflow: 41209387856 }
		, failures: [{
			job: 124566906989, name: "Managed consumer (jvm)"
			, completedAt: "2026-10-31T16:10:45Z"
			, step: "Enforce managed consumer support"
			, missingEvidence:
				"docs/evidence/browser-callback-fin-20261008/ordinary.json"
			, instrumentationError: "stubs: undefined"
		}
		, {
			job: 124566907106, name: "PHP-Wasm corpus (values)"
			, completedAt: "2026-10-31T16:12:18Z"
			, step: "Enforce PHP-Wasm corpus"
			, missingEvidence:
				"docs/evidence/browser-callback-fin-20261008/ordinary.json"
			, derivedUploadFailures: true
		}]
		, rootCauses: [{
			kind: "sparse-evidence-corpus"
			, detail: "Metadata-only consumer checkouts invoked readTypeSurface without the commit-bound receipt produced from the complete authenticated corpus."
		}
		, {
			kind: "generated-jvm-indentation"
			, detail: "Fault instrumentation required eight spaces while the generated runtime uses tabs for stub declarations."
		}]
		, receipt: {
			producer: "type-surface-authentication"
			, artifact: "consumer-type-surface-${{ github.sha }}"
			, path: "build/consumer-type-surface/receipt.json"
			, reviewedConsumer: "reviewed-ir-admission"
			, metadataConsumers: receiptConsumers
		}
		, jvmInstrumentation: {
			runtimePath, stubAnchors: stubs.length
			, instrumentedStubs: instrumented.edits.stubs
			, indentationPreserved: true
		}
		, scope: "Authenticate the retained type-surface evidence corpus once, distribute its exact commit-bound receipt to the reviewed corpus and all sixteen metadata-only Nix consumers, and retain their bounded sparse source closures. Repair recursive JVM fault instrumentation against the actual generated tab indentation and prove all 36 stub anchors. Refresh exactly 96 live source citations across three paths without changing any support cell, stage, observation, package API or frozen #1220 model."
		, liveFiles: liveFiles.length, remainingMismatches: 0
		, missingLiveFiles: 0, refreshedPins: 96, currentSourcePins
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions, 96 live source pins and 36 JVM stubs.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
