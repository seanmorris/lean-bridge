/**
 * Installed Python input transfers with authenticated, source-free native wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedPython } from "../src/release/owned-pypi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedRustTransferReviewedIr, ownedRustTransferConfiguration, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { ownedPythonInstalledProbe } from "./helpers/owned-python-installed-probes.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Python transfer wheels bind consumption without changing borrow-only packages", () => {
	const ir = ownedRustTransferReviewedIr();
	const generated = generateOwnedPythonPackage(ir, null, { transferredInputs: true });
	assert.equal(generated.contract.schemaVersion, 2);
	assert.equal(generated.contract.inputTransfers.arguments, "ordinary-values");
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-python-v2");
	assert.throws(() => generateOwnedPythonPackage(ir), /call-scoped input borrows/u);
	const borrowed = ownedCppCompositionReviewedIr();
	assert.deepEqual(generateOwnedPythonPackage(borrowed, null, { transferredInputs: true }).files,
		generateOwnedPythonPackage(borrowed).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Python inputs preserve transfer decisions (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_TRANSFER_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-python-transfers-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustTransferSource);
	const config = mode === "ordinary" ? await ownedRustTransferConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { pypi: { name: "owned-transfers", version: "1.2.3" } };
	if(mode === "reviewed") Object.assign(config.targets, {
		c: { name: "owned-c-transfers", version: "1.2.3" }
		, cpp: { name: "owned-cpp-transfers", version: "1.2.3" }
		, cargo: { name: "owned-transfers", version: "1.2.3" } });
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustTransferReviewedIr()));
	const before = await lakeInputState(project);
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const environment = { ...nativeFixtureEnvironment(["python", "rust"]), LEAN_BRIDGE_PYTHON: interpreters[0]
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	let built;
	try
	{ built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output
		, targets: Object.keys(config.targets), environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) }); }
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections?.find(item => item.ecosystem === "pypi") ?? built;
	assert.equal(projection.backend, "owned-python-v2");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(config.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-c-binding");
	const verified = await ownedPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	assert.equal(verified.model.exports.length, 26);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(verified.adapter.schemaVersion, 4);
	assert.equal(verified.adapter.ownedValues.schemaVersion, 3);
	assert.equal(verified.adapter.pythonValues.schemaVersion, 2);
	const options = { nativeRoot, runtimeRoot, adapterRoot, environment
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.pypi
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const tamperRejected = ["adapter-version", "contract-version", "consumption", "aliases", "native-transfers", "source", "abi", "library"];
	for(const mutation of tamperRejected)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "adapter-version") forged.schemaVersion = 3;
		else if(mutation === "contract-version") forged.pythonValues.schemaVersion = 1;
		else if(mutation === "consumption") forged.pythonValues.inputTransfers.consumption = "after-lean-call";
		else if(mutation === "aliases") forged.pythonValues.inputTransfers.aliases = "wrapper-only";
		else if(mutation === "native-transfers") delete forged.ownedValues.inputTransfers;
		else
		{
			path = mutation === "source" ? `src/${verified.prefix}.c` : mutation === "abi" ? "internal/python-abi.h" : `lib/${verified.adapter.library}`;
			original = await readFile(join(adapterRoot, path));
			const changed = Buffer.concat([original, Buffer.from("\n/* changed transfer adapter */\n")]);
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
	if(mode === "reviewed")
	{
		const values = generateOwnedCValues(verified.model.bindingIr, { hostCallbacks: true, transferredInputs: true });
		const shapes = [["OPTION", "echoOption"], ["ARRAY", "echoArray"]
			, ["LIST", "echoList"], ["RESULT", "echoResult"]
			, ["TUPLE", "echoTuple"], ["ROW", "echoRow"], ["NESTED", "echoNested"]];
		const macros = shapes.map(([macro, name]) => {
			const type = values.functions.find(item => item.name === name).parameters[0];
			return `#define COPY_${macro} ${values.copies.find(item => item.id === type).cName}`;
		}).join("\n") + "\n"
			// Mixed shares this product shape with echoTuple. Reuse its public
			// semantic typedef when compiling the original C transfer consumer.
			+ "#include \"owned_aggregates.h\"\ntypedef owned_aggregates_mixed_product_snd_t owned_aggregates_echo_tuple_argument0_snd_t;\n";
		for(const [profile, target, path, prefix, success] of [
			["c", "c", "owned-installed-transfers.c", macros, "owned-transfers-installed"]
			, ["cpp", "cpp", "owned-cpp-transfers.cpp", "#define OWNED_TRANSFER_INSTALLED 1\n", "owned-cpp-transfers-installed"]
			, ["rust", "cargo", "owned-rust-transfers.rs", "use owned_transfers::*;\n", "owned-rust-transfers-installed"]
		]) {
			const observed = await installCopiedConsumer({ profile, consumer, handoff
				, environment, dependencies
				, packages: receipt.packages.filter(item => item.target === target)
				, fixture: { source: async () => prefix + await readFile(`tests/fixtures/structured-types/${path}`, "utf8"), success } });
			companions[profile] = observed.checks;
			assert.ok(observed.checks > 100);
		}
	}
	const pkg = receipt.packages.find(item => item.target === "pypi" && item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path), moduleName = projection.moduleName;
	const source = await readFile("tests/fixtures/structured-types/owned-installed-python-transfers.py", "utf8");
	const documented = await readFile("tests/fixtures/documentation/consumers/python/owned-transfers.py", "utf8");
	const observations = [], deployments = [];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const root = join(consumer, name);
		const { command, ...installation } = await installPythonWheel({ root, archive, python, typingVersion });
		await saveLakeFile(root, "consumer.py", source);
		const executed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.equal(result.ordinaryImport, true); assert.ok(result.checks > 100);
		await saveLakeFile(root, "loader-probe.py", ownedPythonInstalledProbe);
		const probe = await runCopied(command, ["-I", "-B", "loader-probe.py"], root);
		assert.equal(probe.stderr, ""); const loader = JSON.parse(probe.stdout);
		assert.deepEqual(loader.consumer, result); assert.equal(loader.liveIdentities, 0);
		assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
		const installed = (await runCopied(command, ["-I", "-c", `import importlib.util, pathlib; print(pathlib.Path(importlib.util.find_spec("${moduleName}").origin).parent)`], root)).stdout.trim();
		assert.ok(installed.startsWith(`${root}/venv/`));
		const manifest = await json(join(installed, "lean_bridge/package-receipt.json"));
		assert.equal(manifest.schemaVersion, 3); assert.equal(manifest.kind, "lean-bridge-owned-python-package");
		assert.deepEqual(manifest.ownedValues, verified.python.contract);
		await verifyNativeFiles(dirname(installed), manifest.files);
		await saveLakeFile(root, "documentation.py", documented);
		const typecheck = path => runCopied(checker, ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", command, path], root);
		const typed = await typecheck("documentation.py");
		assert.equal(typed.stderr, ""); assert.match(typed.stdout, /Success: no issues found/u);
		await saveLakeFile(root, "invalid.py", 'import lean_owned_aggregates as api\napi.retain_ticket(None)\napi.echo_array([1])\napi.echo_record("wrong")\n');
		await assert.rejects(typecheck("invalid.py"), error => { assert.match(error.details.stdout, /Found 3 errors in 1 file/u); assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/u); return true; });
		const example = await runCopied(command, ["-I", "-B", "documentation.py"], root);
		assert.equal(example.stdout, "transferred\n"); assert.equal(example.stderr, "");
		observations.push({ name, installation, checks: result.checks, manifest, loader, rejectedTypes: 3 });
		deployments.push({ name, root, result });
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
	await saveLakeFile(resolve("build/owned-python-transfer-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true, sourceFreeInstallation: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true, ordinaryImport: true, tamperRejected
		, consumerSha256: sha256(source), observations, companions, dependencies
		, input
		, loaderProbeSha256: sha256(ownedPythonInstalledProbe)
		, documentationSha256: sha256(documented)
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, runtimeReceipt: verified.runtime
		, packageSetReceipt: receipt
	}));
	t.diagnostic(`${mode}: ${observations.map(item => `${item.name} ${item.checks}+${item.relocatedChecks}`).join(", ")} installed and relocated checks`);
});
