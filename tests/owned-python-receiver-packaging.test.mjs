/**
 * Build original wheels with an offline-installed CLI, then remove author tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { packageOwnedPython } from "../src/release/owned-pypi.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { ownedPythonReceiverConfiguration, ownedPythonReceiverReviewedIr, ownedPythonReceiverSource
	, ownedPythonInstalledReceiverProbe } from "./helpers/owned-python-receiver-fixture.mjs";
import { ownedCppReceiverProbe } from "./helpers/owned-cpp-receiver-fixture.mjs";
import { ownedRustReceiverProbe } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedPythonInstalledProbe } from "./helpers/owned-python-installed-probes.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { installCopiedConsumer, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) test(`installed Python receiver wheel survives source removal (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_RECEIVER_TEST !== "1"
	, timeout: 2400000
}, async t => {
	const configuration = mode === "ordinary" ? await ownedPythonReceiverConfiguration() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { pypi: { name: "owned-receivers", version: "1.2.3" } };
	if(mode === "reviewed") Object.assign(configuration.targets, {
		c: { name: "owned-c-receivers", version: "1.2.3" }
		, cpp: { name: "owned-cpp-receivers", version: "1.2.3" }
		, cargo: { name: "owned-receivers", version: "1.2.3" }
	});
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const context = await prepareOwnedReceiverCli(t, {
		label: `python-receiver-package-${mode}`, configuration
		, reviewedIr: mode === "reviewed" ? ownedPythonReceiverReviewedIr() : null
		, source: ownedPythonReceiverSource, profiles: ["python", "rust"]
		, environment: { LEAN_BRIDGE_PYTHON: interpreters[0]
			, CARGO_HOME: process.env.CARGO_HOME ?? resolve(".toolchains/cargo-copied") }
	});
	const { directory, output, handoff, consumer, environment } = context;
	const built = await context.build(output), projection = built.projections?.find(item => item.ecosystem === "pypi") ?? built;
	assert.equal(projection.backend, "owned-python-v4");
	assert.deepEqual((built.projections ?? [built]).map(item => item.ecosystem).sort(), Object.keys(configuration.targets).sort());
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-c-binding");
	const verified = await ownedPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, receipt: componentReceipt, adapter } = verified;
	assert.equal(model.schemaVersion, 10); assert.equal(componentReceipt.schemaVersion, 6);
	assert.equal(model.exports.length, 27); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
	assert.equal(model.ownedGraph.resultAnchors.exports.length, 20); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(adapter.schemaVersion, 6); assert.equal(adapter.ownedValues.schemaVersion, 5);
	assert.equal(adapter.pythonValues.schemaVersion, 4);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true, ownedAnchoredResults: true, ownedReceiverExports: true };
	for(const key of ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"])
		await assert.rejects(readVerifiedNativeComponent(nativeRoot, verified.evidence.runtimeIdentity, { ...capabilities, [key]: false }));
	const packageOptions = { nativeRoot, runtimeRoot, adapterRoot, environment
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: configuration.targets.pypi
		, glibcMinimumVersion: projection.glibcMinimumVersion };
	const reassembled = join(directory, "reassembled"), rebuilt = await packageOwnedPython({ ...packageOptions, working: reassembled });
	assert.deepEqual(rebuilt.packages, projection.packages);
	const original = await readFile(join(output, "archives", projection.packages[0].archive));
	assert.deepEqual(await readFile(join(reassembled, "archives", projection.packages[0].archive)), original);
	await rm(reassembled, { recursive: true });
	const independent = join(directory, "independent"), second = await context.build(independent);
	for(const item of built.projections ?? [built])
	{
		const again = second.projections?.find(value => value.ecosystem === item.ecosystem) ?? second;
		assert.deepEqual(again.packages, item.packages);
		for(const archive of item.packages)
			assert.deepEqual(await readFile(join(output, "archives", archive.archive)), await readFile(join(independent, "archives", archive.archive)));
	}
	await rm(independent, { recursive: true });
	let rejected = 0;
	for(const mutate of [
		value => { delete value.ownedValues.receiverExports; }
		, value => { value.ownedValues.receiverExports.exports.pop(); }
		, value => { value.ownedValues.receiverExports.exports[0].argument = 1; }
		, value => { value.ownedValues.receiverExports.callingConvention = "receiver-last"; }
		, value => { value.ownedValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.ownedValues.receiverExports.exports[0].owner = "lean:Unknown"; }
		, value => { value.ownedValues.resultAnchors.lifetime = "parameter"; }
		, value => { value.ownedValues.resultAnchors.exports.find(item => item.receiver).receiver = false; }
		, value => { value.ownedValues.resultAnchors.exports.find(item => item.bindingId === "lean:Owned.chooseTicket").parameter = 1; }
		, value => { value.schemaVersion = 5; value.ownedValues.schemaVersion = 4; }
		, value => { delete value.pythonValues.receiverExports; }
		, value => { value.pythonValues.receiverExports.values = "unowned"; }
		, value => { value.pythonValues.receiverExports.members = "camelCase"; }
		, value => { value.pythonValues.receiverExports.properties = "methods"; }
		, value => { value.pythonValues.receiverExports.consumingReceivers = "copied-leaves"; }
		, value => { value.pythonValues.receiverExports.exports[0].member = "wrong"; }
		, value => { value.pythonValues.receiverExports.exports[0].kind = "function"; }
		, value => { value.pythonValues.schemaVersion = 3; }
	]) {
		const changed = structuredClone(adapter); mutate(changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(changed));
		await assert.rejects(packageOwnedPython({ ...packageOptions, working: join(directory, `forged-${rejected}`) }), /compiler-authenticated/u);
		rejected++;
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of [`src/${verified.prefix}.c`, "internal/python-abi.h", `lib/${adapter.library}`])
	{
		const source = await readFile(join(adapterRoot, path)), changed = Buffer.concat([source, Buffer.from("\n/* changed receiver adapter */\n")]);
		const forged = structuredClone(adapter);
		if(!path.startsWith("lib/")) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		await assert.rejects(packageOwnedPython({ ...packageOptions, working: join(directory, `forged-${rejected}`) }));
		rejected++;
		await saveLakeFile(adapterRoot, path, source); await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	const dependencies = mode === "reviewed" ? await prepareRustCorpusDependencies({ rustRoot: join(output, "native/rust"), directory, handoff, environment }) : null;
	if(dependencies) await cp(join(handoff, dependencies.archive), join(consumer, "dependencies", dependencies.archive), { recursive: true });
	const verification = await context.removeAuthor(), companions = {};
	if(mode === "reviewed") for(const [profile, target, probe, success] of [
		["cpp", "cpp", "#define OWNED_BORROW_INSTALLED 1\n" + await ownedCppReceiverProbe(), "owned-cpp-receivers-installed"]
		, ["rust", "cargo", "use owned_receivers::*;\n" + await ownedRustReceiverProbe(), "owned-rust-receivers"]
	]) {
		const observed = await installCopiedConsumer({ profile, consumer, handoff
			, environment, dependencies
			, packages: handoffReceipt.packages.filter(item => item.target === target)
			, fixture: { source: async () => probe, success } });
		assert.ok(observed.checks > 300); companions[profile] = { checks: observed.checks, probeSha256: sha256(probe) };
	}
	const pkg = handoffReceipt.packages.find(item => item.target === "pypi" && item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path), moduleName = projection.moduleName;
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const source = await ownedPythonInstalledReceiverProbe();
	const documented = await readFile("tests/fixtures/documentation/consumers/python/owned-receivers.py", "utf8");
	assert.equal((await readFile("docs/consume/python.md", "utf8")).match(/```python file=python\/owned-receivers\.py\n([\s\S]*?)```/u)?.[1], documented);
	const loaderSource = ownedPythonInstalledProbe.replaceAll("compatible.serial(ticket)", "compatible.serial(ticket.get())")
		.replaceAll("module.serial(value)", "module.serial(value.get())").replaceAll("api.serial(ticket)", "api.serial(ticket.get())");
	const observations = [], deployments = [];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const root = join(consumer, name), { command, ...installation } = await installPythonWheel({ root, archive, python, typingVersion });
		await saveLakeFile(root, "consumer.py", source);
		const executed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.equal(result.ordinaryImport, true); assert.ok(result.checks > 250);
		await saveLakeFile(root, "loader-probe.py", loaderSource);
		const probe = await runCopied(command, ["-I", "-B", "loader-probe.py"], root);
		assert.equal(probe.stderr, ""); const loader = JSON.parse(probe.stdout);
		assert.deepEqual(loader.consumer, result); assert.equal(loader.liveIdentities, 0);
		assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
		const installed = (await runCopied(command, ["-I", "-c", `import importlib.util, pathlib; print(pathlib.Path(importlib.util.find_spec("${moduleName}").origin).parent)`], root)).stdout.trim();
		assert.ok(installed.startsWith(`${root}/venv/`));
		const manifest = await json(join(installed, "lean_bridge/package-receipt.json"));
		assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.kind, "lean-bridge-owned-python-package");
		assert.deepEqual(manifest.ownedValues, verified.python.contract); await verifyNativeFiles(dirname(installed), manifest.files);
		await saveLakeFile(root, "documentation.py", documented);
		const typecheck = path => runCopied(checker, ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", command, path], root);
		const typed = await typecheck("documentation.py");
		assert.equal(typed.stderr, ""); assert.match(typed.stdout, /Success: no issues found/u);
		const invalid = 'import lean_owned_aggregates as api\nroot = api.new_ticket(1, "test")\nroot.serial = 1\nroot.get().retain_ticket()\nroot.choose_ticket(root.get())\nroot.echo_record()\n';
		await saveLakeFile(root, "invalid.py", invalid);
		await assert.rejects(typecheck("invalid.py"), error => {
			for(const line of [3, 4, 5, 6]) assert.match(error.details.stdout, new RegExp(`invalid.py:${line}: error:`));
			assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any/u); return true;
		});
		const example = await runCopied(command, ["-I", "-B", "documentation.py"], root);
		assert.equal(example.stdout, "42\n42\n"); assert.equal(example.stderr, "");
		observations.push({ name, installation, checks: result.checks
			, manifest, loader, rejectedTypes: 4, invalidSha256: sha256(invalid)
			, documentation: { sourceSha256: sha256(documented), stdout: example.stdout } });
		deployments.push({ name, root, result });
	}
	await rm(handoff, { recursive: true }); await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated"); await mkdir(relocated);
	for(const deployment of deployments)
	{
		const root = join(relocated, deployment.name); await rename(deployment.root, root);
		await assert.rejects(access(deployment.root), { code: "ENOENT" });
		const moved = await runCopied(join(root, "venv/bin/python"), ["-I", "-B", "consumer.py"], root);
		assert.equal(moved.stderr, ""); assert.deepEqual(JSON.parse(moved.stdout), deployment.result);
		observations.find(item => item.name === deployment.name).relocatedChecks = deployment.result.checks;
	}
	await saveLakeFile("build/owned-python-receivers", mode + "-package.json", canonicalJson({
		mode, metadata, model, componentReceipt, adapter, runtime: verified.runtime
		, packageSetReceipt: handoffReceipt, packages: projection.packages
		, cli: context.cli, cliInstallation: context.cliInstallation
		, builds: context.builds, verification
		, sourceRemovedBeforeInstall: true, cliRemovedBeforeConsumerInstall: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true, independentRebuild: true
		, rejected, incapableReadersRejected: 4, observations, companions
		, dependencies
		, consumerSha256: sha256(source), loaderProbeSha256: sha256(loaderSource)
	}));
	t.diagnostic(`${mode}: ${observations.map(item => `${item.name} ${item.checks}+${item.relocatedChecks}`).join(", ")} installed and relocated receiver checks`);
});
