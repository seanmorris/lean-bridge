#!/usr/bin/env node

import { cliHandlers } from "../src/cli/commands.mjs";
import { renderProgressEvent, runCli } from "../src/cli/run.mjs";

const cancellation = new AbortController();
let signalCount = 0;
const cancel = signal => {
  signalCount += 1;
  if (signalCount === 1) cancellation.abort(new Error(`Received ${signal}`));
  else process.exit(130);
};
process.once("SIGINT", () => cancel("SIGINT"));
process.once("SIGTERM", () => cancel("SIGTERM"));

const outcome = await runCli({
  argv: process.argv.slice(2),
  handlers: cliHandlers,
  signal: cancellation.signal,
  onProgress: (event, mode) => process.stderr.write(renderProgressEvent(event, mode)),
});
if (outcome.stdout) process.stdout.write(outcome.stdout);
if (outcome.stderr) process.stderr.write(outcome.stderr);
process.exitCode = outcome.exitCode;
