/**
 * Source-free installed JavaScript-family acceptance for direct dependent Fin.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import {
	browserFrameworkArchives, installedBrowserCorpus
} from "./type-corpus-browser.mjs";
import { copyComponentPackageHandoff } from "./component-package-handoff.mjs";
import {
	dependentFinFixture, dependentFinRefinements, dependentFinReviewedIr
} from "./managed-dependent-fin.mjs";
import {
	dependentFinJavascriptConsumer, dependentFinJavascriptExpected
	, dependentFinJavascriptProfiles, dependentFinJavascriptRoutes
	, dependentFinTypeScript
} from "./dependent-fin-javascript.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";

const repository = resolve(import.meta.dirname, "../..");
const clean = {
	PATH: "/unavailable", CC: "/unavailable/compiler"
	, CXX: "/unavailable/compiler", LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: ""
};
const run = (command, args, cwd, env = clean) => processBuildRunner.capture({
	command, args, cwd, env, timeoutMs: 300_000
});
const configuration = route => ({
	schemaVersion: 1, modules: ["DependentFin"]
	, targets: { npm: { name: "dependentfin", version: "1.0.0" } }
	, ...(route === "ordinary-source"
		? { exports: Object.keys(dependentFinRefinements) } : {})
});

const facts = async (bundle, route) => {
	const irBytes = await readFile(join(bundle, "binding/binding-ir.json"));
	const ir = JSON.parse(irBytes);
	assert.equal(reviewedContractDifference(dependentFinReviewedIr(), ir), null);
	const plan = JSON.parse(await readFile(join(
		bundle, "locks/compiler-adapters.json"
	)));
	assert.deepEqual(Object.fromEntries(plan.exports.map(item => [
		item.sourceDeclaration, item.refinements
	])), dependentFinRefinements);
	const metadataBytes = await readFile(join(
		bundle, "metadata/lake-entry-exports.json"
	));
	const metadata = JSON.parse(metadataBytes);
	if(route === "reviewed-ir")
	{
		const source = canonicalJson(dependentFinReviewedIr());
		assert.equal(metadata.reviewedBindingIr.source, source);
		assert.equal(metadata.reviewedBindingIr.sourceSha256, sha256(source));
	}
	else assert.equal(Object.hasOwn(metadata, "reviewedBindingIr"), false);
	return {
		bindingIrSha256: hashBindingIr(ir)
		, metadataSha256: sha256(metadataBytes)
		, adapterPlanSha256: sha256(canonicalJson(plan))
		, ...(route === "reviewed-ir"
			? { reviewedSourceSha256: metadata.reviewedBindingIr.sourceSha256 }
			: {})
	};
};

const install = async (root, release, profile, framework = []) => {
	const bin = join(root, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(root, "package.json", canonicalJson({
		private: true, type: "module"
	}));
	for(const name of ["user.npmrc", "global.npmrc"])
		await saveLakeFile(root, name, "");
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	const result = await run(process.execPath, [
		npm, "install", "--offline", "--ignore-scripts", "--no-audit"
		, "--no-fund", "--userconfig", join(root, "user.npmrc")
		, "--globalconfig", join(root, "global.npmrc")
		, "--cache", join(root, "empty-cache")
		, release.runtimeArchive, release.componentArchive
		, ...framework.map(item => join(root, item.archive))
	], root, { ...clean, PATH: bin });
	assert.equal(result.code, 0);
	const installed = join(root, "node_modules/dependentfin");
	const ir = JSON.parse(await readFile(join(
		installed, "metadata/binding-ir.json"
	)));
	assert.equal(reviewedContractDifference(dependentFinReviewedIr(), ir), null);
	const request = { module: "dependentfin", profile, route: release.route };
	await saveLakeFile(root, "request.json", canonicalJson(request));
	await saveLakeFile(root, "javascript.mjs"
		, await dependentFinJavascriptConsumer());
	return { environment: { ...clean, PATH: bin }, request };
};

const packageSource = request => `export const request = ${JSON.stringify(request)};
export const loadApi = async () => {
  const [api, { runtime }] = await Promise.all([
    import("dependentfin"), import("./node_modules/dependentfin/internal/runtime.mjs")
  ]);
  return { ...api, raw: (name, args) => runtime.call("lean:DependentFin." + name, args) };
};
`;

const nodeConsumers = async (root, release) => {
	const installed = await install(root, release, "node-javascript");
	await saveLakeFile(root, "package.mjs", packageSource(installed.request));
	await saveLakeFile(root, "index.mjs"
		, 'import { executeDependentFin } from "./javascript.mjs";\nimport { request, loadApi } from "./package.mjs";\nconsole.log(JSON.stringify(executeDependentFin(request, await loadApi())));\n');
	const javascript = JSON.parse((await run(
		process.execPath, ["index.mjs"], root, installed.environment
	)).stdout);
	assert.deepEqual(javascript, {
		module: "dependentfin", route: release.route
		, ...dependentFinJavascriptExpected
	});
	const typedRequest = {
		...installed.request, profile: "node-typescript"
	};
	await saveLakeFile(root, "package.mjs", packageSource(typedRequest));
	await saveLakeFile(root, "index.ts", dependentFinTypeScript(typedRequest));
	await saveLakeFile(root, "tsconfig.json", canonicalJson({
		compilerOptions: {
			target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext"
			, lib: ["ES2022", "DOM", "ESNext.Disposable"]
			, strict: true, skipLibCheck: false, noEmitOnError: true
			, allowJs: true, checkJs: false, types: [], outDir: "dist"
		}
		, include: ["index.ts", "javascript.mjs", "package.mjs"]
	}));
	const compiler = join(repository, "node_modules/typescript/lib/tsc.js");
	await run(process.execPath, [compiler, "--project", "tsconfig.json"]
		, root, installed.environment);
	await symlink(join(root, "node_modules"), join(root, "dist/node_modules"));
	const typescript = JSON.parse((await run(
		process.execPath, ["dist/index.js"], root, installed.environment
	)).stdout);
	assert.deepEqual(typescript, {
		module: "dependentfin", route: release.route
		, ...dependentFinJavascriptExpected
	});
	const declarations = await readFile(join(
		root, "node_modules/dependentfin/index.d.ts"
	));
	assert.doesNotMatch(declarations.toString(), /\bany\b/u);
	return {
		executions: [
			{ profile: "node-javascript", hostVersion: process.version
				, result: javascript }
			, { profile: "node-typescript", hostVersion: process.version
				, result: typescript }
		]
		, typescript: {
			strict: true, skipLibCheck: false
			, sourceSha256: sha256(dependentFinTypeScript(typedRequest))
			, declarationsSha256: sha256(declarations)
			, compilerSha256: sha256(await readFile(join(
				repository, "node_modules/typescript/lib/_tsc.js"
			)))
		}
	};
};

const browserConsumers = async (root, release) => {
	const observations = [];
	for(const profile of dependentFinJavascriptProfiles.filter(
		item => item.startsWith("browser-")
	)) {
		const consumer = join(root, profile);
		await mkdir(consumer, { recursive: true });
		const framework = profile === "browser-react"
			? await browserFrameworkArchives(consumer) : [];
		const installed = await install(consumer, release, profile, framework);
		const validateObservation = result => {
			assert.equal(typeof result.hostVersion, "string");
			assert.ok(result.hostVersion.length > 0);
			assert.deepEqual(result, {
				schemaVersion: 1, profile, module: "dependentfin"
				, realm: profile === "browser-worker"
					? "dedicated-worker" : "window"
				, results: {
					module: "dependentfin", route: release.route
					, ...dependentFinJavascriptExpected
				}
				, hostVersion: result.hostVersion
			});
		};
		const browser = await installedBrowserCorpus({
			library: { npmModule: "dependentfin" }
			, profile, root: consumer, framework
			, environment: installed.environment
			, consumer: {
				packageSource: packageSource(installed.request)
				, validateObservation
			}
		});
		observations.push({ profile, browser });
	}
	return observations;
};

/**
 * Build one author route twice, remove the producers and execute all five JS profiles.
 *
 * @param t - Active test context.
 * @param route - Ordinary or independently reviewed author route.
 */
