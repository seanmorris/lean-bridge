/**
 * Installed wasm32 alias packages in offline Node, Composer and Chromium apps.
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
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpWasmCorpus } from "./helpers/type-corpus-php-wasm-install.mjs";
import { phpWasmAliasSettings, phpWasmAliasConsumer, phpWasmAliasRequest, phpWasmAliasContract, checkPhpWasmAliasFiles } from "./helpers/php-wasm-alias-fixture.mjs";

test("installed PHP-Wasm aliases preserve named contracts and wasm32 values on both source paths", { skip: process.env.LEAN_BRIDGE_PHP_WASM_ALIAS_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-alias-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"], targets: { "php-wasm": phpWasmAliasSettings }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(entry => entry.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		const environment = nativeFixtureEnvironment(["php-wasm"]);
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		t.diagnostic(`${path}: compiling the 31-export alias library for wasm32`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json")));
		assert.equal(model.pointerBits, 32);
		assert.deepEqual(phpWasmAliasContract(model.bindingIr), phpWasmAliasContract(nativeAliasReviewedIr()));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const packageSet = JSON.parse(await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json")));
		await rm(author, { recursive: true, force: true });
		const installed = await installedPhpWasmCorpus({ t, library: { id: "aliases" }
			, consumer, handoff, receipt, packageSet, environment
			, clean: { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
				, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
				, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" }
			, sourcePath: path
			, fixture: { settings: phpWasmAliasSettings, source: phpWasmAliasConsumer
				, request: phpWasmAliasRequest, removeHandoff: true } })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const npmRoot = join(consumer, "relocated/node_modules", phpWasmAliasSettings.npm.name);
		const composerRoot = join(consumer, "relocated/vendor", phpWasmAliasSettings.composer.name);
		const files = Object.fromEntries(await Promise.all(["src/Api.php", "copied-zend-manifest.json"].map(async name => [name, await readFile(join(npmRoot, "compiled", name), "utf8")])));
		const catalog = checkPhpWasmAliasFiles(files, path);
		const embedded = await readFile(join(npmRoot, "php/lean-bridge/aliases.json"), "utf8");
		assert.equal(embedded, await readFile(join(composerRoot, "lean-bridge/aliases.json"), "utf8"));
		const sorted = aliases => [...aliases].sort((a, b) => a.id.localeCompare(b.id));
		assert.deepEqual(sorted(JSON.parse(embedded).aliases), catalog.aliases);
		assert.deepEqual(sorted(JSON.parse(await readFile(join(composerRoot, "lean-bridge/compiled-package.json"))).aliases), catalog.aliases);
		const readme = await readFile(join(npmRoot, "README.md"), "utf8");
		assert.equal(readme, await readFile(join(composerRoot, "README.md"), "utf8"));
		for(const alias of catalog.aliases) assert.ok(readme.includes(`| \`${alias.name}\` |`));
		assert.equal(installed.phpWasm.executions.length, 12);
		for(const execution of installed.phpWasm.executions)
		{
			assert.ok(execution.observation.checks > 5000); assert.equal(execution.observation.word_bits, 32);
			assert.equal(execution.observation.primitives.length, 19); assert.equal(execution.observation.aliases, 27);
			assert.equal(execution.phases.at(-1).libraries.length, 2);
			const initial = execution.loading === "lazy" ? 0 : 2;
			assert.ok(execution.phases.slice(0, -1).every(phase => phase.libraries.length === initial));
		}
		t.diagnostic(`${path}: ${installed.observation.checks} public assertions in each of 12 execution modes, repeated after relocation`);
		reports.push({ path, profile: "php-wasm", catalog
			, contract: phpWasmAliasContract(model.bindingIr)
			, ...installed, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].catalog, reports[1].catalog);
	await saveLakeFile("build/aliases", "php-wasm.json", canonicalJson({ schemaVersion: 1, reports }));
});
