/**
 * Ordinary and independently reviewed finite specializations in installed browser packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./type-corpus-browser.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";
import { copyComponentPackageHandoff } from "./component-package-handoff.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { nativeSpecializations, nativeSpecializationSignatures } from "./native-specialization-install.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { reviewedNativeSpecializationIr } from "./reviewed-native-specialization-fixture.mjs";

const repository = resolve(import.meta.dirname, "../..");
const fixture = "tests/fixtures/onboarding/native-specializations";
const caller = "tests/fixtures/specialization-consumers/javascript.mjs";
const routes = Object.freeze(["ordinary", "reviewed"]);
export const signatureSpecializationBrowserProfiles
	= Object.freeze(["browser-javascript", "browser-react", "browser-worker"]);
export const signatureSpecializationBrowserExpected
	= Object.freeze({ checks: 2016, rejections: 5, instanceDefault: 37 });
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
export const loadApi = () => import("specialized");
`;
const type = (value, ir) => {
	if(value.kind === "primitive") return value.name;
	if(value.kind === "array") return { array: type(value.element, ir) };
	if(value.kind === "apply" && value.constructor === "array")
		return { array: type(value.arguments[0], ir) };
	if(value.kind === "named")
	{
		const definition = ir.types.find(item => item.id === value.id);
		if(definition?.kind === "alias") return type(definition.target, ir);
	}
	return value.kind;
};

/**
 * Require the compiler-derived closed signatures and the independently reviewed decisions.
 *
 * @param {object} ir - Compiler-produced Binding IR.
 */
export const assertSignatureSpecializationIr = ir => {
	validateBindingIr(ir);
	assert.equal(reviewedContractDifference(reviewedNativeSpecializationIr(), ir), null);
	const signatures = Object.fromEntries(ir.declarations.map(item => [
		item.source.declaration === item.id.slice("lean:".length)
			? item.id.slice("lean:".length) : item.source.extensions["lean-lang.org/specialization"].name
		, [item.parameters.map(parameter => type(parameter.type, ir)), type(item.result.type, ir)]
	]));
	assert.deepEqual(signatures, nativeSpecializationSignatures);
	for(const item of ir.declarations)
	{
		assert.deepEqual(item.typeParameters, [], item.id);
		assert.deepEqual(item.assurance, [], item.id);
	}
	for(const name of ["echo", "choose", "first", "duplicate"])
		assert.ok(!ir.declarations.some(item => item.id === `lean:Specialized.${name}`), name);
	const choice = ir.declarations.find(item => item.id === "lean:Specialized.chooseWord");
	assert.match(choice.source.extensions["lean-lang.org/specialization"].application
		, /instInhabitedUInt32_specialized/u);
	return ir;
};

const install = async (root, release, profile) => {
	const bin = join(root, "bin"); await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(root, name, "");
	const framework = profile === "browser-react" ? await browserFrameworkArchives(root) : [];
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	const result = await processBuildRunner.capture({ command: process.execPath
		, args: [npm
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
			, ...framework.map(item => join(root, item.archive))]
		, cwd: root, env: { ...clean, PATH: bin }, timeoutMs: 300_000 });
	assert.equal(result.code, 0);
	const installed = join(root, "node_modules/specialized");
	assertSignatureSpecializationIr(JSON.parse(await readFile(join(installed, "metadata/binding-ir.json"), "utf8")));
	const declarations = await readFile(join(installed, "index.d.ts"), "utf8");
	for(const name of ["echoWord", "chooseWord", "firstTextWord", "doubleNat", "plain"])
		assert.match(declarations, new RegExp(`export declare function ${name}\\(`, "u"), name);
	for(const name of ["echo", "choose", "first", "duplicate"])
		assert.doesNotMatch(declarations, new RegExp(`function ${name}\\(`, "u"), name);
	return { environment: { ...clean, PATH: bin }, framework };
};

