/**
 * Exercise all nineteen owned scalar fields through original installed wheels.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));
for(const mode of ["ordinary", "reviewed"]) test(`installed owned Python scalars preserve every primitive (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 900000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-owned-python-scalars-${mode}-`));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const project = join(directory, "source"), output = join(directory, "producer"), handoff = join(directory, "handoff");
	await cp(resolve("tests/fixtures/onboarding/owned-scalars"), project, { recursive: true });
	const config = mode === "ordinary" ? await json(join(project, "lean-bridge.exports.json")) : { schemaVersion: 1, modules: ["Owned"] };
	config.targets = { pypi: { name: "owned-scalar-values", version: "1.2.3" } };
	await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson(config));
	if(mode === "reviewed")
	{
		const ir = ownedPythonScalarsReviewedIr();
		ir.component = { ...ir.component, id: "owned-scalars@1.0.0", name: "owned-scalars", version: "1.0.0" };
		await saveLakeFile(project, "api.binding-ir.json", canonicalJson(ir));
	}
	const before = await lakeInputState(project);
	const interpreters = JSON.parse(process.env.LEAN_BRIDGE_COLLECTION_PYTHONS ?? JSON.stringify([resolve(".toolchains/python311/bin/python3.11"), resolve(".toolchains/python312/bin/python3.12")]));
	const environment = { ...nativeFixtureEnvironment(["python"]), LEAN_BRIDGE_PYTHON: interpreters[0] };
	let built;
	try
	{ built = await buildCanonicalProject({ projectRoot: project, outputRoot: output, targets: ["pypi"], environment }); }
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.deepEqual(await lakeInputState(project), before);
	assert.equal(built.backend, "owned-python-v1");
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime"), adapterRoot = join(output, "native/owned-c-binding");
	const verified = await ownedPythonEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(verified.model.exports.length, 8);
	assert.equal(verified.python.types.find(type => type.name === "Scalars").fields.length, 19);
	assert.equal(Boolean(verified.model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	const input = { metadata: await json(join(nativeRoot, "metadata.json")), sourceIdentity: verified.model.sourceIdentity, component: verified.model.component };
	const receipt = await copyPackageSetHandoff(output, handoff);
	await rm(project, { recursive: true, force: true }); await rm(output, { recursive: true, force: true });
	await assert.rejects(access(project), { code: "ENOENT" }); await assert.rejects(access(output), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const archive = join(handoff, receipt.packages.find(item => item.target === "pypi").artifacts[0].path);
	const source = (await readFile("tests/fixtures/structured-types/owned-installed-python-scalars.py", "utf8")).replace("__PACKAGE__", built.moduleName);
	const observations = [];
	for(const [name, python, typingVersion] of [["3.11-minimum", interpreters[0], "4.6.0"], ["3.11-current", interpreters[0], "4.16.0"], ["3.12-standard", interpreters[1], null]])
	{
		const root = join(directory, "consumer", name);
		const { command, ...installation } = await installPythonWheel({ root, archive, python, typingVersion });
		await saveLakeFile(root, "consumer.py", source);
		const executed = await runCopied(command, ["-I", "-B", "consumer.py"], root);
		assert.equal(executed.stderr, ""); const result = JSON.parse(executed.stdout);
		assert.equal(result.primitives, 19); assert.equal(result.ordinaryImport, true);
		assert.ok(result.checks >= 140);
		observations.push({ name, installation, result });
	}
	await rm(handoff, { recursive: true, force: true });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	const relocated = join(directory, "relocated"); await mkdir(relocated);
	for(const observation of observations)
	{
		const previous = join(directory, "consumer", observation.name), root = join(relocated, observation.name);
		await rename(previous, root); await assert.rejects(access(previous), { code: "ENOENT" });
		const moved = await runCopied(join(root, "venv/bin/python"), ["-I", "-B", "consumer.py"], root);
		assert.equal(moved.stderr, ""); assert.deepEqual(JSON.parse(moved.stdout), observation.result);
		observation.relocatedChecks = observation.result.checks;
	}
	await saveLakeFile(resolve("build/owned-python-packaging"), `scalars-${mode}.json`, canonicalJson({
		schemaVersion: 1, planNode: 1219, mode, compiledLean: true
		, installedPackage: true, sourceUnchanged: true, sourceFreeInstallation: true
		, sourceFreeRelocatedExecution: true
		, handoffRemovedBeforeRelocatedExecution: true
		, ordinaryImport: true, primitives: 19, input
		, consumerSha256: sha256(source), observations
		, componentReceipt: verified.receipt, adapterReceipt: verified.adapter
		, packageSetReceipt: receipt, bindingIr: verified.model.bindingIr
	}));
	t.diagnostic(`${mode}: ${observations.map(item => `${item.name} ${item.result.checks}+${item.relocatedChecks}`).join(", ")} scalar checks`);
});
