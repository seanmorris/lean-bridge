/**
 * Require actual recurring installed gates and preservation of the older measured gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { enableFinContainerEdgeWorkflow, disableFinContainerEdgeWorkflow } from "./fin-container-edge-ci.mjs";
import { assertFinLateWorkflow, enableFinLateWorkflow, disableFinLateWorkflow } from "./fin-container-late-ci-workflow.mjs";

test("late-input CI runs nine selections with both Python floors, WIT and original artifact uploads", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertFinLateWorkflow(workflow);
	assert.equal(sha256(enableFinLateWorkflow(disableFinLateWorkflow(workflow))), sha256(workflow));
	assert.equal(sha256(enableFinContainerEdgeWorkflow(disableFinContainerEdgeWorkflow(workflow))), sha256(workflow));
	assert.throws(() => assertFinLateWorkflow(disableFinLateWorkflow(workflow)));
});

test("late-input CI rejects missing or weakened calls, toolchain selections and uploads", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const lines = workflow.split("\n").filter(line => /^ {10}(?:LEAN_BRIDGE_PYTHON='[^']+' )?bash scripts\/run-fin-late-(?:native|wit)-ci\.sh/u.test(line));
	assert.equal(lines.length, 9);
	for(const line of lines)
	{
		for(const replacement of ["", line + " || true", line.replace("bash scripts/", "echo scripts/")])
		{
			const changed = workflow.replace(line + "\n", replacement + "\n");
			assert.notEqual(sha256(changed), sha256(workflow)); assert.throws(() => assertFinLateWorkflow(changed));
		}
	}
	for(const path of ["build/fin-late-wit-ci", ...["c-family", "python311", "python312", "rust", "ruby", "dotnet", "jvm", "php-native"].map(lane => `build/fin-late-native-ci/${lane}`)])
		assert.throws(() => assertFinLateWorkflow(workflow.replace(`            ${path}\n`, "")));
	const python = "LEAN_BRIDGE_PYTHON='${{ steps.collection_python312.outputs.python-path }}' bash scripts/run-fin-late-native-ci.sh python312";
	assert.throws(() => assertFinLateWorkflow(workflow.replace(python, python.replace("python312.outputs", "python311.outputs"))));
	for(const line of lines)
	{
		const changed = workflow.replace(`&& ${line.trim()}`, "&& true");
		assert.notEqual(sha256(changed), sha256(workflow)); assert.throws(() => assertFinLateWorkflow(changed));
	}
});
