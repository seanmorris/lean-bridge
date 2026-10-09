/**
 * Run the installed Fin corpus through the shared browser lifecycle and asset checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";

/** All browser contexts required for each ordinary and reviewed Fin selection. */
export const reviewedFinBrowserProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);

/**
 * Reject missing cases, a wrong execution realm, or a result from another selection.
 *
 * @param result - Observation returned by the real page or worker.
 * @param profile - Requested browser context.
 * @param selection - Scalar or structural Fin corpus.
 * @param expected - Independently pinned check and rejection counts.
 */
export const validateReviewedFinBrowserObservation = (result, profile, selection, expected) => {
	assert.ok(reviewedFinBrowserProfiles.includes(profile));
	assert.ok(["scalar", "structural"].includes(selection));
	assert.equal(typeof result.hostVersion, "string");
	assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "reviewed-fin"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: "reviewed-fin", selection, ...expected }
		, hostVersion: result.hostVersion
	});
};

/**
 * Install each browser consumer offline after the Lean producer has been removed.
 *
 * @param options - Verified handoff, isolated install function and exact corpus counts.
 * @param options.directory - Parent of disposable consumer roots.
 * @param options.handoff - Source-free npm archives and verified receipt.
 * @param options.receipt - Component and runtime archive identities.
 * @param options.selection - Scalar or structural Fin corpus.
 * @param options.expected - Independently pinned check and rejection counts.
 * @param options.install - Offline installer shared with the Node consumer.
 * @param options.environment - Compiler-free execution environment.
 */
export const checkReviewedFinWasmBrowsers = async ({ directory, handoff, receipt, selection, expected, install, environment }) => {
	const observations = [];
	for(const profile of reviewedFinBrowserProfiles)
	{
		const root = join(directory, profile);
		const framework = profile === "browser-react" ? await browserFrameworkArchives(root) : [];
		await install(root, handoff, receipt, selection, { profile, framework });
		const packageSource = await readFile(join(root, "package.mjs"), "utf8");
		const result = await installedBrowserCorpus({ library: { npmModule: "reviewed-fin" }
			, profile, root
			, framework, environment: { ...environment, PATH: join(root, "bin") }
			, consumer: { packageSource
				, validateObservation: observation => validateReviewedFinBrowserObservation(observation, profile, selection, expected) } });
		observations.push({ profile, ...result });
	}
	return observations;
};
