/**
 * Keep retained Scalar Fin evidence out of the bounded Node consumer checkout
 * while preserving its complete registration in the Core contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimePath = "tests/scalar-fin-rejection.test.mjs";
const retainedPath = "tests/scalar-fin-source-entry.test.mjs";
const retainedImports = [
	"./helpers/scalar-fin-source-entry-evidence-tests.mjs"
	, "./helpers/scalar-fin-source-entry-integration-source-history-tests.mjs"
	, "./helpers/scalar-fin-source-entry-run-tests.mjs"
	, "./helpers/scalar-fin-source-entry-ci-source-history-tests.mjs"
];

test("sparse Scalar Fin runtime acceptance and retained history stay independently registered"
	, async () => {
		const [runtime, retained, workflow] = await Promise.all([
			readFile(runtimePath, "utf8")
			, readFile(retainedPath, "utf8")
			, readFile(".github/workflows/consumer-matrix.yml", "utf8")
		]);
		for(const path of retainedImports)
		{
			assert.equal(runtime.includes(path), false, path);
			assert.equal(retained.split(path).length - 1, 1, path);
		}
		assert.match(runtime
			, /import "[.]\/helpers\/scalar-fin-source-entry-tests[.]mjs";/u);
		assert.match(workflow
			, /node --test tests\/scalar-fin-rejection[.]test[.]mjs/u);
		const sparse = workflow.match(
			/^ {2}LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT: \|\n((?: {4}.*\n)+)/mu)?.[1];
		assert.ok(sparse);
		assert.doesNotMatch(sparse, /scalar-fin-source-entry-20261008/u);
	}
);
