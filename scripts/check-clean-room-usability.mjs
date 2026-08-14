#!/usr/bin/env node
/**
 * Checks the clean room usability workflow.
 *
 * @file
 */


import { resolve } from "node:path";

import { evaluateUsabilityGate, readUsabilitySessions } from "../src/adoption/usability-gate.mjs";

const sessions = await readUsabilitySessions(resolve(process.argv[2] ?? "acceptance/clean-room-sessions.v1.json"));
const report = evaluateUsabilityGate(sessions);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.passed ? 0 : 2;
