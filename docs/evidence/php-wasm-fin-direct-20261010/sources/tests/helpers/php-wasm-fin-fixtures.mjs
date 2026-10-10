/**
 * Fin fixtures for installed PHP-Wasm packages (VO #1220, PHP-Wasm slice 1). Each wasm32 caller
 * is the fixture's native PHP consumer, unchanged except for loading and its final report, so
 * every case, snapshot comparison and recovery runs on both PHP hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { installedPhpWasmCorpus } from "./type-corpus-php-wasm-install.mjs";
import { finProductRefinements } from "./fin-product-install.mjs";
import { finRecordRefinements } from "./fin-record-install.mjs";
import { finProductReviewedIr } from "./reviewed-fin-product-fixture.mjs";
import { finRecordReviewedIr } from "./reviewed-fin-record-fixture.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";

const settings = name => ({ npm: { name: `lean-bridge-${name}-wasm`, version: "1.0.0" }, composer: { name: `lean-bridge-${name}/wasm`, version: "1.0.0" } });
/** Lean projects, expected trees and native PHP callers reused on PHP-Wasm. */
const products = {
	root: "tests/fixtures/onboarding/native-fin-products"
	, module: "FinProducts", refinements: finProductRefinements
	, review: finProductReviewedIr
	, namespace: "LeanFinproducts", operation: "first"
	, consumer: "tests/fixtures/fin-product-consumers/php-native.php"
	, settings: settings("finproducts")
};
const records = {
	root: "tests/fixtures/onboarding/native-fin-records"
	, module: "FinRecords", refinements: finRecordRefinements
	, review: finRecordReviewedIr
	, namespace: "LeanFinrecords", operation: "tile_sum"
	, consumer: "tests/fixtures/fin-record-consumers/php-native.php"
	, settings: settings("finrecords")
};
export const phpWasmFinFixtures = Object.freeze({ products, records });

/**
 * Turn a native PHP consumer into a PHP-Wasm caller: the driver loads the selected autoloader,
 * the caller strictness is set per mode, and the success line becomes a JSON observation.
 *
 * @param source - Native PHP consumer text.
 * @param mode - Weak or strict caller.
 */
export const phpWasmFinConsumer = (source, mode) => {
	const lines = source.split("\n");
	if(lines[1] !== "declare(strict_types=0);" || lines[2] !== "require 'vendor/autoload.php';" || !/^echo "[a-z-]+-ok:\$checks\\n";$/u.test(lines.at(-2)) || lines.at(-1) !== "")
		throw new TypeError("Unexpected native PHP consumer layout");
	lines[1] = `declare(strict_types=${mode === "strict" ? 1 : 0});`;
	lines.splice(2, 1);
	lines[lines.length - 2] = "echo json_encode(['checks' => $checks, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . \"\\n\";";
	return lines.join("\n");
};

/**
 * Read a fixture's caller and the request the shared PHP-Wasm driver expects.
 *
 * @param fixture - Entry of phpWasmFinFixtures.
 */
export const phpWasmFinCaller = async fixture => {
	const source = await readFile(fixture.consumer, "utf8");
	const autoload = arrangement => arrangement === "composer" ? "vendor/autoload.php" : `vendor/${fixture.settings.composer.name}/bootstrap.php`;
	const request = arrangement => `${JSON.stringify({ module: fixture.namespace, operations: { probe: fixture.operation }, autoload: autoload(arrangement) })}\n`;
	return { source: mode => phpWasmFinConsumer(source, mode), request };
};

/**
 * Name both loading modes and both caller strictness modes under one realm and arrangement.
 *
 * @param prefix - Realm and arrangement.
 */
const variants = prefix => ["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(mode => `${prefix}/${loading}/${mode}`));
/** Every execution the shared PHP-Wasm harness must report: Node in both installed arrangements, Chromium bundled. */
export const phpWasmExecutionTuples = Object.freeze([...variants("node/embedded"), ...variants("node/composer"), ...variants("chromium/bundled")].sort());

/**
 * Build a fixture for wasm32 from two unrelated author roots, compare the prepared archives,
 * install the first from its handoff alone and run every Node and Chromium arrangement.
 * Source dispatch is not measured on PHP-Wasm yet, and the report says so.
 *
 * @param t - Running test context.
 * @param spec - Fixture root, module, export names, PHP settings and caller.
 * @param spec.verifyModel - Check the wasm32 model before installation.
 * @param spec.minimumChecks - Least number of public checks each execution must report.
 * @param spec.reviewed - Build from the fixture's independent review instead of selected exports.
 */
export const checkInstalledPhpWasmFixture = async (t, spec) => {
	const archives = [];
	let first = null;
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), `lean-bridge-php-wasm-${spec.label}-author-`));
		const consumer = await mkdtemp(join(tmpdir(), `lean-bridge-php-wasm-${spec.label}-consumer-`));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp(spec.root, projectRoot, { recursive: true });
		// A reviewed build takes every export decision from the review; the configuration names only modules and targets.
		const exports = { schemaVersion: 1, modules: [spec.module], ...(spec.reviewed ? {} : { exports: spec.exports }), targets: { "php-wasm": spec.settings } };
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(exports));
		if(spec.reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(spec.review()));
		const environment = nativeFixtureEnvironment(["php-wasm"]);
		if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
		t.diagnostic(`${spec.label} build ${attempt}: wasm32`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json"), "utf8"));
		assert.equal(model.pointerBits, 32);
		// Only a reconciled review produces the reviewed model schema.
		assert.equal(model.schemaVersion, spec.reviewed ? 3 : 2);
		spec.verifyModel(model);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const packageSet = JSON.parse(await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json")));
		await rm(author, { recursive: true, force: true });
		if(attempt === 0) first = { built, model, receipt, handoff, consumer, packageSet, environment };
	}
	// Two unrelated author roots produce byte-identical archives.
	assert.deepEqual(archives[1], archives[0]);
	const { built, model, receipt, handoff, consumer, packageSet, environment } = first;
	const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
	const caller = await phpWasmFinCaller(spec);
	const clean = { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php", LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler", LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
	const installation = { settings: spec.settings, source: caller.source, request: caller.request, removeHandoff: true };
	const sourcePath = spec.reviewed ? "reviewed-source" : "ordinary-source";
	const options = { t, library: { id: spec.label }, consumer, handoff, receipt, packageSet, environment, clean, sourcePath, fixture: installation };
	const installed = await installedPhpWasmCorpus(options).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	// A lost realm or arrangement fails the gate instead of shrinking it.
	assert.deepEqual(installed.phpWasm.executions.map(item => `${item.realm}/${item.arrangement}/${item.loading}/${item.mode}`).sort(), phpWasmExecutionTuples);
	for(const execution of installed.phpWasm.executions)
	{
		assert.equal(execution.observation.word_bits, 32);
		assert.ok(execution.observation.checks > spec.minimumChecks, `${spec.label} ${execution.realm}`);
	}
	const readme = await readFile(join(consumer, "relocated/node_modules", spec.settings.npm.name, "README.md"), "utf8");
	const identities = { bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(canonicalJson(model)), receiptSha256, ...(spec.reviewed ? { reviewedBindingIrSha256: hashBindingIr(spec.review()) } : {}) };
	const provenance = { packages: receipt.packages, archives: archives[0], reproducible: true, sourceRemovedBeforeInstallation: true };
	return { readme, report: { label: spec.label, profile: "php-wasm", path: sourcePath, dispatch: "not measured", ...identities, ...provenance, ...installed } };
};
