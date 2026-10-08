/**
 * Locate the dedicated owned JVM CI job, its verification step and its retained evidence (#1449).
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Return one top-level job's text.
 *
 * @param workflow - Complete workflow text.
 * @param job - Job key.
 */
const jobText = (workflow, job) => workflow.split(`\n  ${job}:\n`)[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];

/**
 * Return one step of the owned JVM job, from its name to the next step.
 *
 * @param workflow - Complete workflow text.
 * @param name - Title written after the step's `- name:`.
 */
const ownedJvmStepNamed = (workflow, name) => jobText(workflow, "owned-jvm-values")?.split(`      - name: ${name}\n`)[1]?.split("      - name: ")[0];

/**
 * The step that runs every owned JVM acceptance command and report check.
 *
 * @param workflow - Complete workflow text.
 */
export const ownedJvmStep = workflow => ownedJvmStepNamed(workflow, "Verify owned JVM values, transfers, borrows and receivers");

/**
 * The always-run upload of every owned JVM report and log.
 *
 * @param workflow - Complete workflow text.
 */
export const ownedJvmUpload = workflow => ownedJvmStepNamed(workflow, "Preserve owned JVM value acceptance");

/**
 * Require that owned JVM failures fail their own job and block the published support summary.
 *
 * @param workflow - Complete workflow text.
 */
export const assertOwnedJvmEnforced = workflow => {
	const job = jobText(workflow, "owned-jvm-values");
	assert.ok(job, "owned JVM job");
	assert.match(job, /^ {4}timeout-minutes: 240$/mu);
	// No job or step may be skipped or allowed to fail; only the evidence upload runs on failure too.
	assert.doesNotMatch(job, /continue-on-error|^ {4}if:/mu);
	assert.deepEqual(job.match(/^ {8}if: .*$/gmu), ["        if: always()"]);
	assert.doesNotMatch(ownedJvmStep(workflow) ?? "if:", /^ {8}(?:if|continue-on-error):/mu);
	const upload = ownedJvmUpload(workflow);
	assert.match(upload ?? "", /^ {8}if: always\(\)$/mu);
	assert.match(upload ?? "", /^ {10}if-no-files-found: error$/mu);
	const summary = jobText(workflow, "support-summary");
	assert.ok(summary?.split("\n").includes("      - owned-jvm-values"), "summary dependency");
	assert.ok(summary?.includes("      - name: Enforce owned JVM value acceptance\n        if: needs.owned-jvm-values.result != 'success'\n        run: exit 1\n"), "summary enforcement");
};
