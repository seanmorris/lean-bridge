#!/usr/bin/env node

import { resolve } from "node:path";

import { runOnboardingFixtureMatrix } from "../src/adoption/onboarding.mjs";
import { evaluateZeroConfigAudit, readZeroConfigAudit } from "../src/adoption/zero-config-audit.mjs";

const fixtures = await runOnboardingFixtureMatrix({ fixtureRoot: resolve("tests/fixtures/onboarding") });
const audit = evaluateZeroConfigAudit(await readZeroConfigAudit(resolve("acceptance/zero-config-audit.v1.json")));
const result = {
	schemaVersion: 1
	, passed: fixtures.passed && audit.passed
	, fixtures
	, audit
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.passed ? 0 : 2;
