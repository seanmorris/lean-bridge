/**
 * Original Composer collections under relocated, compiler-free PHP consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { collectionReviewedIr, collectionSignatures, writeCollectionProject } from "./helpers/collection-fixture.mjs";
import { phpCollectionConsumer, phpCollectionRequest, phpCollectionDocumentation } from "./helpers/php-collection-fixture.mjs";
import { probePhpCollections } from "./helpers/php-collection-faults.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpCorpus } from "./helpers/type-corpus-php.mjs";

const type = value => value.kind === "primitive" ? value.name : value.kind === "array"
	? { array: type(value.element) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed native PHP collections preserve original records and nested arrays on both source paths", { skip: process.env.LEAN_BRIDGE_PHP_COLLECTION_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [];
	const environment = { ...nativeFixtureEnvironment(["php-native"])
		, LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php"
		, LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-collection-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-collection-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await writeCollectionProject(projectRoot);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Collections"]
			, targets: { "php-native": { name: "lean-bridge-collections/api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: collectionSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(collectionReviewedIr()));
		t.diagnostic(`${path}: compiling all 35 collection exports for native PHP`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(collectionSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline Composer installation, then source-free weak/strict execution`);
		const installed = await installedPhpCorpus({ library: { phpModule: "LeanCollections" }
			, consumer, handoff, pkg, environment
			, clean: copiedCleanEnvironment, sourcePath: path
			, fixture: { source: phpCollectionConsumer, request: phpCollectionRequest, removeHandoff: true } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		for(const execution of installed.php.executions)
		{
			assert.ok(execution.observation.checks > 100000); assert.ok(execution.observation.calls > 4000);
			assert.equal(execution.observation.primitives.length, 19); assert.equal(execution.observation.records, 7);
			assert.ok(execution.observation.rejections > 50);
			assert.equal(execution.observation.documentation, phpCollectionDocumentation().stdout);
			for(const [file, hash] of Object.entries(execution.observation.native_libraries)) assert.equal(hash, installed.php.packageReceipt.files[file].sha256);
			t.diagnostic(`${path}/${execution.mode}: ${execution.observation.checks} assertions across ${execution.observation.calls} public calls`);
		}
		const faults = await probePhpCollections({ consumer, environment, installed, projection: compileCopiedPhpModel(model.bindingIr) });
		t.diagnostic(`${path}: ${faults.failures} injected failures and ${faults.partialInputCases} partial-input failures released all tracked owners`);
		reports.push({ profile: "php-native", path, signatures
			, ...installed, faults, documentation: phpCollectionDocumentation()
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_COLLECTION_REPORT ?? "build/collections/php-native.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
