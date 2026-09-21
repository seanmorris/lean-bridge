/**
 * Original RubyGems variants from ordinary Lean and independent reviewed IR.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { rubyVariantReviewedIr, rubyVariantSignatures } from "./helpers/ruby-variant-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installRubyVariants } from "./helpers/ruby-variant-install.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed Ruby variants preserve every named constructor and compiler-free execution", { skip: process.env.LEAN_BRIDGE_RUBY_VARIANT_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["ruby"]);
	environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
	environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await cp("tests/fixtures/variant-consumers/RubyVariants.lean", join(projectRoot, "RubyVariants.lean"));
		await saveLakeFile(projectRoot, "lakefile.toml", `${await readFile(join(projectRoot, "lakefile.toml"), "utf8")}\n[[lean_lib]]\nname = "RubyVariants"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra", "RubyVariants"]
			, targets: { rubygems: { name: "variants-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: rubyVariantSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(rubyVariantReviewedIr()));
		t.diagnostic(`${path}: compiling fourteen variant exports with the explicit Ruby inspector wrapper`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["rubygems"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(rubyVariantReviewedIr()));
		const nativeFaults = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline gem installation, relocation, independent consumer and failure probes`);
		const installed = await installRubyVariants({ consumer, handoff, packages: receipt.packages, environment, projection: compileCopiedRubyModel(model.bindingIr) });
		t.diagnostic(`${path}: ${installed.checks} public assertions, ${installed.rejected} rejections and ${installed.faults.checks} injected failures passed`);
		reports.push({ path, profile: "ruby", ...installed, nativeFaults
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].nativeLibraries, reports[1].nativeLibraries);
	await saveLakeFile("build/variants", "ruby.json", canonicalJson({ schemaVersion: 1, reports }));
});
