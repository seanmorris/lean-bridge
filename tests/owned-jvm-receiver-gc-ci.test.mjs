/**
 * Reject missing GC cases, suppressed failures and incomplete JVM CI evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedJvmReceiverGcCi, ownedJvmReceiverGcLines } from "./helpers/owned-jvm-receiver-gc-ci.mjs";

test("JVM receiver GC CI runs both source paths and retains their evidence", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedJvmReceiverGcCi(workflow, manifest);
	for(const suffix of ["", "-ci", "-evidence"])
		assert.equal(classifyRepositoryTest(`tests/owned-jvm-receiver-gc${suffix}.test.mjs`), "contract");
});

test("JVM receiver GC CI rejects omitted gates, reports and container execution", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedJvmReceiverGcCi(workflow, manifest);
	for(const line of [
		...ownedJvmReceiverGcLines.map(value => "          " + value)
		, "            build/owned-jvm-receiver-gc/"
		, "            build/owned-jvm-receiver-gc.log"
		, '              consumer_command="$consumer_command && npm run test:owned-jvm-receiver-gc"'
	]) {
		assert.equal(workflow.split(line + "\n").length, 2, line);
		assert.throws(() => assertOwnedJvmReceiverGcCi(workflow.replace(line + "\n", ""), manifest), undefined, line);
	}
	for(const script of [
		undefined, "node --test tests/owned-jvm-receiver-gc.test.mjs"
		, manifest.scripts["test:owned-jvm-receiver-gc"] + " || true"
	]) {
		const changed = structuredClone(manifest);
		changed.scripts["test:owned-jvm-receiver-gc"] = script;
		assert.throws(() => assertOwnedJvmReceiverGcCi(workflow, changed));
	}
});
