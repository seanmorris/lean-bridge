/**
 * Two-root source-free installed acceptance of separately identified structural entry probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { reviewedContractDifference } from "../src/analyze/reviewed-source.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { structuralSubtypeFixture } from "./helpers/structural-subtype-installed-fixture.mjs";
import { structuralSubtypeEntrySource, structuralSubtypeEntryReview, structuralSubtypeEntryConfiguration, structuralSubtypeEntrySelection } from "./helpers/structural-subtype-entry.mjs";
import { observeStructuralSubtypeEntries } from "./helpers/structural-subtype-entry-observe.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./helpers/fin-container-edge-closure.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ENTRY_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ENTRY_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtype entry probe ${route} reproduces and relocates`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ENTRY_OUTPUT ?? "build/structural-subtype-entry", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-entry-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural entry inputs: ${directory}`);
	});
	const original = await readFile(join(structuralSubtypeFixture, "StructuralSubtypes.lean"), "utf8"), probe = structuralSubtypeEntrySource(original);
	const expected = structuralSubtypeEntryReview(), configuration = structuralSubtypeEntryConfiguration(route);
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const environment = nativeFixtureEnvironment(["c"]), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await saveLakeFile(output, "source-probe.json", canonicalJson(probe));
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const builds = []; let model;
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "StructuralSubtypes.lean", probe.source);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`${route}: structural entry author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["c"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const bytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(bytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.equal(model.sourceIdentity.modules[0].source.sha256, probe.probeSha256);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		await saveLakeFile(output, `build-${attempt}/model.json`, bytes);
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		builds.push({ modelSha256: sha256(bytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const packages = receipt.packages.filter(pkg => pkg.target === "c"), pkg = packages.find(item => item.role === "component");
	const caller = await readFile("tests/fixtures/structural-subtype-consumers/c.c", "utf8");
	const source = route === "ordinary" ? caller : caller.replaceAll(/arg([01])/gu, "value$1");
	await saveLakeFile(output, "consumer.c", source);
	const installed = await installCopiedConsumer({ profile: "c"
		, consumer, handoff, packages, environment
		, fixture: { source: () => source, success: "structural-subtype-ok", expectedChecks: 4049, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure } });
	const selected = structuralSubtypeEntrySelection(model, probe);
	const dispatch = await observeStructuralSubtypeEntries({ root: join(consumer, "c"), handoff, pkg, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX, model, selected, output });
	delete installed.command;
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, scope: dispatch.scope, route, producerCommit
		, builds, receipt, installed, dispatch, configuration
		, source: { originalSha256: probe.originalSha256, probeSha256: probe.probeSha256 }
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" }));
	complete = true;
});
