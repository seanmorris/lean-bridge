/**
 * Validates installed-consumer observations without confusing host warnings with program failures.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { basename } from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";

import { componentScalarAbi } from "../abi/component-scalars.mjs";

const execute = promisify(execFile);
const outputTail = value => String(value ?? "").slice(-16 * 1024);
const processDetails = result => ({
	status: result.status ?? null
	, signal: result.signal ?? null
	, stdout: outputTail(result.stdout)
	, stderr: outputTail(result.stderr)
});

/**
 * Runs a consumer command and preserves both output streams when it fails.
 *
 * @param command - Executable selected by the consumer test.
 * @param args - Arguments passed directly to the executable without a shell.
 * @param options - Child-process options such as the working directory and environment.
 */
export const runConsumerCommand = async (command, args, options = {}) => {
	try
	{
		return { ...await execute(command, args, { maxBuffer: 64 * 1024 * 1024, ...options }), status: 0, signal: null };
	} catch(cause)
	{
		const details = processDetails({ ...cause, status: cause.code });
		const error = new Error(`Consumer command ${basename(command)} failed:\n${JSON.stringify(details, null, 2)}`, { cause });
		Object.assign(error, details, { code: cause.code });
		throw error;
	}
};

// Node 22.10 emits this warning for valid JSON imports. Keep every other stderr byte significant.
const jsonImportWarning = /^\(node:\d+\) ExperimentalWarning: Importing JSON modules is an experimental feature and might change at any time\r?\n(?:\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\r?\n)?/gm;

/**
 * Checks a JSON consumer result while allowing only the explicitly selected host warning.
 *
 * @param observation - Exit status, streams, and expected semantic result.
 * @param observation.label - Description included in assertion failures.
 * @param observation.status - Subprocess exit status, or its spawn error code.
 * @param observation.signal - Signal that terminated the subprocess, if any.
 * @param observation.stdout - Complete JSON output from the consumer.
 * @param observation.stderr - Host diagnostics, kept separate from semantic output.
 * @param observation.expected - Expected decoded JSON value.
 * @param observation.allowNodeJsonImportWarning - Whether to permit Node's known JSON import warning.
 */
export const assertConsumerJsonResult = ({
	label
	, status
	, signal = null
	, stdout = ""
	, stderr = ""
	, expected
	, allowNodeJsonImportWarning = false
}) => {
	let actual;
	let parseError = null;
	try
	{
		actual = JSON.parse(stdout);
	} catch(error)
	{
		parseError = error.message;
	}
	const unexpectedStderr = allowNodeJsonImportWarning ? stderr.replace(jsonImportWarning, "") : stderr;
	if(status !== 0 || signal !== null || unexpectedStderr !== "" || parseError !== null || !isDeepStrictEqual(actual, expected))
	{
		throw new Error(`${label} failed:\n${JSON.stringify({
			...processDetails({ status, signal, stdout, stderr })
			, expected, actual, parseError
		}, null, 2)}`);
	}
	return actual;
};

/**
 * Cross-checks a verified receipt against the packages actually installed by a consumer.
 *
 * @param observation - Verified receipt and installed package metadata.
 * @param observation.verification - Successful independent receipt-verifier response.
 * @param observation.receipt - Receipt whose package archives were verified.
 * @param observation.runtimePackage - Installed shared runtime's package.json contents.
 * @param observation.componentPackage - Installed component's package.json contents.
 */
export const assertConsumerRuntimeIdentity = ({ verification, receipt, runtimePackage, componentPackage }) => {
	assert.equal(verification.verified, true);
	assert.equal(runtimePackage.name, "@lean-bridge/runtime");
	assert.equal(runtimePackage.leanBridge.componentScalarAbi, componentScalarAbi);
	assert.match(runtimePackage.leanBridge.runtimeIdentity, /^[0-9a-f]{64}$/);
	assert.equal(runtimePackage.version, `0.0.0-abi${componentScalarAbi}.${runtimePackage.leanBridge.runtimeIdentity}`);
	const runtime = `${runtimePackage.name}@${runtimePackage.version}`;
	const component = `${componentPackage.name}@${componentPackage.version}`;
	assert.equal(verification.runtime, runtime);
	assert.equal(receipt.runtime.package, runtime);
	assert.equal(componentPackage.dependencies[runtimePackage.name], runtimePackage.version);
	assert.equal(verification.component, receipt.component.id);
	assert.equal(verification.package, component);
	assert.equal(receipt.package.package, component);
};
