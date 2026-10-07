/**
 * Generic record instantiations in relocated PHP-Wasm packages (VO #1220).
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
import { createNativeModel, createPhpWasmCopiedModel } from "../src/build/native-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { installedPhpWasmCorpus } from "./helpers/type-corpus-php-wasm-install.mjs";
import { phpWasmFinCaller } from "./helpers/php-wasm-fin-fixtures.mjs";
import { assertGenericRecordIr, genericRecordExports } from "./helpers/generic-record-packages.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const fixture = {
	root: "tests/fixtures/onboarding/generic-records"
	, module: "GenericRecords", namespace: "LeanGenericrecords"
	, operation: "swap_named"
	, consumer: "tests/fixtures/generic-record-consumers/php-native.php"
	, settings: {
		npm: { name: "lean-bridge-genericrecords-wasm", version: "1.0.0" }
		, composer: { name: "lean-bridge-genericrecords/wasm", version: "1.0.0" }
	}
};

test("the wasm32 model keeps a generic record's instantiation exactly as native packages do", () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection, nat = projection.parameters[0].type;
	const fields = [{ name: "value", projection: "Box.value", type: nat }];
	const box = { kind: "record", name: "NatBox", lean: "NatBox", constructor: "Box.mk", provenance: { structure: "Box", arguments: [nat] }, fields, abi: heap };
	projection.parameters[0].type = box;
	const options = { ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	const native = createNativeModel(options), wasm = createPhpWasmCopiedModel(options);
	assert.deepEqual(wasm.bindingIr, native.bindingIr);
	const definition = wasm.bindingIr.types.find(type => type.id === "lean:NatBox");
	assert.deepEqual(definition.source.extensions["lean-lang.org/instantiation"], { structure: "Box", arguments: [{ kind: "primitive", name: nat.name }] });
});

test("relocated PHP-Wasm packages construct alias-named generic records in Node and browser hosts", { skip: process.env.LEAN_BRIDGE_PHP_WASM_GENERIC_RECORD_TEST !== "1", timeout: 3_600_000 }, async t => {
	const author = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-generic-author-"));
	const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-generic-consumer-"));
	t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
	const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
	await cp(fixture.root, projectRoot, { recursive: true });
	const exports = { schemaVersion: 1, modules: [fixture.module], exports: genericRecordExports, targets: { "php-wasm": fixture.settings } };
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(exports));
	const environment = nativeFixtureEnvironment(["php-wasm"]);
	if(environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME) environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME = environment.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["php-wasm"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	const model = JSON.parse(await readFile(join(outputRoot, "php-wasm/component/model.json"), "utf8"));
	assert.equal(model.pointerBits, 32);
	// The same instantiations, phantom-only provenance and identical aliases as the native packages.
	assertGenericRecordIr(model.bindingIr, fixture.module);
	const receipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
	const packageSet = JSON.parse(await readFile(join(outputRoot, "packages/php-wasm/php-wasm-package-set.json")));
	await rm(author, { recursive: true, force: true });
	const caller = await phpWasmFinCaller(fixture);
	const clean = { ...copiedCleanEnvironment, LEAN_BRIDGE_PHP_SOURCE: "/unavailable/php", LEAN_BRIDGE_PHP_EMSDK: "/unavailable/compiler", LEAN_BRIDGE_PHP_COPIED_RUNTIME: "/unavailable/runtime" };
	const installation = { settings: fixture.settings, source: caller.source, request: caller.request, removeHandoff: true };
	const options = { t, library: { id: "generic-records" }, consumer, handoff, receipt, packageSet, environment, clean, sourcePath: "ordinary-source", fixture: installation };
	const installed = await installedPhpWasmCorpus(options).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.ok(installed.phpWasm.executions.length >= 8);
	for(const execution of installed.phpWasm.executions)
	{
		assert.equal(execution.observation.word_bits, 32);
		assert.ok(execution.observation.checks > 1000, execution.realm);
	}
	const identities = { bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(canonicalJson(model)), receiptSha256 };
	const report = { schemaVersion: 1, profile: "php-wasm", path: "ordinary-source", ...identities, packages: receipt.packages, ...installed, sourceRemovedBeforeInstallation: true };
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_GENERIC_RECORD_REPORT ?? "build/generic-records/php-wasm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson(report));
});
