/**
 * Real ordinary/reviewed Python wheels with two-root reproduction and relocated execution.
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
import { structuralSubtypePythonConfiguration, structuralSubtypePythonCaller, structuralSubtypePythonCounts, parseStructuralSubtypePythonResult } from "./structural-subtype-python-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { installFinContainerEdgePython, runFinContainerEdgePython, verifyFinContainerEdgePythonEnvironment } from "./fin-container-edge-python-closure.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PYTHON_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PYTHON_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const minor = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PYTHON_MINOR;
if(enabled) assert.ok(["3.11", "3.12"].includes(minor), "Select one supported Python minor explicitly");

for(const route of routes) test(`installed structural Subtypes Python ${minor ?? "unselected"} ${route} reproduce and relocate`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PYTHON_OUTPUT ?? "build/structural-subtype-python", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-python-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural Python inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypePythonConfiguration(route);
	const environment = nativeFixtureEnvironment(["python"]), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	assert.ok(environment.LEAN_BRIDGE_PYTHON?.startsWith("/"), "Select an absolute Python toolchain");
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
		t.diagnostic(`Python ${minor} ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["pypi"] })
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
	const packages = receipt.packages.filter(pkg => pkg.target === "pypi"), source = await structuralSubtypePythonCaller(route);
	await saveLakeFile(output, "consumer.py", source);
	const installed = await installCopiedConsumer({
		profile: "python", consumer, handoff, packages, environment
		, fixture: {
			source: () => source, expectedChecks: structuralSubtypePythonCounts.checks
			, parseResult: parseStructuralSubtypePythonResult
			, installPython: input => installFinContainerEdgePython({ ...input, receiptPath: "lean_structuralsubtypes/lean_bridge/package-receipt.json" })
		}
	});
	delete installed.command;
	assert.equal(installed.pythonEnvironment.python.split(".").slice(0, 2).join("."), minor);
	const root = join(consumer, "python"), observations = [];
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const context = { ...installed.pythonEnvironment, venv: join(location, "venv") };
		const before = await verifyFinContainerEdgePythonEnvironment(context);
		const run = await runFinContainerEdgePython(context, ["consumer.py"], location);
		assert.equal(run.stderr, ""); const counts = parseStructuralSubtypePythonResult(run.stdout);
		assert.deepEqual(await verifyFinContainerEdgePythonEnvironment(context), before);
		assert.equal(await readFile(join(location, "consumer.py"), "utf8"), source);
		observations.push({ relocated: Boolean(position), run, counts, closure: before });
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observations.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, minor, producerCommit
		, configuration, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt, installed, observations
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "No Python entry counters in this installed acceptance" } }));
	complete = true;
});
