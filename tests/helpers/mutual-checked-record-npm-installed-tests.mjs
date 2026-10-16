/**
 * Reproduce, install offline and relocate mutual checked-record npm packages.
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
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import {
	mutualCheckedRecordFixtureRoot, mutualCheckedRecordModule
} from "./mutual-checked-record-fixture.mjs";
import {
	mutualCheckedRecordNpmExpected, mutualCheckedRecordNpmPositions
	, mutualCheckedRecordNpmRoutes, mutualCheckedRecordNpmSelection
} from "./mutual-checked-record-npm-fixture.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";

const flag = "LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NPM_TEST";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[flag] === "1";
const routes = (process.env.LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NPM_ROUTES
	?? mutualCheckedRecordNpmRoutes.join(",")).split(",").filter(Boolean);
assert.ok(routes.length && new Set(routes).size === routes.length
	&& routes.every(route => mutualCheckedRecordNpmRoutes.includes(route)));
if(process.env.LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NPM_ROUTES !== undefined)
	assert.ok(enabled, "Explicit mutual checked-record npm routes require the installed gate");

const fileTree = async directory => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(directory)).map(async path => [
		path, sha256(await readFile(join(directory, path)))
	])
));

for(const route of routes) test(
	`installed mutual checked-record npm package reproduces and relocates ${route}`,
	{ skip: !enabled, timeout: 3_600_000 }, async t => {
		const output = resolve(process.env.LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NPM_OUTPUT
			?? "build/mutual-checked-record-npm", route);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-mutual-checked-record-npm-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed mutual checked-record npm inputs: ${root}`);
		});
		const engineRoot = process.cwd();
		const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT
			?? "build/lean-link-spike/lazy");
		const environment = {
			...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix"
			, LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot
		};
		const selection = mutualCheckedRecordNpmSelection(route);
		const handoff = join(root, "handoff"), builds = [];
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"]
			, { stdio: "ignore" }), "Installed evidence requires a clean tracked source tree");
		await saveLakeFile(output, "configuration.json", canonicalJson(selection.configuration));
		await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(selection.expected));
		for(const attempt of [0, 1])
		{
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project"), outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(mutualCheckedRecordFixtureRoot, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(selection.configuration));
			if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json"
				, canonicalJson(selection.expected));
			const sourceBefore = await lakeInputState(projectRoot);
			const stableInputs = sourceBefore.map(({ path, mode, sha256: digest }) =>
				({ path, mode, sha256: digest }));
			t.diagnostic(`${route} npm author ${attempt}`);
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
			await saveLakeFile(record, `${mutualCheckedRecordModule}.lean`
				, await readFile(join(projectRoot, `${mutualCheckedRecordModule}.lean`)));
			await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
			builds.push({
				bindingIrSha256: hashBindingIr(ir), bindingIrFileSha256: sha256(irBytes)
				, receiptSha256: sha256(receiptBytes)
				, componentArchiveSha256: sha256(await readFile(release.componentArchive))
				, runtimeArchiveSha256: sha256(await readFile(release.runtimeArchive))
				, authorInputsSha256: sha256(canonicalJson(stableInputs))
			});
			if(attempt === 0)
			{
				await mkdir(handoff);
				for(const name of [
					release.report.package.archive, release.report.runtime.archive
					, "component-package-receipt.json", "verify-component-package-receipt.mjs"
				]) await cp(join(release.output, name), join(handoff, name));
			}
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		await verifyComponentPackageReceipt({
			receiptPath: join(handoff, "component-package-receipt.json")
		});
		await cp(handoff, join(output, "handoff"), {
			recursive: true, errorOnExist: true, force: false
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
				, join(handoff, item.archive), "-C", extracted], root);
			const packageRoot = join(extracted, "package");
			const manifest = JSON.parse(await readFile(join(packageRoot, "package.json")));
			assert.ok(typeof manifest.name === "string" && !Object.hasOwn(trees, manifest.name));
			trees[manifest.name] = await fileTree(packageRoot);
			assert.ok(!Object.keys(trees[manifest.name]).some(path => path.endsWith(".lean")));
		}
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
			"tests/fixtures/mutual-checked-record-consumers/javascript.mjs");
		const typescript = await readFile(
			"tests/fixtures/mutual-checked-record-consumers/typescript.mts");
		const script = "import * as api from \"mutualcheckedrecords\";\n"
			+ "import {checkMutualCheckedRecords} from \"./check.mjs\";\n"
			+ "console.log(JSON.stringify(checkMutualCheckedRecords(api)));\n";
		for(const [path, source] of [
			["index.mjs", script], ["check.mjs", corpus], ["index.mts", typescript]
		]) {
			await saveLakeFile(consumer, path, source);
			await saveLakeFile(output, `callers/${path}`, source);
		}
		const expected = mutualCheckedRecordNpmExpected(route), observations = [];
		const runtimeIdentity = {
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
				assert.deepEqual(await fileTree(join(directory, "node_modules", name)), files, name);
			const result = await runCopied(process.execPath, ["index.mjs"]
				, directory, clean(directory));
			assert.equal(result.stderr, "");
			assert.deepEqual(JSON.parse(result.stdout), expected);
			const typed = await runCopied(process.execPath, [
				join(engineRoot, "node_modules/typescript/lib/tsc.js")
				, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022"
				, "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext"
				, "--moduleResolution", "NodeNext", "index.mts"
			], directory, clean(directory));
			assert.equal(typed.stdout, ""); assert.equal(typed.stderr, "");
			const runtime = await runCopied(process.execPath
				, ["--input-type=module", "--eval", runtimeProbe]
				, directory, clean(directory));
			assert.equal(runtime.stderr, "");
			assert.deepEqual(JSON.parse(runtime.stdout), runtimeIdentity);
			assert.deepEqual(await readFile(join(directory, "check.mjs")), corpus);
			assert.deepEqual(await readFile(join(directory, "index.mts")), typescript);
			assert.equal(await readFile(join(directory, "index.mjs"), "utf8"), script);
			observations.push({ result, typescript: typed, runtime
				, relocated: directory === moved });
			await saveLakeFile(output, directory === moved ? "relocated.json" : "installed.json"
				, canonicalJson(observations.at(-1)));
		}
		const declarations = await readFile(
			join(moved, "node_modules/mutualcheckedrecords/index.d.ts"), "utf8");
		assert.match(declarations, /export interface Envelope \{[\s\S]*readonly next: [^;]*Step/u);
		assert.match(declarations, /export type EnvelopeAlias = Envelope;/u);
		assert.match(declarations, /export type Step = [^\n]*kind: "stop"[^\n]*kind: "more"/u);
		assert.doesNotMatch(declarations, /readonly linked:/u);
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1
			, route
			, producerCommit
			, configuration: selection.configuration
			, builds, receipt, trees, observations, runtime: runtimeIdentity
			, consumerProfiles: ["node-javascript", "node-typescript"]
			, positions: mutualCheckedRecordNpmPositions
			, expectedBindingIrSha256: hashBindingIr(selection.expected), expected
			, callers: {
				"index.mjs": sha256(script), "check.mjs": sha256(corpus)
				, "index.mts": sha256(typescript)
			}
			, typescript: {
				strict: true, skipLibCheck: false, sourceSha256: sha256(typescript)
				, declarationsSha256: sha256(declarations)
			}
			, independentBuilds: 2, reproducible: true, authorInputsUnchanged: true
			, sourceCommitClean: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true
			, immutableCallerAssertions: true, malformedDepthCycleRecovery: true
		}));
		complete = true;
	}
);
