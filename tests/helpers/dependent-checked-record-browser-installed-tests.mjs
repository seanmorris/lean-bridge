/**
 * Reproduce, install offline, relocate and execute dependent checked records.
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
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import {
	checkDependentCheckedRecordBrowsers
} from "./dependent-checked-record-browser.mjs";
import {
	dependentCheckedRecordEngines
	, dependentCheckedRecordExpected
	, dependentCheckedRecordFixture
	, dependentCheckedRecordName
	, dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { corpusBrowserSelection } from "./type-corpus.mjs";

const npmFlag = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NPM_TEST";
const browserFlag = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_BROWSER_TEST";
for(const flag of [npmFlag, browserFlag])
	if(process.env[flag] !== undefined)
		assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[npmFlag] === "1";
const browsers = process.env[browserFlag] === "1";
if(browsers)
{
	assert.ok(enabled, "Browser acceptance requires installed npm packages");
	assert.deepEqual(corpusBrowserSelection(
		process.env.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS
	), dependentCheckedRecordEngines);
}
const routeVariable = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? [...dependentCheckedRecordRoutes];
assert.ok(routes.length && new Set(routes).size === routes.length
	&& routes.every(route => dependentCheckedRecordRoutes.includes(route)));
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit dependent-record routes require the installed gate");

const fileTree = async directory => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(directory)).map(async path => [
		path, sha256(await readFile(join(directory, path)))
	])
));

for(const route of routes) test(
	`installed dependent checked records reproduce and relocate ${route}`
	, { skip: !enabled, timeout: 7_200_000 }, async t => {
	const output = resolve(
		process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_OUTPUT
			?? "build/dependent-checked-record-browser", route
	);
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-record-installed-"
	));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained failed dependent-record inputs: ${directory}`);
	});
	const engineRoot = process.cwd();
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT
		?? "build/lean-link-spike/lazy");
	const environment = {
		...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
		, LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot
	};
	const { configuration, expected, resultOnly, reviewed }
		= dependentCheckedRecordSelection(route);
	const builds = [], handoff = join(directory, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	assert.doesNotThrow(() => execFileSync(
		"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
	), "Installed evidence requires clean tracked source");
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`);
		const projectRoot = join(author, "project");
		const outputRoot = join(author, "release");
		await cp(dependentCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(configuration));
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json"
			, canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} dependent-record npm author ${attempt}`);
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
		const irBytes = await readFile(join(
			bundleRoot, "binding/binding-ir.json"
		));
		const ir = JSON.parse(irBytes);
		assert.equal(reviewedContractDifference(expected, ir), null);
		const release = await buildComponentNpmPackages({
			bundleRoot, runtimeRoot, outputRoot: join(author, "npm")
		});
		await verifyComponentPackageReceipt({
			receiptPath: join(release.output, "component-package-receipt.json")
		});
		for(const path of [
			"binding/binding-ir.json", "locks/compiler-adapters.json"
			, "locks/component-build-plan.json", "metadata/provenance.json"
		]) await saveLakeFile(
			output, `build-${attempt}/${path}`, await readFile(join(bundleRoot, path))
		);
		const receiptBytes = await readFile(join(
			release.output, "component-package-receipt.json"
		));
		await saveLakeFile(output
			, `build-${attempt}/component-package-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/DependentRecords.lean`
			, await readFile(join(projectRoot, "DependentRecords.lean")));
		await saveLakeFile(output, `build-${attempt}/author-inputs.json`
			, canonicalJson(sourceBefore));
		builds.push({
			authorInputsSha256: sha256(canonicalJson(sourceBefore.map(
				({ path, mode, sha256: digest }) => ({ path, mode, sha256: digest })
			)))
			, bindingIrSha256: hashBindingIr(ir)
			, bindingIrFileSha256: sha256(irBytes)
			, receiptSha256: sha256(receiptBytes)
			, componentArchiveSha256: sha256(await readFile(
				release.componentArchive
			))
			, runtimeArchiveSha256: sha256(await readFile(
				release.runtimeArchive
			))
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
	const receipt = JSON.parse(await readFile(join(
		handoff, "component-package-receipt.json"
	)));
	const trees = {};
	for(const [role, item] of [
		["component", receipt.package], ["runtime", receipt.runtime]
	]) {
		const extracted = join(directory, `original-${role}`);
		await mkdir(extracted);
		await runCopied("/usr/bin/tar", [
			"--use-compress-program=/usr/bin/gzip", "-xf"
			, join(handoff, item.archive), "-C", extracted
		], directory);
		const packageRoot = join(extracted, "package");
		const manifest = JSON.parse(await readFile(join(
			packageRoot, "package.json"
		)));
		assert.equal(manifest.name, role === "component"
			? dependentCheckedRecordName : "@lean-bridge/runtime");
		assert.ok(!Object.hasOwn(trees, manifest.name));
		trees[manifest.name] = await fileTree(packageRoot);
		assert.ok(!Object.keys(trees[manifest.name])
			.some(path => path.endsWith(".lean")));
	}
	const consumer = join(directory, "consumer");
	const moved = join(directory, "moved");
	const bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json"
		, canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"])
		await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
	const clean = root => ({
		...copiedCleanEnvironment, PATH: join(root, "bin"), NODE_PATH: ""
		, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime"
		, LEAN_BRIDGE_LEAN: "/unavailable/lean"
		, CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
	});
	const install = await runCopied(process.execPath, [
		npmCli, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--userconfig"
		, join(consumer, "user.npmrc"), "--globalconfig"
		, join(consumer, "global.npmrc"), "--cache"
		, join(consumer, "empty-cache"), join(handoff, receipt.runtime.archive)
		, join(handoff, receipt.package.archive)
	], consumer, clean(consumer));
	await saveLakeFile(output, "install.json", canonicalJson(install));
	const script = `import * as api from "${dependentCheckedRecordName}";
import {checkDependentRecords} from "./check.mjs";
console.log(JSON.stringify(checkDependentRecords(api, ${resultOnly}, ${reviewed})));
`;
	const fixture = "tests/fixtures/dependent-checked-record-browser";
	const corpus = await readFile(join(fixture, "javascript.mjs"));
	const typescript = await readFile(join(
		fixture, resultOnly ? "result-only.mts" : "full.mts"
	));
	for(const [path, source] of [
		["index.mjs", script], ["check.mjs", corpus], ["index.mts", typescript]
	]) {
		await saveLakeFile(consumer, path, source);
		await saveLakeFile(output, path, source);
	}
	const observations = [];
	for(const root of [consumer, moved])
	{
		if(root === moved)
		{
			await rename(consumer, moved);
			await assert.rejects(access(consumer), { code: "ENOENT" });
		}
		for(const [name, files] of Object.entries(trees))
			assert.deepEqual(await fileTree(join(
				root, "node_modules", name
			)), files, name);
		const result = await runCopied(
			process.execPath, ["index.mjs"], root, clean(root)
		);
		assert.equal(result.stderr, "");
		assert.deepEqual(JSON.parse(result.stdout)
			, dependentCheckedRecordExpected(route));
		const typed = await runCopied(process.execPath, [
			join(engineRoot, "node_modules/typescript/lib/tsc.js")
			, "--strict", "--noEmit", "--skipLibCheck", "false"
			, "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable"
			, "--module", "NodeNext", "--moduleResolution", "NodeNext"
			, "index.mts"
		], root, clean(root));
		assert.equal(typed.stdout, "");
		assert.equal(typed.stderr, "");
		observations.push({ result, typescript: typed, relocated: root === moved });
		await saveLakeFile(output, root === moved
			? "relocated.json" : "installed.json"
			, canonicalJson(observations.at(-1)));
	}
	const declarations = await readFile(join(
		moved, "node_modules", dependentCheckedRecordName, "index.d.ts"
	), "utf8");
	assert.match(declarations, /export interface Dependent \{\s*readonly bound: bigint;\s*readonly below: bigint;\s*\}/u);
	assert.doesNotMatch(declarations, /readonly valid:/u);
	for(const name of ["dependentTotal", "dependentRoundtrip"])
		(resultOnly ? assert.doesNotMatch : assert.match)(
			declarations, new RegExp(`export declare function ${name}\\(`, "u")
		);
	assert.match(declarations
		, /export declare function dependentResult\(/u);
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, producerCommit, configuration, builds, receipt
		, trees, observations, expectedBindingIrSha256: hashBindingIr(expected)
		, expected: dependentCheckedRecordExpected(route)
		, consumerProfiles: ["node-javascript", "node-typescript"]
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
		, relation: "below < bound"
	}));
	if(browsers) await checkDependentCheckedRecordBrowsers({
		directory: join(directory, "browsers"), handoff, receipt, records: output
		, route, producerCommit
	});
		complete = true;}
);
