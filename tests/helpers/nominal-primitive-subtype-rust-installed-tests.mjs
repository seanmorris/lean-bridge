/**
 * Reproduce nominal Rust crates and execute installed, relocated and source-free callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nominalPrimitiveSubtypeFixture, nominalPrimitiveSubtypeModule, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypeRustCaller, nominalPrimitiveSubtypeRustConfiguration, nominalPrimitiveSubtypeRustSelection, parseNominalPrimitiveSubtypeRustResult } from "./nominal-primitive-subtype-rust-fixture.mjs";
import { installNominalPrimitiveSubtypeRust, verifyNominalPrimitiveSubtypeRustDependencies } from "./nominal-primitive-subtype-rust-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./type-corpus-rust.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { nominalPrimitiveSubtypeRustDependencyManifests } from "./nominal-primitive-subtype-rust-dependency-records.mjs";
import { checkNominalPrimitiveSubtypeRustReport } from "./nominal-primitive-subtype-rust-report.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";

const { enabled, routes, modes } = nominalPrimitiveSubtypeRustSelection(process.env);
const resourceMaxLoad = process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_MAX_LOAD === undefined
	? 6
	: Number(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_MAX_LOAD);
const resourceCheck = root => waitNominalSubtypeDotnetResources(root, {
	maxLoad: resourceMaxLoad
	, notify: console.log
});
const registryFiles = async () => (await readdir("/tmp")).filter(name => /^lean-bridge-rust-(?:v1|assets)-/u.test(name)).sort();

for(const route of routes) for(const mode of modes) test(`installed primitive-base nominal Rust packages reproduce and relocate ${route} ${mode}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	for(const path of ["fixture.mjs", "package.mjs", "install.mjs", "installed-tests.mjs"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/helpers/nominal-primitive-subtype-rust-${path}`]);
	execFileSync("git", ["ls-files", "--error-unmatch", "tests/fixtures/nominal-primitive-subtype-consumers/rust.rs"]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const expected = nominalPrimitiveSubtypeReview(mode === "result-only"), configuration = nominalPrimitiveSubtypeRustConfiguration(route, mode);
	const output = resolve(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUST_OUTPUT ?? "build/nominal-primitive-subtype-rust", route, mode);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const environment = { ...nativeFixtureEnvironment(["rust"])
		, CARGO_BUILD_JOBS: "1", LEAN_NUM_THREADS: "1"
		, OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1", CMAKE_BUILD_PARALLEL_LEVEL: "1" };
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select the native glibc floor explicitly");
	assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
	const runtime = { platform: process.platform, arch: process.arch, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output) };
	assert.equal(runtime.glibc.stderr, ""); assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	for(const [path, value] of Object.entries({ "runtime.json": runtime, "expected.binding-ir.json": expected, "configuration.json": configuration }))
		await saveLakeFile(output, path, canonicalJson(value));
	const caller = await nominalPrimitiveSubtypeRustCaller(route); await saveLakeFile(output, "consumer.rs", caller);
	await resourceCheck(output);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-subtype-rust-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed nominal Rust inputs: ${root}`);
	});
	const handoff = join(root, "handoff"), dependencyHandoff = join(root, "dependency-handoff"), builds = [];
	let model, dependencies;
	for(const attempt of [0, 1])
	{
		await resourceCheck(output);
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
		await cp(nominalPrimitiveSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${mode} author ${attempt}: reproducible Rust crate`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author inputs remain unchanged");
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["cargo", "component"]]);
		await saveLakeFile(record, "model.json", modelBytes);
		await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
		await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
		for(const name of [`${nominalPrimitiveSubtypeModule}.lean`, "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(route === "reviewed") await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await copyPackageSetHandoff(handoff, join(output, "handoff"));
			await resourceCheck(output);
			dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: dependencyHandoff, environment });
			await cp(dependencyHandoff, join(output, "dependency-handoff"), { recursive: true });
			await saveLakeFile(output, "dependencies.json", canonicalJson(dependencies));
			const bytes = await readFile(join(dependencyHandoff, dependencies.archive));
			for(const [path, value] of nominalPrimitiveSubtypeRustDependencyManifests(bytes, dependencies))
				await saveLakeFile(output, path, value);
		}
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce the complete crate");
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), pkg = receipt.packages[0];
	const archive = join(handoff, pkg.artifacts[0].path), consumer = join(root, "consumer");
	await resourceCheck(output);
	const installation = await installNominalPrimitiveSubtypeRust({ root: consumer, handoff, dependencyHandoff, pkg, dependencies, environment, model, floor, caller, mode, route, output });
	const observations = [], clean = { ...copiedCleanEnvironment, CARGO_HOME: "/unavailable", RUSTC: "/unavailable" };
	for(const [index, location] of [consumer, consumer + "-relocated"].entries())
	{
		if(index)
		{ await rename(consumer, location); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		const verify = async () => ({
			crate: await verifyFinContainerEdgeArchiveClosure({ profile: "rust"
				, installed: join(location, "vendor", `${pkg.name}-${pkg.version}`)
				, receiptPath: "lean-bridge/package-receipt.json"
				, archive
				, archiveSha256: pkg.artifacts[0].sha256 })
			, dependencies: await verifyNominalPrimitiveSubtypeRustDependencies(join(location, "vendor/dependencies"), dependencies)
		});
		const closure = await verify(), before = await registryFiles();
		assert.equal(sha256(await readFile(join(location, installation.executable))), installation.executableSha256);
		assert.equal(await readFile(join(location, "src/main.rs"), "utf8"), caller);
		await resourceCheck(output);
		const run = await runCopied(join(location, installation.executable), [], location, clean);
		assert.equal(run.stderr, ""); const counts = parseNominalPrimitiveSubtypeRustResult(run.stdout, mode);
		assert.deepEqual(await verify(), closure); assert.deepEqual(await registryFiles(), before);
		assert.equal(sha256(await readFile(join(location, installation.executable))), installation.executableSha256);
		const observation = { stage: index ? "relocated" : "installed", cwd: location, run, counts, closure, normalExitCleanup: true };
		observations.push(observation); await saveLakeFile(output, `${observation.stage}.json`, canonicalJson(observation));
	}
	const sourceFree = join(root, "source-free"); await mkdir(sourceFree);
	await rename(join(consumer + "-relocated", installation.executable), join(sourceFree, "consumer"));
	await rm(consumer + "-relocated", { recursive: true });
	await assert.rejects(access(consumer + "-relocated"), { code: "ENOENT" });
	assert.deepEqual(await readdir(sourceFree), ["consumer"]);
	await resourceCheck(output);
	const before = await registryFiles(), run = await runCopied(join(sourceFree, "consumer"), [], sourceFree, clean);
	assert.equal(run.stderr, ""); const counts = parseNominalPrimitiveSubtypeRustResult(run.stdout, mode);
	assert.deepEqual(await registryFiles(), before);
	assert.equal(sha256(await readFile(join(sourceFree, "consumer"))), installation.executableSha256);
	const observation = { stage: "source-free", cwd: sourceFree, run, counts, sourcesRemoved: true, normalExitCleanup: true };
	observations.push(observation); await saveLakeFile(output, "source-free.json", canonicalJson(observation));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1
		, route
		, mode
		, producerCommit
		, runtime
		, builds
		, receipt
		, observations
		, installation
		, dependencies
		, declaredGlibcFloor: floor, expectedBindingIrSha256: hashBindingIr(expected)
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true
		, compilerFreeReplay: true
		, relocatedInstallation: true, sourceFreeExecutable: true
		, dispatch: { observed: false, reason: "No Rust constructor/source entry counters in this installed acceptance" } }));
	await checkNominalPrimitiveSubtypeRustReport(path => readFile(join(output, path)), { route
		, mode, producerCommit, floor
		, runtime: { platform: runtime.platform, arch: runtime.arch, glibc: runtime.glibc.stdout.trim().slice(6) }
		, toolchain: JSON.parse(await readFile(join(output, "toolchain.json"))) });
	complete = true;
});
