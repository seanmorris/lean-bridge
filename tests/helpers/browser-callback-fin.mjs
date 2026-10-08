/**
 * Checked Fin callbacks and returned closures of installed npm packages, run in real browser
 * pages, React effects and dedicated workers. The package is the installed Node acceptance's
 * scalar and nominal sources in one module.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { callbackFinCases } from "./callback-fin-packages.mjs";
import { copyComponentPackageHandoff } from "./component-package-handoff.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixtures = join(repository, "tests/fixtures/browser-callback-fin");
const module = "OnboardingSmall";
/** Every browser context the acceptance requires; none may be skipped. */
export const browserCallbackFinProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
/** Checks and rejections each context must report, pinned so a silent skip is visible. */
export const browserCallbackFinExpected = Object.freeze({ checks: 409, rejections: 894 });
/** The scalar and nominal Node sources, unchanged, in one package. */
export const browserCallbackFinSource = () => `${callbackFinCases.scalar.source}\n${callbackFinCases.nominal.source}`;
/** Every export of both Node packages, with the returned closures' arities. */
export const browserCallbackFinConfiguration = () => ({
	exports: [...callbackFinCases.scalar.names, ...callbackFinCases.nominal.names].map(name => `${module}.${name}`)
	, arities: { ...callbackFinCases.scalar.arities, ...callbackFinCases.nominal.arities } });

/**
 * Require the structured private ABI with both host-reply bounds and the nominal field bounds.
 *
 * @param plan - Compiler adapter plan of the bundle.
 */
export const assertBrowserCallbackFinPlan = plan => {
	assert.equal(plan.privateAbi.version, 9);
	const bounds = plan.privateAbi.callbacks.filter(type => type.refinements?.result?.kind === "fin").map(type => type.refinements.result.bound);
	for(const bound of ["3", "5"]) assert.ok(bounds.includes(bound), bound);
	assert.deepEqual(plan.privateAbi.nominalRefinements, plan.nominalRefinements);
	assert.ok(plan.nominalRefinements.length > 0);
};

/**
 * Reject a missing case, a wrong realm or a result from another package.
 *
 * @param result - Observation returned by the page or worker.
 * @param profile - Requested browser context.
 */
export const validateBrowserCallbackFinObservation = (result, profile) => {
	assert.ok(browserCallbackFinProfiles.includes(profile));
	assert.equal(typeof result.hostVersion, "string");
	assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "onboarding-small"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: "onboarding-small", ...browserCallbackFinExpected }
		, hostVersion: result.hostVersion
	});
};

// The public API and the package-internal runtime, which skips the generated JavaScript validation.
const packageSource = `import request from "./request.json";
export { request };
export const loadApi = async () => {
	const [api, { runtime }] = await Promise.all([import("onboarding-small"), import("./node_modules/onboarding-small/internal/runtime.mjs")]);
	return { ...api, raw: (name, args) => runtime.call("lean:${module}." + name, args) };
};
`;
const clean = { PATH: "/unavailable", CC: "/unavailable/compiler", CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: "" };

/**
 * Install the verified archives offline under a compiler-free PATH and check what was installed.
 *
 * @param root - Fresh consumer root.
 * @param release - Component and shared-runtime archives.
 * @param profile - Browser context.
 */
