/**
 * Source-free Python wheels preserve the compiler's original-owner lifetimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedPython } from "../src/release/owned-pypi.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { ownedRustBorrowReviewedIr, ownedRustBorrowConfiguration, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { ownedPythonInstalledProbe } from "./helpers/owned-python-installed-probes.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Python borrow wheels bind original owners without changing unanchored packages", () => {
	const ir = ownedRustBorrowReviewedIr();
	const generated = generateOwnedPythonPackage(ir, null, { transferredInputs: true, anchoredResults: true });
	assert.equal(generated.contract.schemaVersion, 3);
	assert.equal(generated.contract.inputTransfers.arguments, "whole-values");
	assert.equal(generated.contract.resultAnchors.anchor, "original-result-owner");
	assert.equal(JSON.parse(generated.files["binding-manifest.json"]).backend, "owned-python-v3");
	assert.throws(() => generateOwnedPythonPackage(ir, null, { transferredInputs: true }), /explicit output leases/u);
	for(const [source, transferredInputs] of [[ownedAggregateReviewedIr(), false], [ownedRustTransferReviewedIr(), true]])
		assert.deepEqual(generateOwnedPythonPackage(source, null, { transferredInputs, anchoredResults: true }).files,
			generateOwnedPythonPackage(source, null, { transferredInputs }).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`installed Python borrowed results preserve original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_BORROW_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-python-borrow-package-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer");
	const handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	await cp(resolve("tests/fixtures/onboarding/owned-aggregates"), project, { recursive: true });
	await saveLakeFile(project, "Owned.lean", await readFile(join(project, "Owned.lean"), "utf8") + ownedRustBorrowSource);
	const config = mode === "ordinary" ? await ownedRustBorrowConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { pypi: { name: "owned-borrows", version: "1.2.3" } };
	if(mode === "reviewed") Object.assign(config.targets, {
		c: { name: "owned-c-borrows", version: "1.2.3" }
		, cpp: { name: "owned-cpp-borrows", version: "1.2.3" }
		, cargo: { name: "owned-borrows", version: "1.2.3" } });
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed") await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ownedRustBorrowReviewedIr()));
	const before = await lakeInputState(project);
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const environment = { ...nativeFixtureEnvironment(["python", "rust"]), LEAN_BRIDGE_PYTHON: interpreters[0]
		, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") };
	const built = await buildCanonicalProject({ projectRoot: project
		, outputRoot: output, targets: Object.keys(config.targets), environment
		, onProgress: event => t.diagnostic(`${mode}: ${event.message}`) })
		.catch(error => { throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); });
	assert.deepEqual(await lakeInputState(project), before);
	const projection = built.projections?.find(item => item.ecosystem === "pypi") ?? built;
	assert.equal(projection.backend, "owned-python-v3");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(config.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-c-binding");
	const verified = await ownedPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	assert.equal(verified.model.schemaVersion, 9); assert.equal(verified.model.exports.length, 26);
	assert.equal(verified.model.ownedGraph.resultAnchors.exports.length, 19);
	assert.equal(verified.model.ownedGraph.inputTransfers.exports.length, 4);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(verified.adapter.schemaVersion, 5); assert.equal(verified.adapter.ownedValues.schemaVersion, 4);
	assert.equal(verified.adapter.pythonValues.schemaVersion, 3);
	const options = { nativeRoot, runtimeRoot, adapterRoot, environment
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: config.targets.pypi
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const fields = ["values", "anchor", "expiration", "descendants", "emptyValues"
		, "aliases", "independentOwnership", "copyType", "resourceEquality"
		, "invalidEquality", "transfers"];
	const tamperRejected = [...fields, "adapter-version", "contract-version", "native-anchors", "input-transfers", "source", "abi", "library"];
	for(const mutation of tamperRejected)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(fields.includes(mutation)) forged.pythonValues.resultAnchors[mutation] = "forged";
		else if(mutation === "adapter-version") forged.schemaVersion = 4;
		else if(mutation === "contract-version") forged.pythonValues.schemaVersion = 2;
		else if(mutation === "native-anchors") delete forged.ownedValues.resultAnchors;
		else if(mutation === "input-transfers") forged.pythonValues.inputTransfers.arguments = "ordinary-values";
		else
		{
			path = mutation === "source" ? `src/${verified.prefix}.c` : mutation === "abi" ? "internal/python-abi.h" : `lib/${verified.adapter.library}`;
			original = await readFile(join(adapterRoot, path));
			const changed = Buffer.concat([original, Buffer.from("\n/* changed borrow adapter */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			if(mutation !== "library") forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedPython({ ...options, working: join(directory, `forged-${mutation}`) }));
		if(path) await saveLakeFile(adapterRoot, path, original);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(verified.adapter));
	}
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true };
	for(const key of ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults"])
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...capabilities, [key]: false }));
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
	if(mode === "reviewed") for(const [profile, target, path, prefix, success] of [
		["cpp", "cpp", "owned-cpp-borrows.cpp", "#define OWNED_BORROW_INSTALLED 1\n", "owned-cpp-borrows-installed"]
		, ["rust", "cargo", "owned-rust-borrows.rs", "use owned_borrows::*;\n", "owned-rust-borrows"]
	]) {
		const observed = await installCopiedConsumer({ profile, consumer, handoff
			, environment, dependencies
			, packages: receipt.packages.filter(item => item.target === target)
			, fixture: { source: async () => prefix + await readFile(`tests/fixtures/structured-types/${path}`, "utf8"), success } });
		companions[profile] = observed.checks; assert.ok(observed.checks > 300);
	}
	const pkg = receipt.packages.find(item => item.target === "pypi" && item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path), moduleName = projection.moduleName;
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const source = await readFile("tests/fixtures/structured-types/owned-installed-python-borrows.py", "utf8");
	const documented = await readFile("tests/fixtures/documentation/consumers/python/owned-borrows.py", "utf8");
	const loaderSource = ownedPythonInstalledProbe.replaceAll("compatible.serial(ticket)", "compatible.serial(ticket.get())")
		.replaceAll("module.serial(value)", "module.serial(value.get())").replaceAll("api.serial(ticket)", "api.serial(ticket.get())");
	const observations = [], deployments = [];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const root = join(consumer, name);
		const { command, ...installation } = await installPythonWheel({ root, archive, python, typingVersion });
		await saveLakeFile(root, "consumer.py", source);
		const executed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.equal(result.ordinaryImport, true); assert.ok(result.checks > 250);
		t.diagnostic(`${mode}/${name}: ${result.checks} public consumer checks passed`);
		await saveLakeFile(root, "loader-probe.py", loaderSource);
		const probe = await runCopied(command, ["-I", "-B", "loader-probe.py"], root);
		assert.equal(probe.stderr, ""); const loader = JSON.parse(probe.stdout);
		assert.deepEqual(loader.consumer, result); assert.equal(loader.liveIdentities, 0);
		assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
		const installed = (await runCopied(command, ["-I", "-c", `import importlib.util, pathlib; print(pathlib.Path(importlib.util.find_spec("${moduleName}").origin).parent)`], root)).stdout.trim();
		assert.ok(installed.startsWith(`${root}/venv/`));
		const manifest = await json(join(installed, "lean_bridge/package-receipt.json"));
		assert.equal(manifest.schemaVersion, 4); assert.equal(manifest.kind, "lean-bridge-owned-python-package");
		assert.deepEqual(manifest.ownedValues, verified.python.contract);
		await verifyNativeFiles(dirname(installed), manifest.files);
		await saveLakeFile(root, "documentation.py", documented);
		const typecheck = path => runCopied(checker, ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", command, path], root);
		const typed = await typecheck("documentation.py");
		assert.equal(typed.stderr, ""); assert.match(typed.stdout, /Success: no issues found/u);
		await saveLakeFile(root, "invalid.py", 'import lean_owned_aggregates as api\nroot = api.new_ticket(1, "test")\napi.retain_ticket(root.get())\napi.transfer_ticket(root.get())\napi.copy_value([], result_of=api.serial)\nroot()\n');
		await assert.rejects(typecheck("invalid.py"), error => {
			for(const line of [3, 4, 5, 6]) assert.match(error.details.stdout, new RegExp(`invalid.py:${line}: error:`));
			assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/u);
			return true;
		});
		const example = await runCopied(command, ["-I", "-B", "documentation.py"], root);
		assert.equal(example.stdout, "42\n"); assert.equal(example.stderr, "");
		observations.push({ name, installation, checks: result.checks, manifest, loader, rejectedTypes: 4 });
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
	await saveLakeFile(resolve("build/owned-python-borrow-packaging"), `${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true, deterministicReassembly: true
		, ordinaryImport: true, tamperRejected, incapableReadersRejected: 3
		, consumerSha256: sha256(source), observations, companions, dependencies
		, input, loaderProbeSha256: sha256(loaderSource)
		, documentationSha256: sha256(documented)
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, runtimeReceipt: verified.runtime, packageSetReceipt: receipt
	}));
	t.diagnostic(`${mode}: ${observations.map(item => `${item.name} ${item.checks}+${item.relocatedChecks}`).join(", ")} installed and relocated checks`);
});
