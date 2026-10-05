/**
 * Verify original Python wheels after removing producer sources and build tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { readVerifiedNativeComponent, verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { projectOwnedNativeCFamily } from "../src/build/owned-c-projection.mjs";
import { packageOwnedPython } from "../src/release/owned-pypi.mjs";
import { writeNativePackageSet } from "../src/release/package-set-assembly.mjs";
import { prepareOwnedReceiverCli } from "./helpers/owned-receiver-cli.mjs";
import { ownedPythonCallbackResultConfiguration, ownedPythonCallbackResultReviewedIr
	, ownedPythonCallbackResultSource, ownedPythonCallbackResultCombinedConfiguration
	, ownedPythonCallbackResultCombinedReviewedIr, ownedPythonCallbackResultCombinedSource } from "./helpers/owned-python-callback-result-fixture.mjs";
import { ownedPythonInstalledProbe } from "./helpers/owned-python-installed-probes.mjs";
import { ownedPythonCallbackInstalledProbe } from "./helpers/owned-python-callback-result-installed.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) for(const combined of [false, true])
test(`installed Python callback-result wheel (${mode}, ${combined ? "combined" : "no-host"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PYTHON_CALLBACK_RESULT_TEST !== "1"
	, timeout: 1800000
}, async t => {
	const authored = combined ? ownedPythonCallbackResultCombinedConfiguration : ownedPythonCallbackResultConfiguration;
	const reviewed = combined ? ownedPythonCallbackResultCombinedReviewedIr : ownedPythonCallbackResultReviewedIr;
	const configuration = mode === "ordinary" ? await authored() : { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { pypi: { name: "owned-callback-results", version: "1.2.3" } };
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	assert.equal(interpreters.length, 2);
	const context = await prepareOwnedReceiverCli(t, {
		label: `python-callback-installed-${mode}-${combined}`, configuration
		, reviewedIr: mode === "reviewed" ? reviewed() : null
		, source: combined ? ownedPythonCallbackResultCombinedSource : ownedPythonCallbackResultSource
		, profiles: ["python"], environment: { LEAN_BRIDGE_PYTHON: interpreters[0] }
	});
	const { directory, project, output, handoff, consumer, environment } = context;
	const before = await lakeInputState(project);
	const build = async destination => {
		if(combined) return context.build(destination);
		const runtimeRoot = join(destination, "native/runtime"), nativeRoot = join(destination, "native/component");
		const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		const native = await buildNativeComponent({ projectRoot: project
			, outputRoot: nativeRoot, runtimeRoot, leanPrefix, targets: ["pypi"]
			, ownedGraphs: true, ownedHostCallbacks: false
			, ownedCallbackResultAnchors: true });
		const projections = await projectOwnedNativeCFamily({ working: destination
			, nativeRoot, runtimeRoot, leanPrefix, targets: ["pypi"]
			, settings: configuration.targets, environment });
		await writeNativePackageSet({ root: destination, model: native.model
			, runtimeIdentity: native.receipt.runtimeIdentity, projections });
		context.builds.push({ producerInterface: "native-build-api", projections });
		assert.deepEqual(await lakeInputState(project), before);
		return projections[0];
	};
	const built = await build(output), projection = built.projections?.find(item => item.ecosystem === "pypi") ?? built;
	assert.equal(projection.backend, "owned-python-v5");
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const adapterRoot = join(output, "native/owned-c-binding");
	const verified = await ownedPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const { model, receipt, adapter } = verified;
	assert.equal(model.schemaVersion, 11); assert.equal(receipt.schemaVersion, 7);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const key of ["hostCallbacks", "resultAnchors", "receiverExports", "inputTransfers"])
		assert.equal(Boolean(model.ownedGraph[key]), combined, key);
	if(!combined) await assert.rejects(access(join(nativeRoot, "callbacks.c")), { code: "ENOENT" });
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	assert.equal(adapter.schemaVersion, 7); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.equal(adapter.pythonValues.schemaVersion, 5);
	const metadata = await json(join(nativeRoot, "metadata.json"));
	const capabilities = { ownedGraphs: true, ownedHostCallbacks: combined
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined, ownedCallbackResultAnchors: true };
	const incapable = ["ownedCallbackResultAnchors", ...combined ? ["ownedHostCallbacks", "ownedInputTransfers", "ownedAnchoredResults", "ownedReceiverExports"] : []];
	for(const key of incapable)
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
	const independent = join(directory, "independent"), second = await build(independent);
	const secondProjection = second.projections?.find(item => item.ecosystem === "pypi") ?? second;
	assert.deepEqual(secondProjection.packages, projection.packages);
	assert.deepEqual(await readFile(join(independent, "archives", projection.packages[0].archive)), original);
	await rm(independent, { recursive: true });
	let rejected = 0;
	for(const mutate of [
		value => { delete value.ownedValues.callbackResultAnchors; }
		, value => { value.ownedValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.ownedValues.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.ownedValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.ownedValues.callbackResultAnchors.expiration = "never"; }
		, value => { value.ownedValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.ownedValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.schemaVersion = 6; value.ownedValues.schemaVersion = 5; }
		, value => { delete value.pythonValues.callbackResultAnchors; }
		, value => { value.pythonValues.callbackResultAnchors.signatures.pop(); }
		, value => { value.pythonValues.callbackResultAnchors.signatures[0].parameter++; }
		, value => { value.pythonValues.callbackResultAnchors.anchor = "closure-owner"; }
		, value => { value.pythonValues.callbackResultAnchors.parameterNumbering = "includes-closure"; }
		, value => { value.pythonValues.callbackResultAnchors.hostReply = "unchecked"; }
		, value => { value.pythonValues.callbackResultAnchors.hostResultHandoff = "after-frame"; }
		, value => { value.pythonValues.callbackResultAnchors.descendants = "independent"; }
		, value => { value.pythonValues.callbackResultAnchors.emptyValues = "unowned"; }
		, value => { value.pythonValues.schemaVersion = 4; }
	]) {
		const changed = structuredClone(adapter); mutate(changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(changed));
		try
		{ await assert.rejects(packageOwnedPython({ ...packageOptions, working: join(directory, `forged-${rejected}`) }), /compiler-authenticated/u); }
		finally
		{ await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter)); }
		rejected++;
	}
	for(const path of [`src/${verified.prefix}.c`, "internal/python-abi.h", `lib/${adapter.library}`])
	{
		const source = await readFile(join(adapterRoot, path)), changed = Buffer.concat([source, Buffer.from("\n/* changed callback ownership */\n")]);
		const forged = structuredClone(adapter);
		if(!path.startsWith("lib/")) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(forged));
		try
		{ await assert.rejects(packageOwnedPython({ ...packageOptions, working: join(directory, `forged-${rejected}`) })); }
		finally
		{ await saveLakeFile(adapterRoot, path, source); await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter)); }
		rejected++;
	}
	const handoffReceipt = await copyPackageSetHandoff(output, handoff);
	const verification = await context.removeAuthor();
	const pkg = handoffReceipt.packages.find(item => item.target === "pypi" && item.role === "component");
	const archive = join(handoff, pkg.artifacts[0].path), moduleName = projection.moduleName;
	assert.equal(sha256(await readFile(archive)), pkg.artifacts[0].sha256);
	const source = await ownedPythonCallbackInstalledProbe(combined);
	const loaderSource = ownedPythonInstalledProbe.replaceAll("compatible.serial(ticket)", "compatible.serial(ticket.get())")
		.replaceAll("module.serial(value)", "module.serial(value.get())").replaceAll("api.serial(ticket)", "api.serial(ticket.get())");
	const documented = await readFile("tests/fixtures/documentation/consumers/python/owned-callback-results.py", "utf8");
	assert.equal((await readFile("docs/consume/python.md", "utf8")).match(/```python file=python\/owned-callback-results\.py\n([\s\S]*?)```/u)?.[1], documented);
	const observations = [], deployments = [];
	const checker = resolve(process.env.LEAN_BRIDGE_COLLECTION_MYPY_PYTHON ?? "build/python-collection-typecheck/bin/python");
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const root = join(consumer, name), { command, ...installation } = await installPythonWheel({ root, archive, python, typingVersion });
		await saveLakeFile(root, "consumer.py", source);
		const executed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.equal(result.ordinaryImport, true); assert.ok(result.checks > 250);
		assert.equal(result.scenarios.length, combined ? 8 : 6);
		await saveLakeFile(root, "loader-probe.py", loaderSource);
		const probe = await runCopied(command, ["-I", "-B", "loader-probe.py"], root);
		assert.equal(probe.stderr, ""); const loader = JSON.parse(probe.stdout);
		assert.deepEqual(loader.consumer, result); assert.equal(loader.liveIdentities, 0);
		assert.equal(loader.runtimeInitializations, 1); assert.equal(loader.componentInitializations, 1);
		const installed = (await runCopied(command, ["-I", "-c", `import importlib.util, pathlib; print(pathlib.Path(importlib.util.find_spec("${moduleName}").origin).parent)`], root)).stdout.trim();
		assert.ok(installed.startsWith(`${root}/venv/`));
		const manifest = await json(join(installed, "lean_bridge/package-receipt.json"));
		assert.equal(manifest.schemaVersion, 6); assert.equal(manifest.kind, "lean-bridge-owned-python-package");
		assert.deepEqual(manifest.ownedValues, verified.python.contract);
		await verifyNativeFiles(dirname(installed), manifest.files);
		await saveLakeFile(root, "documentation.py", documented);
		const typecheck = path => runCopied(checker, ["-I", "-m", "mypy", "--strict", "--no-incremental", "--cache-dir=/dev/null", "--python-executable", command, path], root);
		const typed = await typecheck("documentation.py");
		assert.equal(typed.stderr, ""); assert.match(typed.stdout, /Success: no issues found/u);
		const invalid = 'import lean_owned_aggregates as api\ndef invalid(root: api.Value[api.Bundle], ticket: api.Value[api.Ticket]) -> None:\n    callback = api.make_record(root.get())\n    callback(False, root.get())\n    callback(False, ticket)\n    wrong: api.Bundle = callback(False, root)\n';
		await saveLakeFile(root, "invalid.py", invalid);
		await assert.rejects(typecheck("invalid.py"), error => {
			for(const line of [4, 5, 6]) assert.match(error.details.stdout, new RegExp(`invalid.py:${line}: error:`));
			assert.doesNotMatch(error.details.stdout, /import-not-found|import-untyped|no-any|syntax error/iu); return true;
		});
		const example = await runCopied(command, ["-I", "-B", "documentation.py"], root);
		assert.equal(example.stdout, "42\n42\n"); assert.equal(example.stderr, "");
		observations.push({ name, installation, checks: result.checks
			, scenarios: result.scenarios
			, manifest, loader, rejectedTypes: 3, invalidSha256: sha256(invalid)
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
	await saveLakeFile("build/owned-python-callback-results", `${mode}-${combined ? "combined" : "no-host"}-package.json`, canonicalJson({
		mode, combined, metadata, model, componentReceipt: receipt
		, adapter, runtime: verified.runtime
		, packageSetReceipt: handoffReceipt, packages: projection.packages
		, cli: context.cli, cliInstallation: context.cliInstallation
		, builds: context.builds, verification
		, producerInterface: combined ? "installed-cli" : "native-build-api"
		, sourceRemovedBeforeInstall: true, cliRemovedBeforeConsumerInstall: true
		, sourceFreeInstallation: true, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, deterministicReassembly: true, independentRebuild: true
		, rejected, incapableReadersRejected: incapable.length, observations
		, consumerSha256: sha256(source), loaderProbeSha256: sha256(loaderSource)
	}));
	t.diagnostic(`${mode}-${combined ? "combined" : "no-host"}: ${observations.map(item => `${item.name} ${item.checks}+${item.relocatedChecks}`).join(", ")} installed and relocated checks`);
});
