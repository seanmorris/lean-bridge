/**
 * The Node job step that runs and checks the installed scalar Fin source-entry probe (VO #1430), and
 * the exact workflow shape it must keep: right after the locked compilation step, non-skippable, with a
 * failure-preserving pipe and its whole output directory in the job's always-run diagnostic artifact.
 *
 * @file
 */
import assert from "node:assert/strict";

export const sourceEntryStepName = "Account Lean source entry on every installed scalar Fin call (instrumented probe packages)";
export const sourceEntryWorkflowStep = `      - name: ${sourceEntryStepName}
        shell: bash
        env:
          LEAN_BRIDGE_LAKE_WASM_TEST: "1"
          LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY: "1"
          LEAN_BRIDGE_SCALAR_FIN_SOURCE_ENTRY_REPORT: build/scalar-fin-source-entry/report.json
          LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine
          LEAN_BRIDGE_LAKE_RUNTIME_ROOT: build/consumer-ci-runtime/lazy
        run: |
          set -euo pipefail
          mkdir -p build/scalar-fin-source-entry
          node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern='^installed scalar Fin rejections never enter the Lean source on any private ABI$' tests/scalar-fin-rejection.test.mjs | tee build/scalar-fin-source-entry/run.tap
          node scripts/check-scalar-fin-source-entry-run.mjs build/scalar-fin-source-entry
`;
export const sourceEntryUploadLine = "            build/scalar-fin-source-entry/\n";
const compileStep = "      - name: Compile locked and dependency-free projects and install relocated npm releases offline\n";
const uninstrumented = "          node --test tests/scalar-fin-rejection.test.mjs\n          test -s build/scalar-fin-rejection/report.json\n";
const uploadStep = "      - name: Preserve installed npm corpus observations\n";
const uploadAnchor = "            build/scalar-fin-rejection/report.json\n";
const nextStep = "\n      - name: ";

const once = (text, part, label) => {
	const index = text.indexOf(part);
	assert.ok(index >= 0 && text.indexOf(part, index + 1) < 0, `exactly one ${label}`);
	return index;
};
/**
 * The step starting at an index, up to the next step of the same job.
 *
 * @param workflow - Workflow text.
 * @param start - Index of the step's name line.
 */
const step = (workflow, start) => {
	const end = workflow.indexOf(nextStep, start + 1);
	assert.ok(end > start, "a following step");
	return workflow.slice(start, end + 1);
};

/**
 * Insert the probe step after the locked compilation step and its directory into the always-run corpus
 * artifact. Every other byte stays as it is.
 *
 * @param workflow - Workflow text without the probe step.
 */
export const insertSourceEntryWorkflow = workflow => {
	assert.ok(!workflow.includes(sourceEntryStepName), "the probe step is not yet present");
	const compile = once(workflow, compileStep, "locked compilation step"), after = compile + step(workflow, compile).length;
	const inserted = workflow.slice(0, after) + sourceEntryWorkflowStep + workflow.slice(after);
	const upload = once(inserted, uploadStep, "corpus artifact step"), block = step(inserted, upload);
	const anchor = upload + once(block, uploadAnchor, "scalar report upload path") + uploadAnchor.length;
	return inserted.slice(0, anchor) + sourceEntryUploadLine + inserted.slice(anchor);
};

/**
 * Require the exact probe step right after the unchanged locked compilation step in the 330-minute Node
 * job, and its directory in that job's always-run corpus artifact.
 *
 * @param workflow - Workflow text.
 */
export const assertSourceEntryWorkflow = workflow => {
	const start = once(workflow, `      - name: ${sourceEntryStepName}\n`, "probe step");
	// Exact text: no continue-on-error, no if, the bash shell, set -euo pipefail, both gates and the checker.
	assert.equal(step(workflow, start), sourceEntryWorkflowStep, "the exact probe step");
	const compile = once(workflow, compileStep, "locked compilation step"), compiled = step(workflow, compile);
	assert.equal(compile + compiled.length, start, "the probe step follows the locked compilation step");
	once(compiled, uninstrumented, "unchanged uninstrumented scalar suite and report");
	assert.doesNotMatch(compiled, /continue-on-error|^ {8}if:/mu, "the compilation step stays gating");
	const job = workflow.lastIndexOf("\n  node-consumers:\n", start);
	assert.ok(job >= 0 && !/\n {2}[a-z][a-z0-9-]*:\n/u.test(workflow.slice(job + 1, start)), "inside the node-consumers job");
	assert.match(workflow.slice(job, workflow.indexOf("\n    steps:\n", job) + 1), /\n {4}timeout-minutes: 330\n/u, "the 330-minute budget");
	const upload = once(workflow, uploadStep, "corpus artifact step"), block = step(workflow, upload);
	assert.ok(upload > start && !/\n {2}[a-z][a-z0-9-]*:\n/u.test(workflow.slice(start, upload)), "the artifact step follows in the same job");
	assert.match(block, /^ {8}if: always\(\)$/mu, "the artifact uploads on failure");
	assert.ok(block.includes(uploadAnchor + sourceEntryUploadLine), "the probe directory beside the scalar report");
	assert.match(block, /^ {10}if-no-files-found: error$/mu);
};
