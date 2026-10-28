/**
 * Browser, React and Worker acceptance for a source-free direct-proof npm handoff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, realpath, symlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";

export const directProofErasureBrowserProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
export const directProofErasureBrowserExpected = Object.freeze({
	checks: 1005, rejections: 4
});
export const directProofErasureBrowserPackage = `import request from "./request.json";
export { request };
export const loadApi = () => import("direct-proof-erasure");
`;

/**
 * Require the exact installed package, realm and caller result.
 *
 * @param result - Original browser observation.
 * @param profile - Required browser context.
 */
export const validateDirectProofErasureBrowserObservation = (result, profile) => {
	assert.ok(directProofErasureBrowserProfiles.includes(profile));
	assert.equal(typeof result.hostVersion, "string");
	assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "direct-proof-erasure"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: "direct-proof-erasure"
			, ...directProofErasureBrowserExpected }
		, hostVersion: result.hostVersion
	});
};

/**
 * Expected lifecycle phases for one browser profile.
 *
 * @param profile - Required browser context.
 */
export const directProofErasureBrowserPhases = profile => {
	assert.ok(directProofErasureBrowserProfiles.includes(profile));
	return profile === "browser-react"
		? ["first", "remount-1", "remount-2", "failure-recovery", "pending-unmount"]
		: profile === "browser-worker"
			? ["first", "rerun", "worker-restart", "failure-recovery"]
			: ["first", "rerun", "failure-recovery"];
};

/**
 * Require every selected engine, variant and lifecycle observation exactly once.
 *
 * @param observations - Original lifecycle observations.
 * @param profile - Required browser context.
 * @param engines - Explicit selected browser engines.
 */
export const validateDirectProofErasureBrowserPhases = (
	observations, profile, engines
) => {
	assert.ok(Array.isArray(engines) && engines.length > 0);
	assert.equal(new Set(engines).size, engines.length);
	const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
	const expected = engines.flatMap(engine => variants.flatMap(variant =>
		directProofErasureBrowserPhases(profile).map(phase => ({ engine, variant, phase }))));
	assert.deepEqual(observations.map(({ engine, variant, phase }) => ({
		engine, variant, phase
	})), expected);
	for(const item of observations)
		validateDirectProofErasureBrowserObservation(item.observation, profile);
};

const clean = {
	PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: ""
};

/**
 * Install only the verified handoff and execute all three browser contexts.
 *
 * @param options - Source-free package handoff and report destination.
 * @param options.directory - Disposable consumer parent.
 * @param options.handoff - Verified npm archives and receipt.
 * @param options.receipt - Parsed component-package receipt.
 * @param options.records - Retained evidence directory.
 * @param options.route - Ordinary or reviewed author route.
 */
export const checkDirectProofErasureBrowsers = async ({
	directory, handoff, receipt, records, route
}) => {
	await verifyComponentPackageReceipt({
		receiptPath: join(handoff, "component-package-receipt.json")
	});
	const requestedEngines = corpusBrowserSelection(
		process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS
	);
	const reports = [];
	for(const profile of directProofErasureBrowserProfiles)
	{
		const root = join(directory, profile), bin = join(root, "bin");
		await mkdir(bin, { recursive: true });
		await symlink(process.execPath, join(bin, "node"));
		await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
		for(const name of ["user.npmrc", "global.npmrc"])
			await saveLakeFile(root, name, "");
		const framework = profile === "browser-react"
			? await browserFrameworkArchives(root) : [];
		const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
		const environment = { ...clean, PATH: bin };
		await processBuildRunner.capture({ command: process.execPath, cwd: root
			, env: environment, timeoutMs: 300_000
			, args: [npmCli, "install", "--offline", "--ignore-scripts"
				, "--no-audit", "--no-fund", "--userconfig", join(root, "user.npmrc")
				, "--globalconfig", join(root, "global.npmrc")
				, "--cache", join(root, "empty-cache")
				, join(handoff, receipt.runtime.archive)
				, join(handoff, receipt.package.archive)
				, ...framework.map(item => join(root, item.archive))] });
		await saveLakeFile(root, "request.json", canonicalJson({
			module: "direct-proof-erasure", profile
		}));
		await saveLakeFile(root, "javascript.mjs", await readFile(
			"tests/fixtures/direct-proof-erasure-consumers/browser.mjs"
		));
		await saveLakeFile(root, "check.mjs", await readFile(
			"tests/fixtures/direct-proof-erasure-consumers/javascript.mjs"
		));
		const observations = [];
		const result = await installedBrowserCorpus({
			library: { npmModule: "direct-proof-erasure" }
			, profile, root, framework, environment
			, consumer: {
				packageSource: directProofErasureBrowserPackage
				, validateObservation: (observation, phase) => {
					validateDirectProofErasureBrowserObservation(observation, profile);
					observations.push({ ...phase, observation });
				}
			}
		});
		validateDirectProofErasureBrowserPhases(
			observations, profile, requestedEngines
		);
		const report = {
			schemaVersion: 1, route, profile
			, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, callerSha256: sha256(await readFile(
				"tests/fixtures/direct-proof-erasure-consumers/javascript.mjs"
			))
			, observations, ...result
		};
		await saveLakeFile(records, `browser/${profile}.json`, canonicalJson(report));
		reports.push(report);
	}
	return { requestedEngines, reports };
};
