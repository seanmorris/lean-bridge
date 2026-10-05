/**
 * Named Rust enums through installed ordinary and independently reviewed crates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { installRustVariants } from "./helpers/rust-variant-install.mjs";

const shape = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed Rust variants retain enum identity, ownership and source-free execution", { skip: process.env.LEAN_BRIDGE_RUST_VARIANT_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["rust"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-rust-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-rust-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra"]
			, targets: { cargo: { name: "variants-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: cVariantSignatures().map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(cVariantReviewedIr()));
		t.diagnostic(`${path}: compiling named Rust variants`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(shape(model.bindingIr), shape(cVariantReviewedIr()));
		const nativeFaults = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(canonicalJson(receipt));
		const dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment });
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline consumer without producer files or Lean/C compilation`);
		const observation = await installRustVariants({ consumer, handoff, packages: receipt.packages, dependencies, environment, projection: compileCopiedRustModel(model.bindingIr) });
		reports.push({ profile: "rust", path, ...observation, nativeFaults
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256, sourceRemovedBeforeInstallation: true });
		t.diagnostic(`${path}: ${observation.checks} public assertions, ${observation.faultChecks} allocation/panic failures recovered`);
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].nativeLibraries, reports[1].nativeLibraries);
	await saveLakeFile("build/variants", "rust.json", canonicalJson({ schemaVersion: 1, reports }));
});
