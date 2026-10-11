/**
 * Source-free, relocated structural Subtype packages from ordinary and independent reviewed APIs.
 * Installation evidence is produced only when explicit profiles are selected.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { reviewedSubtypeContracts } from "../src/analyze/reviewed-subtypes.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { generateCBindingPackage } from "../src/backends/c/generate.mjs";
import { generateGmpProjection } from "../src/backends/c/gmp-projection.mjs";
import { generateCppBindingPackage } from "../src/backends/cpp/generate.mjs";
import { boostSources } from "../src/backends/cpp/boost.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./helpers/fin-container-edge-closure.mjs";
import { structuralSubtypeConfiguration, structuralSubtypeFixture, structuralSubtypeModule, structuralSubtypeReview } from "./helpers/structural-subtype-installed-fixture.mjs";

const profiles = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PROFILES?.split(",") ?? [];
assert.ok(profiles.every(profile => ["c", "cpp"].includes(profile)), "Select implemented native installed profiles explicitly");
assert.equal(new Set(profiles).size, profiles.length);
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const consumerSource = async (profile, route) => {
	const source = await readFile(`tests/fixtures/structural-subtype-consumers/${profile}.${profile}`, "utf8");
	return route === "ordinary" ? source : source.replaceAll(/arg([01])/gu, "value$1");
};

test("independent structural Subtype review matches ordinary choices without erasing mixed Fin", () => {
	const review = structuralSubtypeReview(); validateBindingIr(review);
	const configuration = structuralSubtypeConfiguration("ordinary", ["c", "cpp"]);
	const derived = reviewedSubtypeContracts(review);
	for(const [name, contract] of Object.entries(derived)) assert.deepEqual(contract, configuration.contracts[name]);
	assert.equal(derived[`${structuralSubtypeModule}.plainFin`], undefined);
	assert.ok(!Object.hasOwn(structuralSubtypeConfiguration("reviewed", ["c"]), "contracts"));
	assert.deepEqual(review.declarations.find(item => item.name === "nested").source.extensions["lean-lang.org/refinements"].parameters[0].arguments[0].arguments[0].arguments[0].arguments[1], { kind: "fin", bound: "184467440737095516170" });
});

test("independent C and C++ structural Subtype callers compile against their public APIs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-callers-"));
	t.after(() => rm(root, { recursive: true }));
	const review = structuralSubtypeReview();
	for(const profile of ["c", "cpp"])
	{
		const directory = join(root, profile);
		const files = { ...generateCBindingPackage(review), ...profile === "c" ? generateGmpProjection(review).files : { ...generateCppBindingPackage(review), ...boostSources() } };
		for(const [path, source] of Object.entries(files)) await saveLakeFile(directory, path, source);
		await saveLakeFile(directory, `consumer.${profile}`, await consumerSource(profile, "ordinary"));
		await runCopied(profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++"
			, [`-std=${profile === "c" ? "c11" : "c++20"}`, "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-Iinclude", `consumer.${profile}`], directory);
	}
});

for(const route of routes) test(`installed structural Subtypes reproduce and relocate ${route}`, { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_OUTPUT ?? "build/structural-subtype-installed", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-subtype-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained failed installed-package inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeConfiguration(route, profiles);
	const environment = nativeFixtureEnvironment(profiles), builds = [];
	const consumer = join(directory, "consumer"), handoff = join(consumer, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`${route} author ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: profiles, environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/${structuralSubtypeModule}.lean`, await readFile(join(projectRoot, `${structuralSubtypeModule}.lean`)));
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
		const packages = receipt.packages.filter(pkg => pkg.target === profile), pkg = packages.find(item => item.role === "component");
		const source = await consumerSource(profile, route);
		await saveLakeFile(output, `consumers/${profile}.${profile}`, source);
		const fixture = { source: () => source, success: "structural-subtype-ok"
			, expectedChecks: profile === "c" ? 4049 : 4047
			, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure };
		const observation = await installCopiedConsumer({ profile, consumer, handoff, packages, environment, fixture });
		const root = join(consumer, profile), relocated = root + "-relocated", packageName = `${pkg.name}-${pkg.version}-${profile}`;
		const executableSha256 = sha256(await readFile(join(root, "consumer"))), runs = [];
		for(const location of [root, relocated])
		{
			if(location === relocated)
			{ await rename(root, relocated); await assert.rejects(access(root), { code: "ENOENT" }); }
			const installed = join(location, packageName);
			const verify = () => verifyFinContainerEdgeArchiveClosure({ profile
				, installed
				, receiptPath: "lean-bridge-package.json"
				, archive: join(handoff, pkg.artifacts[0].path)
				, archiveSha256: pkg.artifacts[0].sha256 });
			const closure = await verify();
			const result = await runCopied(join(location, "consumer"), [], location, { ...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installed, "lib") });
			assert.equal(result.stderr, ""); assert.equal(result.stdout, `structural-subtype-ok:${observation.checks}\n`);
			assert.deepEqual(await verify(), closure);
			assert.equal(sha256(await readFile(join(location, "consumer"))), executableSha256);
			assert.equal(await readFile(join(location, `consumer.${profile}`), "utf8"), source);
			runs.push({ ...result, ...closure, relocated: location === relocated });
			await saveLakeFile(output, `${profile}/${location === relocated ? "relocated" : "installed"}.json`, canonicalJson(runs.at(-1)));
		}
		delete observation.command;
		reports.push({ profile, ...observation, executableSha256, runs, packages
			, relocatedInstallation: true, sourceRemovedBeforeInstallation: true
			, compilerFreeReplay: true
			, dispatch: { observed: false, reason: "Separate constructor/source entry probe remains required" } });
		await saveLakeFile(output, `${profile}/report.json`, canonicalJson(reports.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, route, profiles, producerCommit, configuration, builds, reports
		, expectedBindingIrSha256: hashBindingIr(expected)
		, reproducible: true, independentBuilds: 2
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" }));
	complete = true;
});
