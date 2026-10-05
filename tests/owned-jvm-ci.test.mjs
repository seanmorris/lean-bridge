/**
 * Prevent owned Java/Kotlin acceptance from silently skipping or losing reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJvmCi } from "./helpers/owned-jvm-ci.mjs";

const workflow = () => readFile(".github/workflows/consumer-matrix.yml", "utf8");

test("owned JVM CI runs every acceptance layer and retains nonempty observations", async () => {
	assert.deepEqual(assertOwnedJvmCi(await workflow()), {
		testFiles: 11, requiredReports: 25, artifactDirectories: 7
		, recordedRouteMatches: true, realExecutionRequired: true
	});
});

test("owned JVM CI rejects dropped execution, suites, reports and artifacts", async () => {
	const source = await workflow();
	for(const [before, after] of [
		["          LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-runtime.test.mjs", "          node --test --test-concurrency=1 tests/owned-jvm-runtime.test.mjs"]
		, ["tests/owned-jvm-calls.test.mjs tests/verified-jvm-assets.test.mjs", "tests/owned-jvm-calls.test.mjs"]
		, ["          test -s build/owned-jvm-packaging/documentation.json\n", ""]
		, ["            build/owned-jvm-packaging/\n", ""]
		, ['consumer_command="$consumer_command && LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-runtime.test.mjs'
			, 'consumer_command="$consumer_command && node --test --test-concurrency=1 tests/owned-jvm-runtime.test.mjs']
	]) {
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedJvmCi(changed));
	}
});
