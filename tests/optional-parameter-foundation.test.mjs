/**
 * Foundation controls for the ordinary/reviewed optional-parameter matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertOptionalParameterIr
	, optionalParameterExports
	, optionalParameterFixture
	, optionalParameterProfiles
	, optionalParameterReview
} from "./helpers/optional-parameter-fixture.mjs";
import {
	optionalParameterTargetConfiguration
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
