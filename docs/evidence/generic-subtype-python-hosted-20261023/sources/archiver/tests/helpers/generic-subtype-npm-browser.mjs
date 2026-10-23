/**
 * Reproducible ordinary and reviewed generic-Subtype packages in Node and browsers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { copyComponentPackageHandoff } from "./component-package-handoff.mjs";
import { validateComponentPackageReceipt, verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { nominalSubtypeFixture, nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview
	, nominalSubtypeName, genericSubtypeModule, genericSubtypeSource } from "./nominal-subtype-installed-fixture.mjs";

export const genericSubtypeBrowserProfiles = Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
export const genericSubtypeExpected = Object.freeze({ checks: 611, rejections: 5 });
const routes = Object.freeze(["ordinary", "reviewed"]);
const repository = resolve(import.meta.dirname, "../..");
const browserEntry = "tests/fixtures/generic-subtype-consumers/browser.mjs";
const javascriptCaller = "tests/fixtures/generic-subtype-consumers/javascript.mjs";
const snapshotCaller = "tests/fixtures/structural-subtype-consumers/javascript.mjs";
const clean = {
	PATH: "/unavailable"
	, CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime"
	, NODE_PATH: ""
};
const packageSource = `import request from "./request.json";
export { request };
export const loadApi = () => import("nominalsubtypes");
`;
const exactKeys = (value, keys, label) =>
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), label);
const hash = (value, label) => assert.match(value, /^[a-f0-9]{64}$/u, label);
const byHash = files => files.map(({ bytes, sha256 }) => ({ bytes, sha256 }))
	.sort((left, right) => left.sha256.localeCompare(right.sha256));
const variantsFor = profile =>
	profile === "browser-react" ? ["production", "strict"] : ["production"];
const lifecycleFor = (profile, variant) => profile === "browser-worker"
	? { created: 2, terminated: 2, live: 0 }
	: profile === "browser-react"
		? variant === "strict"
			? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
			: { effects: 3, cleanups: 2, ignored: 0, commits: 3 }
		: { rerun: true };

const exactTree = async directory => Object.fromEntries(await Promise.all((await nativeArtifactPaths(directory))
	.map(async path => [path, sha256(await readFile(join(directory, path)))])));

/**
 * Require the closed generic record, both specializations and their directional refinements.
 *
 * @param ir - Compiler-produced or independently reviewed Binding IR.
 */
