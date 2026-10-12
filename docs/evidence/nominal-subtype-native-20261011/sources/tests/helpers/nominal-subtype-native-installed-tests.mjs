/**
 * Real C/C++ packages: two author roots, offline installation and physical move.
 * Full and constructor-free result-only APIs have separate installed gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeFixture, nominalSubtypeModule, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeNativeCaller, nominalSubtypeNativeSelection } from "./nominal-subtype-native-caller.mjs";

const { enabled, profiles, routes, modes } = nominalSubtypeNativeSelection(process.env);

for(const route of routes) for(const mode of modes) test(`installed native nominal Subtypes reproduce and relocate ${route} ${mode}`, { skip: !enabled, timeout: 3_600_000 }, async t => {
	const resultOnly = mode === "result-only";
	const output = resolve(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_OUTPUT ?? "build/nominal-subtype-native", route, mode);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-native-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained failed nominal native inputs: ${directory}`);
	});
	const expected = nominalSubtypeInstalledReview(resultOnly);
	const configuration = nominalSubtypeInstalledConfiguration(route, profiles, resultOnly);
	const environment = nativeFixtureEnvironment(profiles), builds = [];
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select and report the native glibc floor explicitly");
	assert.equal(process.platform, "linux");
	const runtime = { platform: process.platform, arch: process.arch
		, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], directory) };
	assert.equal(runtime.glibc.stderr, "");
	assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
	const consumer = join(directory, "consumer"), handoff = join(consumer, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(nominalSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${mode} author ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: profiles, environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author source remains unchanged");
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort(), [...profiles].sort());
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/author-inputs.json`, canonicalJson(sourceBefore));
		await saveLakeFile(output, `build-${attempt}/${nominalSubtypeModule}.lean`, await readFile(join(projectRoot, `${nominalSubtypeModule}.lean`)));
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots must reproduce model, receipt and archives");
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), reports = [];
	for(const profile of profiles)
	{
		const packages = receipt.packages.filter(pkg => pkg.target === profile);
		assert.equal(packages.length, 1);
		const pkg = packages[0]; assert.equal(pkg.role, "component");
		const source = await nominalSubtypeNativeCaller(profile, route, mode);
		await saveLakeFile(output, `consumers/${profile}.${profile}`, source);
		const fixture = { source: () => source, success: "nominal-subtype-ok"
			, ...resultOnly ? { expectedChecks: 2042 } : {}
			, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure };
		const observation = await installCopiedConsumer({ profile, consumer, handoff, packages, environment, fixture });
		const root = join(consumer, profile), relocated = root + "-relocated", packageName = `${pkg.name}-${pkg.version}-${profile}`;
		await saveLakeFile(output, `${profile}/lean-bridge-package.json`, await readFile(join(root, packageName, "lean-bridge-package.json")));
		const compiler = await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++", ["--version"], root);
		assert.equal(compiler.stderr, "");
		await saveLakeFile(output, `${profile}/compiler.json`, canonicalJson(compiler));
		const executableSha256 = sha256(await readFile(join(root, "consumer"))), runs = [];
		for(const location of [root, relocated])
		{
			if(location === relocated)
			{ await rename(root, relocated); await assert.rejects(access(root), { code: "ENOENT" }); }
			const installed = join(location, packageName);
			const verify = () => verifyFinContainerEdgeArchiveClosure({ profile
				, installed, receiptPath: "lean-bridge-package.json"
				, archive: join(handoff, pkg.artifacts[0].path)
				, archiveSha256: pkg.artifacts[0].sha256 });
			const closure = await verify();
			const result = await runCopied(join(location, "consumer"), [], location, { ...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installed, "lib") });
			assert.equal(result.stderr, ""); assert.equal(result.stdout, `nominal-subtype-ok:${observation.checks}\n`);
			assert.deepEqual(await verify(), closure);
			assert.equal(sha256(await readFile(join(location, "consumer"))), executableSha256);
			assert.equal(await readFile(join(location, `consumer.${profile}`), "utf8"), source);
			runs.push({ ...result, ...closure, relocated: location === relocated });
			await saveLakeFile(output, `${profile}/${location === relocated ? "relocated" : "installed"}.json`, canonicalJson(runs.at(-1)));
		}
		delete observation.command;
		reports.push({ profile, ...observation, executableSha256, runs, packages
			, sourceSha256: sha256(source), compiler
			, relocatedInstallation: true, sourceRemovedBeforeInstallation: true
			, compilerFreeReplay: true
			, dispatch: { observed: false, reason: "Separate constructor/source entry probe remains required" } });
		await saveLakeFile(output, `${profile}/report.json`, canonicalJson(reports.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, route, mode, profiles, producerCommit, configuration, builds, reports
		, expectedBindingIrSha256: hashBindingIr(expected), runtime
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, declaredGlibcFloor: floor }));
	complete = true;
});
