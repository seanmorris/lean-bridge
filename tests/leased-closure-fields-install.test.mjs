/**
 * Install the real Python wheel on both author routes before exercising a
 * retained Lean callable at a record field, not merely at an export result.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { ownedPythonEvidence } from "../src/build/owned-python-artifacts.mjs";
import { generateOwnedPythonValues } from "../src/backends/python/owned-values.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { installPythonWheel } from "./helpers/python-wheel-install.mjs";
import { leasedClosureFieldReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";

test("a record-only API generates the field's callable without a dummy callback export", () => {
	const review = leasedClosureFieldReviewedIr();
	review.declarations = review.declarations.filter(decl => ["echoTariff", "makeTariff"].includes(decl.name));
	review.types = review.types.filter(type => type.kind !== "resource");
	const surface = generateOwnedPythonValues(review, { hostCallbacks: false });
	const fn = surface.types.find(type => type.kind === "callback");
	assert.equal(surface.c.functions.length, 2);
	assert.equal(surface.c.callbacks.length, 1);
	assert.ok(surface.stub.includes(`quote: ${fn.publicType}`));
	assert.ok(surface.stub.includes("def __call__(self, arg0: int) -> int:"));
});

for(const route of ["ordinary", "reviewed"]) test(`installed ${route} wheel retains callable fields without promoting host borrows`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 3600000
}, async t => {
	const fixture = resolve("tests/fixtures/onboarding/leased-closure-fields");
	const python = resolve(process.env.LEAN_BRIDGE_PYTHON ?? ".toolchains/python312/bin/python3.12");
	const environment = { ...nativeFixtureEnvironment(["python"]), LEAN_BRIDGE_PYTHON: python };
	const config = JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json")));
	const probe = await readFile("tests/fixtures/structured-types/leased-closure-fields.py");
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-closure-field-"));
	try
	{
		const project = join(directory, "project"), output = join(directory, "producer"), handoff = join(directory, "handoff");
		await cp(fixture, project, { recursive: true });
		if(route === "reviewed")
		{
			await saveLakeFile(project, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: config.modules, targets: config.targets }));
			await saveLakeFile(project, "api.binding-ir.json", canonicalJson(leasedClosureFieldReviewedIr()));
		}
		const built = await buildCanonicalProject({ projectRoot: project
			, outputRoot: output, targets: ["pypi"], environment
			, onProgress: event => t.diagnostic(`${route}: ${event.message}`) });
		const projection = built.projections?.find(item => item.ecosystem === "pypi") ?? built;
		assert.equal(projection.backend, "owned-python-v1");
		const { model } = await ownedPythonEvidence({ nativeRoot: join(output, "native/component")
			, runtimeRoot: join(output, "native/runtime")
			, adapterRoot: join(output, "native/owned-c-binding") });
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), route === "reviewed");
		assert.deepEqual(model.bindingIr.aggregatePolicy.closureFields, ["Owned.Tariff.quote"]);
		const apply = model.bindingIr.declarations.find(fn => fn.name === "applyTariff");
		assert.ok(apply.effects.includes("host-call")); assert.equal(apply.failure.mode, "declared");
		const receipt = await copyPackageSetHandoff(output, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const digest = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(project, { recursive: true }); await rm(output, { recursive: true });
		const pkg = receipt.packages.find(item => item.target === "pypi" && item.role === "component");
		const root = join(directory, "consumer"), archive = join(handoff, pkg.artifacts[0].path);
		const installation = await installPythonWheel({ root, archive, python });
		await rm(handoff, { recursive: true });
		const relocated = join(directory, "relocated");
		await saveLakeFile(root, "consumer.py", probe);
		await cp("tests/fixtures/structured-types/leased-closure-field-leases.py", join(root, "inspect_leases.py"));
		await rename(root, relocated);
		const result = await runCopied(join(relocated, "venv/bin/python"), ["-I", "-B", "inspect_leases.py"], relocated);
		assert.equal(result.stdout.trim(), "leased-closure-fields: ok"); assert.equal(result.stderr, "");
		t.diagnostic(`${route} Python ${installation.python}: package-set ${digest}; consumer ${sha256(probe)}`);
	}
	finally
	{ await rm(directory, { recursive: true, force: true }); }
});
