/**
 * Ordinary and independently reviewed structural Subtypes in offline npm packages.
 * Keep originals and replay unchanged callers after moving the installed tree.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { buildComponentNpmPackages } from "../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../src/release/component-package-receipt.mjs";
import { refinementEngineTransport } from "./helpers/refinement-engine.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { structuralSubtypeConfiguration, structuralSubtypeFixture, structuralSubtypeName, structuralSubtypeReview } from "./helpers/structural-subtype-installed-fixture.mjs";
import { structuralSubtypeNpmPackageName } from "./helpers/structural-subtype-npm-package.mjs";
import { checkStructuralSubtypeBrowsers } from "./helpers/structural-subtype-browser.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM_TEST === "1";
const browsers = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_BROWSER_TEST === "1";
for(const flag of ["LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM_TEST", "LEAN_BRIDGE_STRUCTURAL_SUBTYPE_BROWSER_TEST"])
	if(process.env[flag] !== undefined) assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
if(browsers) assert.ok(enabled, "Browser acceptance requires actual installed npm packages");
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const fileTree = async directory => Object.fromEntries(await Promise.all((await nativeArtifactPaths(directory))
	.map(async path => [path, sha256(await readFile(join(directory, path)))])));

for(const route of routes) test(`installed npm structural Subtypes reproduce and relocate ${route}`, { skip: !enabled, timeout: 3_600_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM_OUTPUT ?? "build/structural-subtype-npm", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-npm-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained failed npm inputs: ${directory}`);
	});
	const engineRoot = process.cwd();
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const configuration = structuralSubtypeConfiguration(route, ["npm"]), expected = structuralSubtypeReview();
	const builds = [], handoff = join(directory, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`${route} npm author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const bundleRoot = join(outputRoot, "bundle"), irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
		assert.equal(reviewedContractDifference(expected, JSON.parse(irBytes)), null);
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(author, "npm") });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		for(const path of ["binding/binding-ir.json", "locks/compiler-adapters.json", "locks/component-build-plan.json", "metadata/provenance.json"])
			await saveLakeFile(output, `build-${attempt}/${path}`, await readFile(join(bundleRoot, path)));
		const receiptBytes = await readFile(join(release.output, "component-package-receipt.json"));
		await saveLakeFile(output, `build-${attempt}/component-package-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/StructuralSubtypes.lean`, await readFile(join(projectRoot, "StructuralSubtypes.lean")));
		builds.push({ bindingIrSha256: hashBindingIr(JSON.parse(irBytes))
			, receiptSha256: sha256(receiptBytes)
			, componentArchiveSha256: sha256(await readFile(release.componentArchive))
			, runtimeArchiveSha256: sha256(await readFile(release.runtimeArchive)) });
		if(attempt === 0)
		{
			await mkdir(handoff);
			for(const name of [release.report.package.archive, release.report.runtime.archive, "component-package-receipt.json", "verify-component-package-receipt.mjs"])
				await cp(join(release.output, name), join(handoff, name));
		}
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	await verifyComponentPackageReceipt({ receiptPath: join(handoff, "component-package-receipt.json") });
	const receipt = JSON.parse(await readFile(join(handoff, "component-package-receipt.json"))), trees = {};
	for(const [role, item] of [["component", receipt.package], ["runtime", receipt.runtime]])
	{
		const extracted = join(directory, `original-${role}`); await mkdir(extracted);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, item.archive), "-C", extracted], directory);
		const manifest = JSON.parse(await readFile(join(extracted, "package/package.json")));
		const name = structuralSubtypeNpmPackageName(item, manifest, role === "component" ? structuralSubtypeName : "@lean-bridge/runtime");
		assert.ok(!Object.hasOwn(trees, name));
		trees[name] = await fileTree(join(extracted, "package"));
	}
	const consumer = join(directory, "consumer"), moved = join(directory, "moved"), bin = join(consumer, "bin");
	await mkdir(bin, { recursive: true }); await symlink(process.execPath, join(bin, "node"));
	await saveLakeFile(consumer, "package.json", canonicalJson({ private: true, type: "module" }));
	for(const name of ["user.npmrc", "global.npmrc"]) await saveLakeFile(consumer, name, "");
	const npmCli = await realpath(join(process.execPath, "../../bin/npm"));
	const clean = root => ({ ...copiedCleanEnvironment, PATH: join(root, "bin"), NODE_PATH: "", LEAN_BRIDGE_RUNTIME_ROOT: "/unavailable/runtime" });
	const installArgs = [npmCli, "install", "--offline", "--ignore-scripts"
		, "--no-audit", "--no-fund", "--userconfig", join(consumer, "user.npmrc")
		, "--globalconfig", join(consumer, "global.npmrc")
		, "--cache", join(consumer, "empty-cache")
		, join(handoff, receipt.runtime.archive)
		, join(handoff, receipt.package.archive)];
	const install = await runCopied(process.execPath, installArgs, consumer, clean(consumer));
	await saveLakeFile(output, "install.json", canonicalJson(install));
	const script = `import * as api from "${structuralSubtypeName}";\nimport {checkStructuralSubtypes} from "./check.mjs";\nconsole.log(JSON.stringify(checkStructuralSubtypes(api)));\n`;
	const corpus = await readFile("tests/fixtures/structural-subtype-consumers/javascript.mjs");
	const typescript = await readFile("tests/fixtures/structural-subtype-consumers/index.mts");
	for(const [path, source] of [["index.mjs", script], ["check.mjs", corpus], ["index.mts", typescript]])
	{
		await saveLakeFile(consumer, path, source); await saveLakeFile(output, path, source);
	}
	const observations = [];
	for(const root of [consumer, moved])
	{
		if(root === moved)
		{ await rename(consumer, moved); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		const verify = async () => {
			for(const [name, files] of Object.entries(trees)) assert.deepEqual(await fileTree(join(root, "node_modules", name)), files, name);
		};
		await verify();
		const result = await runCopied(process.execPath, ["index.mjs"], root, clean(root));
		assert.equal(result.stderr, ""); assert.deepEqual(JSON.parse(result.stdout), { checks: 3028, rejections: 1020 });
		const compiler = join(engineRoot, "node_modules/typescript/lib/tsc.js");
		const typed = await runCopied(process.execPath, [compiler, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", "index.mts"], root, clean(root));
		assert.equal(typed.stdout, ""); assert.equal(typed.stderr, "");
		await verify();
		assert.deepEqual(await readFile(join(root, "check.mjs")), corpus);
		assert.deepEqual(await readFile(join(root, "index.mts")), typescript);
		assert.equal(await readFile(join(root, "index.mjs"), "utf8"), script);
		observations.push({ result, typescript: typed, relocated: root === moved });
		await saveLakeFile(output, root === moved ? "relocated.json" : "installed.json", canonicalJson(observations.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, route
		, producerCommit, configuration, builds, receipt, trees, observations
		, expectedBindingIrSha256: hashBindingIr(expected)
		, consumerSha256: sha256(script), corpusSha256: sha256(corpus)
		, typescript: { strict: true, skipLibCheck: false, sourceSha256: sha256(typescript) }
		, independentBuilds: 2, reproducible: true
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreePath: true, relocatedInstallation: true
		, dispatch: { observed: false, reason: "No constructor/source entry counters in this npm caller" } }));
	if(browsers) await checkStructuralSubtypeBrowsers({ directory, handoff, receipt, records: output, route, producerCommit });
	complete = true;
});
