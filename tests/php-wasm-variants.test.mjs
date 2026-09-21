/**
 * Original wasm32 npm and Composer variant packages on both source paths.
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
import { phpVariantReviewedIr, phpVariantSignatures } from "./helpers/php-variant-fixture.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpWasmCorpus } from "./helpers/type-corpus-php-wasm-install.mjs";
import { phpWasmVariantSettings, phpWasmVariantConsumer, phpWasmVariantRequest, phpWasmVariantContract } from "./helpers/php-wasm-variant-fixture.mjs";

test("installed PHP-Wasm variants preserve named constructors in Node, Composer and Chromium", { skip: process.env.LEAN_BRIDGE_PHP_WASM_VARIANT_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await cp("tests/fixtures/variant-consumers/PhpVariants.lean", join(projectRoot, "PhpVariants.lean"));
		await saveLakeFile(projectRoot, "lakefile.toml", `${await readFile(join(projectRoot, "lakefile.toml"), "utf8")}\n[[lean_lib]]\nname = "PhpVariants"\n`);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra", "PhpVariants"]
			, targets: { "php-wasm": phpWasmVariantSettings }
			, ...(path === "ordinary-source" ? { exports: phpVariantSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(phpVariantReviewedIr()));
		const environment = nativeFixtureEnvironment(["php-wasm"]);
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		t.diagnostic(`${path}: compiling fourteen variant exports for wasm32 with the explicit PHP echo wrapper`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json")));
		assert.equal(model.pointerBits, 32);
		assert.deepEqual(phpWasmVariantContract(model.bindingIr), phpWasmVariantContract(phpVariantReviewedIr()));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const packageSet = JSON.parse(await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json")));
		await rm(author, { recursive: true, force: true });
		const installed = await installedPhpWasmCorpus({ t
			, library: { id: "variants" }
			, consumer, handoff, receipt, packageSet
			, environment
			, clean: { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php"
				, LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler"
				, LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" }
			, sourcePath: path
			, fixture: { settings: phpWasmVariantSettings, source: phpWasmVariantConsumer
				, request: phpWasmVariantRequest, removeHandoff: true } })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const npmRoot = join(consumer, "relocated/node_modules", phpWasmVariantSettings.npm.name);
		const composerRoot = join(consumer, "relocated/vendor", phpWasmVariantSettings.composer.name);
		const readme = await readFile(join(npmRoot, "README.md"), "utf8");
		assert.equal(readme, await readFile(join(composerRoot, "README.md"), "utf8"));
		assert.match(readme, /Tagged variants/);
		assert.equal(installed.phpWasm.executions.length, 12);
		for(const execution of installed.phpWasm.executions)
		{
			assert.ok(execution.observation.checks > 20000 && execution.observation.calls > 4000 && execution.observation.rejected > 50);
			assert.equal(execution.observation.word_bits, 32);
			assert.equal(execution.observation.primitives.length, 19);
			assert.equal(execution.observation.families, 7); assert.equal(execution.observation.constructors, 18);
			assert.equal(execution.phases.at(-1).libraries.length, 2);
			const initial = execution.loading === "lazy" ? 0 : 2;
			assert.ok(execution.phases.slice(0, -1).every(phase => phase.libraries.length === initial));
		}
		t.diagnostic(`${path}: ${installed.observation.checks} public assertions and ${installed.observation.rejected} rejected inputs in each of 12 execution modes, repeated after relocation`);
		reports.push({ path, profile: "php-wasm"
			, contract: phpWasmVariantContract(model.bindingIr)
			, ...installed
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, sourceRemovedBeforeInstallation: true
			, handoffRemovedBeforeExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(reports[0].contract, reports[1].contract);
	await saveLakeFile("build/variants", "php-wasm.json", canonicalJson({ schemaVersion: 1, reports }));
});
