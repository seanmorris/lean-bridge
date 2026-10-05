/**
 * Both compiler-authenticated collection paths through original C/C++ archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { collectionReviewedIr, collectionSignatures, writeCollectionProject } from "./helpers/collection-fixture.mjs";
import { nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { prepareNativeCollections } from "./helpers/native-collection-install.mjs";
import { checkNativeCollectionFaults } from "./helpers/native-collection-faults.mjs";

const type = value => value.kind === "primitive" ? value.name : value.kind === "array"
	? { array: type(value.element) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };
test("installed C/C++ arrays and records preserve values on both source paths", { skip: process.env.LEAN_BRIDGE_NATIVE_COLLECTION_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["c", "cpp"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-native-collection-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-native-collection-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await writeCollectionProject(projectRoot);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Collections"]
			, targets: { c: { name: "collections", version: "1.0.0" }, cpp: { name: "collections", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: collectionSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(collectionReviewedIr()));
		t.diagnostic(`${path}: compiling C/C++ collections`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "cpp"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(collectionSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		t.diagnostic(`${path}: native and GMP allocation/sanitizer probes`);
		const faults = await checkNativeCollectionFaults(outputRoot, join(consumer, "faults"), environment);
		await rm(author, { recursive: true, force: true });
		const prepared = [];
		for(const profile of ["c", "cpp"])
		{
			t.diagnostic(`${path}: offline install and host compilation for ${profile}`);
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			prepared.push({ profile, packages, execute: await prepareNativeCollections({ profile, consumer: join(consumer, profile), handoff, packages }) });
		}
		await rm(handoff, { recursive: true, force: true });
		for(const { profile, packages, execute } of prepared)
		{
			const observation = await execute();
			t.diagnostic(`${path}/${profile}: ${observation.runs[0].checks} assertions, ${observation.runs[0].calls} calls`);
			reports.push({ profile, path, signatures, packages
				, ...observation
				, faults: profile === "c" ? faults : { native: faults.native }
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(canonicalJson(receipt))
				, sourceRemovedBeforeInstallation: true
				, handoffRemovedBeforeExecution: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/collections", "native.json", canonicalJson({ schemaVersion: 1, reports }));
});
