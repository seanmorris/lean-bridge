/**
 * Keep recursive JVM admission compatible with installed collection releases.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertJvmSharedRegressionEvidence, assertJvmSharedSourceTransition, jvmSharedProductionPaths } from "./helpers/jvm-shared-regression-receipt.mjs";
import { beforeJvmSharedVerification } from "./helpers/jvm-shared-verifier-updates.mjs";

const readRecord = async () => JSON.parse(await readFile("docs/evidence/jvm-shared-regressions-20260924.json"));

test("shared JVM compiler changes preserve original installed Java and Kotlin packages", async () => {
	const record = await readRecord();
	await assertJvmSharedRegressionEvidence(record);
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_JVM_COLLECTION_TEST=1 LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java,kotlin node --test tests/jvm-collections.test.mjs"));
	assert.ok(workflow.includes("build/collections/jvm.json"));
});

test("shared JVM source acceptance requires measured current sources and exact predecessors", async () => {
	const record = await readRecord();
	for(const path of jvmSharedProductionPaths)
	{
		const source = await readFile(path, "utf8"), expected = record.predecessors[path].sha256;
		assert.equal(await assertJvmSharedSourceTransition(path, source, expected), true);
		assert.equal(await assertJvmSharedSourceTransition(path, source, "0".repeat(64)), false);
		await assert.rejects(() => assertJvmSharedSourceTransition(path, source + "\n// unrelated edit\n", expected));
	}
	assert.equal(await assertJvmSharedSourceTransition("src/build/native-project.mjs", "", "0".repeat(64)), false);
	for(const [path, expected] of Object.entries(record.verifierPredecessors))
	{
		const source = await readFile(path, "utf8");
		assert.equal(sha256(beforeJvmSharedVerification(path, source)), expected);
		assert.notEqual(sha256(beforeJvmSharedVerification(path, source + "\n// unrelated edit\n")), expected);
		assert.throws(() => beforeJvmSharedVerification(path, source + source));
	}
});

test("shared JVM evidence rejects incomplete runs and weakened package or safety observations", async () => {
	const original = await readRecord();
	for(const change of [
		record => { record.finalAcceptance = true; }
		, record => { record.packageGlibcFloor = "2.38"; }
		, record => { delete record.predecessors["src/build/compile-jvm-sources.mjs"]; }
		, record => { record.predecessors["src/build/compile-jvm-sources.mjs"].text += "\n"; }
		, record => { record.sourceHashes["tests/jvm-collections.test.mjs"] = "0".repeat(64); }
		, record => { record.executions.pop(); }
		, record => { record.executions[1].profile = "java"; }
		, record => { record.executions[0].checks--; }
		, record => { record.executions[0].packages[0].artifacts[0].sha256 = "0".repeat(64); }
		, record => { record.executions[0].faults.checkpoints--; }
		, record => { record.executions[0].jvm.runtimeOnlyExecution = false; }
		, record => { record.executions[0].jvm.nativeLibraries["unexpected.so"] = "0".repeat(64); }
		, record => { record.log.text = record.log.text.replace("# skipped 0", "# skipped 1"); }
	]) {
		const changed = structuredClone(original); change(changed);
		changed.executionsSha256 = sha256(canonicalJson(changed.executions));
		changed.log.sha256 = sha256(changed.log.text);
		await assert.rejects(() => assertJvmSharedRegressionEvidence(changed));
	}
});
