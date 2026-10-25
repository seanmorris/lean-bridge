/**
 * Bind a scoped npm producer to the complete recurring JavaScript job.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedCheckedRecordNpmWorkflow
	= ".github/workflows/owned-checked-record-npm-browser.yml";
export const ownedCheckedRecordNpmTagPrefix = "ci/owned-checked-record-npm/";
export const ownedCheckedRecordNpmGuard = "${{ github.event_name == 'workflow_dispatch' || (github.event_name == 'create' && github.event.ref_type == 'tag' && github.event.ref == format('ci/owned-checked-record-npm/{0}', github.sha)) }}";
export const ownedCheckedRecordNpmHeader = `name: Owned checked-record npm and browser producer

on:
  create:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: owned-checked-record-npm-\${{ github.ref }}
  cancel-in-progress: false

env:
  NODE_VERSION: "22"
  LEAN_BRIDGE_CONSUMER_PERFORMANCE_DIR: build/consumer-ci/performance

jobs:
`;

/**
 * Select only a lane's recurring workflow or its exact scoped counterpart.
 *
 * @param lane - Closed hosted lane contract.
 * @param workflow - Actual workflow from the authenticated run API record.
 */
export const selectOwnedCheckedRecordWorkflow = (lane, workflow = lane.workflow) => {
	assert.equal(typeof workflow, "string");
	assert.ok(workflow === lane.workflow
		|| (lane.kind === "javascript" && workflow === ownedCheckedRecordNpmWorkflow)
	, "Unknown owned checked-record producer workflow: " + workflow);
	return workflow;
};

/**
 * Require every command, environment setting, observation and upload unchanged.
 * The only job difference is the explicit scoped-trigger guard.
 * Compare the two sources at the producer revision; live CI policy is checked
 * separately so a later policy change cannot reinterpret an old job's commands.
 *
 * @param source - Complete dedicated producer workflow.
 * @param recurring - Complete recurring Consumer Matrix workflow.
 */
export const assertOwnedCheckedRecordNpmProducer = (source, recurring) => {
	const job = recurring.match(/^ {2}owned-javascript-wasm:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
	assert.ok(job, "Recurring JavaScript producer must exist");
	const expected = ownedCheckedRecordNpmHeader + job.trimEnd().replace(
		"  owned-javascript-wasm:\n"
		, "  owned-javascript-wasm:\n    if: " + ownedCheckedRecordNpmGuard + "\n"
	) + "\n";
	assert.equal(source, expected
		, "Scoped producer must retain the complete recurring job and closed trigger");
	return { jobs: 1, workflow: ownedCheckedRecordNpmWorkflow
		, recurring: ".github/workflows/consumer-matrix.yml" };
};
