/**
 * Array fields and results over alias-named generic records in installed C, C++ and Python packages: exact source
 * composition and consumer controls, and a gated installed acceptance from two author roots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { genericRecordArrayExports } from "./helpers/generic-record-browser.mjs";
import { genericRecordInstantiations } from "./helpers/generic-record-packages.mjs";
import { specializedGenericRecordCase, specializedGenericRecordConsumer } from "./helpers/generic-record-specializations.mjs";
import { assertGenericRecordArrayAdditions, checkInstalledGenericRecordArrays, claimGenericRecordArrayReport, genericRecordArrayBaseConsumers, genericRecordArrayCases, genericRecordArrayConfiguration, genericRecordArrayConsumer, genericRecordArrayExpectedChecks, genericRecordArrayInstantiations, genericRecordArrayProfileSelection, genericRecordArrayProfiles, genericRecordArrayReportPath, genericRecordArraySource, writeGenericRecordArrayReport } from "./helpers/generic-record-arrays.mjs";

const profiles = genericRecordArrayProfileSelection(process.env.LEAN_BRIDGE_GENERIC_RECORD_ARRAY_PROFILES);
const extensions = { c: "c", cpp: "cpp", python: "py" };

test("the Array source is the accepted specialization source with GenericRecordArrays.lean appended", async () => {
	const shared = await readFile("tests/fixtures/onboarding/generic-records/GenericRecords.lean", "utf8");
	const arrays = await readFile("tests/fixtures/generic-record-browser/GenericRecordArrays.lean", "utf8");
	const source = await genericRecordArraySource();
	assert.ok(source.startsWith(shared));
	assert.equal(source, `${await specializedGenericRecordCase.source()}\n${arrays}`);
	for(const declaration of ["abbrev ArrayBox := Box (Array Nat)", "abbrev BoxRow := Array NatBox", "abbrev RowBox := Box (Array NatBox)"]) assert.ok(source.includes(`\n${declaration}\n`), declaration);
	// The module argument renames every occurrence and nothing else.
	assert.equal(await genericRecordArraySource("Other"), source.replaceAll("GenericRecords", "Other"));
});

test("the Array configuration keeps every specialized export and decision and adds exactly four exports", () => {
	const specialized = specializedGenericRecordCase.configuration(), configuration = genericRecordArrayConfiguration();
	assert.deepEqual(configuration.specializations, specialized.specializations);
	assert.deepEqual(configuration.exports, [...specialized.exports, ...genericRecordArrayExports.map(name => `GenericRecords.${name}`)]);
	assert.deepEqual(genericRecordArrayExports, ["pushCount", "rowTotal", "rowOf", "rowBoxSum"]);
	assert.deepEqual(Object.keys(configuration).sort(), Object.keys(specialized).sort());
});

test("each Array consumer is the pinned specialized consumer with one fragment inserted at its marker", async () => {
	for(const profile of genericRecordArrayProfiles)
	{
		const extension = extensions[profile];
		const base = await specializedGenericRecordConsumer(profile, extension);
		const fragment = await readFile(`tests/fixtures/generic-record-array-consumers/${profile}.${extension}`, "utf8");
		const composed = await genericRecordArrayConsumer(profile);
		// The accepted consumer bytes are those the hosted specialization archive measured.
		assert.equal(sha256(base), genericRecordArrayBaseConsumers[profile].sha256, profile);
		assert.equal(composed.length, base.length + fragment.length + 1, profile);
		assert.equal(composed.replace(`${fragment}\n`, ""), base, profile);
		assert.equal(composed.split(fragment).length, 2, profile);
		// Every Array export, Array rejections at three positions and the Array rounds are in the fragment itself.
		const names = { c: ["genericrecords_push_count", "genericrecords_row_total", "genericrecords_row_of", "genericrecords_row_box_sum"]
			, cpp: ["api::push_count", "api::row_total", "api::row_of", "api::row_box_sum"]
			, python: ["api.push_count", "api.row_total", "api.row_of", "api.row_box_sum"] }[profile];
		for(const name of names) assert.ok(fragment.includes(`${name}(`), `${profile}: ${name}`);
		assert.match(fragment, { c: /for \(unsigned long r = 0; r < 1000; \+\+r\)/u, cpp: /for \(unsigned r = 0; r < 1000; \+\+r\)/u, python: /^for round_index in range\(1000\):$/mu }[profile]);
		assert.match(fragment, { c: /for \(unsigned a = 0; a < 3; \+\+a\)/u, cpp: /for \(unsigned position = 0; position < 3; \+\+position\)/u, python: /^for position in range\(3\):$/mu }[profile]);
		if(profile === "c")
		{
			for(const site of ["mpz_set_si(array_values[a], -1)", "mpz_set_si(member, -1)", "mpz_set_si(array_in.count, -1)", "mpz_set_si(row_box.count, -1)"]) assert.ok(fragment.includes(site), site);
			for(const site of ["array_null = {NULL, 2, NULL, NULL}", "null_row = {NULL, 2, NULL, NULL}"]) assert.ok(fragment.includes(site), site);
			assert.ok(fragment.includes("GENERICRECORDS_STATUS_INVALID_ARGUMENT && error.code == GENERICRECORDS_ERROR_INVALID_ARGUMENT"));
		}
		if(profile === "cpp") assert.ok(fragment.includes("failure.status == GENERICRECORDS_STATUS_INVALID_ARGUMENT && failure.code == GENERICRECORDS_ERROR_INVALID_ARGUMENT"));
		if(profile === "python") for(const kind of ["(-1, ValueError)", "(True, TypeError)", "(api.NatBox(-1, 0), ValueError)", "(api.NatBox(0, -1), ValueError)", "(api.NatBoxAgain(1, 0), TypeError)"]) assert.ok(fragment.includes(kind), kind);
	}
});

test("the old generic-record consumers stay byte-identical and keep their List, Option and nominal-identity checks", async () => {
	for(const profile of genericRecordArrayProfiles)
	{
		const composed = await genericRecordArrayConsumer(profile);
		const original = await readFile(`tests/fixtures/generic-record-consumers/${profile}.${extensions[profile]}`, "utf8");
		const specialization = await readFile(`tests/fixtures/generic-record-specialization-consumers/${profile}.${extensions[profile]}`, "utf8");
		assert.ok(composed.includes(specialization), profile);
		for(const line of original.split("\n")) assert.ok(composed.includes(line), `${profile}: ${line}`);
		for(const name of { c: ["genericrecords_echo_boxes", "genericrecords_echo_optional_nat", "genericrecords_total"], cpp: ["api::echo_boxes", "api::echo_optional_nat", "api::total"], python: ["api.echo_boxes", "api.echo_optional_nat", "api.bump(api.NatBoxAgain(1, 2))"] }[profile])
			assert.ok(composed.includes(name), `${profile}: ${name}`);
	}
});

test("every C Array refusal seeds its output and the rounds refuse a negative member of the real row", async () => {
	const fragment = await readFile("tests/fixtures/generic-record-array-consumers/c.c", "utf8");
	// Each refused call goes through a sentinel-checking macro; none uses the bare status check.
	assert.doesNotMatch(fragment, /ARRAY_REJECTED\(genericrecords_/u);
	const sums = fragment.match(/SUM_REJECTED\(genericrecords_row_(total|box_sum)\(/gu) ?? [], boxes = fragment.match(/BOX_REJECTED\(genericrecords_push_count\(/gu) ?? [];
	assert.deepEqual([sums.length, boxes.length], [6, 4]);
	assert.ok(fragment.includes("#define SUM_REJECTED(call) (mpz_set_ui(array_sum, 77777), ARRAY_REJECTED(call) && is_small(array_sum, 77777))"));
	assert.ok(fragment.includes("&& array_out.value.length == 0 && array_out.value.data == NULL && is_small(array_out.count, 77777))"));
	// In the rounds, the RowBox is reset to the real row before its member is made negative, checked, then recovered.
	const rounds = fragment.slice(fragment.indexOf("for (unsigned long r = 0; r < 1000; ++r)"), fragment.indexOf("checks += 1000;"));
	const reset = rounds.indexOf("row_box.value = row; mpz_set_ui(row_box.count, r); mpz_set_si(row_items[position].value, -1);");
	const refused = rounds.indexOf("!SUM_REJECTED(genericrecords_row_box_sum(&row_box, array_sum, &error))");
	const recovered = rounds.indexOf("!OK(genericrecords_row_box_sum(&row_box, array_sum, &error)) || mpz_cmp(array_sum, array_expected) != 0");
	assert.ok(reset > 0 && refused > reset && recovered > refused, "reset, refusal and recovery in order");
	assert.ok(rounds.slice(refused).includes("row_box.value.data != row_items || row_box.value.length != 3"));
	assert.ok(!rounds.includes("null_row"));
});

test("each profile has its expected case list and an exact check total", () => {
	assert.deepEqual(Object.keys(genericRecordArrayCases).sort(), [...genericRecordArrayProfiles].sort());
	for(const profile of genericRecordArrayProfiles)
	{
		const { checks, cases } = genericRecordArrayCases[profile];
		assert.ok(cases.length > 5 && new Set(cases).size === cases.length, profile);
		assert.equal(cases.at(-1), "1000 Array rounds");
		assert.ok(Number.isSafeInteger(checks) && checks > 1000, profile);
		assert.equal(genericRecordArrayExpectedChecks(profile), genericRecordArrayBaseConsumers[profile].checks + checks);
	}
	assert.deepEqual(genericRecordArrayProfiles.map(genericRecordArrayExpectedChecks), [2078, 2058, 2144]);
});

test("Array profile selection accepts only this slice's hosts, each once", () => {
	assert.deepEqual(genericRecordArrayProfileSelection(undefined), []);
	assert.deepEqual(genericRecordArrayProfileSelection("python,c"), ["c", "python"]);
	assert.deepEqual(genericRecordArrayProfileSelection("cpp"), ["cpp"]);
	for(const value of ["", "rust", "c,rust", "c,c", "c,,cpp", "C", " c"]) assert.throws(() => genericRecordArrayProfileSelection(value), value);
	assert.throws(() => genericRecordArrayProfileSelection(1));
});

test("Array reports are written apart from every ordinary and specialized generic-record report", () => {
	assert.equal(genericRecordArrayReportPath(["c", "cpp"]), resolve("build/generic-records/array-c-cpp.json"));
	assert.equal(genericRecordArrayReportPath(["python"], "build/generic-records/array-python312.json"), resolve("build/generic-records/array-python312.json"));
	for(const path of ["build/generic-records/c-cpp.json", "build/generic-records/specialized-c-cpp.json", "build/generic-records/python312.json", "build/generic-records/report.json"])
		assert.throws(() => genericRecordArrayReportPath(["c", "cpp"], path), path);
	assert.throws(() => genericRecordArrayReportPath(["python"], "build/generic-records/specialized-python312.json"));
});

test("an existing Array report is refused before work and never overwritten", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-record-arrays-report-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const existing = join(directory, "array-c.json"), fresh = join(directory, "nested/array-cpp.json");
	await writeFile(existing, "earlier report\n");
	await assert.rejects(claimGenericRecordArrayReport(existing));
	await assert.rejects(writeGenericRecordArrayReport(existing, { schemaVersion: 1 }), { code: "EEXIST" });
	assert.equal(await readFile(existing, "utf8"), "earlier report\n");
	await claimGenericRecordArrayReport(fresh);
	await writeGenericRecordArrayReport(fresh, { schemaVersion: 1 });
	await assert.rejects(writeGenericRecordArrayReport(fresh, { schemaVersion: 2 }), { code: "EEXIST" });
	assert.deepEqual(JSON.parse(await readFile(fresh, "utf8")), { schemaVersion: 1 });
});

const named = id => ({ kind: "named", id });
const nat = { kind: "primitive", name: "nat" };
const array = element => ({ kind: "apply", constructor: "array", arguments: [element] });
/**
 * A compiler-shaped fragment of the native Binding IR holding only what the Array additions name.
 *
 * @param module - Lean module and namespace name.
 */