const install = async (root, release, profile) => {
	const bin = join(root, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
	await saveLakeFile(root, "user.npmrc", "");
	await saveLakeFile(root, "global.npmrc", "");
	const framework = profile === "browser-react" ? await browserFrameworkArchives(root) : [];
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	const flags = ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"];
	const configuration = ["--userconfig", join(root, "user.npmrc"), "--globalconfig", join(root, "global.npmrc"), "--cache", join(root, "empty-cache")];
	const archives = [release.runtimeArchive, release.componentArchive, ...framework.map(item => join(root, item.archive))];
	await processBuildRunner.capture({ command: process.execPath, args: [npm, ...flags, ...configuration, ...archives], cwd: root, env: { ...clean, PATH: bin }, timeoutMs: 300_000 });
	// The installed package carries the callback bounds and exports the compiler produced.
	const installed = join(root, "node_modules/onboarding-small");
	const ir = JSON.parse(await readFile(join(installed, "metadata/binding-ir.json"), "utf8"));
	assert.ok(ir.types.some(type => type.kind === "callback" && type.source.extensions["lean-lang.org/refinements"]), "a bounded callback definition");
	assert.deepEqual(ir.declarations.map(item => item.id).sort(), browserCallbackFinConfiguration().exports.map(name => `lean:${name}`).sort());
	await saveLakeFile(root, "request.json", canonicalJson({ module: "onboarding-small", profile }));
	await saveLakeFile(root, "javascript.mjs", await readFile(join(fixtures, "javascript.mjs")));
	return framework;
};

/**
 * Build from two author roots, remove both, install offline and run every browser context.
 *
 * @param t - Node test context.
 * @param options - Shared unlocked author-project build harness.
 * @param options.fixture - Create an isolated author project.
 * @param options.build - Build using compiler-owned metadata.
 * @param options.runtimeRoot - Prepared shared runtime root.
 */
export const checkBrowserCallbackFinPackages = async (t, { fixture, build, runtimeRoot }) => {
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, `${module}.lean`, browserCallbackFinSource());
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [module], ...browserCallbackFinConfiguration() }));
	const moved = join(directory, "moved"), releases = [];
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		assertBrowserCallbackFinPlan(JSON.parse(await readFile(join(outputRoot, "bundle/locks/compiler-adapters.json"), "utf8")));
		releases.push(await buildComponentNpmPackages({ bundleRoot: join(outputRoot, "bundle"), runtimeRoot, outputRoot: join(directory, `npm-${index}`) }));
		await verifyComponentPackageReceipt({ receiptPath: join(releases[index].output, "component-package-receipt.json") });
		assert.deepEqual(await lakeInputState(projectRoot), before);
	}
	// Two author roots produce byte-identical archives.
	assert.deepEqual(releases[0].report, releases[1].report);
	const archives = {};
	for(const archive of [releases[0].componentArchive, releases[0].runtimeArchive, releases[1].componentArchive, releases[1].runtimeArchive])
	{
		const name = archive.split("/").at(-1), digest = sha256(await readFile(archive));
		assert.equal(archives[name] ?? digest, digest, name);
		archives[name] = digest;
	}
	const consumers = await mkdtemp(join(tmpdir(), "lean-bridge-browser-callback-fin-consumers-"));
	t.after(() => rm(consumers, { recursive: true, force: true }));
	const release = await copyComponentPackageHandoff(releases[0].output, join(consumers, "handoff"));
	assert.deepEqual(release.receipt, releases[0].report);
	// Producer projects, copied build sources and unpacked package staging all disappear.
	await rm(directory, { recursive: true, force: true });
	await assert.rejects(stat(directory), { code: "ENOENT" });
	assert.deepEqual(await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") }), release.verified);
	const observations = [];
	for(const profile of browserCallbackFinProfiles)
	{
		const consumer = join(consumers, profile);
		const framework = await install(consumer, release, profile);
		const validateObservation = observation => validateBrowserCallbackFinObservation(observation, profile);
		const environment = { ...clean, PATH: join(consumer, "bin") };
		const result = await installedBrowserCorpus({ library: { npmModule: "onboarding-small" }, profile, root: consumer, framework, environment, consumer: { packageSource, validateObservation } });
		observations.push({ profile, ...result });
	}
	t.diagnostic(`Browser callback Fin archives: ${canonicalJson(archives).trim()}`);
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	// Counts are public and raw rejections; no dispatch or source-entry counter is instrumented here.
	return {
		archives, requestedEngines, expected: browserCallbackFinExpected, observations
		, dispatch: "not measured"
		, receiptSha256: release.verified.receiptSha256
		, bindingIrSha256: release.receipt.bindingIrSha256
		, componentIdentitySha256: release.receipt.componentIdentitySha256
		, reproducible: true, sourceRemovedBeforeInstallation: true
		, producerBuildsRemovedBeforeInstallation: true
		, packagesRelocatedBeforeInstallation: true
		, externalNetworkBlocked: true
	};
};
