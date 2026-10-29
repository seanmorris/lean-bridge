/**
 * Foundation controls for the ordinary/reviewed optional-parameter matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { hashBindingIr } from "../src/binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertOptionalParameterIr
	, optionalParameterBinder
	, optionalParameterExports
	, optionalParameterFixture
	, optionalParameterProfiles
	, optionalParameterReview
} from "./helpers/optional-parameter-fixture.mjs";
import {
	checkOptionalParameterNativeComponentRecords
	, optionalParameterTargetConfiguration
	, prepareOptionalParameterProject
} from "./helpers/optional-parameter-packages.mjs";

test("optional-parameter profiles exactly cover the public consumer ledger", async () => {
	const ledger = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
	assert.deepEqual([...optionalParameterProfiles].sort()
		, ledger.profiles.map(profile => profile.id).sort());
	assert.equal(new Set(optionalParameterProfiles).size, 17);
	assert.deepEqual(optionalParameterTargetConfiguration([
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	]), { npm: { name: "optional-parameters", version: "1.0.0" } });
	assert.deepEqual(optionalParameterTargetConfiguration(["java", "kotlin"])
		, { maven: { name: "org.leanbridge:optionalparameters", version: "1.0.0" } });
	assert.throws(() => optionalParameterTargetConfiguration(["java", "java"])
		, /must be unique/u);
	assert.throws(() => optionalParameterTargetConfiguration(["unknown"])
		, /Unknown optional-parameter profile/u);
});

test("the independent review carries seven typed compiler-authenticated defaults", () => {
	const declarations = assertOptionalParameterIr(optionalParameterReview());
	assert.deepEqual(declarations.map(item => item.name), [
		"word", "natural", "text", "character", "maybe", "present", "unitValue"
	]);
	assert.deepEqual(declarations.map(item => item.parameters[0].default), [
		{ kind: "integer", value: "7" }
		, { kind: "integer", value: "184467440737095516160" }
		, { kind: "string", value: "Lean\nBridge" }
		, { kind: "char", value: "λ" }
		, { kind: "option-none" }
		, { kind: "option-some", value: { kind: "integer", value: "9" } }
		, { kind: "unit" }
	]);
});

test("optional-parameter authoring routes retain distinct compiler binders", () => {
	assert.equal(optionalParameterBinder("ordinary"), "arg0");
	assert.equal(optionalParameterBinder("reviewed"), "value0");
	assert.throws(() => optionalParameterBinder("foreign"), /Unknown/u);
	const ordinary = structuredClone(optionalParameterReview());
	for(const declaration of ordinary.declarations)
		declaration.parameters[0].name = "arg0";
	assert.equal(assertOptionalParameterIr(ordinary, [
		optionalParameterBinder("ordinary")
	]).length, 7);
});

test("ordinary and reviewed author roots retain distinct authenticated inputs", async t => {
	const ordinary = await prepareOptionalParameterProject(t, {
		route: "ordinary", profiles: ["node-javascript"]
	});
	const reviewed = await prepareOptionalParameterProject(t, {
		route: "reviewed", profiles: ["node-javascript"]
	});
	assert.deepEqual(ordinary.configuration.exports, optionalParameterExports);
	assert.equal(reviewed.configuration.exports, undefined);
	assert.deepEqual(JSON.parse(await readFile(
		`${reviewed.projectRoot}/api.binding-ir.json`, "utf8"
	)), optionalParameterReview());
	const lean = await readFile(
		`${optionalParameterFixture}/Defaults.lean`, "utf8");
	for(const expected of [
		"UInt32 := 7", "Nat := 184467440737095516160"
		, "String := \"Lean\\nBridge\"", "Char := 'λ'"
		, "Option UInt32 := none", "Option UInt32 := some 9"
		, "Unit := ()"
	]) assert.ok(lean.includes(expected), expected);
});

test("retained native component records authenticate optional defaults", async () => {
	const bytes = value => Buffer.from(typeof value === "string"
		? value : canonicalJson(value));
	const ir = optionalParameterReview(), irBytes = bytes(ir);
	const metadataBytes = bytes({ schemaVersion: 1 });
	const leanBytes = bytes("def generatedOptionalAdapters : Nat := 7\n");
	const modelBytes = bytes({
		profile: "native-library-v1", bindingIr: ir
		, bindingIrSha256: hashBindingIr(ir)
	});
	const receiptBytes = bytes({
		profile: "native-library-v1", bindingIrSha256: hashBindingIr(ir)
		, metadataSha256: sha256(metadataBytes)
		, modelSha256: sha256(modelBytes), adaptersSha256: sha256(leanBytes)
		, exports: ir.declarations.map(item => item.id)
	});
	const files = Object.fromEntries([
		["binding-ir.json", irBytes], ["generated.lean", leanBytes]
		, ["metadata.json", metadataBytes], ["model.json", modelBytes]
		, ["native-component.json", receiptBytes]
	].map(([name, value]) => [name, {
		bytes: value.length, sha256: sha256(value)
	}]));
	const records = new Map([
		["build/binding-ir.json", irBytes]
		, ["build/generated.lean", leanBytes]
		, ["build/metadata.json", metadataBytes]
		, ["build/model.json", modelBytes]
		, ["build/native-component.json", receiptBytes]
		, ["build/artifacts.json"
			, bytes({
			schemaVersion: 1, profile: "native-library-v1", files
			})
		]
	]);
	const read = async path => {
		assert.ok(records.has(path), path);
		return records.get(path);
	};
	const fact = await checkOptionalParameterNativeComponentRecords(
		read, "build/");
	assert.equal(fact.declarations, 7);
	assert.equal(fact.authenticatedDefaults, 7);
	records.set("build/generated.lean", bytes("axiom forged : Nat\n"));
	await assert.rejects(checkOptionalParameterNativeComponentRecords(
		read, "build/"));
});

test("non-npm optional lanes retain the compiler profile they consume", async () => {
	for(const lane of ["language", "managed", "native", "wit"])
	{
		const source = await readFile(
			`tests/optional-parameter-${lane}-installed.test.mjs`, "utf8");
		assert.match(source, /assertOptionalParameterNativeComponent\(outputRoot\)/u);
		assert.match(source, /retainOptionalParameterNativeComponent/u);
		assert.doesNotMatch(source, /join\(outputRoot, "bundle"\)/u);
	}
	const php = await readFile(
		"tests/optional-parameter-php-installed.test.mjs", "utf8");
	assert.match(php, /assertOptionalParameterPhpComponents\(outputRoot\)/u);
	assert.match(php, /retainOptionalParameterPhpComponents/u);
	assert.doesNotMatch(php, /join\(outputRoot, "bundle"\)/u);
});
