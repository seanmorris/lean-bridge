#!/usr/bin/env node
/**
 * Runs the Lean bridge command-line workflow.
 *
 * @file
 */


import { renderProgressEvent, runCli } from "../src/cli/run.mjs";
import { verificationHandler } from "../src/cli/verify.mjs";

const cancellation = new AbortController();
let signalCount = 0;
const cancel = signal => {
	signalCount += 1;
	if(signalCount === 1) cancellation.abort(new Error(`Received ${signal}`));
	else process.exit(130);
};
process.once("SIGINT", () => cancel("SIGINT"));
process.once("SIGTERM", () => cancel("SIGTERM"));

const outcome = await runCli({
	argv: process.argv.slice(2)
	, handlers: {
		verify: verificationHandler
		, ...Object.fromEntries(["analyze", "build", "publish"].map(command => [command
			, async (request, context) => (await import("../src/cli/commands.mjs")).cliHandlers[command](request, context)]))
	}
	, signal: cancellation.signal
	, onProgress: (event, mode) => process.stderr.write(renderProgressEvent(event, mode))
});
if(outcome.stdout) process.stdout.write(outcome.stdout);
if(outcome.stderr) process.stderr.write(outcome.stderr);
process.exitCode = outcome.exitCode;
