/**
 * Actual installed Cargo structural Subtypes through both independent author routes.
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
import { structuralSubtypeRustConfiguration, structuralSubtypeRustCaller, structuralSubtypeRustCounts, parseStructuralSubtypeRustResult } from "./structural-subtype-rust-fixture.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./type-corpus-rust.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUST_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUST_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtypes Rust ${route} reproduce and relocate`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_RUST_OUTPUT ?? "build/structural-subtype-rust", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-rust-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural Rust inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeRustConfiguration(route);
	const environment = nativeFixtureEnvironment(["rust"]), consumer = join(directory, "consumer"), handoff = join(directory, "handoff");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const builds = [];
	let dependencies;
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`Rust ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["cargo"] })
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
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment });
		}
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const packages = receipt.packages.filter(pkg => pkg.target === "cargo"), pkg = packages.find(item => item.role === "component");
	const source = await structuralSubtypeRustCaller(route);
	await saveLakeFile(output, "consumer.rs", source);
	await saveLakeFile(output, "dependencies.json", canonicalJson(dependencies));
	const installed = await installCopiedConsumer({ profile: "rust"
		, consumer, handoff, packages, environment, dependencies
		, fixture: { source: () => source
			, expectedChecks: structuralSubtypeRustCounts.checks
			, parseResult: parseStructuralSubtypeRustResult
			, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure } });
	delete installed.command;
	const root = join(consumer, "rust"), observations = [], executable = "target/debug/consumer";
	const executableSha256 = sha256(await readFile(join(root, executable)));
	const toolchain = {};
	for(const [name, command] of [["cargo", environment.LEAN_BRIDGE_CARGO], ["rustc", environment.LEAN_BRIDGE_RUSTC]])
	{
		const run = await runCopied(command, ["--version"], root); assert.equal(run.stderr, "");
		toolchain[name] = { version: run.stdout.trim(), sha256: sha256(await readFile(command)) };
	}
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const packageRoot = join(location, `${pkg.name}-${pkg.version}`);
		const verify = () => verifyFinContainerEdgeArchiveClosure({ profile: "rust"
			, installed: packageRoot
			, receiptPath: "lean-bridge/package-receipt.json"
			, archive: join(handoff, pkg.artifacts[0].path)
			, archiveSha256: pkg.artifacts[0].sha256 });
		const closure = await verify();
		const run = await runCopied(join(location, executable), [], location, { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" });
		assert.equal(run.stderr, ""); const counts = parseStructuralSubtypeRustResult(run.stdout);
		assert.deepEqual(await verify(), closure);
		assert.equal(sha256(await readFile(join(location, executable))), executableSha256);
		assert.equal(await readFile(join(location, "consumer.rs"), "utf8"), source);
		observations.push({ relocated: Boolean(position), run, counts, closure });
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observations.at(-1)));
		const retained = [["consumer.Cargo.lock", join(location, "Cargo.lock")]
			, ["package.Cargo.lock", join(packageRoot, "Cargo.lock")]
			, ["public.rs", join(packageRoot, "src/lib.rs")]
			, ["package-receipt.json", join(packageRoot, "lean-bridge/package-receipt.json")]];
		for(const [name, path] of retained)
		{
			const bytes = await readFile(path);
			if(position) assert.deepEqual(bytes, await readFile(join(output, name)));
			else await saveLakeFile(output, name, bytes);
		}
	}
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, route, producerCommit, configuration
		, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt, installed, observations
		, dependencies, toolchain, executableSha256
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "No Rust entry counters in this installed acceptance" } }));
	complete = true;
});