const additions = (module = "GenericRecords") => {
	const record = (name, value, instantiation) => {
		const extensions = instantiation ? { "lean-lang.org/instantiation": instantiation } : {};
		const fields = [{ name: "value", type: value }, { name: "count", type: nat }];
		return { id: `lean:${module}.${name}`, name, kind: "record", fields, source: { declaration: `${module}.${name}`, extensions } };
	};
	const declaration = (name, parameter, result) => ({ id: `lean:${module}.${name}`, typeParameters: [], parameters: [{ name: "value", type: parameter }], result: { type: result } });
	const instantiations = genericRecordArrayInstantiations(module);
	return { types: [record("NatBox", nat, { structure: `${module}.Box`, arguments: [nat] })
		, record("ArrayBox", array(nat), instantiations[`lean:${module}.ArrayBox`])
		, record("RowBox", array(named(`lean:${module}.NatBox`)), instantiations[`lean:${module}.RowBox`])
		, { id: `lean:${module}.BoxRow`, name: "BoxRow", kind: "alias", target: array(named(`lean:${module}.NatBox`)), fields: [] }]
	, declarations: [declaration("pushCount", named(`lean:${module}.ArrayBox`), named(`lean:${module}.ArrayBox`))
		, declaration("rowTotal", named(`lean:${module}.BoxRow`), nat)
		, declaration("rowOf", nat, named(`lean:${module}.BoxRow`))
		, declaration("rowBoxSum", named(`lean:${module}.RowBox`), nat)] };
};