const browserConsumers = async (root, release, route) => {
	const requestedEngines = corpusBrowserSelection(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	assert.deepEqual(requestedEngines, ["chromium", "firefox", "webkit"]);
	const observations = [];
	for(const profile of signatureSpecializationBrowserProfiles)
	{
		const consumer = join(root, profile), { environment, framework } = await install(consumer, release, profile);
		await saveLakeFile(consumer, "request.json", canonicalJson({ module: "specialized", profile, route }));
		await saveLakeFile(consumer, "javascript.mjs", await readFile(caller));
		const validateObservation = value => {
			assert.equal(typeof value.hostVersion, "string"); assert.ok(value.hostVersion.length > 0);
			assert.deepEqual(value, {
				schemaVersion: 1, profile, module: "specialized"
				, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
				, results: { module: "specialized", route, ...signatureSpecializationBrowserExpected }
				, hostVersion: value.hostVersion
			});
		};
		const browser = await installedBrowserCorpus({ library: { npmModule: "specialized" }
			, profile, root: consumer, framework, environment
			, consumer: { packageSource, validateObservation } });
		observations.push({ profile, browser });
	}
	return { requestedEngines, observations };
};

const configuration = route => ({ schemaVersion: 1, modules: ["Specialized"]
	, ...(route === "ordinary" ? {
		exports: Object.keys(nativeSpecializationSignatures)
		, specializations: nativeSpecializations
	} : {}) });

/**
 * Build one author route twice, remove it, and execute all three browser realms.
 *
 * @param {import("node:test").TestContext} t - Active test context.
 * @param {"ordinary"|"reviewed"} route - Author route to build and execute.
 */
export const checkSignatureSpecializationBrowserRoute = async (t, route) => {
	assert.ok(routes.includes(route));
	const producer = await mkdtemp(join(tmpdir(), `lean-bridge-signature-specialization-browser-${route}-`));
	const consumers = await mkdtemp(join(tmpdir(), `lean-bridge-signature-specialization-browser-consumers-${route}-`));
	let producerRemoved = false;
	t.after(async () => {
		if(!producerRemoved) await rm(producer, { recursive: true, force: true });
		await rm(consumers, { recursive: true, force: true });
	});
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const releases = [], builds = [], selected = configuration(route);
	for(const attempt of [0, 1])
	{
		const projectRoot = join(producer, `author-${attempt}`), outputRoot = join(producer, `build-${attempt}`);
		await cp(fixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selected));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(reviewedNativeSpecializationIr()));
		const before = await lakeInputState(projectRoot);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot: repository, environment, targets: ["npm"], runner: refinementEngineTransport() })
			.catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const ir = assertSignatureSpecializationIr(JSON.parse(await readFile(join(outputRoot, "bundle/binding/binding-ir.json"), "utf8")));
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
	const browsers = await browserConsumers(join(consumers, "browsers"), handoff, route);
	return {
		route
		, producerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
		, configuration: selected
		, reviewedBindingIrSha256: hashBindingIr(reviewedNativeSpecializationIr())
		, builds
		, receipt: handoff.receipt
		, browsers
		, independentBuilds: 2
		, reproducible: true
		, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
		, producerBuildsRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreePath: true, relocatedInstallation: true
	};
};

/**
 * Validate the retained browser report before it can support a promotion.
 *
 * @param {object} report - Closed two-route hosted report.
 */
export const validateSignatureSpecializationBrowserReport = report => {
	assert.deepEqual(Object.keys(report).sort(), ["kind", "routes", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.kind, "signature-specialization-browser-installed-v1");
	assert.deepEqual(report.routes.map(item => item.route), routes);
	for(const item of report.routes)
	{
		assert.equal(item.producerCommit.length, 40); assert.equal(item.independentBuilds, 2);
		for(const flag of ["reproducible"
			, "authorInputsUnchanged"
			, "sourceRemovedBeforeInstallation"
			, "producerBuildsRemovedBeforeInstallation"
			, "offlineInstall"
			, "compilerFreePath"
			, "relocatedInstallation"])
			assert.equal(item[flag], true, `${item.route}:${flag}`);
		assert.deepEqual(item.builds[1], item.builds[0]);
		assert.deepEqual(item.browsers.requestedEngines, ["chromium", "firefox", "webkit"]);
		assert.deepEqual(item.browsers.observations.map(value => value.profile), signatureSpecializationBrowserProfiles);
		for(const observation of item.browsers.observations)
		{
			const variants = observation.profile === "browser-react"
				? ["production", "strict"] : ["production"];
			assert.equal(observation.browser.browser.installedSourcesRemoved, true);
			assert.equal(observation.browser.browser.externalNetworkBlocked, true);
			assert.deepEqual(observation.browser.browser.executions.map(
				execution => `${execution.engine}/${execution.variant}`).sort()
			, ["chromium", "firefox", "webkit"].flatMap(engine =>
				variants.map(variant => `${engine}/${variant}`)).sort());
			for(const execution of observation.browser.browser.executions)
			{
				assert.deepEqual(execution.observation.results, {
					module: "specialized", route: item.route
					, ...signatureSpecializationBrowserExpected
				});
				assert.equal(execution.failedAssetRecovery, true);
				if(observation.profile === "browser-react")
					assert.equal(execution.pendingUnmount, true);
				else assert.equal(Object.hasOwn(execution, "pendingUnmount"), false);
			}
			assert.deepEqual(observation.browser.observation
				, observation.browser.browser.executions[0].observation);
		}
	}
	return report;
};
