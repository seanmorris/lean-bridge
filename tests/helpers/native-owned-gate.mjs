/**
 * Check actual ownership commands and artifacts in the required values job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nativeConsumerValueGate, nativeConsumerValuesJob } from "./native-consumer-partition.mjs";

/**
 * Keep archived unsplit workflow checks while inspecting live split execution.
 *
 * @param workflow - Complete downstream workflow source.
 * @param command - Exact enabled shell command.
 * @param reports - Exact nonempty report checks required after execution.
 * @param uploads - Exact artifact files or directories retained by the job.
 */
export const assertNativeOwnedGate = (workflow, command, reports, uploads = reports) => {
	const split = workflow.includes(`  ${nativeConsumerValuesJob}:\n`);
	const { step, upload } = split ? nativeConsumerValueGate(workflow) : { step: workflow, upload: workflow };
	assert.ok(step.split("\n").includes("          " + command));
	if(split) assert.equal(step.split(command).length - 1, 1);
	else assert.ok(workflow.includes('consumer_command="$consumer_command && ' + command + '"'));
	for(const path of reports) assert.ok(step.split("\n").includes("          test -s " + path), path);
	for(const path of uploads) assert.ok(upload.split("\n").includes("            " + path), path);
};
