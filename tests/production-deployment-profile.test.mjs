/**
 * Tests the production deployment profile contract and approval boundary.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	ProductionDeploymentProfileError,
	evaluateProductionDeploymentProfile,
	loadProductionDeploymentProfile,
	validateProductionDeploymentProfile,
} from "../src/adoption/production-deployment-profile.mjs";

test("the repository deployment candidate is closed, versioned, and not self-approved", async () => {
	const profile = await loadProductionDeploymentProfile();
	assert.equal(validateProductionDeploymentProfile(profile), true);
	const result = evaluateProductionDeploymentProfile(profile);
	assert.equal(result.eligible, false);
	assert.deepEqual(result.missingApprovals, ["release-owner", "runtime-owner", "security-owner"]);
	assert.deepEqual(profile.runtimes.map(item => item.id), [
		"browser-chromium", "native-abi", "node", "php-native", "php-wasm", "python"
	]);
});

test("reviewed status fails closed without every required approval", async () => {
	const profile = structuredClone(await loadProductionDeploymentProfile());
	profile.status = "reviewed";
	assert.throws(
		() => validateProductionDeploymentProfile(profile)
		, error => error instanceof ProductionDeploymentProfileError && error.code === "deployment-review-incomplete",
	);
});
