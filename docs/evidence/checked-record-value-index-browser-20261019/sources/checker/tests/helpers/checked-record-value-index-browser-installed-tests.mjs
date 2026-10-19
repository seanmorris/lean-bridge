/**
 * Reproduce, install offline, relocate and browser-replay value-index packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import {
	verifyComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import { checkCheckedRecordValueIndexBrowsers } from "./checked-record-value-index-browser.mjs";
import {
	checkedRecordValueIndexBrowserNegativeControls
} from "./checked-record-value-index-browser-controls.mjs";
import {
	checkedRecordValueIndexBrowserEngines
	, checkedRecordValueIndexBrowserExpected
	, checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
	, checkedRecordValueIndexFixtureRoot
	, checkedRecordValueIndexInputNames
	, checkedRecordValueIndexModule
	, checkedRecordValueIndexPackage
	, checkedRecordValueIndexResultNames
} from "./checked-record-value-index-browser-fixture.mjs";
import {
	checkedRecordValueIndexPositions
	, checkedRecordValueIndexBrowserRecordPaths
	, checkCheckedRecordValueIndexBrowserReport
	, checkCheckedRecordValueIndexNpmReport
} from "./checked-record-value-index-browser-report.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";

const npmFlag = "LEAN_BRIDGE_VALUE_INDEX_NPM_TEST";
const browserFlag = "LEAN_BRIDGE_VALUE_INDEX_BROWSER_TEST";
for(const flag of [npmFlag, browserFlag])
	if(process.env[flag] !== undefined)
		assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[npmFlag] === "1";
const browsers = process.env[browserFlag] === "1";
if(browsers)
{
	assert.ok(enabled, "Browser acceptance requires installed value-index packages");
	const selectedBrowsers = corpusBrowserSelection(
		process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS);
	assert.deepEqual(selectedBrowsers, checkedRecordValueIndexBrowserEngines);
}
const routeVariable = "LEAN_BRIDGE_VALUE_INDEX_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? [...checkedRecordValueIndexBrowserRoutes];
assert.ok(routes.length && new Set(routes).size === routes.length
	&& routes.every(route => checkedRecordValueIndexBrowserRoutes.includes(route)));
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit value-index routes require the installed gate");

const fileTree = async directory => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(directory)).map(async path => [
		path, sha256(await readFile(join(directory, path)))
	])
));

for(const route of routes) test(
	`installed value-index records reproduce, relocate and reach browsers for ${route}`
	, { skip: !enabled, timeout: 7_200_000 }, async t => {
		const output = resolve(process.env.LEAN_BRIDGE_VALUE_INDEX_BROWSER_OUTPUT
			?? "build/checked-record-value-index-browser", route);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-installed-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed value-index inputs: ${root}`);
		});
		const engineRoot = process.cwd();
		const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT
			?? "build/lean-link-spike/lazy");
		const environment = {
			...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
			, LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot
		};
		const selection = checkedRecordValueIndexBrowserSelection(route);
		const handoff = join(output, "handoff"), builds = [];
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"]
			, { stdio: "ignore" }), "Installed evidence requires clean tracked source");
		await saveLakeFile(output, "configuration.json"
			, canonicalJson(selection.configuration));
		await saveLakeFile(output, "expected.binding-ir.json"
			, canonicalJson(selection.expected));
		for(const attempt of [0, 1])
		{
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project");
			const outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(checkedRecordValueIndexFixtureRoot, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(selection.configuration));
			if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json"
				, canonicalJson(selection.expected));
			const sourceBefore = await lakeInputState(projectRoot);
			const stableInputs = sourceBefore.map(({ path, mode, sha256: digest }) => ({
				path, mode, sha256: digest
			}));
			t.diagnostic(`${route} value-index author ${attempt}`);
			await buildCanonicalProject({
				projectRoot, outputRoot, engineRoot, environment, targets: ["npm"]
				, runner: refinementEngineTransport()
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore
				, "Author source remains unchanged");
			const bundleRoot = join(outputRoot, "bundle");
			const irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
			const ir = JSON.parse(irBytes);
			assert.equal(reviewedContractDifference(selection.expected, ir), null);
			const release = await buildComponentNpmPackages({
				bundleRoot, runtimeRoot, outputRoot: join(author, "npm")
			});
			await verifyComponentPackageReceipt({
				receiptPath: join(release.output, "component-package-receipt.json")
			});
			for(const path of [
				"binding/binding-ir.json", "locks/compiler-adapters.json"
				, "locks/component-build-plan.json", "metadata/provenance.json"
			]) await saveLakeFile(record, path, await readFile(join(bundleRoot, path)));
			const receiptBytes = await readFile(join(release.output
				, "component-package-receipt.json"));
			await saveLakeFile(record, "component-package-receipt.json", receiptBytes);
			await saveLakeFile(record, `${checkedRecordValueIndexModule}.lean`
				, await readFile(join(projectRoot, `${checkedRecordValueIndexModule}.lean`)));
			await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
			builds.push({
				authorInputsSha256: sha256(canonicalJson(stableInputs))
				, bindingIrSha256: hashBindingIr(ir)
				, bindingIrFileSha256: sha256(irBytes)
				, receiptSha256: sha256(receiptBytes)
				, componentArchiveSha256: sha256(await readFile(release.componentArchive))
				, runtimeArchiveSha256: sha256(await readFile(release.runtimeArchive))
			});
			if(attempt === 0)
			{
				await mkdir(handoff);
				for(const name of [
					release.report.package.archive, release.report.runtime.archive
					, "component-package-receipt.json"
					, "verify-component-package-receipt.mjs"
				]) await cp(join(release.output, name), join(handoff, name));
			}
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		await verifyComponentPackageReceipt({
			receiptPath: join(handoff, "component-package-receipt.json")
		});
		const receipt = JSON.parse(await readFile(join(handoff
			, "component-package-receipt.json")));
		const trees = {};
		for(const item of [receipt.package, receipt.runtime])
		{
			const extracted = join(root, `archive-${Object.keys(trees).length}`);
			await mkdir(extracted);
			await runCopied("/usr/bin/tar", [
				"--use-compress-program=/usr/bin/gzip", "-xf"
				, join(handoff, item.archive), "-C", extracted
			], root);
			const packageRoot = join(extracted, "package");
			const manifest = JSON.parse(await readFile(join(packageRoot, "package.json")));
			assert.ok(typeof manifest.name === "string"
				&& !Object.hasOwn(trees, manifest.name));
			trees[manifest.name] = await fileTree(packageRoot);
			assert.ok(!Object.keys(trees[manifest.name]).some(path =>
				path.endsWith(".lean")));
		}
		assert.ok(Object.hasOwn(trees, checkedRecordValueIndexPackage));
		const consumer = join(root, "consumer"), moved = join(root, "moved");
		const bin = join(consumer, "bin");
		await mkdir(bin, { recursive: true });
		await symlink(process.execPath, join(bin, "node"));
		await saveLakeFile(consumer, "package.json"
			, canonicalJson({ private: true, type: "module" }));
		for(const name of ["user.npmrc", "global.npmrc"])
			await saveLakeFile(consumer, name, "");
		const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
		const clean = directory => ({
			...copiedCleanEnvironment, PATH: join(directory, "bin"), NODE_PATH: ""
			, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime"
			, LEAN_BRIDGE_LEAN: "/unavailable/lean"
			, CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
		});
		const install = await runCopied(process.execPath, [
			npmCli, "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund"
			, "--userconfig", join(consumer, "user.npmrc")
			, "--globalconfig", join(consumer, "global.npmrc")
			, "--cache", join(consumer, "empty-cache")
			, join(handoff, receipt.runtime.archive)
			, join(handoff, receipt.package.archive)
		], consumer, clean(consumer));
		await saveLakeFile(output, "install.json", canonicalJson(install));
		const corpus = await readFile(
			"tests/fixtures/checked-record-value-index-browser/javascript.mjs");
		const typescript = await readFile(join(
			"tests/fixtures/checked-record-value-index-browser"
			, selection.resultOnly ? "result-only.mts" : "full.mts"));
		const script = `import * as api from "${checkedRecordValueIndexPackage}";\n`
			+ "import {checkCheckedRecordValueIndices} from \"./check.mjs\";\n"
			+ `console.log(JSON.stringify(checkCheckedRecordValueIndices(api, ${selection.resultOnly})));\n`;
		for(const [path, source] of [
			["index.mjs", script], ["check.mjs", corpus], ["index.mts", typescript]
		]) {
			await saveLakeFile(consumer, path, source);
			await saveLakeFile(output, `callers/${path}`, source);
		}
		const expected = checkedRecordValueIndexBrowserExpected(route);
		const observations = [];
		const runtime = {
			node: process.version, platform: process.platform, arch: process.arch
		};
		const runtimeProbe = "console.log(JSON.stringify({node:process.version"
			+ ",platform:process.platform,arch:process.arch}))";
		for(const directory of [consumer, moved])
		{
			if(directory === moved)
			{
				await rename(consumer, moved);
				await assert.rejects(access(consumer), { code: "ENOENT" });
			}
			for(const [name, files] of Object.entries(trees))
				assert.deepEqual(await fileTree(join(directory, "node_modules", name))
					, files, name);
			const result = await runCopied(process.execPath, ["index.mjs"]
				, directory, clean(directory));
			assert.equal(result.stderr, "");
			assert.deepEqual(JSON.parse(result.stdout), expected);
			const typed = await runCopied(process.execPath, [
				join(engineRoot, "node_modules/typescript/lib/tsc.js")
				, "--strict", "--noEmit", "--skipLibCheck", "false"
				, "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable"
				, "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"
			], directory, clean(directory));
			assert.equal(typed.stdout, ""); assert.equal(typed.stderr, "");
			const runtimeResult = await runCopied(process.execPath
				, ["--input-type=module", "--eval", runtimeProbe]
				, directory, clean(directory));
			assert.equal(runtimeResult.stderr, "");
			assert.deepEqual(JSON.parse(runtimeResult.stdout), runtime);
			assert.deepEqual(await readFile(join(directory, "check.mjs")), corpus);
			assert.deepEqual(await readFile(join(directory, "index.mts")), typescript);
			assert.equal(await readFile(join(directory, "index.mjs"), "utf8"), script);
			observations.push({
				result, typescript: typed, runtime: runtimeResult
				, relocated: directory === moved
			});
			await saveLakeFile(output, directory === moved
				? "relocated.json" : "installed.json"
				, canonicalJson(observations.at(-1)));
		}
		const declarations = await readFile(join(moved, "node_modules"
			, checkedRecordValueIndexPackage, "index.d.ts"), "utf8");
		for(const name of [
			"On", "Off", "Ab", "EmptySized", "ZeroToken", "WideToken"
			, "EmptyToken", "UnicodeToken"
		]) assert.match(declarations, new RegExp(`export interface ${name} \\{`, "u"));
		assert.doesNotMatch(declarations
			, /readonly (?:set|named|sized|fixed|index):/u);
		for(const name of checkedRecordValueIndexResultNames)
			assert.match(declarations
				, new RegExp(`export declare function ${name}\\(`, "u"));
		for(const name of checkedRecordValueIndexInputNames)
			(selection.resultOnly ? assert.doesNotMatch : assert.match)(
				declarations, new RegExp(`export declare function ${name}\\(`, "u"));
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, producerCommit, runtime
			, configuration: selection.configuration, builds, receipt, trees
			, observations
			, expectedBindingIrSha256: hashBindingIr(selection.expected), expected
			, consumerProfiles: ["node-javascript", "node-typescript"]
			, positions: checkedRecordValueIndexPositions
			, callers: {
				"index.mjs": sha256(script), "check.mjs": sha256(corpus)
				, "index.mts": sha256(typescript)
			}
			, typescript: {
				strict: true, skipLibCheck: false, sourceSha256: sha256(typescript)
				, declarationsSha256: sha256(declarations)
			}
			, independentBuilds: 2, reproducible: true
			, authorInputsUnchanged: true, sourceCommitClean: true
			, sourceRemovedBeforeInstallation: true, offlineInstall: true
			, compilerFreePath: true, relocatedInstallation: true
			, immutableCallerAssertions: true
			, negativeControls: {
				checkedRefusals: 4, shapeRefusals: 2, recoveries: 6
			}
		}));
		const read = path => readFile(join(output, path));
		await checkCheckedRecordValueIndexNpmReport(read, {
			route, producerCommit, runtime
		});
		if(browsers)
		{
			const consumerCommit = producerCommit;
			await checkCheckedRecordValueIndexBrowsers({
				directory: join(root, "browsers"), records: output, route
				, producerCommit, consumerCommit, runtime
			});
			const reportOptions = {
				route, producerCommit, consumerCommit, runtime
			};
			const accepted = await checkCheckedRecordValueIndexBrowserReport(
				read, reportOptions);
			const expectedPaths = checkedRecordValueIndexBrowserRecordPaths(receipt)
				.filter(path => path !== "controls.json");
			const actualPaths = await nativeArtifactPaths(output);
			assert.deepEqual(actualPaths, expectedPaths);
			const originals = new Map(await Promise.all(expectedPaths.map(async path => [
				path, await read(path)
			])));
			const controls = await checkedRecordValueIndexBrowserNegativeControls(
				originals, reportOptions);
			assert.deepEqual(controls.accepted, accepted);
			await saveLakeFile(output, "controls.json", canonicalJson({
				schemaVersion: 1, checkerCommit: producerCommit, ...controls
			}));
			assert.deepEqual(await nativeArtifactPaths(output)
				, checkedRecordValueIndexBrowserRecordPaths(receipt));
		}
		complete = true;
	}
);
