/**
 * Generic record instantiations in relocated PHP-Wasm packages (VO #1220).
 *
 * @file
 */
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import "./helpers/php-wasm-generic-record-evidence-tests.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { createNativeModel, createPhpWasmCopiedModel } from "../src/build/native-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { checkInstalledPhpWasmFixture } from "./helpers/php-wasm-fin-fixtures.mjs";
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
	// The same instantiations, phantom-only provenance and identical aliases as the native packages.
	const verifyModel = model => assertGenericRecordIr(model.bindingIr, fixture.module);
	const { report } = await checkInstalledPhpWasmFixture(t, { ...fixture, label: "generic-records", exports: genericRecordExports, verifyModel, minimumChecks: 1000 });
	const reportPath = resolve(process.env.LEAN_BRIDGE_PHP_WASM_GENERIC_RECORD_REPORT ?? "build/generic-records/php-wasm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, ...report }));
});
