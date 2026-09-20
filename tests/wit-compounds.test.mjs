/**
 * Installed WIT/WASI copied compounds on ordinary-source and reviewed-IR paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { validateWitCompoundSignatures, witCompoundConsumer } from "./helpers/wit-compound-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedWitCorpus } from "./helpers/type-corpus-wit.mjs";

const type = value => value.kind === "primitive" ? value.name : ["array", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed WIT compounds preserve copied values on both source paths", { skip: process.env.LEAN_BRIDGE_WIT_COMPOUND_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["wit-wasi"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-wit-compound-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-wit-compound-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-compounds", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Compounds"]
			, targets: { "wit-wasi": { name: "compounds", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: compoundSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(compoundReviewedIr()));
		t.diagnostic(`${path}: compiling 64 Lean exports, WIT component and native Wasmtime host`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(compoundSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing offline and executing twice after relocation and source removal`);
		const installed = await installedWitCorpus({ library: { cModule: "compounds" }
			, consumer, handoff, pkg, environment, clean: copiedCleanEnvironment
			, fixture: { source: await witCompoundConsumer(), validateSignatures: validateWitCompoundSignatures, removeHandoff: true } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		assert.ok(installed.observation.checks > 30000);
		assert.equal(installed.observation.primitives, 19);
		assert.ok(installed.observation.rejections >= 80);
		assert.equal(installed.observation.copiesSurviveSessionClose, true);
		t.diagnostic(`${path}: ${installed.observation.checks} assertions and ${installed.observation.rejections} rejected calls passed`);
		reports.push({ profile: "wit-wasi", path, signatures
			, ...installed, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_WIT_COMPOUND_REPORT ?? "build/compounds/wit.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
