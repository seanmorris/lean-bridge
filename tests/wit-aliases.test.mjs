/**
 * Install named alias contracts and execute the packaged Wasmtime component.
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
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { validateWitAliasSignatures, witAliasConsumer, witAliasNames, checkWitAliasManifest } from "./helpers/wit-alias-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedWitCorpus } from "./helpers/type-corpus-wit.mjs";

test("installed WIT aliases preserve named contracts and target values on both source paths", { skip: process.env.LEAN_BRIDGE_WIT_ALIAS_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["wit-wasi"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-alias-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"]
			, targets: { "wit-wasi": { name: "aliases", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		t.diagnostic(`${path}: compiling 31 Lean alias exports, component and native Wasmtime host`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const expected = nativeAliasReviewedIr();
		const contracts = ir => ir.types.map(type => ({ id: type.id
			, name: type.name, kind: type.kind, target: type.target
			, fields: type.fields.map(field => ({ name: field.name, type: field.type })) })).sort((a, b) => a.id.localeCompare(b.id));
		assert.deepEqual(contracts(model.bindingIr), contracts(expected));
		const bindingManifest = JSON.parse(await readFile(join(outputRoot, "native/wit-adapter/binding-manifest.json")));
		checkWitAliasManifest(bindingManifest, model.bindingIr);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline installation, relocation and two compiler-free executions`);
		const installed = await installedWitCorpus({ library: { cModule: "aliases" }
			, consumer, handoff, pkg, environment, clean: copiedCleanEnvironment
			, fixture: { source: await witAliasConsumer(), validateSignatures: validateWitAliasSignatures, removeHandoff: true } })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.equal(installed.observation.checks, 409138);
		assert.equal(installed.observation.primitives, 19); assert.equal(installed.observation.aliases, 27);
		assert.equal(installed.observation.rejections, 43); assert.equal(installed.observation.copiesSurviveSessionClose, true);
		assert.equal(installed.wit.packageReceipt.files["binding-manifest.json"].sha256, sha256(canonicalJson(bindingManifest)));
		t.diagnostic(`${path}: ${installed.observation.checks} assertions; ${installed.observation.rejections} rejected calls and recovery`);
		reports.push({ profile: "wit-wasi", path
			, contracts: contracts(model.bindingIr), bindingManifest
			, aliasNames: witAliasNames
			, ...installed, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/aliases", "wit.json", canonicalJson({ schemaVersion: 1, reports }));
});