test("the native Array IR assertion is module-qualified and preserves origins, argument order and field types", () => {
	assertGenericRecordArrayAdditions(additions(), "GenericRecords");
	assertGenericRecordArrayAdditions(additions("OnboardingSmall"), "OnboardingSmall");
	// A browser-qualified IR is not the native one, and the native one is not the browser one.
	assert.throws(() => assertGenericRecordArrayAdditions(additions("OnboardingSmall"), "GenericRecords"));
	assert.throws(() => assertGenericRecordArrayAdditions(additions(), "OnboardingSmall"));
	const mutations = {
		"RowBox argument names another alias": ir => { ir.types[2].source.extensions["lean-lang.org/instantiation"].arguments[0].arguments[0].id = "lean:GenericRecords.NatBoxAgain"; }
		, "ArrayBox argument is a List": ir => { ir.types[1].source.extensions["lean-lang.org/instantiation"].arguments[0].constructor = "list"; }
		, "ArrayBox origin names another structure": ir => { ir.types[1].source.extensions["lean-lang.org/instantiation"].structure = "GenericRecords.Pair"; }
		, "RowBox loses its origin": ir => { ir.types[2].source.extensions = {}; }
		, "ArrayBox field is a List": ir => { ir.types[1].fields[0].type = { ...array(nat), constructor: "list" }; }
		, "RowBox fields are reordered": ir => { ir.types[2].fields.reverse(); }
		, "ArrayBox is missing": ir => { ir.types.splice(1, 1); }
		, "BoxRow alias is expanded away": ir => { ir.types.pop(); }
		, "BoxRow alias targets ArrayBox": ir => { ir.types[3].target = array(named("lean:GenericRecords.ArrayBox")); }
		, "rowTotal takes the expanded Array": ir => { ir.declarations[1].parameters[0].type = array(named("lean:GenericRecords.NatBox")); }
		, "rowOf returns RowBox": ir => { ir.declarations[2].result.type = named("lean:GenericRecords.RowBox"); }
		, "pushCount stays generic": ir => { ir.declarations[0].typeParameters = ["α"]; }
		, "rowBoxSum is missing": ir => { ir.declarations.pop(); }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const ir = additions();
		mutate(ir);
		assert.throws(() => assertGenericRecordArrayAdditions(ir, "GenericRecords"), label);
	}
	// The native instantiations extend, and never change, the accepted ones.
	assert.deepEqual(Object.keys(genericRecordArrayInstantiations()), ["lean:GenericRecords.ArrayBox", "lean:GenericRecords.RowBox"]);
	assert.ok(!Object.keys(genericRecordInstantiations).some(name => ["ArrayBox", "RowBox"].includes(name)));
});

test("relocated source-free native packages carry Array fields and results over alias-named generic records", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reportPath = genericRecordArrayReportPath(profiles, process.env.LEAN_BRIDGE_GENERIC_RECORD_ARRAY_REPORT);
	const report = await checkInstalledGenericRecordArrays(t, profiles, reportPath);
	assert.deepEqual(report.reports.map(item => item.profile), profiles);
	for(const item of report.reports) assert.equal(item.checks, genericRecordArrayExpectedChecks(item.profile));
});
