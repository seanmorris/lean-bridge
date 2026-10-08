/**
 * Require every Java/Kotlin receiver case and all installed Maven reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedJvmEnforced, ownedJvmStep, ownedJvmUpload } from "./owned-jvm-job.mjs";
import { assertOwnedDotnetReceiverCi } from "./owned-dotnet-receiver-ci.mjs";
import { assertOwnedJvmBorrowCi } from "./owned-jvm-borrow-evidence.mjs";

export const ownedJvmReceiverScript = "LEAN_BRIDGE_OWNED_JVM_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-receiver-core.test.mjs tests/owned-jvm-receiver-plain.test.mjs tests/owned-jvm-receiver-unanchored.test.mjs tests/owned-jvm-receiver-packaging.test.mjs tests/owned-jvm-receiver-resource-packaging.test.mjs";
export const ownedJvmReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-plain", "-consuming", "-unanchored", "-package", "-resource-package"].map(suffix => `build/owned-jvm-receiver-core/${mode}${suffix}.json`));

/**
 * Keep explicit tool setup, every no-skip gate and both native/container routes.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Actual package scripts.
 */
export const assertOwnedJvmReceiverCi = (workflow, manifest) => {
	assertOwnedDotnetReceiverCi(workflow, manifest); assertOwnedJvmBorrowCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-jvm-receivers"], ownedJvmReceiverScript);
	const step = ownedJvmStep(workflow);
	assert.ok(step);
	assertOwnedJvmEnforced(workflow);
	for(const line of [
		"bash scripts/bootstrap-rust-ci.sh"
		, "npm run test:owned-jvm-receivers > build/owned-jvm-receivers.log 2>&1"
		, "cat build/owned-jvm-receivers.log"
		, ...["tests 15", "pass 15", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-jvm-receivers.log`)
		, ...ownedJvmReceiverReports.map(path => "test -s " + path)
	]) assert.ok(step.split("\n").includes("          " + line), line);
	for(const name of ["RUSTC", "CARGO", "PYTHON", "RUBY", "GEM", "DOTNET", "JAVA", "JAVAC", "KOTLINC", "MAVEN"])
		assert.ok(step.includes(`export LEAN_BRIDGE_${name}=`), name);
	const upload = ownedJvmUpload(workflow);
	for(const path of ["build/owned-jvm-receiver-core/", "build/owned-jvm-receivers.log"])
		assert.ok(upload.split("\n").includes("            " + path));
	assert.ok(!workflow.includes('consumer_command="$consumer_command && npm run test:owned-jvm-receivers"'));
};
