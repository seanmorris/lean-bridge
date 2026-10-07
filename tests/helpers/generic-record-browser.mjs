/**
 * Alias-named generic records in installed npm packages, run in real browser pages, React effects and workers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, realpath, rename, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { assertGenericRecordIr, genericRecordExports, genericRecordInstantiations, genericRecordProvenanceOnly, genericRecordSource } from "./generic-record-packages.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixtures = join(repository, "tests/fixtures/generic-record-browser");
const module = "OnboardingSmall";
/** Every browser context the acceptance requires; none may be skipped. */
export const genericRecordBrowserProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
/** Checks and rejections each context must report, pinned so a silent skip is visible. */
export const genericRecordBrowserExpected = Object.freeze({ checks: 1018, rejections: 1018 });
const named = name => ({ kind: "named", id: `lean:${module}.${name}` });
const nat = { kind: "primitive", name: "nat" };
const array = element => ({ kind: "apply", constructor: "array", arguments: [element] });
/** Array-field instantiations added to the shared fixture for the browser acceptance only. */
export const genericRecordArrayInstantiations = Object.freeze({
	ArrayBox: { structure: "Box", arguments: [array(nat)] }
	, RowBox: { structure: "Box", arguments: [array(named("NatBox"))] } });
export const genericRecordArrayExports = Object.freeze(["pushCount", "rowTotal", "rowOf", "rowBoxSum"]);

/**
 * The instantiation each record must carry in the descriptor the installed runtime loads: the
 * fixture's aliases, the Array-field aliases, and null for the phantom-only Marker.
 */
export const genericRecordBrowserInstantiations = () => {
	const qualify = argument => argument.kind === "named" ? named(argument.id.replace(/^lean:[^.]+\./u, ""))
		: argument.kind === "apply" ? { ...argument, arguments: argument.arguments.map(qualify) } : argument;
	const entries = Object.entries({ ...genericRecordInstantiations, ...genericRecordArrayInstantiations })
		.map(([name, { structure, arguments: args }]) => [`lean:${module}.${name}`, { structure: `${module}.${structure}`, arguments: args.map(qualify) }]);
	for(const name of genericRecordProvenanceOnly) entries.push([`lean:${module}.${name}`, null]);
	return Object.fromEntries(entries.sort(([a], [b]) => a < b ? -1 : 1));
};

/**
 * The shared fixture with the Array-field declarations appended, under the npm module name.
 *
 * @param name - Lean module and namespace name.
 */
export const genericRecordBrowserSource = async (name = module) => `${await genericRecordSource(name)}\n${(await readFile(join(fixtures, "GenericRecordArrays.lean"), "utf8")).replaceAll("GenericRecords", name)}`;

/**
 * Require the fixture's records with their provenance, plus each Array-field instantiation.
 *
 * @param ir - Compiler-derived Binding IR.
 */
export const assertGenericRecordBrowserIr = ir => {
	const extras = Object.keys(genericRecordArrayInstantiations).map(name => `lean:${module}.${name}`);
	assertGenericRecordIr({ ...ir, types: ir.types.filter(type => !extras.includes(type.id)) }, module);
	const expected = genericRecordBrowserInstantiations();
	for(const id of extras)
	{
		const record = ir.types.find(type => type.id === id);
		assert.equal(record.kind, "record", id);
		assert.deepEqual(record.fields.map(field => field.name), ["value", "count"], id);
		assert.deepEqual(record.source.extensions["lean-lang.org/instantiation"], expected[id], id);
	}
};

/**
 * Reject a missing case, a wrong realm, a changed instantiation or a result from another package.
 *
 * @param result - Observation returned by the page or worker.
 * @param profile - Requested browser context.
 */
export const validateGenericRecordBrowserObservation = (result, profile) => {
	assert.ok(genericRecordBrowserProfiles.includes(profile));
	assert.equal(typeof result.hostVersion, "string");
	assert.ok(result.hostVersion.length > 0);
	assert.deepEqual(result, {
		schemaVersion: 1, profile, module: "onboarding-small"
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { module: "onboarding-small", ...genericRecordBrowserExpected, instantiations: genericRecordBrowserInstantiations() }
		, hostVersion: result.hostVersion
	});
};

// The public API, plus the descriptor the installed runtime loads, whose Binding IR carries each alias's origin.
const packageSource = `import request from "./request.json";
export { request };
export const loadApi = async () => {
	const [api, { default: descriptor }] = await Promise.all([import("onboarding-small"), import("./node_modules/onboarding-small/internal/descriptor.mjs")]);
	return { ...api, descriptor };
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
	// The installed package carries the same records and origins the compiler produced.
	const installed = join(root, "node_modules/onboarding-small");
	assertGenericRecordBrowserIr(JSON.parse(await readFile(join(installed, "metadata/binding-ir.json"), "utf8")));
	const declarations = await readFile(join(installed, "index.d.ts"), "utf8");
	for(const name of Object.keys(genericRecordBrowserInstantiations()).filter(id => !id.endsWith(".Marker")).map(id => id.split(".").at(-1)))
		assert.match(declarations, new RegExp(`export interface ${name} \\{`), name);
	assert.match(declarations, /export type BoxRow = /u);
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
export const checkGenericRecordBrowserPackages = async (t, { fixture, build, runtimeRoot }) => {
	const { directory, root } = await fixture(t);
	await saveLakeFile(root, `${module}.lean`, await genericRecordBrowserSource());
	const exports = [...genericRecordExports.map(name => name.replace("GenericRecords.", `${module}.`)), ...genericRecordArrayExports.map(name => `${module}.${name}`)];
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [module], exports }));
	const moved = join(directory, "moved"), releases = [];
	await cp(root, moved, { recursive: true });
	for(const [index, projectRoot] of [root, moved].entries())
	{
		const before = await lakeInputState(projectRoot), outputRoot = join(directory, `build-${index}`);
		await build(projectRoot, outputRoot).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		assertGenericRecordBrowserIr(JSON.parse(await readFile(join(outputRoot, "bundle/binding/binding-ir.json"), "utf8")));
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
	await rename(root, join(directory, "source-unavailable"));
	await rename(moved, join(directory, "moved-unavailable"));
	const observations = [];
	for(const profile of genericRecordBrowserProfiles)
	{
		const consumer = join(directory, profile);
		const framework = await install(consumer, releases[0], profile);
		const validateObservation = observation => validateGenericRecordBrowserObservation(observation, profile);
		const environment = { ...clean, PATH: join(consumer, "bin") };
		const result = await installedBrowserCorpus({ library: { npmModule: "onboarding-small" }, profile, root: consumer, framework, environment, consumer: { packageSource, validateObservation } });
		observations.push({ profile, ...result });
	}
	t.diagnostic(`Browser generic-record archives: ${canonicalJson(archives).trim()}`);
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	const identity = { expected: genericRecordBrowserExpected, instantiations: genericRecordBrowserInstantiations() };
	return { archives, requestedEngines, ...identity, observations, sourceRemovedBeforeInstallation: true, externalNetworkBlocked: true };
};
