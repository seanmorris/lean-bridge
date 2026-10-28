/**
 * Source-free ordinary and reviewed npm acceptance for optional parameters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	buildComponentNpmPackages
} from "../src/release/component-npm-package.mjs";
import {
	verifyComponentPackageReceipt
} from "../src/release/component-package-receipt.mjs";
import {
	checkOptionalParameterBrowsers
} from "./helpers/optional-parameter-browser.mjs";
import {
	assertOptionalParameterBundle, prepareOptionalParameterProject
} from "./helpers/optional-parameter-packages.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_OPTIONAL_NPM_TEST === "1";
const browsers = process.env.LEAN_BRIDGE_OPTIONAL_BROWSER_TEST === "1";
for(const flag of [
	"LEAN_BRIDGE_OPTIONAL_NPM_TEST", "LEAN_BRIDGE_OPTIONAL_BROWSER_TEST"
]) if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
if(browsers) assert.ok(enabled, "Browser acceptance requires actual npm packages");
const routes = process.env.LEAN_BRIDGE_OPTIONAL_NPM_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

const profiles = [
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker"
];
const clean = {
	CC: "/unavailable/compiler", CXX: "/unavailable/compiler"
	, LEAN_BRIDGE_LEAN: "/unavailable/lean"
	, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime", NODE_PATH: ""
};
const tree = async root => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(root)).map(async path => [
		path, sha256(await readFile(join(root, path)))
	])
));
const caller = `import * as api from "optional-parameters";
import {checkOptionalParameters} from "./check.mjs";
console.log(JSON.stringify(checkOptionalParameters(api)));
`;
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_OPTIONAL_NPM_OUTPUT
		?? "build/optional-parameter-npm/{route}"
).replace("{route}", route));

for(const route of routes) test(
	`installed optional-parameter npm packages reproduce and relocate ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-optional-npm-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const engineRoot = process.cwd();
		const runtimeRoot = resolve(
			process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT
				?? "build/lean-link-spike/lazy"
		);
		const environment = {
			...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
			, LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot
		};
		const builds = [], releases = [];
		const handoff = join(suite, "handoff");
		for(const attempt of [0, 1])
		{
			const prepared = await prepareOptionalParameterProject(t, {
				route, profiles
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot, engineRoot
				, environment, targets: ["npm"]
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const bundleRoot = join(outputRoot, "bundle");
			const bundle = await assertOptionalParameterBundle(bundleRoot);
			const release = await buildComponentNpmPackages({
				bundleRoot, runtimeRoot
				, outputRoot: join(prepared.directory, "npm")
			});
			await verifyComponentPackageReceipt({
				receiptPath: join(
					release.output, "component-package-receipt.json")
			});
			assert.deepEqual(await lakeInputState(prepared.projectRoot), before);
			const fact = {
				...bundle, bindingIrSha256: built.bindingIrSha256
				, componentArchiveSha256: sha256(
					await readFile(release.componentArchive))
				, runtimeArchiveSha256: sha256(
					await readFile(release.runtimeArchive))
				, receiptSha256: sha256(await readFile(join(
					release.output, "component-package-receipt.json")))
			};
			for(const [name, path] of [
				["binding-ir.json", "binding/binding-ir.json"]
				, ["compiler-adapters.json", "locks/compiler-adapters.json"]
				, ["component-build-plan.json", "locks/component-build-plan.json"]
				, ["LeanBridgeGenerated.lean", "generated/LeanBridgeGenerated.lean"]
				, ["provenance.json", "metadata/provenance.json"]
			]) await saveLakeFile(records, `build-${attempt}/${name}`
				, await readFile(join(bundleRoot, path)));
			await saveLakeFile(records
				, `build-${attempt}/component-package-receipt.json`
				, await readFile(join(
					release.output, "component-package-receipt.json")));
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/Defaults.lean`
				, await readFile(join(prepared.projectRoot, "Defaults.lean")));
			if(attempt === 0)
			{
				await mkdir(handoff);
				for(const name of [
					release.report.package.archive, release.report.runtime.archive
					, "component-package-receipt.json"
					, "verify-component-package-receipt.mjs"
				]) await cp(join(release.output, name), join(handoff, name));
			}
			builds.push(fact);
			releases.push(release.report);
			await rm(prepared.directory, { recursive: true, force: true });
			await assert.rejects(lstat(prepared.directory), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		assert.deepEqual(releases[1], releases[0]);
		await verifyComponentPackageReceipt({
			receiptPath: join(handoff, "component-package-receipt.json")
		});
		const receipt = releases[0];

		const nodeRoot = join(suite, "node"), bin = join(nodeRoot, "bin");
		await mkdir(bin, { recursive: true });
		await symlink(process.execPath, join(bin, "node"));
		await saveLakeFile(nodeRoot, "package.json"
			, canonicalJson({ private: true, type: "module" }));
		for(const name of ["user.npmrc", "global.npmrc"])
			await saveLakeFile(nodeRoot, name, "");
		const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
		const installEnvironment = { ...clean, PATH: bin };
		await processBuildRunner.capture({
			command: process.execPath, cwd: nodeRoot, env: installEnvironment
			, timeoutMs: 300_000
			, args: [npmCli, "install", "--offline", "--ignore-scripts"
				, "--no-audit", "--no-fund"
				, "--userconfig", join(nodeRoot, "user.npmrc")
				, "--globalconfig", join(nodeRoot, "global.npmrc")
				, "--cache", join(nodeRoot, "empty-cache")
				, join(handoff, receipt.runtime.archive)
				, join(handoff, receipt.package.archive)]
		});
		await saveLakeFile(nodeRoot, "index.mjs", caller);
		await saveLakeFile(nodeRoot, "check.mjs", await readFile(
			"tests/fixtures/optional-parameter-consumers/javascript.mjs"
		));
		await saveLakeFile(nodeRoot, "index.mts", await readFile(
			"tests/fixtures/optional-parameter-consumers/index.mts"
		));
		const componentRoot = join(
			nodeRoot, "node_modules/optional-parameters");
		const runtimePackageRoot = join(
			nodeRoot, "node_modules/@lean-bridge/runtime");
		const installedTrees = {
			"optional-parameters": await tree(componentRoot)
			, "@lean-bridge/runtime": await tree(runtimePackageRoot)
		};
		const declarations = await readFile(
			join(componentRoot, "index.d.ts"), "utf8");
		for(const signature of [
			/word\(value0\?: number\): number;/u
			, /natural\(value0\?: bigint\): bigint;/u
			, /present\(value0\?: Readonly</u
			, /unitValue\(value0\?: void\): void;/u
		]) assert.match(declarations, signature);
		await saveLakeFile(records, "index.mjs", caller);
		await saveLakeFile(records, "check.mjs", await readFile(
			"tests/fixtures/optional-parameter-consumers/javascript.mjs"
		));
		await saveLakeFile(records, "index.mts", await readFile(
			"tests/fixtures/optional-parameter-consumers/index.mts"
		));
		await saveLakeFile(records, "index.d.ts", declarations);
		const typescript = join(
			engineRoot, "node_modules/typescript/lib/tsc.js");
		const execute = async root => {
			const env = { ...clean, PATH: join(root, "bin") };
			const run = await processBuildRunner.capture({
				command: process.execPath, args: ["index.mjs"], cwd: root, env
			});
			assert.equal(run.stderr, "");
			const result = JSON.parse(run.stdout);
			assert.deepEqual(result, { checks: 27, rejections: 7 });
			const typed = await processBuildRunner.capture({
				command: process.execPath, cwd: root, env
				, args: [typescript, "--strict", "--noEmit"
					, "--skipLibCheck", "false", "--target", "ES2022"
					, "--module", "NodeNext", "--moduleResolution", "NodeNext"
					, "index.mts"]
			});
			assert.equal(typed.stdout, "");
			assert.equal(typed.stderr, "");
			for(const [name, expected] of Object.entries(installedTrees))
				assert.deepEqual(
					await tree(join(root, "node_modules", name)), expected);
			return {
				result, typescript: true, relocated: root.endsWith("/moved")
			};
		};
		const node = [await execute(nodeRoot)];
		const moved = join(suite, "moved");
		await rename(nodeRoot, moved);
		await assert.rejects(access(nodeRoot), { code: "ENOENT" });
		node.push(await execute(moved));
		assert.equal(await readFile(join(moved, "index.mjs"), "utf8"), caller);

		const browser = browsers ? await checkOptionalParameterBrowsers({
			directory: join(suite, "browser"), handoff, receipt, records, route
		}) : null;
		await cp(handoff, join(records, "handoff"), {
			recursive: true, errorOnExist: true, force: false
		});
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		const report = {
			schemaVersion: 1, route, producerCommit, profiles
			, reproducible: true, independentBuilds: 2
			, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
			, builds, receipt, installedTrees, node
			, declarationsSha256: sha256(declarations)
			, callerSha256: sha256(caller), browser
		};
		await saveLakeFile(records, "report.json", canonicalJson(report));
	}
);
