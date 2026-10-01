/**
 * Require both managed close repairs to pass their complete installed gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedPythonBorrowExecution, assertOwnedPythonBorrowCi } from "./owned-python-borrow-evidence.mjs";
import { assertOwnedRubyBorrowExecution, assertOwnedRubyBorrowCi } from "./owned-ruby-borrow-evidence.mjs";

export const managedCloseScope = Object.freeze({
	profiles: ["python", "ruby"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, foreignCloseSchedulesPerRuntime: 12
	, compiledNegativeVariants: { python: 8, ruby: 7 }
	, emptyAndNestedValues: true, installedPackages: true
	, sourceFreeInstallation: true, relocated: true, documentationExecuted: true
	, receiverAnchors: false, callbackResultAnchors: false
	, otherConsumerProjections: false, installedSupportPromotions: 0
});

/**
 * Validate each language's actual Lean, package, typing and cleanup observations.
 *
 * @param record - Complete source-bound managed close repair receipt.
 */
export const assertManagedCloseExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "managed-whole-close-repair");
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, managedCloseScope);
	assert.equal(record.python.kind, "owned-python-close-repair");
	assert.equal(record.ruby.kind, "owned-ruby-close-repair");
	await assertOwnedPythonBorrowExecution(record.python);
	await assertOwnedRubyBorrowExecution(record.ruby);
};

/**
 * Keep both installed gates mandatory in the downstream workflow.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Parsed package scripts.
 */
export const assertManagedCloseCi = (workflow, manifest) => {
	assertOwnedPythonBorrowCi(workflow, manifest);
	assertOwnedRubyBorrowCi(workflow, manifest);
};
