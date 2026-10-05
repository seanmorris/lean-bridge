/**
 * Named variants in original, relocated WIT archives on both compiler paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { witVariantReviewedIr, witVariantSignatures, validateWitVariantSignatures, checkWitVariantManifest, witVariantConsumer } from "./helpers/wit-variant-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedWitCorpus } from "./helpers/type-corpus-wit.mjs";

test("installed WIT variants preserve every named constructor and payload", { skip: process.env.LEAN_BRIDGE_WIT_VARIANT_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["wit-wasi"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await cp("tests/fixtures/variant-consumers/WitVariants.lean", join(projectRoot, "WitVariants.lean"));
		await saveLakeFile(projectRoot, "lakefile.toml", `${await readFile(join(projectRoot, "lakefile.toml"), "utf8")}\n[[lean_lib]]\nname = "WitVariants"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra", "WitVariants"]
			, targets: { "wit-wasi": { name: "variants", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: witVariantSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(witVariantReviewedIr()));
		t.diagnostic(`${path}: compiling nineteen variant exports and the Wasmtime component host`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const contracts = ir => ({
			declarations: ir.declarations.map(fn => ({ id: fn.id, parameters: fn.parameters.map(site => site.type), result: fn.result.type })).sort((a, b) => a.id.localeCompare(b.id))
			, types: ir.types.map(type => ({ id: type.id
				, name: type.name, kind: type.kind
				, target: type.target
				, fields: type.fields.map(({ name, type }) => ({ name, type }))
				, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
		});
		assert.deepEqual(contracts(model.bindingIr), contracts(witVariantReviewedIr()));
		const bindingManifest = JSON.parse(await readFile(join(outputRoot, "native/wit-adapter/binding-manifest.json")));
		checkWitVariantManifest(bindingManifest, model.bindingIr);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		const installed = await installedWitCorpus({ library: { cModule: "variants" }
			, consumer, handoff, pkg, environment, clean: copiedCleanEnvironment
			, fixture: { source: await witVariantConsumer(), validateSignatures: validateWitVariantSignatures, removeHandoff: true } })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.ok(installed.observation.checks > 10000); assert.ok(installed.observation.rejections > 40);
		assert.equal(installed.observation.primitives, 19); assert.equal(installed.observation.families, 10); assert.equal(installed.observation.constructors, 281);
		assert.equal(installed.observation.wideCases, 257); assert.equal(bindingManifest.aliases.length, 2);
		assert.equal(installed.observation.copiesSurviveSessionClose, true);
		t.diagnostic(`${path}: ${installed.observation.checks} assertions, ${installed.observation.calls} calls, ${installed.observation.rejections} rejections`);
		reports.push({ profile: "wit-wasi", path
			, contracts: contracts(model.bindingIr), bindingManifest
			, ...installed
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/variants", "wit.json", canonicalJson({ schemaVersion: 1, reports }));
});
