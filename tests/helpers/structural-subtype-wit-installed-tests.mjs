/**
 * Real ordinary/reviewed WIT packages with two-root reproduction and relocated execution.
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
import { structuralSubtypeWitConfiguration, structuralSubtypeWitCaller, structuralSubtypeWitCounts, parseStructuralSubtypeWitResult } from "./structural-subtype-wit-fixture.mjs";
import { nativeFixtureEnvironment, runCopied, installCopiedConsumer, copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import { prepareFinContainerEdgeExecutable } from "./fin-container-edge-install.mjs";
import { verifyFinContainerEdgeArchiveClosure, verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtypes WIT ${route} reproduce and relocate`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT_OUTPUT ?? "build/structural-subtype-wit", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-structural-wit-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(scratch, { recursive: true });
		else t.diagnostic(`Retained structural WIT inputs: ${scratch}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeWitConfiguration(route);
	const environment = nativeFixtureEnvironment(["wit-wasi"]), handoff = join(scratch, "handoff"), consumer = join(scratch, "consumer");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(scratch, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`WIT ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["wit-wasi"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
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


	const packages = receipt.packages.filter(pkg => pkg.target === "wit-wasi");
	assert.equal(packages.length, 1);
	const pkg = packages[0], source = await structuralSubtypeWitCaller(route);
	await saveLakeFile(output, "consumer.c", source);
	const observed = await installCopiedConsumer({
		profile: "wit-wasi", consumer, handoff, packages, environment
		, fixture: {
			source: () => source, expectedChecks: structuralSubtypeWitCounts.checks
			, parseResult: parseStructuralSubtypeWitResult
			, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
			, wit: [/alias-arguments: func\(/u, /nested: func\(/u]
		}
	});
	delete observed.command;
	const host = join(consumer, "wit-wasi"), directory = pkg.name + "-" + pkg.version + "-wit-wasi";
	const installed = join(host, directory), receiptPath = "lean-bridge-package.json";
	const archive = join(handoff, pkg.artifacts[0].path);
	const tarArgs = ["--use-compress-program=/usr/bin/gzip", "-xOf", archive
		, directory + "/" + receiptPath];
	const original = await runCopied("/usr/bin/tar", tarArgs, host);
	assert.equal(original.stderr, "");
	await saveLakeFile(output, "installed-receipt.json", original.stdout);
	const retained = ["binding-manifest.json", "native-wit-adapter.json"
		, "wit/structuralsubtypes.wit"
		, "component/structuralsubtypes.wasm", "component/structuralsubtypes.wat"
		, "include/structuralsubtypes_wasmtime.h"
		, "lib/pkgconfig/structuralsubtypes-wit.pc"];
	for(const path of retained)
		await saveLakeFile(output, "package/" + path, await readFile(join(installed, path)));
	const verify = root => verifyFinContainerEdgeFileClosure({ installed: join(root, directory), receiptPath, receiptBytes: original.stdout });
	const before = await verify(host);
	const executable = await prepareFinContainerEdgeExecutable({
		profile: "wit-wasi", root: host, directory, pkgConfig: pkg.name + "-wit"
	});
	assert.deepEqual(await verify(host), before);
	const observations = [];
	for(const [position, location] of [host, host + "-relocated"].entries())
	{
		if(position)
		{ await rename(host, location); await assert.rejects(access(host), { code: "ENOENT" }); }
		assert.equal(sha256(await readFile(join(location, "consumer"))), executable.executableSha256);
		assert.equal(await readFile(join(location, "consumer.c"), "utf8"), source);
		assert.deepEqual(await verify(location), before);
		const run = await runCopied(join(location, "consumer"), [], location, copiedCleanEnvironment);
		assert.equal(run.stderr, ""); const counts = parseStructuralSubtypeWitResult(run.stdout);
		assert.deepEqual(await verify(location), before);
		assert.equal(sha256(await readFile(join(location, "consumer"))), executable.executableSha256);
		assert.equal(await readFile(join(location, "consumer.c"), "utf8"), source);
		observations.push({ relocated: Boolean(position), run, counts, closure: before });
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observations.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, producerCommit, configuration
		, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt, installed: observed, observations, executable
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "No WIT entry counters in this installed acceptance" } }));
	complete = true;
});
