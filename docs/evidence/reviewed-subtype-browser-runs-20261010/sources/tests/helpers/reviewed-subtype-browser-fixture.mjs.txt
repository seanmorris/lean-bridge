/**
 * Independent realm, corpus and lifecycle requirements for reviewed Subtype browser execution.
 *
 * @file
 */
import assert from "node:assert/strict";

export const reviewedSubtypeBrowserProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
export const reviewedSubtypeBrowserExpected = Object.freeze({ checks: 2036, rejections: 2024 });
export const reviewedSubtypeBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = async () => {
  const [api, { runtime }] = await Promise.all([import("subtypes"), import("./node_modules/subtypes/internal/runtime.mjs")]);
  return { ...api, raw: (name, args) => runtime.call("lean:Subtypes." + name, args) };
};
`;

/**
 * Reject the wrong package, realm, count or host identity at every lifecycle phase.
 *
 * @param result - Original page or worker result with the observed browser version.
 * @param profile - Required browser context.
 */
export const validateReviewedSubtypeBrowserObservation = (result, profile) => {
	assert.ok(reviewedSubtypeBrowserProfiles.includes(profile));
	assert.equal(typeof result.hostVersion, "string"); assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "subtypes"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: "subtypes", ...reviewedSubtypeBrowserExpected }
		, hostVersion: result.hostVersion });
};

/**
 * Every observed phase the shared lifecycle harness must execute for a selected context.
 *
 * @param profile - Required browser context.
 */
export const reviewedSubtypeBrowserPhases = profile => {
	assert.ok(reviewedSubtypeBrowserProfiles.includes(profile));
	return profile === "browser-react" ? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker" ? ["first", "rerun", "worker-restart", "failure-recovery"] : ["first", "rerun", "failure-recovery"];
};

/**
 * Require every engine, build variant and lifecycle phase exactly once.
 *
 * @param observations - Original result callbacks from the shared browser harness.
 * @param profile - Required browser context.
 * @param engines - Explicit requested engines.
 */
export const validateReviewedSubtypeBrowserPhases = (observations, profile, engines) => {
	assert.ok(Array.isArray(engines) && engines.length > 0);
	assert.equal(new Set(engines).size, engines.length);
	assert.ok(engines.every(engine => ["chromium", "firefox", "webkit"].includes(engine)));
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant => reviewedSubtypeBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({ engine, variant, phase })), expected);
	for(const result of observations)
	{
		assert.deepEqual(Object.keys(result).sort(), ["engine", "observation", "phase", "variant"]);
		validateReviewedSubtypeBrowserObservation(result.observation, profile);
	}
};