export const checkDependentFinJavascriptRoute = async (t, route) => {
	assert.ok(dependentFinJavascriptRoutes.includes(route)
		, `unknown dependent Fin JavaScript route: ${route}`);
	const root = await mkdtemp(join(
		tmpdir(), `lean-bridge-dependent-fin-javascript-${route}-`
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const producers = join(root, "producers");
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT
		?? "build/lean-link-spike/lazy");
	const environment = {
		...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
		, LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot
	};
	const releases = [], buildFacts = [];
	for(const attempt of [0, 1])
	{
		const projectRoot = join(producers, `author-${attempt}`);
		const outputRoot = join(producers, `build-${attempt}`);
		await cp(dependentFinFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(configuration(route)));
		if(route === "reviewed-ir") await saveLakeFile(
			projectRoot, "api.binding-ir.json"
			, canonicalJson(dependentFinReviewedIr())
		);
		const before = await lakeInputState(projectRoot);
		await buildCanonicalProject({
			projectRoot, outputRoot, engineRoot: repository
			, environment, targets: ["npm"], runner: refinementEngineTransport()
		});
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const bundle = join(outputRoot, "bundle");
		buildFacts.push(await facts(bundle, route));
		const release = await buildComponentNpmPackages({
			bundleRoot: bundle, runtimeRoot
			, outputRoot: join(producers, `npm-${attempt}`)
		});
		await verifyComponentPackageReceipt({
			receiptPath: join(release.output, "component-package-receipt.json")
		});
		releases.push(release);
	}
	assert.deepEqual(buildFacts[1], buildFacts[0]);
	assert.deepEqual(releases[1].report, releases[0].report);
	for(const key of ["componentArchive", "runtimeArchive"])
		assert.deepEqual(await readFile(releases[1][key])
			, await readFile(releases[0][key]));
	const handoff = await copyComponentPackageHandoff(
		releases[0].output, join(root, "handoff")
	);
	handoff.route = route;
	await rm(producers, { recursive: true, force: true });
	await assert.rejects(stat(producers), { code: "ENOENT" });
	const node = await nodeConsumers(join(root, "node"), handoff);
	const browsers = await browserConsumers(join(root, "browsers"), handoff);
	return {
		schemaVersion: 1, kind: "dependent-fin-javascript-installed-v1"
		, route
		, producerCommit: execFileSync(
			"git"
			, ["rev-parse", "HEAD"]
			, { encoding: "utf8" }
		).trim()
		, facts: buildFacts[0], receipt: handoff.receipt
		, node, browsers, independentBuilds: 2, reproducible: true
		, sourceRemovedBeforeInstallation: true
		, producerBuildsRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreePath: true
	};
};
