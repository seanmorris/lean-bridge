/**
 * Fresh Lean preserves per-use decisions through native adapters and independently reviewed APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../../src/analyze/elaborated-metadata.mjs";
import { projectionCheckedSelection } from "../../src/analyze/checked-refinement-selection.mjs";
import { exportContractProblem } from "../../src/analyze/export-configuration.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { nominalSelectionContracts, selectedCase, selectedConstructor, selectedEnvelope, selectedEvent, selectedField, selectedRecord, selectedSite, selectedTree, selectedVariant } from "./nominal-subtype-selection-fixture.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { nominalSubtypeReviewInput, nominalSubtypeReviewedFixture } from "./nominal-subtype-reviewed-fixture.mjs";
import { checkNominalNativeSource } from "./nominal-subtype-native-source.mjs";
import { checkComponentSubtypeSource, nominalComponentAssertions } from "./component-nominal-subtype-source.mjs";

const enabled = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_SELECTION_TEST === "1"
	|| process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_EXTRACTOR_TEST === "1"
	|| (process.env.LEAN_BRIDGE_SUBTYPE_PROFILES?.split(",") ?? []).includes("c");

test("fresh Lean preserves nominal constructor selections and rejects false source decisions", { skip: !enabled, timeout: 600_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-selection-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Failed source-check artifacts retained at ${directory}`);
	});
	const reports = process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_SELECTION_REPORTS;
	if(reports) await mkdir(reports, { recursive: false });
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const extractor = resolve("src/analyze/NativeExports.lean");
	const environment = { ...process.env, LEAN_PATH: directory, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` };
	const commands = [];
	const run = async (args, command = lean) => {
		try
		{
			const result = await promisify(execFile)(command, args, {
				cwd: directory, env: environment
				, maxBuffer: 16 * 1024 * 1024, signal: t.signal
			});
			commands.push({ command: command === lean ? "lean" : command, arguments: args.map(value => value === extractor ? "src/analyze/NativeExports.lean" : value), ...result });
			return result;
		}
		catch(error)
		{ error.message += `\n${error.stdout ?? ""}\n${error.stderr ?? ""}`; throw error; }
	};
	const modules = [];
	for(const [name, source] of [
		["NominalConversion", "tests/fixtures/nominal-subtype-conversion/NominalConversion.lean"]
		, ["NominalSelection", "tests/fixtures/nominal-subtype-selection/NominalSelection.lean"]
	]) {
		await cp(source, join(directory, `${name}.lean`));
		const compiled = await run(["-o", `${name}.olean`, `${name}.lean`]);
		if(name === "NominalSelection") assert.match(compiled.stdout, /^NominalSelection\.lean:\d+:\d+: warning: declaration uses `sorry`\n$/u);
		else assert.equal(compiled.stdout, "");
		assert.equal(compiled.stderr, "");
		const identity = await identifyLeanInterface(join(directory, `${name}.olean`));
		modules.push({ name, sourcePath: `${name}.lean`, sourceSha256: sha256(await readFile(source)), interfaceSha256: identity.interfaceSha256 });
	}
	const context = {
		toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor))
		, modules
	};
	const observations = [];
	const extract = async (profile, contracts, route, review) => {
		const selection = {
			profile
			, modules: modules.map(module => module.name)
			, exportModules: modules.map(module => module.name)
			, exports: Object.keys(contracts), resources: [], arities: [], contracts
			, ...(review ? reviewedSourceSelection(review) : {})
		};
		const request = createMetadataRequest(selection, { ...context, ...(review ? { reviewedBindingIrSha256: sha256(canonicalJson(review)) } : {}) });
		const path = join(directory, `${route}-request.json`);
		await writeFile(path, canonicalJson(request));
		const output = await run(["--run", extractor, "--metadata", path]);
		assert.equal(output.stderr, "");
		const report = JSON.parse(output.stdout);
		await writeFile(join(directory, `${route}-metadata.json`), output.stdout);
		if(reports)
		{
			await cp(path, join(reports, `${route}-request.json`));
			await writeFile(join(reports, `${route}-metadata.json`), output.stdout, { flag: "wx" });
		}
		await assertJsonSchema("elaborated-export-metadata", report);
		const projections = new Map(report.modules.flatMap(module => module.declarations.filter(item => item.selected)
			.map(item => [item.identity, item.projection])));
		assert.deepEqual([...projections.keys()].sort(), selection.exports.toSorted());
		observations.push({ route, profile, requestSha256: sha256(canonicalJson(request)), metadataSha256: sha256(output.stdout), selected: projections.size });
		if(profile === "native-library-v1" && !route.endsWith("refusals"))
			observations.push(await checkNominalNativeSource({ report, request, context, directory, reports, route, run, lean, review }));
		if(profile === "component-scalars-v1" && !route.endsWith("refusals"))
			observations.push(await checkComponentSubtypeSource({ report
				, request, context, directory, reports, route, run, review
				, expected: nominalSubtypeReviewedFixture()
				, assertions: nominalComponentAssertions }));
		return { report, request, projections };
	};
	const checkPositive = ({ projections }, contracts) => {
		for(const [name, contract] of Object.entries(contracts))
		{
			const projection = projections.get(name);
			assert.equal(projection.status, "supported", `${name}: ${projection.expression}`);
			assert.equal(exportContractProblem(contract, projection), null);
			assert.deepEqual(projection.parameters.map(parameter => projectionCheckedSelection(parameter.type)), contract.parameters.map(site => site.refinement ?? null));
			assert.deepEqual(projectionCheckedSelection(projection.result), contract.result.refinement ?? null);
		}
		const envelope = projections.get("NominalConversion.first").parameters[0].type;
		assert.deepEqual(envelope.fields[1].type.predicate, { kind: "fin", bound: "3" });
		const pair = projections.get("NominalConversion.nested").parameters[0].type;
		assert.equal(pair.fields[0].type.fields[0].type.predicate.constructor, "NominalConversion.plusOne");
		assert.equal(pair.fields[1].type.fields[0].type.predicate.constructor, "NominalConversion.plusTwo");
	};
	const invalidContracts = () => {
		const make = (parameters, result = null) => ({ parameters: parameters.map(selectedSite), result: selectedSite(result) });
		const fields = selectedEnvelope("plusOne").fields;
		const changedConstructor = name => selectedRecord("NominalConversion.Envelope",
			selectedField("payload", { constructor: name }), selectedField("digit", null));
		const event = selectedEvent("plusOne", "plusTwo");
		let deep = selectedConstructor("plusOne");
		for(let depth = 0; depth < 33; depth++) deep = selectedRecord("NominalConversion.Envelope", selectedField("payload", deep));
		const wide = selectedRecord("Library.Wide", ...Array.from({ length: 1024 }, (_, index) => selectedField(`field${index}`, index ? null : selectedConstructor("plusOne"))));
		return Object.fromEntries(Object.entries({
			wrongName: make([selectedRecord("Library.Other", ...fields)])
			, wrongOrder: make([selectedRecord("NominalConversion.Envelope", ...fields.toReversed())])
			, extraField: make([selectedRecord("NominalConversion.Envelope", ...fields, selectedField("extra", null))])
			, missingField: make([selectedRecord("NominalConversion.Envelope", fields[0])])
			, duplicateField: make([selectedRecord("NominalConversion.Envelope", ...fields, fields[0])])
			, emptySelection: make([selectedRecord("NominalConversion.Envelope", selectedField("payload", null), selectedField("digit", null))])
			, ...Object.fromEntries(["wrongInput", "wrongPredicate", "unsafe", "partial", "foreign", "sorry"].map(name => [
				`${name}Selection`
				, make([changedConstructor(`NominalSelection.${["wrongInput", "wrongPredicate"].includes(name) ? name : name + "Choice"}`)])
			]))
			, outsideSelection: make([changedConstructor("Option.some")])
			, unknownSelection: make([changedConstructor("NominalSelection.doesNotExist")])
			, wrongCaseOrder: make([{ ...event, cases: event.cases.toReversed() }])
			, extraCase: make([{ ...event, cases: [...event.cases, selectedCase("extra")] }])
			, missingCase: make([{ ...event, cases: event.cases.slice(1) }])
			, duplicateCase: make([{ ...event, cases: [...event.cases, event.cases[0]] }])
			, wrongCaseField: make([{ ...event, cases: event.cases.map(branch => branch.name === "box"
				? selectedCase("box", selectedField("other", selectedEnvelope("plusOne"))) : branch) }])
			, tooDeep: make([deep])
			, tooWide: make([selectedTree("tuple", wide, wide)])
			, resultOnly: make([null])
			, callback: { parameters: [{ ownership: "borrow", lifetime: { scope: "call", anchor: null }, refinement: selectedEnvelope("plusOne") }, selectedSite(selectedEnvelope("plusOne"))] }
			, generic: make([selectedRecord("NominalSelection.GenericPositive", selectedField("value", selectedConstructor("plusOne")))])
			, recursive: make([selectedVariant("NominalSelection.Chain", selectedCase("empty"),
				selectedCase("node", selectedField("value", selectedConstructor("plusOne")), selectedField("tail", null)))])
		}).map(([name, value]) => [`NominalSelection.${name}`, value]));
	};
	for(const profile of ["native-library-v1", "component-scalars-v1"])
	{
		const contracts = nominalSelectionContracts();
		const forward = await extract(profile, contracts, `${profile}-forward`);
		checkPositive(forward, contracts);
		validateElaboratedMetadata(forward.report, forward.request);
		const reverseContracts = Object.fromEntries(Object.entries(contracts).toReversed());
		const reverse = await extract(profile, reverseContracts, `${profile}-reverse`);
		checkPositive(reverse, contracts);
		assert.deepEqual(reverse.projections, forward.projections);
		const review = nominalSubtypeReviewInput();
		const reviewed = await extract(profile, contracts, `${profile}-reviewed`, review);
		validateElaboratedMetadata(reviewed.report, reviewed.request);
		assert.deepEqual(reviewed.projections, forward.projections);
		const refused = invalidContracts();
		// Both profiles check constructor-free results in their separate result source fixture.
		delete refused["NominalSelection.resultOnly"];
		const invalid = await extract(profile, refused, `${profile}-refusals`);
		for(const [name, projection] of invalid.projections)
			assert.equal(projection.status, "unsupported", `${profile}/${name}: ${canonicalJson(projection)}`);
		const diagnostic = name => invalid.projections.get(`NominalSelection.${name}`).expression;
		for(const name of ["wrongOrder", "extraField", "missingField", "wrongCaseOrder", "extraCase", "missingCase"])
			assert.match(diagnostic(name), /does not match the compiler-checked Subtype/u);
		assert.match(diagnostic("wrongInputSelection"), /input must equal/u);
		assert.match(diagnostic("wrongPredicateSelection"), /exact subtype/u);
		for(const name of ["unsafeSelection", "partialSelection", "foreignSelection"]) assert.match(diagnostic(name), /unsafe, partial or foreign/u);
		assert.match(diagnostic("sorrySelection"), /depends on sorry/u);
		assert.match(diagnostic("outsideSelection"), /selected module/u);
		for(const name of ["tooDeep", "tooWide"]) assert.match(diagnostic(name), /depth or node limit/u);
		assert.match(diagnostic("recursive"), /recursive nominal constructor selections/u);
	}
	if(reports) await writeFile(join(reports, "report.json"), canonicalJson({ schemaVersion: 1, context, observations, commands, installedSupport: false }), { flag: "wx" });
	complete = true;
});
