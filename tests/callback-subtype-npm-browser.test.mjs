/**
 * Source-free npm, page, React and worker acceptance for callback Subtypes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { browserFrameworkArchives, installedBrowserCorpus } from "./helpers/type-corpus-browser.mjs";
import { corpusBrowserSelection } from "./helpers/type-corpus.mjs";
import { callbackSubtypeConfiguration, callbackSubtypeFixture, callbackSubtypeName } from "./helpers/callback-subtype-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";

const npmFlag = "LEAN_BRIDGE_CALLBACK_SUBTYPE_NPM_TEST";
const browserFlag = "LEAN_BRIDGE_CALLBACK_SUBTYPE_BROWSER_TEST";
for(const flag of [npmFlag, browserFlag])
	if(process.env[flag] !== undefined)
		assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[npmFlag] === "1";
const browserEnabled = process.env[browserFlag] === "1";
if(browserEnabled)
{
	assert.equal(enabled, true, "Browser acceptance requires npm acceptance");
	assert.deepEqual(process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS?.split(",")
		, ["chromium", "firefox", "webkit"]);
}

const expected = Object.freeze({ checks: 18, rejections: 7, callbackCalls: 3 });
const fileTree = async directory => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(directory)).map(async path => [
		path, sha256(await readFile(join(directory, path)))
	])
));
const clean = root => ({ ...copiedCleanEnvironment, PATH: join(root, "bin")
	, NODE_PATH: "", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime" });

const install = async (root, handoff, receipt, framework = []) => {
	const bin = join(root, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(root, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"])
		await saveLakeFile(root, name, "");
	const npm = await realpath(join(process.execPath, "../../bin/npm"));
	const args = [npm, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--userconfig", join(root, "user.npmrc")
		, "--globalconfig", join(root, "global.npmrc")
		, "--cache", join(root, "empty-cache")
		, join(handoff, receipt.runtime.archive)
		, join(handoff, receipt.package.archive)
		, ...framework.map(item => join(root, item.archive))];
	return runCopied(process.execPath, args, root, clean(root));
};

const browserObservation = (observation, profile, route) => {
	assert.equal(typeof observation.hostVersion, "string");
	assert.ok(observation.hostVersion.length > 0);
	assert.deepEqual(observation, { schemaVersion: 1, profile
		, module: callbackSubtypeName
		, realm: profile === "browser-worker" ? "dedicated-worker" : "window"
		, results: { route, ...expected }, hostVersion: observation.hostVersion });
};

test("callback Subtype npm/browser flags fail closed", () => {
	assert.equal(enabled, process.env[npmFlag] === "1");
	assert.equal(browserEnabled, process.env[browserFlag] === "1");
	assert.deepEqual(callbackSubtypeConfiguration("ordinary").exports.length, 6);
	assert.equal(callbackSubtypeConfiguration("reviewed").exports, undefined);
	for(const value of [undefined, "", "source", false])
		assert.throws(() => callbackSubtypeConfiguration(value));
});

test("callback Subtypes install from reproducible ordinary and reviewed npm builds", {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-callback-subtype-npm-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained failed callback Subtype inputs: ${directory}`);
	});
	const engineRoot = process.cwd();
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT
		?? "build/lean-link-spike/lazy");
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
		, LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const producers = join(directory, "producers"), builds = [], releases = [];
	let review;
	for(const [route, attempt] of [["ordinary", 0], ["ordinary", 1], ["reviewed", 0]])
	{
		const author = join(producers, `${route}-${attempt}`);
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(callbackSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(callbackSubtypeConfiguration(route)));
		if(route === "reviewed")
			await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(review));
		const before = await lakeInputState(projectRoot);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot
			, environment, targets: ["npm"], runner: refinementEngineTransport() });
		assert.deepEqual(await lakeInputState(projectRoot), before);
		const bundleRoot = join(outputRoot, "bundle");
		const ir = JSON.parse(await readFile(join(bundleRoot, "binding/binding-ir.json")));
		if(review === undefined)
		{
			review = structuredClone(ir);
			review.producers = [{ id: "review"
				, adapter: "independent-callback-subtype-review"
				, adapterVersion: 1
				, tool: "Callback Subtype contract review"
				, toolVersion: "1", extensions: {} }];
			for(const item of [...review.declarations, ...review.types])
				item.source.producer = "review";
			for(const declaration of review.declarations)
			{
				const refinements = declaration.source.extensions[
					"lean-lang.org/refinements"
				];
				declaration.source.extensions = refinements
					? { "lean-lang.org/refinements": refinements } : {};
			}
		}
		else assert.equal(reviewedContractDifference(review, ir), null);
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot
			, outputRoot: join(author, "npm") });
		await verifyComponentPackageReceipt({ receiptPath: join(
			release.output, "component-package-receipt.json"
		) });
		const receiptBytes = await readFile(join(
			release.output, "component-package-receipt.json"
		));
		builds.push({ route, attempt, bindingIrSha256: hashBindingIr(ir)
			, receiptSha256: sha256(receiptBytes)
			, componentArchiveSha256: sha256(await readFile(release.componentArchive))
			, runtimeArchiveSha256: sha256(await readFile(release.runtimeArchive)) });
		releases.push(release);
	}
	for(const field of ["bindingIrSha256", "componentArchiveSha256"
		, "runtimeArchiveSha256", "receiptSha256"])
		assert.equal(builds[1][field], builds[0][field], field);
	assert.equal(builds[2].runtimeArchiveSha256, builds[0].runtimeArchiveSha256);
	assert.notEqual(builds[2].componentArchiveSha256
		, builds[0].componentArchiveSha256);
	assert.notEqual(builds[2].receiptSha256, builds[0].receiptSha256);

	const artifacts = {};
	for(const [route, index] of [["ordinary", 0], ["reviewed", 2]])
	{
		const release = releases[index], receipt = release.report;
		const handoff = join(directory, `${route}-handoff`);
		await mkdir(handoff);
		for(const name of [receipt.package.archive, receipt.runtime.archive
			, "component-package-receipt.json"
			, "verify-component-package-receipt.mjs"])
			await cp(join(release.output, name), join(handoff, name));
		await verifyComponentPackageReceipt({ receiptPath: join(
			handoff, "component-package-receipt.json"
		) });
		const trees = {}, manifests = {};
		for(const [role, item] of [
			["component", receipt.package]
			, ["runtime", receipt.runtime]
		]) {
			const extracted = join(directory, `${route}-archive-${role}`);
			await mkdir(extracted);
			await runCopied("/usr/bin/tar", [
				"--use-compress-program=/usr/bin/gzip"
				, "-xf", join(handoff, item.archive), "-C", extracted
			], directory);
			const manifest = JSON.parse(await readFile(join(
				extracted, "package/package.json"
			)));
			manifests[role] = manifest;
			trees[manifest.name] = await fileTree(join(extracted, "package"));
			await rm(extracted, { recursive: true });
		}
		artifacts[route] = { handoff, receipt, trees, manifests };
	}
	assert.equal(artifacts.ordinary.manifests.component.name
		, artifacts.reviewed.manifests.component.name);
	assert.equal(artifacts.ordinary.manifests.component.version
		, artifacts.reviewed.manifests.component.version);
	assert.deepEqual(artifacts.ordinary.trees[
		artifacts.ordinary.manifests.runtime.name
	], artifacts.reviewed.trees[artifacts.reviewed.manifests.runtime.name]);
	await rm(producers, { recursive: true, force: true });
	await assert.rejects(access(producers), { code: "ENOENT" });
	const javascript = await readFile(
		"tests/fixtures/callback-subtype-consumers/javascript.mjs", "utf8"
	);
	for(const route of ["ordinary", "reviewed"])
	{
		const { handoff, receipt, trees } = artifacts[route];
		const consumer = join(directory, `${route}-consumer`);
		const relocated = join(directory, `${route}-relocated`);
		await install(consumer, handoff, receipt);
		await saveLakeFile(consumer, "javascript.mjs", javascript);
		await saveLakeFile(consumer, "index.mjs"
			, `import * as api from ${JSON.stringify(callbackSubtypeName)};\nimport {checkCallbackSubtypes} from "./javascript.mjs";\nconsole.log(JSON.stringify(checkCallbackSubtypes(api)));\n`);
		await cp("tests/fixtures/callback-subtype-consumers/types.mts"
			, join(consumer, "types.mts"));
		for(const root of [consumer, relocated])
		{
			if(root === relocated) await rename(consumer, relocated);
			for(const [name, tree] of Object.entries(trees))
				assert.deepEqual(await fileTree(join(
					root, "node_modules", name
				)), tree, name);
			const run = await runCopied(
				process.execPath, ["index.mjs"], root, clean(root)
			);
			assert.equal(run.stderr, "");
			assert.deepEqual(JSON.parse(run.stdout), expected);
			const typed = await runCopied(process.execPath, [
				join(engineRoot, "node_modules/typescript/lib/tsc.js")
				, "--strict", "--noEmit", "--skipLibCheck", "false"
				, "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable"
				, "--module", "NodeNext", "--moduleResolution", "NodeNext"
				, "types.mts"
			], root, clean(root));
			assert.equal(typed.stdout, ""); assert.equal(typed.stderr, "");
		}
	}

	if(browserEnabled)
	{
		assert.deepEqual(corpusBrowserSelection(
			process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS
		), ["chromium", "firefox", "webkit"]);
		for(const route of ["ordinary", "reviewed"])
			for(const profile of ["browser-javascript", "browser-react", "browser-worker"])
			{
				const { handoff, receipt } = artifacts[route];
				const root = join(directory, `${route}-${profile}`);
				await mkdir(root, { recursive: true });
				const framework = profile === "browser-react"
					? await browserFrameworkArchives(root) : [];
				await install(root, handoff, receipt, framework);
				await saveLakeFile(root, "request.json", canonicalJson({
					module: callbackSubtypeName, profile, route
				}));
				await saveLakeFile(root, "javascript.mjs", javascript);
				await installedBrowserCorpus({ library: { npmModule: callbackSubtypeName }
					, profile, root, framework, environment: clean(root)
					, consumer: {
						packageSource: `import request from "./request.json";\nexport {request};\nexport const loadApi = () => import(${JSON.stringify(callbackSubtypeName)});\n`
						, validateObservation: observation => browserObservation(
							observation, profile, route
						)
					}
				});
			}
	}
	complete = true;
});
