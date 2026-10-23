/**
 * Isolated controls for nominal Subtype dispatch classification, expectations and row parsing.
 * Synthetic symbol tables are not measurements; they only prove the model refuses silent zeros.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { elaboratedComponent } from "../../src/analyze/semantic-model.mjs";
import { nominalSubtypeFixture, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { assertNominalSubtypeDispatchPositiveControls, assertNominalSubtypeDispatchReport, nominalSubtypeDispatchProbe, classifyNominalSubtypeDispatchSymbols, nominalSubtypeAdapterSymbol, nominalSubtypeDispatchComponent, nominalSubtypeDispatchConstructors, nominalSubtypeDispatchExpected, nominalSubtypeDispatchExports, nominalSubtypeDispatchInterposer, nominalSubtypeDispatchRoles, nominalSubtypeDispatchSteps, parseNominalSubtypeDispatchRows } from "./nominal-subtype-dispatch.mjs";

const table = symbols => symbols.map((symbol, index) => `${(0x1000 + index * 16).toString(16).padStart(16, "0")} T ${symbol}`).join("\n") + "\n";
const completeSymbols = ({ boxedSource = false, specializePlusTwo = false } = {}) => {
	const symbols = [];
	for(const item of nominalSubtypeDispatchExports)
	{
		const adapter = nominalSubtypeAdapterSymbol(item.name);
		symbols.push(adapter);
		item.parameters.forEach((leaves, index) => leaves.forEach(([suffix]) => symbols.push(`${adapter}_refinement_${index}${suffix}`)));
		symbols.push(boxedSource ? `l_NominalSubtypes_${item.name}___boxed` : `l_NominalSubtypes_${item.name}`);
	}
	symbols.push("l_NominalSubtypes_plusOne");
	if(specializePlusTwo) symbols.push("l_NominalSubtypes_plusTwo___at___00NominalSubtypes_second_spec__0", "l_NominalSubtypes_plusTwo___at___00NominalSubtypes_second_spec__0___boxed");
	else symbols.push("l_NominalSubtypes_plusTwo");
	return symbols;
};

// Independent re-derivation of every leaf path from the fixture's own selection trees.
const leaves = (refinement, suffix = "") => {
	if(refinement === null || refinement.kind === "fin") return [];
	if(refinement.kind === "subtype") return [[suffix, refinement.constructor.replace(/^NominalSubtypes\./u, "")]];
	if(refinement.kind === "record") return refinement.fields.flatMap((member, index) => leaves(member.refinement, `${suffix}_${index}`));
	if(refinement.kind === "variant") return refinement.cases.flatMap((branch, index) => branch.fields.flatMap((member, field) => leaves(member.refinement, `${suffix}_${index}_${field}`)));
	return refinement.arguments.flatMap((child, index) => leaves(child, `${suffix}_${index}`));
};

test("nominal dispatch exports restate the fixture's own constructor selections and leaf paths", () => {
	const review = nominalSubtypeInstalledReview();
	for(const item of nominalSubtypeDispatchExports)
	{
		const declaration = review.declarations.find(entry => entry.name === item.name);
		assert.ok(declaration, item.name);
		assert.deepEqual(item.parameters, declaration.source.extensions["lean-lang.org/refinements"].parameters.map(parameter => leaves(parameter)), item.name);
		assert.equal(item.entry, `nominalsubtypes_${item.name.replaceAll(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`)}`);
	}
	assert.ok(nominalSubtypeDispatchExports.some(item => item.parameters.some(leaves => leaves.length > 1)), "a multi-leaf parameter is measured");
	assert.ok(nominalSubtypeDispatchExports.some(item => item.parameters.length > 1), "a multi-parameter export is measured");
});

test("nominal dispatch keeps every measured Lean source and constructor observable", () => {
	const source = readFileSync(`${nominalSubtypeFixture}/NominalSubtypes.lean`, "utf8");
	for(const name of [...nominalSubtypeDispatchConstructors
		, ...nominalSubtypeDispatchExports.map(item => item.name)])
		assert.match(source, new RegExp(`@\\[noinline\\] def ${name}(?: | :)`, "u"), name);
	assert.deepEqual(nominalSubtypeDispatchSteps.filter(item => item.status === 0)
		.map(item => [item.step, item.sources]), [
			["public-valid-first", ["first"]]
			, ["public-valid-second", ["second"]]
			, ["public-valid-combine", ["combine"]]
			, ["public-valid-nested", ["nested", "combine"]]
			, ["public-inactive-event", ["eventFirst"]]
			, ["public-active-event-box", ["eventFirst", "first"]]
			, ["public-valid-event-choices", ["eventFirst"]]
			, ["public-valid-echo", ["echo"]]
			, ["public-recovery-first", ["first"]]
		]
	);
});

test("nominal dispatch adapter symbols hash the component identity the compiler derives from the fixture", () => {
	const project = JSON.parse(readFileSync(`${nominalSubtypeFixture}/package.json`, "utf8"));
	assert.equal(nominalSubtypeDispatchComponent, elaboratedComponent(project).id);
	// The hosted c45304f model record names this adapter for NominalSubtypes.first.
	assert.equal(nominalSubtypeAdapterSymbol("first"), "lb_bf4a2541d27b77f9e2561f26");
});

test("nominal dispatch classification names every adapter, validator, source and constructor from the symbol table", () => {
	const columns = classifyNominalSubtypeDispatchSymbols(table(completeSymbols()));
	assert.deepEqual([...new Set(columns.map(item => item.role))].sort(), nominalSubtypeDispatchRoles.filter(role => role !== "public").sort());
	assert.equal(columns.filter(item => item.role === "adapter").length, nominalSubtypeDispatchExports.length);
	assert.equal(columns.filter(item => item.role === "validator").length, nominalSubtypeDispatchExports.reduce((sum, item) => sum + item.parameters.flat(1).length, 0));
	assert.deepEqual(columns.filter(item => item.role === "constructor").map(item => item.label), [...nominalSubtypeDispatchConstructors]);
	assert.ok(columns.every(item => item.result === (item.role === "validator" ? "uint8_t" : "lean_object *")));
	assert.deepEqual(columns.find(item => item.role === "adapter" && item.label === "combine").arity, 2);
	const boxed = classifyNominalSubtypeDispatchSymbols(table(completeSymbols({ boxedSource: true })));
	assert.ok(boxed.filter(item => item.role === "source").every(item => item.symbol.endsWith("___boxed")));
	const specialized = classifyNominalSubtypeDispatchSymbols(table(completeSymbols({ specializePlusTwo: true })));
	const plusTwo = specialized.filter(item => item.role === "constructor" && item.label.startsWith("plusTwo"));
	assert.deepEqual(plusTwo.map(item => item.label), ["plusTwo specialized into l_NominalSubtypes_plusTwo___at___00NominalSubtypes_second_spec__0"]);
	const interposer = nominalSubtypeDispatchInterposer(columns);
	assert.ok(interposer.includes("unsigned long nominal_subtype_dispatch_count(unsigned index)"));
	for(const item of columns) assert.ok(interposer.includes(`dlsym(RTLD_NEXT, "${item.symbol}")`), item.symbol);
	assert.match(interposer, /uint8_t lb_[a-f0-9]{24}_refinement_0_0\(lean_object \*a0\)/u);
});

test("nominal dispatch classification refuses missing or duplicated columns instead of reading zeros", () => {
	const symbols = completeSymbols();
	assert.throws(() => classifyNominalSubtypeDispatchSymbols(""), /empty dynamic symbol table/u);
	for(const missing of [nominalSubtypeAdapterSymbol("first"), `${nominalSubtypeAdapterSymbol("combine")}_refinement_1_0`, `${nominalSubtypeAdapterSymbol("eventFirst")}_refinement_0_2_0_0_0_1`, "l_NominalSubtypes_nested", "l_NominalSubtypes_plusOne"])
		assert.throws(() => classifyNominalSubtypeDispatchSymbols(table(symbols.filter(symbol => symbol !== missing))), new RegExp(missing.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "|neither defined nor specialized", "u"), missing);
	assert.throws(() => classifyNominalSubtypeDispatchSymbols(table(symbols), [{ name: "first", entry: "nominalsubtypes_first", parameters: [[["_0", "scalar"]]] }]), /scalar/u);
	assert.throws(() => classifyNominalSubtypeDispatchSymbols(table(symbols), [{ name: "first", entry: "nominalsubtypes_first", parameters: [[["0", "plusOne"]]] }]));
	assert.throws(() => classifyNominalSubtypeDispatchSymbols(table(symbols), [{ name: "first", entry: "nominalsubtypes_first", parameters: [] }]));
	// Undefined (U) and local symbols never count as definitions.
	const undefinedAdapter = table(symbols).replace(`T ${nominalSubtypeAdapterSymbol("first")}`, `U ${nominalSubtypeAdapterSymbol("first")}`);
	assert.throws(() => classifyNominalSubtypeDispatchSymbols(undefinedAdapter));
});

test("nominal dispatch expectations follow validation order, stop at the first refusal and recover", () => {
	const columns = classifyNominalSubtypeDispatchSymbols(table(completeSymbols()));
	const rows = nominalSubtypeDispatchExpected(columns), at = (row, role, label) => row[2][columns.findIndex(item => item.role === role && item.label === label)];
	assert.deepEqual(rows.map(row => row[0]), nominalSubtypeDispatchSteps.map(item => item.step));
	assert.deepEqual(rows[0], ["start", 0, columns.map(() => 0)]);
	const validFirst = rows[1], validSecond = rows[2], invalidFirst = rows[3];
	assert.equal(at(validFirst, "validator", "first:0_0"), 1); assert.equal(at(validFirst, "constructor", "plusOne"), 2);
	assert.equal(at(validFirst, "adapter", "first"), 1); assert.equal(at(validFirst, "source", "first"), 1);
	assert.equal(at(validFirst, "constructor", "plusTwo"), 0);
	// per-use normalizing constructors: second selects plusTwo for the same payload
	assert.equal(at(validSecond, "constructor", "plusTwo"), 2); assert.equal(at(validSecond, "constructor", "plusOne"), 2);
	// invalid-only: the validator and its constructor run, the adapter and source do not
	assert.equal(at(invalidFirst, "validator", "first:0_0"), 2); assert.equal(at(invalidFirst, "constructor", "plusOne"), 3);
	assert.equal(at(invalidFirst, "adapter", "first"), 1); assert.equal(at(invalidFirst, "source", "first"), 1);
	const validCombine = rows[4], lateCombine = rows[5], earlyCombine = rows[6];
	assert.equal(at(validCombine, "validator", "combine:1_0"), 1); assert.equal(at(validCombine, "adapter", "combine"), 1);
	// late failure: the first parameter's validator and constructor ran, the second refused, nothing dispatched
	assert.equal(at(lateCombine, "validator", "combine:0_0"), 2); assert.equal(at(lateCombine, "validator", "combine:1_0"), 2);
	assert.equal(at(lateCombine, "adapter", "combine"), 1); assert.equal(at(lateCombine, "source", "combine"), 1);
	// early failure: the second parameter's validator is never reached
	assert.equal(at(earlyCombine, "validator", "combine:0_0"), 3); assert.equal(at(earlyCombine, "validator", "combine:1_0"), 2);
	const lateNested = rows[8];
	assert.equal(at(lateNested, "validator", "nested:0_0_0"), 2); assert.equal(at(lateNested, "validator", "nested:0_1_0"), 2); assert.equal(at(lateNested, "adapter", "nested"), 1);
	assert.equal(at(lateNested, "source", "combine"), 2, "nested enters combine after its own adapter accepts");
	const inactive = rows[9], box = rows[10], choices = rows[11], invalidChoices = rows[12];
	// inactive branch: no leaf validator and no constructor, but the adapter and source still run
	assert.equal(at(inactive, "validator", "eventFirst:0_1_0_0"), 0); assert.equal(at(inactive, "adapter", "eventFirst"), 1); assert.equal(at(inactive, "source", "eventFirst"), 1);
	assert.equal(at(inactive, "constructor", "plusOne"), at(rows[8], "constructor", "plusOne"));
	assert.equal(at(box, "validator", "eventFirst:0_1_0_0"), 1); assert.equal(at(box, "adapter", "eventFirst"), 2);
	assert.equal(at(box, "source", "first"), at(inactive, "source", "first") + 1, "the active box branch enters first");
	assert.equal(at(choices, "validator", "eventFirst:0_2_0_0_0_0"), 1); assert.equal(at(choices, "validator", "eventFirst:0_2_0_0_0_1"), 1); assert.equal(at(choices, "source", "eventFirst"), 3);
	assert.equal(at(invalidChoices, "validator", "eventFirst:0_2_0_0_0_0"), 2); assert.equal(at(invalidChoices, "validator", "eventFirst:0_2_0_0_0_1"), 1); assert.equal(at(invalidChoices, "adapter", "eventFirst"), 3);
	const recovery = rows.at(-1), echo = rows.at(-2);
	assert.equal(at(recovery, "source", "first"), at(echo, "source", "first") + 1); assert.equal(at(recovery, "adapter", "first"), at(echo, "adapter", "first") + 1);
	assertNominalSubtypeDispatchPositiveControls(rows, columns);
	assert.throws(() => assertNominalSubtypeDispatchPositiveControls(rows.map(row => [row[0], row[1], row[2].map((value, index) => index === 0 ? 0 : value)]), columns), /never entered/u);
	for(const [index, row] of rows.entries()) if(index) for(const [column, value] of row[2].entries()) assert.ok(value >= rows[index - 1][2][column], "counters never decrease");
});

test("nominal dispatch row parsing refuses malformed, truncated or mismatched probe output", () => {
	const columns = classifyNominalSubtypeDispatchSymbols(table(completeSymbols()));
	const rows = nominalSubtypeDispatchExpected(columns);
	const stdout = rows.map(row => [row[0], row[1], ...row[2]].join(" ")).join("\n") + "\n";
	assert.deepEqual(parseNominalSubtypeDispatchRows(stdout, columns), rows);
	for(const broken of [stdout.slice(0, -1), stdout.replace(" 0 ", " 2 "), stdout + "extra\n", stdout.replace(/^start 0 0/u, "Start 0 0"), stdout.replace(/(\d+)\n/u, "$1 7\n"), stdout.replace(/ (\d+)\n/u, " 0$1\n")])
		assert.throws(() => parseNominalSubtypeDispatchRows(broken, columns), undefined, broken.slice(0, 40));
	const shifted = parseNominalSubtypeDispatchRows(stdout.replace(/^public-valid-first 0 (\d+)/mu, "public-valid-first 0 0"), columns);
	assert.notDeepEqual(shifted, rows);
});

test("nominal dispatch probe drives every step through the public API and the report checker rejects drift", () => {
	const text = table(completeSymbols()), columns = classifyNominalSubtypeDispatchSymbols(text);
	const probe = nominalSubtypeDispatchProbe(columns);
	for(const item of nominalSubtypeDispatchSteps) assert.ok(probe.includes(`report("${item.step}"`), item.step);
	assert.equal(probe.match(/report\("/gu).length, nominalSubtypeDispatchSteps.length);
	assert.ok(probe.includes(`i < ${columns.length}; ++i`));
	assert.ok(probe.includes(`dlsym(RTLD_DEFAULT, "nominal_subtype_dispatch_count")`));
	assert.ok(probe.includes("nominalsubtypes_event_tag kind"));
	assert.ok(!probe.includes("nominalsubtypes_event_kind kind"));
	for(const item of nominalSubtypeDispatchExports) assert.ok(probe.includes(`${item.entry}(`), item.entry);
	assert.ok(!probe.includes("lb_"), "the probe reaches Lean only through public entries");
	const observed = nominalSubtypeDispatchExpected(columns);
	const report = { interposer: "LD_PRELOAD", columns, observed, positiveControl: "every column moves in a valid step", unmeasured: ["C++ dispatch (it calls the same C entries)", "resident memory"] };
	assert.deepEqual(assertNominalSubtypeDispatchReport(report, text), columns);
	const drifted = observed.map((row, index) => index === 1 ? [row[0], row[1], row[2].map((value, column) => column === 0 ? value + 1 : value)] : row);
	assert.throws(() => assertNominalSubtypeDispatchReport({ ...report, observed: drifted }, text));
	assert.throws(() => assertNominalSubtypeDispatchReport({ ...report, interposer: "none" }, text), /LD_PRELOAD/u);
	assert.throws(() => assertNominalSubtypeDispatchReport({ ...report, columns: columns.slice(1) }, text));
	assert.throws(() => assertNominalSubtypeDispatchReport(report, table(completeSymbols({ specializePlusTwo: true }))));
	assert.throws(() => assertNominalSubtypeDispatchReport({ ...report, unmeasured: [] }, text));
});