export const assertGenericSubtypeIr = ir => {
	validateBindingIr(ir);
	const expected = nominalSubtypeInstalledReview(false, { genericCompositions: true });
	assert.equal(reviewedContractDifference(expected, ir), null);
	const record = ir.types.find(type => type.id === "lean:NominalSubtypes.GenericCompositions.GenericNat");
	assert.deepEqual(record?.source.extensions["lean-lang.org/instantiation"], {
		structure: "NominalSubtypes.GenericCompositions.GenericCarrier"
		, arguments: [{ kind: "primitive", name: "nat" }]
	});
	const declarations = new Map(ir.declarations.map(item => [item.id, item]));
	for(const [name, constructor] of [["echoGenericFirst", "plusOne"], ["echoGenericSecond", "plusTwo"]])
	{
		const item = declarations.get(`lean:NominalSubtypes.GenericCompositions.${name}`);
		assert.equal(item?.source.declaration, "NominalSubtypes.GenericCompositions.genericEcho");
		assert.equal(item.source.extensions["lean-lang.org/refinements"].parameters[0].fields[0].refinement.constructor, `NominalSubtypes.${constructor}`);
		assert.equal(item.source.extensions["lean-lang.org/refinements"].result.fields[0].refinement.constructor, null);
		assert.equal(item.source.extensions["lean-lang.org/specialization"].name, `NominalSubtypes.GenericCompositions.${name}`);
		assert.match(item.source.extensions["lean-lang.org/specialization"].application, /^\(@_root_\.NominalSubtypes\.GenericCompositions\.genericEcho/u);
	}
	assert.ok(!ir.declarations.some(item => item.id === "lean:NominalSubtypes.GenericCompositions.genericEcho"));
};

/**
 * Reconcile one retained route report without producer sources or live packages.
 *
 * @param value - Parsed route report.
 * @param route - Independently selected author route.
 */
export const validateGenericSubtypeRouteReport = (value, route) => {
	assert.ok(routes.includes(route));
	exactKeys(value, [
		"authorInputsUnchanged"
		, "browsers"
		, "builds"
		, "compilerFreePath"
		, "configuration"
		, "expectedBindingIrSha256"
		, "independentBuilds"
		, "node"
		, "offlineInstall"
		, "producerBuildsRemovedBeforeInstallation"
		, "producerCommit"
		, "receipt"
		, "relocatedInstallation"
		, "reproducible"
		, "route"
		, "sourceRemovedBeforeInstallation"
	], "generic Subtype route report");
	assert.equal(value.route, route); assert.match(value.producerCommit, /^[a-f0-9]{40}$/u);
	assert.notEqual(value.producerCommit, "0".repeat(40));
	assert.deepEqual(value.configuration, nominalSubtypeInstalledConfiguration(route, ["npm"], false, { genericCompositions: true }));
	assert.equal(value.expectedBindingIrSha256, hashBindingIr(nominalSubtypeInstalledReview(false, { genericCompositions: true })));
	for(const key of [
		"reproducible"
		, "authorInputsUnchanged"
		, "sourceRemovedBeforeInstallation"
		, "producerBuildsRemovedBeforeInstallation"
		, "offlineInstall"
		, "compilerFreePath"
		, "relocatedInstallation"
	])
		assert.equal(value[key], true, key);
	assert.equal(value.independentBuilds, 2); assert.equal(value.builds.length, 2);
	assert.deepEqual(value.builds[1], value.builds[0]);
	for(const build of value.builds)
	{
		exactKeys(build, ["bindingIrSha256", "componentArchiveSha256"
			, "receiptSha256", "runtimeArchiveSha256"], "generic Subtype build");
		for(const [key, digest] of Object.entries(build)) hash(digest, key);
	}
	validateComponentPackageReceipt(value.receipt);
	assert.equal(value.builds[0].receiptSha256, sha256(canonicalJson(value.receipt)));
	assert.equal(value.receipt.bindingIrSha256, value.builds[0].bindingIrSha256);
	assert.equal(value.builds[0].componentArchiveSha256, value.receipt.package.sha256);
	assert.equal(value.builds[0].runtimeArchiveSha256, value.receipt.runtime.sha256);
	exactKeys(value.node, ["declarationsSha256", "observations", "tree"], "Node evidence");
	assert.deepEqual(value.node.observations.map(item => item.relocated), [false, true]);
	hash(value.node.declarationsSha256, "declarationsSha256");
	assert.ok(Object.keys(value.node.tree).length > 5);
	assert.equal(value.node.tree["index.d.ts"], value.node.declarationsSha256);
	for(const [path, digest] of Object.entries(value.node.tree))
	{
		assert.ok(path !== "" && !path.startsWith("/") && !path.split("/").includes(".."));
		hash(digest, path);
	}
	for(const item of value.node.observations)
	{
		exactKeys(item, ["execution", "relocated", "typescript"], "Node observation");
		exactKeys(item.execution, ["code", "stderr", "stdout"], "Node execution");
		exactKeys(item.typescript, ["code", "stderr", "stdout"], "TypeScript execution");
		assert.deepEqual(JSON.parse(item.execution.stdout), genericSubtypeExpected);
		assert.equal(item.execution.stderr, ""); assert.equal(item.execution.code, 0);
		assert.equal(item.typescript.stdout, ""); assert.equal(item.typescript.stderr, ""); assert.equal(item.typescript.code, 0);
	}
	exactKeys(value.browsers, ["observations", "requestedEngines"], "browser evidence");
	assert.deepEqual(value.browsers.requestedEngines, ["chromium", "firefox", "webkit"]);
	assert.deepEqual(value.browsers.observations.map(item => item.profile), genericSubtypeBrowserProfiles);
	let commonAssets;
	for(const item of value.browsers.observations)
	{
		exactKeys(item, ["browser", "profile"], "browser profile evidence");
		exactKeys(item.browser, ["browser", "observation"], "browser result");
		const { profile } = item, result = item.browser, browser = result.browser;
		exactKeys(browser, ["deployments", "executions", "externalNetworkBlocked"
			, "framework", "installedAssets", "installedSourcesRemoved"
			, "requestedEngines"], "browser harness result");
		assert.equal(browser.externalNetworkBlocked, true); assert.equal(browser.installedSourcesRemoved, true);
		assert.deepEqual(browser.requestedEngines, value.browsers.requestedEngines);
		const variants = variantsFor(profile);
		assert.deepEqual(browser.framework.map(item => item.name)
			, profile === "browser-react" ? ["react", "react-dom", "scheduler"] : []);
		for(const framework of browser.framework)
		{
			exactKeys(framework, ["archive", "name", "sha256", "version"], "browser framework");
			hash(framework.sha256, framework.name);
		}
		assert.equal(browser.installedAssets.length, 2);
		for(const asset of browser.installedAssets)
		{
			exactKeys(asset, ["bytes", "path", "sha256"], "installed browser asset");
			assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
			assert.match(asset.path, /^node_modules\/(?:@lean-bridge\/runtime|nominalsubtypes)\//u);
			hash(asset.sha256, asset.path);
		}
		commonAssets ??= browser.installedAssets;
		assert.deepEqual(browser.installedAssets, commonAssets);
		assert.deepEqual(browser.deployments.map(deployment => deployment.variant), variants);
		for(const deployment of browser.deployments)
		{
			exactKeys(deployment, ["files", "modulePaths", "sha256"
				, "variant", "viteVersion"], "browser deployment");
			assert.equal(deployment.sha256, sha256(canonicalJson(deployment.files)));
			assert.equal(new Set(deployment.files.map(file => file.path)).size
				, deployment.files.length);
			assert.deepEqual(byHash(deployment.files.filter(file => file.path.endsWith(".wasm")))
				, byHash(browser.installedAssets));
			for(const name of ["nominalsubtypes", "@lean-bridge/runtime"])
				assert.ok(deployment.modulePaths.includes(`node_modules/${name}/index.mjs`));
			for(const path of deployment.modulePaths)
				assert.ok(path.startsWith("node_modules/") && !path.split("/").includes(".."));
		}
		const expectedExecutions = value.browsers.requestedEngines
			.flatMap(engine => variants.map(variant => ({ engine, variant })));
		assert.deepEqual(browser.executions.map(({ engine, variant }) => ({ engine, variant }))
			, expectedExecutions);
		assert.deepEqual(result.observation, browser.executions[0].observation);
		for(const execution of browser.executions)
		{
			assert.equal(execution.failedAssetRecovery, true);
			assert.deepEqual(execution.lifecycle, lifecycleFor(profile, execution.variant));
			assert.equal(execution.assets.length, profile === "browser-worker" ? 4 : 2);
			const deployment = browser.deployments
				.find(candidate => candidate.variant === execution.variant);
			for(const asset of execution.assets)
			{
				exactKeys(asset, ["bytes", "mime", "path", "sha256", "status"]
					, "observed browser asset");
				assert.equal(asset.status, 200); assert.equal(asset.mime, "application/wasm");
				assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
				const installed = browser.installedAssets
					.find(candidate => candidate.sha256 === asset.sha256);
				assert.ok(installed); assert.equal(asset.bytes, installed.bytes);
				const deployed = deployment.files
					.find(candidate => `/corpus/nested/${candidate.path}` === asset.path);
				assert.ok(deployed); assert.deepEqual(byHash([asset]), byHash([deployed]));
			}
			for(const asset of browser.installedAssets)
				assert.equal(execution.assets
					.filter(candidate => candidate.sha256 === asset.sha256).length
				, profile === "browser-worker" ? 2 : 1);
			const observation = execution.observation;
			assert.equal(typeof observation.hostVersion, "string"); assert.ok(observation.hostVersion.length > 0);
			assert.deepEqual(observation, {
				schemaVersion: 1
				, profile
				, module: nominalSubtypeName
				, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
				, results: { module: nominalSubtypeName, route, genericCompositions: true, ...genericSubtypeExpected }
				, hostVersion: observation.hostVersion });
			if(profile === "browser-react") assert.equal(execution.pendingUnmount, true);
		}
	}
	return value;
};

/**
 * Require a closed retained evidence envelope and independently selected routes.
 *
 * @param value - Parsed evidence file.
 * @param selected - Independently selected routes.
 */
export const validateGenericSubtypeEvidence = (value, selected) => {
	exactKeys(value, ["kind", "observations", "schemaVersion"], "generic Subtype evidence");
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.kind, "generic-subtype-npm-browser-installed-v1");
	assert.deepEqual(value.observations.map(item => item.route), selected);
	for(const item of value.observations)
		validateGenericSubtypeRouteReport(item, item.route);
	return value;
};

/**
 * Prove that retained-report verification rejects representative forgeries.
 *
 * @param value - One valid route report.
 */
export const assertGenericSubtypeReportControls = value => {
	const mutations = [
		report => { report.route = report.route === "ordinary" ? "reviewed" : "ordinary"; }
		, report => { report.producerCommit = "0".repeat(40); }
		, report => { report.configuration.modules = []; }
		, report => { report.expectedBindingIrSha256 = "0".repeat(64); }
		, report => { report.independentBuilds = 1; }
		, report => { report.builds[1].componentArchiveSha256 = "0".repeat(64); }
		, report => { report.receipt.bindingIrSha256 = "0".repeat(64); }
		, report => { report.offlineInstall = false; }
		, report => { report.node.observations[1].relocated = false; }
		, report => { report.node.observations[0].execution.stdout = "{}\n"; }
		, report => { report.node.observations[0].typescript.code = 1; }
		, report => { report.browsers.requestedEngines.pop(); }
		, report => { report.browsers.observations.reverse(); }
		, report => { report.browsers.observations[0].browser.browser.externalNetworkBlocked = false; }
		, report => { report.browsers.observations[0].browser.browser.installedAssets[0].sha256 = "0".repeat(64); }
		, report => { report.browsers.observations[0].browser.browser.deployments[0].sha256 = "0".repeat(64); }
		, report => { report.browsers.observations[0].browser.browser.deployments[0].modulePaths = []; }
		, report => { report.browsers.observations[0].browser.browser.executions[0].failedAssetRecovery = false; }
		, report => { report.browsers.observations[0].browser.browser.executions[0].assets[0].status = 500; }
		, report => { report.browsers.observations[0].browser.browser.executions[0].observation.results.checks -= 1; }
		, report => { report.browsers.observations[1].browser.browser.executions[0].pendingUnmount = false; }
	];
	for(const mutate of mutations)
	{
		const changed = structuredClone(value); mutate(changed);
		assert.throws(() => validateGenericSubtypeRouteReport(changed, value.route));
	}
	return mutations.length;
};

const install = async (root, release, framework = []) => {
	const bin = join(root, "bin"); await mkdir(bin, { recursive: true }); await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(root, name, "");
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	const args = [
		npm
		, "install"
		, "--offline"
		, "--ignore-scripts"
		, "--no-audit"
		, "--no-fund"
		, "--userconfig"
		, join(root, "user.npmrc")
		, "--globalconfig"
		, join(root, "global.npmrc")
		, "--cache"
		, join(root, "empty-cache")
		, release.runtimeArchive
		, release.componentArchive
		, ...framework.map(item => join(root, item.archive))];
	const environment = { ...clean, PATH: bin };
	const result = await processBuildRunner.capture({ command: process.execPath, args, cwd: root, env: environment, timeoutMs: 300_000 });
	assert.equal(result.code, 0); return { environment, result };
};

const verifyInstalled = async root => {
	const installed = join(root, "node_modules", nominalSubtypeName);
	assertGenericSubtypeIr(JSON.parse(await readFile(join(installed, "metadata/binding-ir.json"), "utf8")));
	const declarations = await readFile(join(installed, "index.d.ts"), "utf8");
	for(const text of ["export interface GenericNat {", "export declare function genericUse", "export declare function echoGenericFirst", "export declare function echoGenericSecond"])
		assert.ok(declarations.includes(text), text);
	assert.doesNotMatch(declarations, /function genericEcho/u);
	return { tree: await exactTree(installed), declarationsSha256: sha256(declarations) };
};

const nodeConsumers = async (root, release) => {
	const installed = join(root, "installed"), relocated = join(root, "relocated");
	const { environment } = await install(installed, release);
	const index = `import * as api from "nominalsubtypes";\nimport { checkGenericSubtypeCompositions } from "./fixtures/generic-subtype-consumers/javascript.mjs";\nconsole.log(JSON.stringify(checkGenericSubtypeCompositions(api)));\n`;
	await saveLakeFile(installed, "index.mjs", index);
	for(const [path, source] of [["fixtures/generic-subtype-consumers/javascript.mjs", javascriptCaller]
		, ["fixtures/structural-subtype-consumers/javascript.mjs", snapshotCaller]
		, ["index.mts", "tests/fixtures/nominal-subtype-consumers/index.mts"]
		, ["results.mts", "tests/fixtures/nominal-subtype-consumers/results.mts"]
		, ["generic.mts", "tests/fixtures/nominal-subtype-consumers/generic.mts"]])
		await saveLakeFile(installed, path, await readFile(source));
	const expected = await verifyInstalled(installed), observations = [];
	for(const current of [installed, relocated])
	{
		if(current === relocated)
		{
			await rename(installed, relocated); await assert.rejects(access(installed), { code: "ENOENT" });
			environment.PATH = join(relocated, "bin");
		}
		assert.deepEqual((await verifyInstalled(current)).tree, expected.tree);
		const execution = await processBuildRunner.capture({ command: process.execPath, args: ["index.mjs"], cwd: current, env: environment, timeoutMs: 120_000 });
		assert.equal(execution.stderr, ""); assert.deepEqual(JSON.parse(execution.stdout), genericSubtypeExpected);
		const compiler = join(repository, "node_modules/typescript/lib/tsc.js");
		const typescript = await processBuildRunner.capture({ command: process.execPath
			, args: [
				compiler
				, "--strict"
				, "--noEmit"
				, "--skipLibCheck"
				, "false"
				, "--target"
				, "ES2022"
				, "--lib"
				, "ES2022,ESNext.Disposable"
				, "--module"
				, "NodeNext"
				, "--moduleResolution"
				, "NodeNext"
				, "index.mts"
				, "generic.mts"]
			, cwd: current, env: environment, timeoutMs: 120_000 });
		assert.equal(typescript.stdout, ""); assert.equal(typescript.stderr, "");
		observations.push({ relocated: current === relocated, execution, typescript });
	}
	return { observations, tree: expected.tree, declarationsSha256: expected.declarationsSha256 };
};

const browserConsumers = async (root, release, route) => {
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	assert.deepEqual(requestedEngines, ["chromium", "firefox", "webkit"]);
	const observations = [];
	for(const profile of genericSubtypeBrowserProfiles)
	{
		const consumer = join(root, profile), framework = profile === "browser-react" ? await browserFrameworkArchives(consumer) : [];
		const { environment } = await install(consumer, release, framework);
		await verifyInstalled(consumer);
		await saveLakeFile(consumer, "request.json", canonicalJson({ module: nominalSubtypeName, profile, route, genericCompositions: true }));
		await saveLakeFile(consumer, "javascript.mjs"
			, 'export { executeCorpus } from "./fixtures/generic-subtype-consumers/browser.mjs";\n');
		await saveLakeFile(consumer, "fixtures/generic-subtype-consumers/browser.mjs", await readFile(browserEntry));
		await saveLakeFile(consumer, "fixtures/generic-subtype-consumers/javascript.mjs", await readFile(javascriptCaller));
		await saveLakeFile(consumer, "fixtures/structural-subtype-consumers/javascript.mjs", await readFile(snapshotCaller));
		const validateObservation = value => {
			assert.equal(typeof value.hostVersion, "string"); assert.ok(value.hostVersion.length > 0);
			assert.deepEqual(value, {
				schemaVersion: 1, profile, module: nominalSubtypeName
				, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
				, results: { module: nominalSubtypeName, route, genericCompositions: true, ...genericSubtypeExpected }
				, hostVersion: value.hostVersion
			});
		};
		const browser = await installedBrowserCorpus({
			library: { npmModule: nominalSubtypeName }
			, profile
			, root: consumer
			, framework
			, environment
			, consumer: { packageSource, validateObservation } });
		observations.push({ profile, browser });
	}
	return { requestedEngines, observations };
};

/**
 * Build one route twice, erase its producers, then execute every installed consumer.
 *
 * @param t - Active Node test context.
 * @param options - Build and route inputs.
 * @param options.route - Ordinary source or independent review.
 * @param options.engineRoot - Lean Bridge repository root.
 * @param options.environment - Explicit producer environment.
 * @param options.runtimeRoot - Prepared shared-runtime root.
 */
export const checkGenericSubtypeRoute = async (t, { route, engineRoot, environment, runtimeRoot }) => {
	assert.ok(routes.includes(route));
	const producer = await mkdtemp(join(tmpdir(), `lean-bridge-generic-subtype-${route}-`));
	const consumers = await mkdtemp(join(tmpdir(), `lean-bridge-generic-subtype-consumers-${route}-`));
	t.after(() => rm(consumers, { recursive: true, force: true }));
	let producerRemoved = false;
	t.after(async () => { if(!producerRemoved) await rm(producer, { recursive: true, force: true }); });
	const options = { genericCompositions: true };
	const configuration = nominalSubtypeInstalledConfiguration(route, ["npm"], false, options);
	const expected = nominalSubtypeInstalledReview(false, options), releases = [], builds = [];
	for(const attempt of [0, 1])
	{
		const projectRoot = join(producer, `author-${attempt}`), outputRoot = join(producer, `build-${attempt}`);
		await cp(nominalSubtypeFixture, projectRoot, { recursive: true });
		const genericModulePath = join(projectRoot, ...genericSubtypeModule.split(".")) + ".lean";
		await mkdir(dirname(genericModulePath), { recursive: true });
		await cp(genericSubtypeSource, genericModulePath);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const before = await lakeInputState(projectRoot);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
			.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const ir = JSON.parse(await readFile(join(outputRoot, "bundle/binding/binding-ir.json"), "utf8")); assertGenericSubtypeIr(ir);
		const release = await buildComponentNpmPackages({ bundleRoot: join(outputRoot, "bundle"), runtimeRoot, outputRoot: join(producer, `npm-${attempt}`) });
		const verified = await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		releases.push(release); builds.push({ bindingIrSha256: hashBindingIr(ir)
			, receiptSha256: verified.receiptSha256
			, componentArchiveSha256: sha256(await readFile(release.componentArchive))
			, runtimeArchiveSha256: sha256(await readFile(release.runtimeArchive)) });
	}
	assert.deepEqual(releases[1].report, releases[0].report); assert.deepEqual(builds[1], builds[0]);
	const handoff = await copyComponentPackageHandoff(releases[0].output, join(consumers, "handoff"));
	await rm(producer, { recursive: true, force: true }); producerRemoved = true;
	await assert.rejects(stat(producer), { code: "ENOENT" });
	const node = await nodeConsumers(join(consumers, "node"), handoff);
	const browsers = await browserConsumers(join(consumers, "browsers"), handoff, route);
	const report = {
		route
		, producerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
		, configuration
		, expectedBindingIrSha256: hashBindingIr(expected)
		, builds
		, receipt: handoff.receipt
		, node
		, browsers
		, independentBuilds: 2
		, reproducible: true
		, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true
		, producerBuildsRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true };
	return validateGenericSubtypeRouteReport(report, route);
};
