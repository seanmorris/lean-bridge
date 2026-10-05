/**
 * Original Cargo collection packages from ordinary Lean and reviewed source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { compileCopiedRustModel } from "../src/backends/rust/copied-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { collectionReviewedIr, collectionSignatures, writeCollectionProject } from "./helpers/collection-fixture.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { installRustCollections } from "./helpers/rust-collection-install.mjs";

const type = value => value.kind === "primitive" ? value.name : value.kind === "array"
	? { array: type(value.element) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed Rust arrays and records preserve values on both source paths", { skip: process.env.LEAN_BRIDGE_RUST_COLLECTION_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["rust"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-rust-collection-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-rust-collection-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await writeCollectionProject(projectRoot);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Collections"]
			, targets: { cargo: { name: "collections-api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: collectionSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(collectionReviewedIr()));
		t.diagnostic(`${path}: compiling Rust collections`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cargo"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(collectionSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const dependencies = await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory: author, handoff: join(consumer, "dependencies"), environment });
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: original offline crate, typed callers, isolated failure probes and relocation`);
		const installed = await installRustCollections({ consumer, handoff, packages: receipt.packages, dependencies, environment, projection: compileCopiedRustModel(model.bindingIr) });
		reports.push({
			profile: "rust", path, signatures
			, ...installed
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(canonicalJson(receipt))
			, sourceRemovedBeforeInstallation: true });
		t.diagnostic(`${path}: ${installed.checks} public assertions, ${installed.calls} calls, ${installed.nativeFaultChecks} allocation/panic checks`);
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].nativeLibraries, reports[1].nativeLibraries);
	await saveLakeFile("build/collections", "rust.json", canonicalJson({ schemaVersion: 1, reports }));
});
