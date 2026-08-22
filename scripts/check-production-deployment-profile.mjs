#!/usr/bin/env node
/**
 * Checks the versioned production deployment profile and reports its approval eligibility.
 *
 * @file
 */

import { evaluateProductionDeploymentProfile, loadProductionDeploymentProfile } from "../src/adoption/production-deployment-profile.mjs";

const profile = await loadProductionDeploymentProfile(process.argv[2]);
const result = evaluateProductionDeploymentProfile(profile);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if(!result.eligible) process.exitCode = 2;
