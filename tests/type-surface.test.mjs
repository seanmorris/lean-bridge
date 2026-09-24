/**
 * Keep the type baseline complete and prevent evidence from crossing profiles or stages.
 *
 * @file
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { readTypeSurface, typeSurfaceCells, typeSurfaceGapReport, validateTypeSurface } from "../src/adoption/type-surface.mjs";

const execute = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const { document, ...contracts } = await readTypeSurface();
const clone = value => structuredClone(value);
const stage = (state = "unreviewed") => ({ state, evidence: state === "unreviewed" ? [] : ["test-evidence"], note: "Scope of this test observation." });
const observationFixture = () => {
	const candidate = clone(document);
	candidate.observations = [];
	candidate.evidence = [{
		id: "test-evidence"
		, kind: "inspection"
		, revision: "0".repeat(40)
		, command: "Inspect the fixture generator."
		, scope: "Test-only evidence."
		, files: [{ path: "src/abi/component-scalars.mjs", sha256: "0".repeat(64) }]
		, artifacts: []
	}];
	candidate.observations.push({
		id: "test-nat"
		, profiles: ["node-javascript"]
		, shapes: ["nat"]
		, positions: ["parameter", "result"]
		, path: "ordinary-source"
		, scope: "One exact-integer fixture; no field or callback coverage."
		, hostTypes: { nat: { parameter: "bigint", result: "bigint" } }
		, stages: Object.fromEntries(candidate.stages.map(name => [name, stage(name === "generation" ? "inspected" : "unreviewed")]))
		, limitations: []
	});
	return candidate;
};

test("the versioned inventory classifies every profile, IR alternative and required source shape", async () => {
	await assertJsonSchema("type-surface", document);
	assert.equal(validateTypeSurface(document, contracts), true);
	assert.equal(document.profiles.length, 17);
	assert.equal(document.shapes.length, 48);
	assert.deepEqual(document.profiles.filter(profile => profile.consumer === "jvm").map(profile => profile.id), ["java", "kotlin"]);
	assert.deepEqual(document.profiles.filter(profile => profile.consumer === "browser-javascript").map(profile => profile.id),
		["browser-javascript", "browser-react", "browser-worker"]);
	const cells = typeSurfaceCells(document, contracts);
	const expected = document.profiles.length * document.paths.length * document.shapes.reduce((count, shape) => count + document.families[shape.family].positions.length, 0);
	assert.equal(cells.length, expected);
	assert.equal(new Set(cells.map(cell => cell.id)).size, expected);
	for(const cell of cells)
	{
		assert.ok(cell.owner > 0 && cell.bounds && cell.ownership && cell.absence && cell.failure && cell.platform);
		assert.deepEqual(Object.keys(cell.stages), document.stages);
	}
});

test("recursive copied acceptance covers all seventeen profiles without promoting callable payloads", () => {
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.shape === "recursive");
	const installed = cells.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(installed.length, 102);
	assert.equal(new Set(installed.map(cell => cell.profile)).size, 17);
	const promoted = installed.filter(cell => ["dotnet", "java", "kotlin", "php-native", "php-wasm"].includes(cell.profile));
	assert.equal(promoted.length, 30);
	for(const cell of promoted)
	{
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(cell.hostType && cell.conversionNote);
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["managed-recursive-installed"]); }
	}
	const wit = installed.filter(cell => cell.profile === "wit-wasi");
	assert.equal(wit.length, 6);
	for(const cell of wit) for(const stage of Object.values(cell.stages))
	{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["wit-wasi-recursive-installed"]); }
	for(const cell of cells.filter(cell => cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed", cell.id);
});

test("Char installed evidence distinguishes npm record fields from scalar and callable evidence", () => {
	const profiles = ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"];
	const hosts = { c: "uint32_t", cpp: "char32_t", python: "str", rust: "char", dotnet: "System.Text.Rune", java: "int", kotlin: "Int", ruby: "String", perl: "text scalar", "php-native": "string", "php-wasm": "string", "wit-wasi": "char" };
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.shape === "char");
	const observed = cells.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(observed.length, 170);
	for(const cell of cells)
	{
		const npm = profiles.includes(cell.profile);
		const callable = cell.position.startsWith("callback-");
		const callableEvidence = npm ? "npm-callables-installed" : ["java", "kotlin"].includes(cell.profile) ? "jvm-callables-installed" : `${cell.profile}-callables-installed`;
		const covered = callable || ["parameter", "result", "field"].includes(cell.position);
		assert.equal(cell.stages.installedExecution.state, covered ? "passed" : "unreviewed", cell.id);
		if(!covered) continue;
		assert.equal(cell.hostType, npm ? "string" : hosts[cell.profile]);
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, [callable ? callableEvidence : npm ? cell.position === "field" ? "npm-records-installed" : "npm-installed-char" : "native-installed-char"]);
		}
	}
});

test("platform-word evidence binds all seventeen profiles to compiled widths and audited positions", () => {
	const cells = typeSurfaceCells(document, contracts).filter(cell => ["usize", "isize"].includes(cell.shape));
	const wasm = ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker", "php-wasm"];
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, 340);
	for(const cell of cells)
	{
		assert.equal(cell.wordBits, wasm.includes(cell.profile) ? 32 : 64);
		const npm = wasm.includes(cell.profile) && cell.profile !== "php-wasm";
		const callable = cell.position.startsWith("callback-");
		const callableEvidence = npm ? "npm-callables-installed" : ["java", "kotlin"].includes(cell.profile) ? "jvm-callables-installed" : `${cell.profile}-callables-installed`;
		const audited = callable || ["parameter", "result", "field"].includes(cell.position);
		assert.equal(cell.stages.installedExecution.state, audited ? "passed" : "unreviewed");
		if(audited)
		{
			assert.deepEqual(cell.stages.installedExecution.evidence, [callable ? callableEvidence : npm && cell.position === "field" ? "npm-records-installed" : "platform-words-installed"]);
			assert.ok(cell.conversionNote.includes(`${cell.wordBits}-bit compiled Lean target`));
		}
	}
});

test("List evidence covers all copied profiles and accepted C/C++/Rust callback payloads", () => {
	const profiles = ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"];
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.shape === "list");
	assert.equal(cells.filter(cell => cell.stages.installedExecution.state === "passed").length, 114);
	assert.equal(document.shapes.find(shape => shape.id === "list").ir, "constructor:list");
	for(const cell of cells)
	{
		const copied = ["parameter", "result", "field"].includes(cell.position), npm = profiles.includes(cell.profile), native = ["c", "cpp"].includes(cell.profile), python = cell.profile === "python", rust = cell.profile === "rust", dotnet = cell.profile === "dotnet";
		const jvm = ["java", "kotlin"].includes(cell.profile), wit = cell.profile === "wit-wasi";
		const ruby = cell.profile === "ruby", perl = cell.profile === "perl", php = ["php-native", "php-wasm"].includes(cell.profile);
		if((npm || native || python || rust || dotnet || jvm || ruby || perl || php || wit) && copied)
		{
			const pythonType = { parameter: "tuple[T, ...] | list[T]", result: "tuple[T, ...]", field: "tuple[T, ...] | list[T] (input); tuple[T, ...] (output)" };
			assert.equal(cell.hostType, wit ? "list<T> (owned Wasmtime component values)" : php ? "list<T> (consecutive-key PHP array)" : perl ? "Plain array reference" : ruby ? "Array" : jvm ? cell.profile === "java" ? "T[] (primitive arrays for primitive elements)" : "primitive arrays or Array<T>" : dotnet ? "T[]" : rust ? cell.position === "parameter" ? "&[T]" : "Vec<T>" : python ? pythonType[cell.position] : npm ? "ReadonlyArray<T> (ordinary dense Array)" : cell.profile === "c" ? "<prefix>_list_<element>_span" : "std::vector<T>");
			for(const stage of Object.values(cell.stages))
			{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, [wit ? "wit-wasi-lists-installed" : php ? cell.profile === "php-native" ? "php-native-lists-ffi-installed" : "php-wasm-lists-installed" : perl ? "perl-lists-installed" : ruby ? "ruby-lists-installed" : jvm ? "jvm-lists-installed" : dotnet ? "dotnet-lists-installed" : rust ? "rust-lists-installed" : python ? "python-lists-installed" : npm ? "npm-lists-installed" : "native-lists-installed"]); }
		} else if((native || rust) && cell.position.startsWith("callback-"))
		{
			assert.equal(cell.stages.installedExecution.state, "passed");
			assert.deepEqual(cell.stages.installedExecution.evidence, [`${cell.profile}-structured-callables-installed`]);
		} else
		{
			assert.equal(cell.stages.installedExecution.state, "unreviewed");
			if(npm && cell.position.startsWith("callback-")) assert.equal(cell.stages.compilation.state, "rejected");
		}
	}
});

test("collection evidence covers all seventeen profiles, both source paths and nineteen primitive fields", () => {
	const cells = typeSurfaceCells(document, contracts).filter(cell =>
		["array", "record"].includes(cell.shape) && ["parameter", "result", "field"].includes(cell.position)
		|| document.irFacets.primitive.includes(cell.shape) && cell.position === "field");
	assert.equal(document.profiles.length, 17); assert.equal(document.irFacets.primitive.length, 19);
	assert.equal(cells.length, 850);
	for(const profile of document.profiles) assert.equal(cells.filter(cell => cell.profile === profile.id).length, 50);
	for(const cell of cells)
	{
		assert.equal(cell.stages.installedExecution.state, "passed", cell.id);
		assert.ok(cell.stages.installedExecution.evidence.length > 0, cell.id);
		assert.ok(cell.hostType, cell.id);
	}
});

test("npm record evidence covers only copied positions and all nineteen primitive fields", () => {
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("npm-records-installed"));
	const profiles = ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"];
	assert.equal(observed.length, 250);
	for(const cell of observed)
	{
		assert.ok(profiles.includes(cell.profile));
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
	}
	for(const profile of profiles) for(const path of document.paths)
	{
		for(const shape of document.irFacets.primitive)
			assert.ok(observed.some(cell => cell.profile === profile && cell.path === path && cell.shape === shape && cell.position === "field"));
		for(const shape of ["record", "array"]) for(const position of ["parameter", "result", "field"])
			assert.ok(observed.some(cell => cell.profile === profile && cell.path === path && cell.shape === shape && cell.position === position));
	}
});

test("native compound evidence promotes exactly C/C++ copied positions on both paths", () => {
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("native-compounds-installed"));
	assert.equal(observed.length, 36);
	for(const cell of observed)
	{
		assert.ok(["c", "cpp"].includes(cell.profile));
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["option", "result", "tuple"].includes(cell.shape));
		assert.equal(cell.stages.installedExecution.state, "passed");
	}
});

for(const profile of ["python", "rust", "dotnet", "java", "kotlin", "ruby", "perl", "php-native", "php-wasm", "wit-wasi"]) test(`${profile} compound evidence promotes exactly eighteen copied positions on both paths`, () => {
	const cells = typeSurfaceCells(document, contracts);
	const evidence = ["java", "kotlin"].includes(profile) ? "jvm-compounds-installed" : `${profile}-compounds-installed`;
	const observed = cells.filter(cell => cell.profile === profile && cell.stages.installedExecution.evidence.includes(evidence));
	assert.equal(observed.length, 18);
	for(const cell of observed)
	{
		assert.equal(cell.profile, profile);
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["option", "result", "tuple"].includes(cell.shape));
		assert.equal(cell.stages.installedExecution.state, "passed");
	}
});

test("npm callable evidence covers five installed profiles without claiming fields or compound values", () => {
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("npm-callables-installed"));
	assert.equal(observed.length, 720);
	assert.equal(observed.filter(cell => cell.position.startsWith("callback-") || ["callback", "closure"].includes(cell.shape)).length, 400);
	assert.deepEqual([...new Set(observed.map(cell => cell.profile))].sort(), ["browser-javascript", "browser-react", "browser-worker", "node-javascript", "node-typescript"]);
	for(const cell of observed)
	{
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.notEqual(cell.position, "field");
		assert.ok([...document.irFacets.primitive, "callback", "closure"].includes(cell.shape));
		assert.ok(cell.conversionNote !== null || cell.hostType === "number" || cell.hostType === "bigint" || cell.hostType === "boolean");
	}
});

test("historical C callable evidence excludes GMP integers, other hosts and copied fields", () => {
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("c-callables-installed"));
	assert.equal(observed.length, 100);
	assert.ok(observed.every(cell => cell.profile === "c" && cell.position !== "field" && cell.stages.installedExecution.state === "passed"));
	assert.ok(observed.every(cell => !["nat", "int"].includes(cell.shape)));
	for(const path of document.paths)
	{
		for(const primitive of document.irFacets.primitive.filter(shape => !["nat", "int"].includes(shape))) for(const position of ["callback-parameter", "callback-result"])
			assert.ok(observed.some(cell => cell.path === path && cell.shape === primitive && cell.position === position));
		for(const [shape, position] of [["callback", "parameter"], ["closure", "result"]])
			assert.ok(observed.some(cell => cell.path === path && cell.shape === shape && cell.position === position));
	}
});

for(const profile of ["python", "ruby", "rust", "cpp", "dotnet", "java", "kotlin", "php-native", "php-wasm", "wit-wasi"]) test(`${profile} callable evidence promotes only its installed primitive and callable positions`, () => {
	const cells = typeSurfaceCells(document, contracts);
	const evidence = ["java", "kotlin"].includes(profile) ? "jvm-callables-installed" : `${profile}-callables-installed`;
	const observed = cells.filter(cell => cell.profile === profile && cell.stages.installedExecution.evidence.includes(evidence));
	assert.equal(observed.length, profile === "cpp" ? 120 : 112);
	assert.ok(observed.every(cell => cell.profile === profile && (cell.position !== "field" || profile === "cpp" && ["nat", "int"].includes(cell.shape)) && cell.stages.installedExecution.state === "passed"));
	if(profile === "cpp") assert.ok(observed.filter(cell => ["nat", "int"].includes(cell.shape)).every(cell => cell.hostType === "boost::multiprecision::cpp_int"));
	for(const path of document.paths)
	{
		for(const primitive of document.irFacets.primitive) for(const position of ["callback-parameter", "callback-result"])
			assert.ok(observed.some(cell => cell.path === path && cell.shape === primitive && cell.position === position));
		for(const [shape, position] of [["callback", "parameter"], ["closure", "result"]])
			assert.ok(observed.some(cell => cell.path === path && cell.shape === shape && cell.position === position));
	}
});

test("C exact integers use installed GMP values in every copied and primitive callable position", () => {
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.profile === "c" && ["nat", "int"].includes(cell.shape));
	assert.equal(cells.length, 20);
	for(const cell of cells)
	{
		assert.equal(cell.hostType, "mpz_t");
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, ["c-gmp-installed"]);
		}
	}
});

test("Perl installed evidence stays scoped to audited source paths and positions", () => {
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.profile === "perl");
	const state = (shape, position, sourcePath = "ordinary-source") => cells.find(cell => cell.shape === shape
		&& cell.position === position && cell.path === sourcePath).stages.installedExecution.state;
	for(const scalar of document.irFacets.primitive.filter(name => !["char", "usize", "isize"].includes(name)))
		for(const position of document.families.primitive.positions)
			assert.equal(state(scalar, position), "passed", `${scalar}/${position}`);
	for(const path of document.paths) for(const shape of ["array", "record"])
		for(const position of ["parameter", "result", "field"])
			assert.equal(state(shape, position, path), "passed", `${shape}/${path}/${position}`);
	assert.equal(state("array", "callback-result"), "limited");
	assert.equal(state("array", "callback-result", "reviewed-ir"), "unreviewed");
	assert.equal(state("resource", "result"), "passed");
	assert.equal(state("resource", "field"), "unreviewed");
	assert.equal(state("callback", "parameter"), "passed");
	assert.equal(state("closure", "result"), "passed");
	assert.equal(state("nat", "parameter", "reviewed-ir"), "passed");
	assert.equal(state("nat", "field", "reviewed-ir"), "passed");
	assert.equal(state("task", "signature"), "unreviewed");
});

test("Perl primitive callable evidence promotes no other profile or copied fields", () => {
	const cells = typeSurfaceCells(document, contracts);
	const covered = cells.filter(cell => cell.stages.installedExecution.evidence.includes("perl-callables-installed"));
	assert.equal(covered.length, 110);
	for(const cell of covered)
	{
		assert.equal(cell.profile, "perl");
		assert.notEqual(cell.position, "field");
		assert.equal(cell.stages.installedExecution.state, "passed");
	}
	for(const path of document.paths) for(const primitive of document.irFacets.primitive)
		for(const position of ["callback-parameter", "callback-result"])
			assert.ok(covered.some(cell => cell.path === path && cell.shape === primitive && cell.position === position));
});

for(const [profile, evidence] of [["php-native", "native-php-installed-copied"], ["php-wasm", "php-wasm-installed-copied"], ["rust", "native-rust-installed-copied"], ["dotnet", "native-dotnet-installed-copied"], ["java", "native-jvm-installed-copied"], ["kotlin", "native-jvm-installed-copied"], ["ruby", "native-ruby-installed-copied"], ["wit-wasi", "native-wit-installed-copied"], ["python", "native-python-installed-copied"]]) test(`ordinary ${profile} installed evidence stays within copied-value positions`, () => {
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.profile === profile && cell.path === "ordinary-source"
		&& cell.stages.installedExecution.state === "passed"
		&& !cell.position.startsWith("callback-") && !["callback", "closure"].includes(cell.shape));
	const compounds = ["python", "rust", "dotnet", "java", "kotlin", "ruby", "php-native", "php-wasm", "wit-wasi"].includes(profile) ? ["option", "result", "tuple"] : [];
	const lists = ["python", "rust", "dotnet", "java", "kotlin", "ruby", "php-native", "php-wasm", "wit-wasi"].includes(profile) ? ["list"] : [];
	const aliases = ["python", "rust", "dotnet", "java", "kotlin", "ruby", "php-native", "php-wasm", "wit-wasi"].includes(profile) ? ["alias"] : [];
	const variants = ["python", "rust", "dotnet", "java", "kotlin", "ruby", "php-native", "php-wasm", "wit-wasi"].includes(profile) ? ["variant"] : [];
	const recursive = ["rust", "python", "ruby", "dotnet", "java", "kotlin", "php-native", "php-wasm", "wit-wasi"].includes(profile) ? ["recursive"] : [];
	const recursiveEvidence = ["dotnet", "java", "kotlin", "php-native", "php-wasm"].includes(profile) ? "managed-recursive-installed" : `${profile}-recursive-installed`;
	const variantEvidence = ["java", "kotlin"].includes(profile) ? "jvm-variants-installed" : `${profile}-variants-installed`;
	const aliasEvidence = ["java", "kotlin"].includes(profile) ? "jvm-aliases-installed" : `${profile}-aliases-installed`;
	const compoundEvidence = ["java", "kotlin"].includes(profile) ? "jvm-compounds-installed" : `${profile}-compounds-installed`;
	assert.equal(observed.length, 63 + 3 * (compounds.length + lists.length + aliases.length + variants.length + recursive.length));
	assert.deepEqual([...new Set(observed.map(cell => cell.shape))].sort(), [...document.irFacets.primitive, "array", "record", ...compounds, ...lists, ...aliases, ...variants, ...recursive].sort());
	for(const cell of observed)
	{
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{
			assert.equal(stage.state, "passed");
			assert.deepEqual(stage.evidence, [recursive.includes(cell.shape) ? recursiveEvidence : variants.includes(cell.shape) ? variantEvidence : aliases.includes(cell.shape) ? aliasEvidence : lists.includes(cell.shape) ? ["java", "kotlin"].includes(profile) ? "jvm-lists-installed" : profile === "php-native" ? "php-native-lists-ffi-installed" : `${profile}-lists-installed` : compounds.includes(cell.shape) ? compoundEvidence : cell.shape === "char" ? "native-installed-char" : ["usize", "isize"].includes(cell.shape) ? "platform-words-installed" : evidence]);
		}
	}
	for(const cell of cells.filter(cell => cell.profile === profile
		&& cell.path === "ordinary-source" && !observed.includes(cell)
		&& !cell.stages.installedExecution.evidence.some(id => ["python-callables-installed", "ruby-callables-installed", "rust-callables-installed", "rust-structured-callables-installed", "cpp-callables-installed", "dotnet-callables-installed", "jvm-callables-installed", "php-native-callables-installed", "php-wasm-callables-installed", "wit-wasi-callables-installed"].includes(id))))
		assert.equal(cell.stages.installedExecution.state, "unreviewed", cell.id);
});

for(const [name, change] of [
	["primitive", schema => schema.$defs.typeRef.oneOf[0].properties.name.enum.push("decimal")]
	, ["constructor", schema => schema.$defs.typeRef.oneOf[3].properties.constructor.enum.push("map")]
	, ["named kind", schema => schema.$defs.typeDefinition.properties.kind.enum.push("union")]
	, ["type reference", schema => schema.$defs.typeRef.oneOf.push({ properties: { kind: { const: "dependent" } } })]
	, ["declaration", schema => schema.$defs.declaration.properties.kind.enum.push("event")]
	, ["delivery", schema => schema.$defs.declaration.properties.resultMode.enum.push("stream")]
	, ["ownership", schema => schema.$defs.ownershipSite.properties.ownership.enum.push("shared")]
	, ["callback ownership", schema => schema.$defs.parameter.properties.ownership.enum.push("shared")]
	, ["callback effect", schema => schema.$defs.callable.properties.effects.items.enum.push("transaction")]
]) test(`a new ${name} fails until its type-surface classification is reviewed`, () => {
	const irSchema = clone(contracts.irSchema);
	change(irSchema);
	assert.throws(() => validateTypeSurface(document, { ...contracts, irSchema }), /unclassified or missing/);
});

test("missing, duplicate, foreign and unclassified source/profile entries cannot disappear", () => {
	for(const change of [
		value => value.shapes.splice(value.shapes.findIndex(shape => shape.id === "proof"), 1)
		, value => value.shapes.push({ ...value.shapes[0], id: "unclassified" })
		, value => value.profiles.splice(0, 1)
		, value => value.profiles.push(clone(value.profiles[0]))
		, value => { value.profiles[0].consumer = "php-native"; }
		, value => { value.profiles[0].language = "php"; }
		, value => { value.shapes.find(shape => shape.id === "nat").ir = "primitive:int"; }
	]){
		const candidate = clone(document);
		change(candidate);
		assert.throws(() => validateTypeSurface(candidate, contracts));
	}
	const consumers = clone(contracts.consumers);
	consumers.consumers.push({ ...consumers.consumers[0], id: "new-language" });
	assert.throws(() => validateTypeSurface(document, { ...contracts, consumers }), /consumer profiles/);
});

test("refinements, host null and erased proofs retain their individual value positions", () => {
	const cells = typeSurfaceCells(document, contracts);
	for(const shape of ["fin", "subtype", "host-null", "proof"])
	{
		const selected = cells.filter(cell => cell.profile === "python" && cell.path === "ordinary-source" && cell.shape === shape);
		assert.deepEqual(selected.map(cell => cell.position), document.positions.filter(position => shape === "proof" || position !== "signature"));
		assert.ok(selected.every(cell => cell.requirement === (shape === "proof" ? "required-erasure" : "required")));
	}
});

test("unknown fields, versions, evidence states and unsafe paths fail closed", () => {
	for(const change of [
		value => { value.schemaVersion = 2; }
		, value => { value.hiddenSupport = true; }
		, value => { value.shapes[0].supported = true; }
		, value => { value.observations[0].stages.generation.state = "probably-supported"; }
		, value => { value.evidence[0].files[0].path = "../outside"; }
		, value => { value.evidence[0].files[0].path = "/etc/passwd"; }
		, value => { value.evidence[0].files[0].path = "C:/outside"; }
		, value => { value.evidence[0].files[0].sha256 = "not-a-hash"; }
	]){
		const candidate = observationFixture();
		change(candidate);
		assert.throws(() => validateTypeSurface(candidate, contracts));
	}
});

test("inspection, generation, installation and execution are distinct evidence stages", () => {
	const candidate = observationFixture();
	assert.equal(validateTypeSurface(candidate, contracts), true);
	candidate.observations[0].stages.generation.state = "passed";
	assert.throws(() => validateTypeSurface(candidate, contracts), /inspection cannot establish a passing test/);
	candidate.evidence[0].kind = "test";
	assert.equal(validateTypeSurface(candidate, contracts), true);
	candidate.observations[0].stages.installedExecution = stage("passed");
	assert.throws(() => validateTypeSurface(candidate, contracts), /installed execution needs archive evidence/);
	candidate.evidence[0].kind = "installed";
	assert.throws(() => validateTypeSurface(candidate, contracts), /installed evidence needs exact archives/);
	candidate.evidence[0].artifacts = [{ path: "example-1.0.0.tgz", sha256: "f".repeat(64) }];
	assert.throws(() => validateTypeSurface(candidate, contracts), /installed execution lacks analysis/);
	for(const name of candidate.stages) candidate.observations[0].stages[name] = stage("passed");
	assert.equal(validateTypeSurface(candidate, contracts), true);
	assert.equal(typeSurfaceGapReport(candidate, contracts).installedTestedCells, 2);
	candidate.observations[0].hostTypes.nat.result = null;
	assert.throws(() => validateTypeSurface(candidate, contracts), /installed execution needs host types/);
});

test("missing evidence and ambiguous overlapping observations are rejected", () => {
	const candidate = observationFixture();
	candidate.observations[0].stages.generation.evidence = ["missing"];
	assert.throws(() => validateTypeSurface(candidate, contracts), /unknown evidence/);
	candidate.observations[0].stages.generation.evidence = [];
	assert.throws(() => validateTypeSurface(candidate, contracts), /missing or unexplained evidence/);
	candidate.observations[0].stages.generation = stage("inspected");
	candidate.observations.push({ ...clone(candidate.observations[0]), id: "conflicting-audit" });
	assert.throws(() => validateTypeSurface(candidate, contracts), /Overlapping observations/);
});

test("partial evidence cannot leak across a position, source path or language profile", () => {
	const candidate = observationFixture();
	const cells = typeSurfaceCells(candidate, contracts);
	assert.equal(cells.filter(cell => cell.observation !== null).length, 2);
	for(const id of [
		"node-javascript/nat/ordinary-source/field"
		, "node-javascript/nat/ordinary-source/callback-parameter"
		, "node-javascript/nat/reviewed-ir/parameter"
		, "node-typescript/nat/ordinary-source/parameter"
		, "browser-worker/nat/ordinary-source/parameter"
	]){
		const cell = cells.find(entry => entry.id === id);
		assert.equal(cell.hostType, null, id);
		assert.equal(cell.stages.generation.state, "unreviewed", id);
	}
	cells.find(cell => cell.observation !== null).stages.generation.state = "passed";
	assert.equal(candidate.observations[0].stages.generation.state, "inspected", "Returned evidence cannot mutate the inventory");
});

test("rejections and partial ranges remain required work, and exclusions need review evidence", () => {
	const candidate = observationFixture();
	candidate.observations[0].stages.generation = stage("rejected");
	const report = typeSurfaceGapReport(candidate, contracts);
	assert.equal(report.complete, false);
	assert.ok(report.gaps.some(gap => gap.state === "rejected" && gap.implementationOwner === 1218 && gap.requirement === "required"));
	candidate.observations[0].stages.generation = stage("limited");
	candidate.evidence[0].kind = "test";
	assert.throws(() => validateTypeSurface(candidate, contracts), /limited result needs its boundary/);
	candidate.observations[0].limitations = ["Only small integers were tested."];
	assert.equal(validateTypeSurface(candidate, contracts), true);
	candidate.baseline.exclusions.push({ profile: "node-javascript", shape: "nat", reason: "Test exclusion", decisionEvidence: "test-evidence", followUp: 1218 });
	assert.throws(() => validateTypeSurface(candidate, contracts), /recorded review decision/);
});

test("the inventory command keeps unknown filters closed and emits unreviewed cells as JSON", async () => {
	const result = await execute(process.execPath, ["scripts/type-surface.mjs", "--json", "--profile", "php-wasm", "--shape", "array"], { cwd: root });
	const report = JSON.parse(result.stdout);
	assert.equal(report.complete, false);
	assert.equal(report.selectedCells.length, 10);
	assert.equal(report.cells, 10);
	assert.equal(report.profiles, 1);
	assert.equal(report.shapes, 1);
	assert.equal(report.requiredGaps, report.gaps.length);
	assert.ok(report.selectedCells.every(cell => cell.profile === "php-wasm" && cell.shape === "array"));
	assert.ok(report.gaps.every(gap => gap.cell.startsWith("php-wasm/array/")));
	const complete = JSON.parse((await execute(process.execPath, ["scripts/type-surface.mjs", "--json", "--profile", "php-wasm", "--shape", "char"], { cwd: root })).stdout);
	assert.equal(complete.complete, true); assert.equal(complete.requiredGaps, 0);
	await assert.rejects(execute(process.execPath, ["scripts/type-surface.mjs", "--json", "--profile", "unknown"], { cwd: root }), /Unknown profile/);
	await assert.rejects(execute(process.execPath, ["scripts/type-surface.mjs", "--unknown"], { cwd: root }), /Use --json/);
});

test("changing an audited source fails before the inventory can feed a report", async () => {
	assert.ok(document.evidence.length > 0, "The initial audit must record evidence, not only empty cells");
	const temporary = await mkdtemp(path.join(tmpdir(), "lean-type-surface-"));
	try
	{
		const files = [
			"docs/type-surface.v1.json"
			, "schema/binding-ir.schema.json"
			, "docs/consumer-support.v1.json"
			, ...document.evidence.flatMap(entry => entry.files.map(file => file.path))
		];
		for(const file of files)
		{
			await mkdir(path.dirname(path.join(temporary, file)), { recursive: true });
			await cp(path.join(root, file), path.join(temporary, file));
		}
		assert.ok((await readTypeSurface({ repository: temporary })).document);
		const file = document.evidence[0].files[0].path;
		await writeFile(path.join(temporary, file), `${await readFile(path.join(temporary, file), "utf8")}\n// changed\n`);
		await assert.rejects(readTypeSurface({ repository: temporary }), /stale source evidence/);
	}
	finally
{ await rm(temporary, { recursive: true, force: true }); }
});
