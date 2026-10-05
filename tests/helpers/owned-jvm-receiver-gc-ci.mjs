/**
 * Require optimized receiver lifetime checks in native and container JVM CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedJvmReceiverCi } from "./owned-jvm-receiver-ci.mjs";

export const ownedJvmReceiverGcScript = "LEAN_BRIDGE_OWNED_JVM_RECEIVER_GC_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-receiver-gc.test.mjs";
export const ownedJvmReceiverGcReports = ["ordinary", "reviewed"].map(mode => `build/owned-jvm-receiver-gc/${mode}.json`);
export const ownedJvmReceiverGcLines = [
	"npm run test:owned-jvm-receiver-gc > build/owned-jvm-receiver-gc.log 2>&1"
	, "cat build/owned-jvm-receiver-gc.log"
	, ...["tests 2", "pass 2", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-jvm-receiver-gc.log`)
	, ...ownedJvmReceiverGcReports.map(path => "test -s " + path)
];

/**
 * Keep the full receiver gate and require each GC report without skipped cases.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Actual package scripts.
 */
export const assertOwnedJvmReceiverGcCi = (workflow, manifest) => {
	assertOwnedJvmReceiverCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-jvm-receiver-gc"], ownedJvmReceiverGcScript);
	const steps = workflow.split("      - name: ").filter(section => section.split("\n").includes("        id: type_corpus_jvm"));
	assert.equal(steps.length, 1); const [step] = steps;
	for(const line of ownedJvmReceiverGcLines) assert.ok(step.split("\n").includes("          " + line), line);
	const upload = workflow.split("      - name: Upload installed Java and Kotlin corpus observations\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {8}if: always\(\) && matrix\.profile == 'jvm'$/mu);
	for(const path of ["build/owned-jvm-receiver-gc/", "build/owned-jvm-receiver-gc.log"])
		assert.ok(upload.split("\n").includes("            " + path), path);
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-jvm-receiver-gc"'));
};
