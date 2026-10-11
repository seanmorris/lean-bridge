/**
 * Real ordinary/reviewed Maven packages with two-root reproduction and relocated execution.
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
import { structuralSubtypeFixture, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeJvmConfiguration, structuralSubtypeJvmCaller, structuralSubtypeJvmCounts, parseStructuralSubtypeJvmResult } from "./structural-subtype-jvm-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { installFinContainerEdgeJvm, runFinContainerEdgeJvm, verifyFinContainerEdgeJvmEnvironment } from "./fin-container-edge-jvm-closure.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_JVM_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_JVM_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtypes JVM ${route} reproduce and relocate`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_JVM_OUTPUT ?? "build/structural-subtype-jvm", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-jvm-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural Jvm inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeJvmConfiguration(route);
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`JVM ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["maven"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
		await saveLakeFile(output, `build-${attempt}/native-jvm.json`, await readFile(join(outputRoot, "native/jvm/native-jvm.json")));
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/StructuralSubtypes.lean`, await readFile(join(projectRoot, "StructuralSubtypes.lean")));
		builds.push({ modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const packages = receipt.packages.filter(pkg => pkg.target === "maven"), consumers = [];
	for(const profile of ["java", "kotlin"])
	{
		const source = await structuralSubtypeJvmCaller(profile, route), extension = profile === "java" ? "java" : "kt";
		await saveLakeFile(output, "consumer." + extension, source);
		const installed = await installCopiedConsumer({
			profile, consumer, handoff, packages, environment
			, fixture: {
				source: () => source, expectedChecks: structuralSubtypeJvmCounts.checks
				, parseResult: parseStructuralSubtypeJvmResult
				, installJvm: installFinContainerEdgeJvm
			}
		});
		delete installed.command;
		const root = join(consumer, profile), observations = [];
		const version = await runCopied(installed.jvmEnvironment.command, ["--version"], root);
		assert.equal(version.stderr, ""); assert.match(version.stdout, /^(?:openjdk|java) 22[. ]/u);
		for(const [position, location] of [root, root + "-relocated"].entries())
		{
			if(position)
			{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
			const context = { ...installed.jvmEnvironment, root: location };
			const before = await verifyFinContainerEdgeJvmEnvironment(context);
			const run = await runFinContainerEdgeJvm(context);
			assert.equal(run.stderr, ""); const counts = parseStructuralSubtypeJvmResult(run.stdout);
			assert.deepEqual(await verifyFinContainerEdgeJvmEnvironment(context), before);
			assert.equal(await readFile(join(location, "consumer." + extension), "utf8"), source);
			observations.push({ relocated: Boolean(position), run, counts, closure: before });
			await saveLakeFile(output, profile + "/" + (position ? "relocated" : "installed") + ".json", canonicalJson(observations.at(-1)));
		}
		consumers.push({ profile, installed, observations, javaVersion: version.stdout });
	}
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, producerCommit
		, configuration, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt, consumers
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "No JVM entry counters in this installed acceptance" } }));
	complete = true;
});
