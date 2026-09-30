/**
 * Reject fabricated JVM borrow observations and preserve previous source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedJvmBorrowExecution, assertOwnedJvmBorrowCi } from "./helpers/owned-jvm-borrow-evidence.mjs";
import { ownedJvmBorrowPath, ownedJvmBorrowBaseline, ownedJvmBorrowPrevious
	, ownedJvmBorrowAddedPaths, ownedJvmBorrowChangedPaths
	, beforeOwnedJvmBorrow, reverseOwnedJvmBorrowUpdate } from "./helpers/owned-jvm-borrow-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJvmBorrowPath, "utf8"));

test("JVM borrow evidence authenticates complete source changes without rewriting predecessors", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-jvm-borrows");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJvmBorrowBaseline);
	assert.deepEqual(record.previous, ownedJvmBorrowPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedJvmBorrowAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJvmBorrowChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedJvmBorrow(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJvmBorrow(update.path, prior), prior);
		assert.equal(beforeOwnedJvmBorrow(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded change */\n";
		assert.equal(beforeOwnedJvmBorrow(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJvmBorrowUpdate(unknown, update));
		for(const changed of [{ ...update, path: "unrelated.mjs" }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJvmBorrowUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedJvmBorrow(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	const module = "src/backends/jvm/owned-borrows.mjs";
	const files = JSON.parse(await readFile("config/cli-package.v1.json", "utf8")).files;
	assert.deepEqual(JSON.parse(await readFile("package.json", "utf8")).files, files);
	assert.ok(files.includes(module));
	assert.ok(JSON.parse(await readFile("nix/perl-engine-source-boundary.json", "utf8")).includedFiles.includes(module));
	assert.equal(classifyRepositoryTest("tests/owned-jvm-borrow-evidence.test.mjs"), "contract");
});

test("JVM borrow evidence requires real Lean and installed Maven consumers on both paths", async () => {
	await assertOwnedJvmBorrowExecution(await read());
});

test("JVM borrow evidence rejects missing observations, forged ownership and false scope", async () => {
	const record = await read();
	for(const mutate of [
		...["docker", "independentRebuild", "otherConsumerBindings", "inheritedProcess", "receiverAnchors", "callbackResultAnchors"].map(key => value => { value.scope[key] = true; })
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.scope.rawResourceViews = "independent"; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unknown"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.borrowOnly.observations.pop(); }
		, value => { value.borrowOnly.observations[1].stdout = "not run"; }
		, value => { value.borrowOnly.observations[0].nativeProbeSha256 = "0".repeat(64); }
		, value => { value.borrowOnly.observations[1].probeSha256 = "0".repeat(64); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].observed.identities++; }
		, value => { value.runtime[1].observed.kotlinFaults[1] = 0; }
		, value => { value.runtime[0].observed.threadExitErrors++; }
		, value => { value.runtime[1].rejectedMutations.pop(); }
		, value => { value.runtime[0].rejectedMutations[0].compiled = false; }
		, value => { value.runtime[0].nativeProbeSha256 = "0".repeat(64); }
		, value => { value.runtime[1].instrumentedRuntimeSha256 = "0".repeat(64); }
		, value => { value.runtime[0].kotlinProbeSha256 = "0".repeat(64); }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceRemovedBeforeInstallation = false; }
		, value => { value.packages[1].deterministicReassembly = false; }
		, value => { value.packages[1].input.sourceIdentity.extractorSha256 = "0".repeat(64); }
		, value => { value.packages[0].nativeReceipt.resultAnchors.exports[0].parameter = 999; }
		, value => { value.packages[1].adapter.jvmValues.resultAnchors.expiration = "session-close"; }
		, value => { value.packages[0].manifest.ownedValues.resultAnchors.emptyValues = "discarded"; }
		, value => { value.packages[1].manifest.schemaVersion = 2; }
		, value => { value.packages[0].manifest.bindingIrSha256 = "0".repeat(64); }
		, value => { value.packages[1].manifest.runtimeIdentity = "0".repeat(64); }
		, value => { value.packages[1].tamperRejections.pop(); }
		, value => { value.packages[0].runtimeReceipt.pointerBits = 32; }
		, value => { value.packages[1].compiled.schemaVersion = 2; }
		, value => { value.packages[1].adapter.gmp.binding = "global-symbols"; }
		, value => { value.packages[0].compiled.kotlin.options.pop(); }
		, value => { value.packages[1].observations.pop(); }
		, value => { value.packages[0].observations[0].jvm.compilerFreeExecution = false; }
		, value => { value.packages[1].observations[1].jvm.exactPublicSignatures = false; }
		, value => { value.packages[0].observations[0].jvm.consumerSourceSha256 = "0".repeat(64); }
		, value => { value.packages[1].observations[1].jvm.signaturesSha256 = "0".repeat(64); }
		, value => { value.packages[0].observations[0].jvm.documentation[0].sourceSha256 = "0".repeat(64); }
		, value => { value.packages[1].observations[1].jvm.documentation[0].stdout = "not executed"; }
		, value => { value.packages[0].observations[0].observation.results.pop(); }
		, value => { value.packages[1].observations[1].observation.results.at(-1).diagnostics[0].code = "SYNTAX_ERROR"; }
		, value => { value.packages[1].observations[1].observation.results.at(-1).sourceSha256 = "0".repeat(64); }
		, value => { value.packages[0].observations[0].jvm.inspection.scenarios.pop(); }
		, value => { value.packages[1].observations[0].jvm.inspection.recomputedMutableReceipt = false; }
		, value => { value.packages[0].observations[0].jvm.inspection.scenarios[1].existingPackageUsable = false; }
		, value => { value.packages[1].observations[0].jvm.inspection.scenarios[0].rejected = false; }
		, value => { value.packages[0].observations[0].jvm.runtimeModules.push("jdk.compiler"); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedJvmBorrowExecution(changed), undefined, mutate.toString());
	}
});

test("JVM borrow CI requires eight enabled tests and every runtime and package report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedJvmBorrowCi(workflow, manifest);
	for(const line of [
		"          npm run test:owned-jvm-borrows > build/owned-jvm-borrows.log 2>&1"
		, "          rg '^# pass 8$' build/owned-jvm-borrows.log"
		, "          rg '^# fail 0$' build/owned-jvm-borrows.log"
		, "          rg '^# skipped 0$' build/owned-jvm-borrows.log"
		, ...["ordinary", "reviewed", "borrow-only", "ordinary-installed", "reviewed-installed"].map(name => `          test -s build/owned-jvm-borrows/${name}.json`)
		, "            build/owned-jvm-borrows/"
		, "            build/owned-jvm-borrows.log"
	]) {
		assert.ok(workflow.includes(line + "\n"));
		assert.throws(() => assertOwnedJvmBorrowCi(workflow.replace(line + "\n", ""), manifest));
	}
	const key = "test:owned-jvm-borrows";
	assert.throws(() => assertOwnedJvmBorrowCi(workflow, { ...manifest, scripts: { ...manifest.scripts, [key]: manifest.scripts[key].replace("=1", "=0") } }));
});
