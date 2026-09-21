/**
 * Installed native PHP aliases under weak and strict callers on both source paths.
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
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { phpAliasConsumer, phpAliasRequest, checkPhpAliasFiles } from "./helpers/php-alias-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpCorpus } from "./helpers/type-corpus-php.mjs";
import { probePhpAliases } from "./helpers/php-alias-probe.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, representation: type.representation, mutability: type.mutability
		, typeParameters: type.typeParameters, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed native PHP aliases preserve named contracts and target semantics on both source paths", { skip: process.env.LEAN_BRIDGE_PHP_ALIAS_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [];
	const environment = { ...nativeFixtureEnvironment(["php-native"]), LEAN_BRIDGE_PHP: process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", LEAN_BRIDGE_COMPOSER: process.env.LEAN_BRIDGE_COMPOSER ?? "/usr/bin/composer" };
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-alias-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"]
			, targets: { "php-native": { name: "lean-bridge-aliases/api", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		t.diagnostic(`${path}: compiling native PHP aliases from the unchanged shared Lean fixture`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-native"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(nativeAliasReviewedIr()));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(item => item.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing offline, removing the handoff and running relocated weak/strict callers`);
		const installed = await installedPhpCorpus({ library: { phpModule: "LeanAliases" }
			, consumer, handoff, pkg, environment
			, clean: copiedCleanEnvironment, sourcePath: path
			, fixture: { source: phpAliasConsumer, request: phpAliasRequest, removeHandoff: true } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const packageRoot = join(consumer, "php-native/relocated/vendor", pkg.name);
		const files = Object.fromEntries(await Promise.all(["src/Api.php", "README.md", "binding-manifest.json"].map(async file => [file, await readFile(join(packageRoot, file), "utf8")])));
		const catalog = checkPhpAliasFiles(files, path);
		for(const execution of installed.php.executions)
		{
			assert.ok(execution.observation.checks > 5000); assert.equal(execution.observation.primitives.length, 19);
			assert.equal(execution.observation.aliases, 27); assert.equal(Object.keys(execution.observation.native_libraries).length, 4);
			for(const [file, hash] of Object.entries(execution.observation.native_libraries)) assert.equal(hash, installed.php.packageReceipt.files[file].sha256);
			t.diagnostic(`${path}/${execution.mode}: ${execution.observation.checks} public assertions passed`);
		}
		const faults = await probePhpAliases({ consumer, environment, installed, projection: compileCopiedPhpModel(model.bindingIr, { lists: true }) });
		t.diagnostic(`${path}: ${faults.failures} injected conversion failures and ${faults.realFailureCases} real failure cases passed`);
		reports.push({ profile: "php-native", path, catalog
			, contract: contract(model.bindingIr), ...installed, faults
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].catalog, reports[1].catalog);
	assert.deepEqual(reports[0].observation.native_libraries, reports[1].observation.native_libraries);
	await saveLakeFile("build/aliases", "php-native.json", canonicalJson({ schemaVersion: 1, reports }));
});
