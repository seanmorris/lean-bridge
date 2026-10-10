/**
 * Preserve refined record and variant aliases in relocated installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { finRecordRefinements, finRecordTargets, installFinRecordConsumer } from "./fin-record-install.mjs";
import { checkInstalledFinFixture, finFixtureProfiles } from "./fin-fixture-installed.mjs";
import { finRecordReviewedIr } from "./reviewed-fin-record-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const aliases = { "lean:FinRecords.Tile": "lean:FinRecords.TileName", "lean:FinRecords.Shape": "lean:FinRecords.ShapeName" };
const reviewedAliases = () => {
	const ir = finRecordReviewedIr();
	const reference = type => {
		if(type.kind === "named" && aliases[type.id]) return { ...type, id: aliases[type.id] };
		return type.kind === "apply" ? { ...type, arguments: type.arguments.map(reference) } : type;
	};
	for(const declaration of ir.declarations)
	{
		for(const parameter of declaration.parameters) parameter.type = reference(parameter.type);
		declaration.result.type = reference(declaration.result.type);
	}
	for(const [target, id] of Object.entries(aliases))
	{
		const original = ir.types.find(type => type.id === target);
		ir.types.push({ ...structuredClone(original), id
			, name: id.split(".").at(-1), kind: "alias"
			, fields: [], cases: [], target: { kind: "named", id: target }
			, source: { ...original.source, declaration: id.slice(5), extensions: {} } });
	}
	return ir;
};

test("independent refined record alias review retains target identities and constraints", () => {
	const ir = reviewedAliases(); validateBindingIr(ir);
	for(const [target, id] of Object.entries(aliases))
	{
		const alias = ir.types.find(type => type.id === id);
		assert.equal(alias.kind, "alias"); assert.deepEqual(alias.target, { kind: "named", id: target });
		assert.deepEqual(alias.source.extensions, {});
		assert.ok(ir.types.find(type => type.id === target).source.extensions["lean-lang.org/nominal-refinements"]);
	}
	assert.equal(ir.declarations.find(item => item.name === "bump").result.type.id, "lean:FinRecords.TileName");
	assert.equal(ir.declarations.find(item => item.name === "shapeSize").parameters[0].type.id, "lean:FinRecords.ShapeName");
});

const profiles = finFixtureProfiles("LEAN_BRIDGE_FIN_RECORD_ALIAS_PROFILES", finRecordTargets);
for(const reviewed of [false, true]) test(`${reviewed ? "reviewed" : "ordinary"} installed refined record aliases preserve bounds and relocated archive identities`, {
	skip: !profiles.length, timeout: 2400000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-fin-record-alias-fixture-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await cp("tests/fixtures/onboarding/native-fin-records", directory, { recursive: true });
	const original = await readFile(join(directory, "FinRecords.lean"), "utf8");
	const marker = "-- The dispatch probe counts calls";
	const split = original.indexOf(marker); assert.ok(split > 0);
	const functions = original.slice(split).replace(/\bTile\b/gu, "TileName").replace(/\bShape\b/gu, "ShapeName");
	await saveLakeFile(directory, "FinRecords.lean", original.slice(0, split)
		+ "abbrev TileName := Tile\nabbrev ShapeName := Shape\n\n" + functions);
	await checkInstalledFinFixture(t, {
		fixture: directory, module: "FinRecords", label: "fin-record-alias"
		, targets: finRecordTargets, refinements: finRecordRefinements
		, reviewedIr: reviewedAliases, install: installFinRecordConsumer
		, report: { variable: "LEAN_BRIDGE_FIN_RECORD_ALIAS_REPORT"
			, reviewedVariable: "LEAN_BRIDGE_REVIEWED_FIN_RECORD_ALIAS_REPORT"
			, directory: "build/native-fin-record-aliases" }
	}, profiles, reviewed);
});
