#!/usr/bin/env node

import { cliHandlers } from "../src/cli/commands.mjs";
import { runCli } from "../src/cli/run.mjs";

const outcome = await runCli({ argv: process.argv.slice(2), handlers: cliHandlers });
if (outcome.stdout) process.stdout.write(outcome.stdout);
if (outcome.stderr) process.stderr.write(outcome.stderr);
process.exitCode = outcome.exitCode;
