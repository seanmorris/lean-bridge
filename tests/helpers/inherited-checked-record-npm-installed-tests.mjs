/**
 * Reproduce, install offline, relocate and execute all four inherited checked-record npm selections.
 * This gate is opt-in because it compiles fresh Lean and the shared Wasm component twice per route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { inheritedCheckedRecordFixture } from "./inherited-checked-record-fixture.mjs";
import {
	inheritedCheckedRecordNpmExpected,
	inheritedCheckedRecordNpmPositions,
	inheritedCheckedRecordNpmRoutes,
	inheritedCheckedRecordNpmSelection
} from "./inherited-checked-record-npm-fixture.mjs";
import {
	checkInheritedCheckedRecordNpmReport,
	controlInheritedCheckedRecordNpmReport
} from "./inherited-checked-record-npm-report.mjs";

const enabled = process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NPM_TEST === "1";
if(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NPM_TEST !== undefined)
	assert.ok(["0", "1"].includes(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NPM_TEST)
		, "Unknown inherited checked-record npm gate value");
const routes = process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NPM_ROUTES?.split(",")
	?? [...inheritedCheckedRecordNpmRoutes];
assert.ok(routes.length && routes.every(route => inheritedCheckedRecordNpmRoutes.includes(route)));
assert.equal(new Set(routes).size, routes.length);
if(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NPM_ROUTES !== undefined)
	assert.ok(enabled, "Explicit inherited checked-record npm routes require the installed gate");

const fileTree = async directory => Object.fromEntries(await Promise.all((await nativeArtifactPaths(directory))
	.map(async path => [path, sha256(await readFile(join(directory, path)))])));

for(const route of routes) test(`installed inherited checked-record npm package reproduces and relocates ${route}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NPM_OUTPUT
		?? "build/inherited-checked-record-npm", route);
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-inherited-checked-record-npm-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained failed inherited checked-record npm inputs: ${directory}`);
	});
	const engineRoot = process.cwd();
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const selection = inheritedCheckedRecordNpmSelection(route), builds = [], handoff = join(directory, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"], {
		stdio: "ignore"
	}), "Installed evidence requires a clean tracked source tree");
	await saveLakeFile(output, "configuration.json", canonicalJson(selection.configuration));
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(selection.expected));
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project");
		const outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
		await cp(inheritedCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(selection.configuration));
		if(selection.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(selection.expected));
		const sourceBefore = await lakeInputState(projectRoot);
		const stableInputs = sourceBefore.map(({ path, mode, sha256: digest }) => ({ path, mode, sha256: digest }));
		t.diagnostic(`${route} npm author ${attempt}`);
		await buildCanonicalProject({
			projectRoot, outputRoot, engineRoot, environment, targets: ["npm"]
			, runner: refinementEngineTransport() }).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`; throw error;
			});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author source remains unchanged");
		const bundleRoot = join(outputRoot, "bundle"), irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
		const ir = JSON.parse(irBytes);
		assert.equal(reviewedContractDifference(selection.expected, ir), null);
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(author, "npm") });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		for(const path of ["binding/binding-ir.json", "locks/compiler-adapters.json"
			, "locks/component-build-plan.json", "metadata/provenance.json"])
			await saveLakeFile(record, path, await readFile(join(bundleRoot, path)));
		const receiptBytes = await readFile(join(release.output, "component-package-receipt.json"));
		await saveLakeFile(record, "component-package-receipt.json", receiptBytes);
		await saveLakeFile(record, "InheritedCheckedRecords.lean", await readFile(join(projectRoot, "InheritedCheckedRecords.lean")));
		await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
		builds.push({
			bindingIrSha256: hashBindingIr(ir), bindingIrFileSha256: sha256(irBytes)
			, receiptSha256: sha256(receiptBytes)
			, componentArchiveSha256: sha256(await readFile(release.componentArchive))
			, runtimeArchiveSha256: sha256(await readFile(release.runtimeArchive))
			, authorInputsSha256: sha256(canonicalJson(stableInputs)) });
		if(attempt === 0)
		{
			await mkdir(handoff);
			for(const name of [
				release.report.package.archive, release.report.runtime.archive
				, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
				await cp(join(release.output, name), join(handoff, name));
		}
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	await cp(handoff, join(output, "handoff"), { recursive: true, errorOnExist: true, force: false });
	const receipt = JSON.parse(await readFile(join(handoff, "component-package-receipt.json"))), trees = {};
	for(const item of [receipt.package, receipt.runtime])
	{
		const extracted = join(directory, `archive-${Object.keys(trees).length}`);
		await mkdir(extracted);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf"
			, join(handoff, item.archive)
			, "-C", extracted], directory);
		const manifest = JSON.parse(await readFile(join(extracted, "package/package.json")));
		assert.ok(typeof manifest.name === "string" && !Object.hasOwn(trees, manifest.name));
		trees[manifest.name] = await fileTree(join(extracted, "package"));
		assert.ok(!Object.keys(trees[manifest.name]).some(path => path.endsWith(".lean")));
	}
	const consumer = join(directory, "consumer"), moved = join(directory, "moved"), bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true });
	await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
	const clean = root => ({
		...copiedCleanEnvironment, PATH: join(root, "bin"), NODE_PATH: ""
		, LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime"
		, LEAN_BRIDGE_LEAN: "/unavailable/lean"
		, CC: "/unavailable/compiler", CXX: "/unavailable/compiler" });
	const install = await runCopied(process.execPath, [
		npmCli, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--userconfig", join(consumer, "user.npmrc")
		, "--globalconfig"
		, join(consumer, "global.npmrc")
		, "--cache"
		, join(consumer, "empty-cache")
		, join(handoff, receipt.runtime.archive)
		, join(handoff, receipt.package.archive)], consumer, clean(consumer));
	await saveLakeFile(output, "install.json", canonicalJson(install));
	for(const [record, path] of [
		["package.json", "package.json"], ["package-lock.json", "package-lock.json"]
		, ["runtime-identity.json", "node_modules/@lean-bridge/runtime/runtime-identity.json"]
		, ["runtime-package.json", "node_modules/@lean-bridge/runtime/package.json"]
		, ["component-package.json", "node_modules/inheritedcheckedrecords/package.json"]
	]) await saveLakeFile(output, `installed/${record}`, await readFile(join(consumer, path)));
	const corpus = await readFile("tests/fixtures/inherited-checked-record-consumers/javascript.mjs");
	const typescript = await readFile(`tests/fixtures/inherited-checked-record-consumers/${selection.resultOnly ? "result-only" : "full"}.mts`);
	const script = `import * as api from "inheritedcheckedrecords";\nimport {checkInheritedCheckedRecords} from "./check.mjs";\nconsole.log(JSON.stringify(checkInheritedCheckedRecords(api, {resultOnly: ${selection.resultOnly}})));\n`;
	const runtimeIdentity = { node: process.version, platform: process.platform, arch: process.arch };
	const runtimeProbe = "console.log(JSON.stringify({node:process.version"
		+ ",platform:process.platform,arch:process.arch}))";
	for(const [path, source] of [["index.mjs", script], ["check.mjs", corpus], ["index.mts", typescript]])
	{
		await saveLakeFile(consumer, path, source);
		await saveLakeFile(output, `callers/${path}`, source);
	}
	const observations = [], expected = inheritedCheckedRecordNpmExpected(route);
	for(const root of [consumer, moved])
	{
		if(root === moved)
		{
			await rename(consumer, moved);
			await assert.rejects(access(consumer), { code: "ENOENT" });
		}
		const verify = async () => {
			for(const [name, files] of Object.entries(trees))
				assert.deepEqual(await fileTree(join(root, "node_modules", name)), files, name);
		};
		await verify();
		const result = await runCopied(process.execPath, ["index.mjs"], root, clean(root));
		assert.equal(result.stderr, "");
		assert.deepEqual(JSON.parse(result.stdout), expected);
		const typed = await runCopied(process.execPath, [join(engineRoot, "node_modules/typescript/lib/tsc.js")
			, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022"
			, "--lib"
			, "ES2022,ESNext.Disposable"
			, "--module"
			, "NodeNext"
			, "--moduleResolution"
			, "NodeNext"
			, "index.mts"], root, clean(root));
		assert.equal(typed.stdout, ""); assert.equal(typed.stderr, "");
		const runtime = await runCopied(process.execPath, ["--input-type=module", "--eval", runtimeProbe]
			, root, clean(root));
		assert.equal(runtime.stderr, "");
		assert.deepEqual(JSON.parse(runtime.stdout), runtimeIdentity);
		await verify();
		assert.deepEqual(await readFile(join(root, "check.mjs")), corpus);
		assert.deepEqual(await readFile(join(root, "index.mts")), typescript);
		assert.equal(await readFile(join(root, "index.mjs"), "utf8"), script);
		observations.push({ result, typescript: typed, runtime, relocated: root === moved });
		await saveLakeFile(output, root === moved ? "relocated.json" : "installed.json"
			, canonicalJson(observations.at(-1)));
	}
	const declarations = await readFile(join(moved, "node_modules/inheritedcheckedrecords/index.d.ts"), "utf8");
	assert.match(declarations, /export interface Span \{\s*readonly lo: bigint;\s*readonly hi: bigint;\s*\}/u);
	assert.match(declarations, /export interface Ticket \{\s*readonly toSpan: Span;\s*readonly word: bigint;\s*\}/u);
	assert.match(declarations, /export interface Stamped \{\s*readonly toTicket: Ticket;\s*readonly mark: bigint;\s*\}/u);
	assert.equal(/export type TicketAlias = Ticket;/u.test(declarations)
		, !selection.resultOnly);
	assert.doesNotMatch(declarations, /readonly (?:ordered|linked|stamped):/u);
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route
		, authorRoute: selection.reviewed ? "reviewed" : "ordinary"
		, apiMode: selection.mode
		, producerCommit
		, configuration: selection.configuration
		, builds
		, receipt
		, trees
		, observations
		, runtime: runtimeIdentity
		, consumerProfiles: ["node-javascript", "node-typescript"]
		, positions: inheritedCheckedRecordNpmPositions[selection.mode]
		, expectedBindingIrSha256: hashBindingIr(selection.expected), expected
		, callers: {
			"index.mjs": sha256(script), "check.mjs": sha256(corpus)
			, "index.mts": sha256(typescript) }
		, typescript: {
			strict: true, skipLibCheck: false, sourceSha256: sha256(typescript)
			, declarationsSha256: sha256(declarations) }
		, independentBuilds: 2
		, reproducible: true, authorInputsUnchanged: true
		, sourceCommitClean: true
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true
		, dispatch: { observed: false, reason: "No constructor/source entry counters in this npm caller" } }));
	const original = path => readFile(join(output, path));
	const identity = {
		route, producerCommit, runtime: runtimeIdentity, checkerCommit: producerCommit
	};
	await checkInheritedCheckedRecordNpmReport(original, identity);
	await saveLakeFile(output, "controls.json", canonicalJson(
		await controlInheritedCheckedRecordNpmReport(original, identity)));
	complete = true;
});
