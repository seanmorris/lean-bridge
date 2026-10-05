/**
 * Source-free wheel installation and ordinary imports of owned Python values.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedPython } from "../src/release/owned-pypi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { ownedPythonInstalledProbe } from "./helpers/owned-python-installed-probes.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
const enabled = process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST === "1";

for(const mode of ["ordinary", "reviewed"]) test(`installed Python owned compositions preserve semantics (${mode})`, { skip: !enabled, timeout: 1200000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-python-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-cpp-composition"), project, { recursive: true });
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { pypi: { name: "owned-values", version: "1.2.3" } };
	if(mode === "reviewed")
		Object.assign(config.targets, {
			c: { name: "owned-c-values", version: "1.2.3" }
			, cpp: { name: "owned-cpp-values", version: "1.2.3" }
			, cargo: { name: "owned-values", version: "1.2.3" } });
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedCppCompositionReviewedIr()));
	const before = await lakeInputState(project);
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const environment = { ...nativeFixtureEnvironment(["python", "rust"]), LEAN_BRIDGE_PYTHON: interpreters[0]
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	let built;
	try
	{
		built = await buildCanonicalProject({ projectRoot: project, outputRoot: output
			, targets: Object.keys(config.targets), environment
			, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) });
	} catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections?.find(item => item.ecosystem === "pypi") ?? built;
	assert.equal(projection.ecosystem, "pypi"); assert.equal(projection.backend, "owned-python-v1");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(config.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-c-binding");
	const verified = await ownedPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	assert.equal(verified.model.exports.length, 31);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const options = { nativeRoot, runtimeRoot, adapterRoot, environment
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.pypi
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	for(const mutation of ["lifetime", "source", "abi", "library"])
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "lifetime") forged.pythonValues.callbackLifetime = "retained";
		else
		{
			path = mutation === "source" ? `src/${verified.prefix}.c` : mutation === "abi" ? "internal/python-abi.h" : `lib/${verified.adapter.library}`;
			original = await readFile(join(adapterRoot, path));
			const changed = Buffer.concat([original, Buffer.from("\n/* modified projection */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			if(mutation !== "library") forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedPython({ ...options, working: join(directory, `forged-${mutation}`) }));
		if(path) await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(verified.adapter));
	}
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedPython({ ...options, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	assert.deepEqual(await readFile(join(reassembled, "archives", rebuilt.packages[0].archive)), await readFile(join(output, "archives", projection.packages[0].archive)));
	await rm(reassembled, { recursive: true, force: true });
	const receipt = await copyPackageSetHandoff(output, handoff);
	const dependencies = mode === "reviewed" ? await prepareRustCorpusDependencies({ rustRoot: join(output, "native/rust"), directory, handoff, environment }) : null;
	if(dependencies) await cp(join(handoff, dependencies.archive), join(consumer, "dependencies", dependencies.archive), { recursive: true });
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const companions = {};
	for(const profile of mode === "reviewed" ? ["c", "cpp"] : [])
	{
		const cpp = profile === "cpp";
		const observed = await installCopiedConsumer({
			profile, consumer, handoff, environment
			, packages: receipt.packages.filter(item => item.target === profile)
			, fixture: { source: () => readFile(`tests/fixtures/structured-types/${cpp ? "owned-installed-cpp.cpp" : "owned-installed-host-callbacks.c"}`, "utf8")
				, success: cpp ? "owned-installed-cpp" : "owned-installed-callbacks" } });
		companions[profile] = observed.checks; assert.equal(observed.checks, cpp ? 577 : 693);
	}
	if(dependencies)
	{
		const observed = await installCopiedConsumer({ profile: "rust"
			, consumer, handoff, environment, dependencies
			, packages: receipt.packages.filter(item => item.target === "cargo")
			, fixture: { source: () => readFile("tests/fixtures/structured-types/owned-installed-rust.rs", "utf8"), success: "owned-installed-rust" } });
		companions.rust = observed.checks; assert.equal(observed.checks, 596);
	}
	const pkg = receipt.packages.find(item => item.target === "pypi" && item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path), moduleName = projection.moduleName;
	const source = await readFile("tests/fixtures/structured-types/owned-installed-python.py", "utf8");
	const docs = await readFile("docs/consume/python.md", "utf8");
	const documented = docs.split("### Resource-containing values\n")[1].split("```python\n")[1].split("\n```")[0] + "\n";
	const observations = [], deployments = [];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const root = join(consumer, name);
		const { command, ...installation } = await installPythonWheel({ root, archive, python, typingVersion });
		await saveLakeFile(root, "consumer.py", source);
		const executed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.equal(result.ordinaryImport, true); assert.ok(result.checks >= 100);
		await saveLakeFile(root, "loader-probe.py", ownedPythonInstalledProbe);
		const probe = await runCopied(command, ["-I", "-B", "loader-probe.py"], root);
		assert.equal(probe.stderr, ""); const loader = JSON.parse(probe.stdout);
		assert.deepEqual(loader.consumer, result); assert.equal(loader.liveIdentities, 0);
		assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
		const installed = (await runCopied(command, ["-I", "-c", `import importlib.util, pathlib; print(pathlib.Path(importlib.util.find_spec("${moduleName}").origin).parent)`], root)).stdout.trim();
		assert.ok(installed.startsWith(`${root}/venv/`));
		const manifest = await json(join(installed, "lean_bridge/package-receipt.json"));
		assert.equal(manifest.kind, "lean-bridge-owned-python-package");
		await verifyNativeFiles(dirname(installed), manifest.files);
		for(const suffix of ["typed", "invalid"])
			await saveLakeFile(root, `${suffix}.py`, await readFile(`tests/fixtures/structured-types/owned-python-${suffix}.py`, "utf8"));
		const typecheck = path => runCopied(checker, ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", command, path], root);
		const typed = await typecheck("typed.py");
		assert.equal(typed.stderr, ""); assert.match(typed.stdout, /Success: no issues found/u);
		await assert.rejects(typecheck("invalid.py"), error => { assert.match(error.details.stdout, /Found 13 errors in 1 file/u); assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/u); return true; });
		await runCopied(command, ["-I", "-B", "typed.py"], root);
		await saveLakeFile(root, "documentation.py", documented);
		const documentedTypes = await typecheck("documentation.py");
		assert.match(documentedTypes.stdout, /Success: no issues found/u);
		const example = await runCopied(command, ["-I", "-B", "documentation.py"], root);
		assert.equal(example.stdout, ""); assert.equal(example.stderr, "");
		const rejection = `import importlib, sys\ntry:\n    importlib.import_module("${moduleName}")\nexcept ImportError as error:\n    assert sys.argv[1] in str(error), str(error)\n    print("owned-loader-rejected")\nelse:\n    raise AssertionError("Invalid native input was accepted")\n`;
		const rejected = async (expected, env) => {
			const check = await runCopied(command, ["-I", "-B", "-c", rejection, expected], root, env);
			assert.equal(check.stdout, "owned-loader-rejected\n"); assert.equal(check.stderr, "");
		};
		await rejected("Unverified native library is already loaded", { ...copiedCleanEnvironment, LD_PRELOAD: join(installed, "native/linux-x64/libleanshared.so") });
		const library = join(installed, "native/linux-x64", verified.adapter.library), original = await readFile(library);
		const corrupt = Buffer.from(original); corrupt[0] ^= 1;
		await saveLakeFile(dirname(library), verified.adapter.library, corrupt);
		await rejected("Native library differs from compiled evidence");
		await saveLakeFile(dirname(library), verified.adapter.library, original);
		await rename(library, `${library}.original`); await symlink(`${library}.original`, library);
		await rejected("Native library is not a regular file");
		await rm(library); await rename(`${library}.original`, library);
		observations.push({ name, installation, checks: result.checks
			, manifest, loader
			, rejectedTypes: 13
			, loaderRejected: ["unverified-runtime", "changed-library", "symlink-library"] });
		deployments.push({ name, root, command, result });
	}
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated"); await mkdir(relocated);
	for(const deployment of deployments)
	{
		const root = join(relocated, deployment.name); await rename(deployment.root, root);
		await assert.rejects(access(deployment.root), { code: "ENOENT" });
		const moved = await runCopied(join(root, "venv/bin/python"), ["-I", "-B", "consumer.py"], root);
		assert.equal(moved.stderr, ""); assert.deepEqual(JSON.parse(moved.stdout), deployment.result);
		observations.find(item => item.name === deployment.name).relocatedChecks = deployment.result.checks;
	}
	await saveLakeFile(resolve("build/owned-python-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true, sourceFreeInstallation: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true, ordinaryImport: true
		, tamperRejected: ["lifetime", "source", "abi", "library"]
		, consumerSha256: sha256(source), observations, companions
		, dependencies, input
		, loaderProbeSha256: sha256(ownedPythonInstalledProbe)
		, documentationSha256: sha256(documented)
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, packageSetReceipt: receipt
	}));
	t.diagnostic(`${mode}: ${observations.map(item => `${item.name} ${item.checks}+${item.relocatedChecks}`).join(", ")} installed and relocated checks`);
});
