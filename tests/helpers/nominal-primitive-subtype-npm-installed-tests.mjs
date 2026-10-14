/**
 * Ordinary and reviewed nineteen-base nominal Subtypes through real offline npm packages.
 * Full and constructor-free result-only packages each reproduce from two roots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { buildComponentNpmPackages } from "../../src/release/component-npm-package.mjs";
import { verifyComponentPackageReceipt } from "../../src/release/component-package-receipt.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { structuralSubtypeNpmPackageName } from "./structural-subtype-npm-package.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFixture, nominalPrimitiveSubtypeModule, nominalPrimitiveSubtypeName, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";
import { checkNominalPrimitiveSubtypeNpmReport } from "./nominal-primitive-subtype-npm-report.mjs";
import { waitNominalSubtypeDotnetResources as waitResources } from "./nominal-subtype-dotnet-resources.mjs";
import { nominalPrimitiveSubtypeBrowserEnabled } from "./nominal-primitive-subtype-browser-fixture.mjs";
import { checkNominalPrimitiveSubtypeBrowsers } from "./nominal-primitive-subtype-browser.mjs";
import { checkNominalPrimitiveSubtypeBrowserReport } from "./nominal-primitive-subtype-browser-report.mjs";

const flag = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST";
if(process.env[flag] !== undefined) assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[flag] === "1";
const browserEnabled = nominalPrimitiveSubtypeBrowserEnabled(process.env);
const select = (variable, permitted) => {
	const selected = process.env[variable]?.split(",") ?? permitted;
	assert.ok(selected.length && selected.every(value => permitted.includes(value)), `Invalid ${variable}`);
	assert.equal(new Set(selected).size, selected.length, `Duplicate ${variable}`);
	return selected;
};
const routes = select("LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES", ["ordinary", "reviewed"]);
const modes = select("LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES", ["full", "result-only"]);
const fileTree = async directory => Object.fromEntries(await Promise.all((await nativeArtifactPaths(directory))
	.map(async path => [path, sha256(await readFile(join(directory, path)))])));

for(const route of routes) for(const mode of modes) test(`installed npm primitive-base nominal Subtypes reproduce and relocate ${route} ${mode}`, { skip: !enabled, timeout: 3_600_000 }, async t => {
	const resultOnly = mode === "result-only";
	const output = resolve(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT ?? "build/nominal-primitive-subtype-npm", route, mode);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const resources = () => waitResources(output, { notify: message => t.diagnostic(message.replaceAll("C#", "primitive npm")) });
	await resources();
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-subtype-npm-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained failed nominal npm inputs: ${directory}`);
	});
	const engineRoot = process.cwd();
	const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
	const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
	const configuration = nominalPrimitiveSubtypeConfiguration(route, ["npm"], resultOnly);
	const expected = nominalPrimitiveSubtypeReview(resultOnly), builds = [], handoff = join(directory, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	for(const attempt of [0, 1])
	{
		await resources();
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(nominalPrimitiveSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${mode}: npm author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, engineRoot, environment, targets: ["npm"], runner: refinementEngineTransport() })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author source remains unchanged");
		const bundleRoot = join(outputRoot, "bundle"), irBytes = await readFile(join(bundleRoot, "binding/binding-ir.json"));
		assert.equal(reviewedContractDifference(expected, JSON.parse(irBytes)), null);
		const release = await buildComponentNpmPackages({ bundleRoot, runtimeRoot, outputRoot: join(author, "npm") });
		await verifyComponentPackageReceipt({ receiptPath: join(release.output, "component-package-receipt.json") });
		for(const path of ["binding/binding-ir.json", "locks/compiler-adapters.json", "locks/component-build-plan.json", "metadata/provenance.json"])
			await saveLakeFile(output, `build-${attempt}/${path}`, await readFile(join(bundleRoot, path)));
		const receiptBytes = await readFile(join(release.output, "component-package-receipt.json"));
		await saveLakeFile(output, `build-${attempt}/component-package-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/${nominalPrimitiveSubtypeModule}.lean`, await readFile(join(projectRoot, `${nominalPrimitiveSubtypeModule}.lean`)));
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
	await cp(handoff, join(output, "handoff"), { recursive: true, errorOnExist: true, force: false });
	const receipt = JSON.parse(await readFile(join(handoff, "component-package-receipt.json"))), trees = {};
	for(const [role, item] of [["component", receipt.package], ["runtime", receipt.runtime]])
	{
		const extracted = join(directory, `original-${role}`); await mkdir(extracted);
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, item.archive), "-C", extracted], directory);
		const manifest = JSON.parse(await readFile(join(extracted, "package/package.json")));
		const name = structuralSubtypeNpmPackageName(item, manifest, role === "component" ? nominalPrimitiveSubtypeName : "@lean-bridge/runtime");
		assert.ok(!Object.hasOwn(trees, name));
		trees[name] = await fileTree(join(extracted, "package"));
		await rm(extracted, { recursive: true });
	}
	const consumer = join(directory, "consumer"), moved = join(directory, "relocated-consumer"), bin = join(consumer, "bin");
	await resources();
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
	for(const [record, path] of [
		["package.json", "package.json"], ["package-lock.json", "package-lock.json"]
		, ["runtime-identity.json", "node_modules/@lean-bridge/runtime/runtime-identity.json"]
		, ["runtime-package.json", "node_modules/@lean-bridge/runtime/package.json"]
		, ["component-package.json", `node_modules/${nominalPrimitiveSubtypeName}/package.json`]
	]) await saveLakeFile(output, `installed/${record}`, await readFile(join(consumer, path)));
	const callers = { "index.mjs": `import * as api from "${nominalPrimitiveSubtypeName}";\nimport {checkNominalPrimitiveSubtypes} from "./fixtures/nominal-primitive-subtype-consumers/javascript.mjs";\nconsole.log(JSON.stringify(checkNominalPrimitiveSubtypes(api, {resultOnly: ${resultOnly}})));\n` };
	for(const path of ["nominal-primitive-subtype-consumers/javascript.mjs"])
		callers[`fixtures/${path}`] = await readFile(`tests/fixtures/${path}`, "utf8");
	for(const name of resultOnly ? ["results.mts", "types.mts"] : ["index.mts", "results.mts", "types.mts"])
		callers[name] = await readFile(`tests/fixtures/nominal-primitive-subtype-consumers/${name}`, "utf8");
	for(const [path, source] of Object.entries(callers))
	{
		await saveLakeFile(consumer, path, source);
		await saveLakeFile(output, `callers/${path}`, source);
	}
	const observations = [];
	for(const root of [consumer, moved])
	{
		if(root === moved)
		{ await rename(consumer, moved); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		const verify = async () => {
			for(const [name, files] of Object.entries(trees)) assert.deepEqual(await fileTree(join(root, "node_modules", name)), files, name);
			for(const [path, source] of Object.entries(callers)) assert.equal(await readFile(join(root, path), "utf8"), source, path);
		};
		await verify();
		const runtime = await runCopied(process.execPath, ["-p", "JSON.stringify({node:process.version,platform:process.platform,arch:process.arch})"], root, clean(root));
		assert.equal(runtime.stderr, ""); assert.equal(JSON.parse(runtime.stdout).node, process.version);
		const result = await runCopied(process.execPath, ["index.mjs"], root, clean(root));
		assert.equal(result.stderr, "");
		assert.deepEqual(JSON.parse(result.stdout), resultOnly ? { checks: 578, rejections: 0, rounds: 256, wordBits: 32 } : { checks: 1213, rejections: 283, rounds: 256, wordBits: 32 });
		const compiler = join(engineRoot, "node_modules/typescript/lib/tsc.js");
		const typed = await runCopied(process.execPath, [compiler, "--strict", "--noEmit", "--skipLibCheck", "false", "--target", "ES2022", "--lib", "ES2022,ESNext.Disposable", "--module", "NodeNext", "--moduleResolution", "NodeNext", resultOnly ? "results.mts" : "index.mts"], root, clean(root));
		assert.equal(typed.stdout, ""); assert.equal(typed.stderr, "");
		await verify();
		observations.push({ result, typescript: typed, runtime, relocated: root === moved });
		await saveLakeFile(output, root === moved ? "relocated.json" : "installed.json", canonicalJson(observations.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, route, mode, producerCommit, configuration, builds, receipt, trees
		, observations
		, expectedBindingIrSha256: hashBindingIr(expected)
		, callers: Object.fromEntries(Object.entries(callers).map(([path, source]) => [path, sha256(source)]))
		, typescript: { strict: true, skipLibCheck: false }
		, independentBuilds: 2, reproducible: true, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreePath: true, relocatedInstallation: true
		, dispatch: { observed: false, reason: "No Wasm constructor/source entry counters in this caller" } }));
	const runtime = { node: process.version, platform: process.platform, arch: process.arch };
	const original = path => readFile(join(output, path));
	await checkNominalPrimitiveSubtypeNpmReport(original, { route, mode, producerCommit, runtime });
	if(browserEnabled)
	{
		await checkNominalPrimitiveSubtypeBrowsers({ directory, handoff, receipt, records: output, route, mode, producerCommit, runtime });
		await checkNominalPrimitiveSubtypeBrowserReport(original, { route, mode, producerCommit, runtime });
	}
	complete = true;
});
