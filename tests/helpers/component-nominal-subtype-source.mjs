/**
 * Compile public component adapters from fresh Lean metadata and an independent review.
 * This establishes source admission, not installed host/runtime acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { projectElaboratedMetadata } from "../../src/analyze/project-elaborated.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { generateCompilerAdapters } from "../../src/build/compiler-adapters.mjs";
import { generateComponentRecursiveAdapters } from "../../src/build/component-recursive-adapters.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { assertJsonSchema } from "./json-schema.mjs";

/**
 * Pass measured compiler evidence through public analysis, reconciliation and adapter generation.
 *
 * @param options - Fresh request/report, expected independent API and assertion factory.
 */
export const checkComponentSubtypeSource = async options => {
	const { report, request, context, directory, reports, route, run, review, expected, assertions } = options;
	const configuration = { schemaVersion: 1, modules: context.modules.map(module => module.name) };
	const inputs = [];
	for(const module of context.modules)
	{
		const source = await readFile(join(directory, module.sourcePath));
		assert.equal(sha256(source), module.sourceSha256);
		inputs.push({ path: module.sourcePath, bytes: source.length, sha256: sha256(source) });
	}
	if(review) inputs.push({ path: review.path, bytes: Buffer.byteLength(review.source), sha256: review.sourceSha256 });
	const inventory = {
		project: { name: expected.component.name, version: expected.component.version
			, toolchain: context.toolchain, toolVersion: "4.32.2" }
		, configurationRecord: { configuration, sha256: sha256(canonicalJson(configuration)) }
		, inputs, sourceTreeSha256: sha256(canonicalJson(inputs)) };
	const elaboration = { request, metadata: report
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256
		, ...(review ? { reviewedBindingIr: review } : {}) };
	const analysis = projectElaboratedMetadata(inventory
		, context.modules.map(module => ({ module: module.name, path: module.sourcePath })), elaboration);
	assert.equal(analysis.adapterHints.length, 0);
	assert.equal(analysis.bindingIr.origin, "lean-elaborated");
	assert.equal(reviewedContractDifference(expected, analysis.bindingIr.document), null);
	assert.deepEqual(reviewedSubtypeContracts(analysis.bindingIr.document), reviewedSubtypeContracts(expected));
	if(review) assert.ok(analysis.bindingIr.document.declarations.every(item => item.parameters.every(parameter => parameter.name.startsWith("value"))));
	const componentPlan = {
		sha256: sha256(canonicalJson({ bindingIr: analysis.bindingIr.semanticSha256, request }))
		, document: { bindingIr: { semanticSha256: analysis.bindingIr.semanticSha256 } }
	};
	const generated = generateCompilerAdapters({ analysis, componentPlan });
	assert.equal(generated.plan.privateAbi.version, 8);
	await assertJsonSchema("binding-ir", analysis.bindingIr.document);
	await assertJsonSchema("compiler-adapter-plan", generated.plan);
	const call = name => {
		const item = generated.plan.exports.find(item => item.bindingId === `lean:${name}`)
			?? generated.plan.exports.find(item => item.sourceDeclaration === name);
		assert.ok(item, name); return `${generated.plan.module}.${item.wrapper}`;
	};
	const checks = assertions(call);
	const source = generated.files["LeanBridgeGenerated.lean"] + "\n" + checks.join("\n") + "\n";
	assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b|_root_\.null|_root_\.undefined/u);
	await writeFile(join(directory, "ComponentSubtypeAdapters.lean"), source);
	const compiled = await run(["-c", "ComponentSubtypeAdapters.c", "ComponentSubtypeAdapters.lean"]);
	assert.equal(compiled.stdout, ""); assert.equal(compiled.stderr, "");
	const frame = generateComponentRecursiveAdapters(generated.plan.privateAbi, generated.plan);
	if(reports) for(const [suffix, value] of [
		["lean", source], ["plan.json", canonicalJson(generated.plan)]
		, ["binding-ir.json", canonicalJson(analysis.bindingIr.document)]
		, ["frame.c", frame]
	]) await writeFile(join(reports, `${route}-component-adapters.${suffix}`), value, { flag: "wx" });
	return { route
		, kind: "public-component-subtype-source-check"
		, reviewed: Boolean(review)
		, leanAssertions: checks.length, exports: generated.plan.exports.length
		, metadataAdmission: true, installedAcceptance: false
		, sourceSha256: sha256(source)
		, planSha256: sha256(canonicalJson(generated.plan))
		, generatedCSha256: sha256(await readFile(join(directory, "ComponentSubtypeAdapters.c")))
		, frameSha256: sha256(frame) };
};

/**
 * Compile one compiler-selected recursive Subtype graph without a hand-authored expected IR.
 *
 * @param options - Fresh request/report and compiler execution context.
 */
export const checkRecursiveComponentSubtypeSource = async options => {
	const { report, request, context, directory, reports, route, run } = options;
	const component = { name: "recursive-refinements", version: "1.0.0" };
	const configuration = { schemaVersion: 1, modules: context.modules.map(module => module.name) };
	const inputs = [];
	for(const module of context.modules)
	{
		const source = await readFile(join(directory, module.sourcePath));
		assert.equal(sha256(source), module.sourceSha256);
		inputs.push({ path: module.sourcePath, bytes: source.length, sha256: sha256(source) });
	}
	const inventory = { project: { ...component, toolchain: context.toolchain, toolVersion: "4.32.2" }
		, configurationRecord: { configuration, sha256: sha256(canonicalJson(configuration)) }
		, inputs, sourceTreeSha256: sha256(canonicalJson(inputs)) };
	const elaboration = { request, metadata: report
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256 };
	const analysis = projectElaboratedMetadata(inventory
		, context.modules.map(module => ({ module: module.name, path: module.sourcePath })), elaboration);
	assert.equal(analysis.adapterHints.length, 0);
	assert.equal(analysis.bindingIr.document.declarations.length, 1);
	const declaration = analysis.bindingIr.document.declarations[0];
	assert.equal(declaration.source.declaration, "NominalSelection.recursive");
	const refinements = declaration.source.extensions["lean-lang.org/refinements"];
	assert.equal(refinements.parameters[0].kind, "variant");
	assert.equal(refinements.parameters[0].cases[1].fields[0].refinement.constructor, "NominalConversion.plusOne");
	assert.equal(refinements.parameters[0].cases[1].fields[1].refinement, null);
	const componentPlan = { sha256: sha256(canonicalJson({ bindingIr: analysis.bindingIr.semanticSha256, request }))
		, document: { bindingIr: { semanticSha256: analysis.bindingIr.semanticSha256 } } };
	const generated = generateCompilerAdapters({ analysis, componentPlan });
	const item = generated.plan.exports[0], call = `${generated.plan.module}.${item.wrapper}`;
	const checks = [
		`example : ${call} #[.empty] = #[0] := by decide`
		, `example : ${call} #[.node 40 (.node 80 .empty)] = #[0] := by native_decide`
		, `example : ${call} #[.node 40 (.node 100 .empty)] = #[] := by native_decide`
		, `example : ${call} #[.node 40 (.node 80 (.node 20 .empty))] = #[0] := by native_decide`
		, `example : ${call}_refinement_0 #[.node 40 (.node 80 .empty)] = 1 := by native_decide`
		, `example : ${call}_refinement_0 #[.node 40 (.node 100 .empty)] = 0 := by native_decide`
	];
	const source = generated.files["LeanBridgeGenerated.lean"] + "\n" + checks.join("\n") + "\n";
	assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b|_root_\.null|_root_\.undefined/u);
	assert.equal((source.match(/def LbErased\.NominalSelection\.Chain\.via_/gu) ?? []).length, 1);
	await writeFile(join(directory, "RecursiveComponentSubtypeAdapters.lean"), source);
	const compiled = await run(["-c", "RecursiveComponentSubtypeAdapters.c", "RecursiveComponentSubtypeAdapters.lean"]);
	assert.equal(compiled.stdout, ""); assert.equal(compiled.stderr, "");
	const frame = generateComponentRecursiveAdapters(generated.plan.privateAbi, generated.plan);
	if(reports) for(const [suffix, value] of [
		["lean", source]
		, ["plan.json", canonicalJson(generated.plan)]
		, ["binding-ir.json", canonicalJson(analysis.bindingIr.document)]
		, ["frame.c", frame]
	]) await writeFile(join(reports, `${route}-component-adapters.${suffix}`), value, { flag: "wx" });
	return { route
		, kind: "recursive-component-subtype-source-check"
		, leanAssertions: checks.length
		, metadataAdmission: true
		, installedAcceptance: false
		, sourceSha256: sha256(source)
		, planSha256: sha256(canonicalJson(generated.plan))
		, generatedCSha256: sha256(await readFile(join(directory, "RecursiveComponentSubtypeAdapters.c")))
		, frameSha256: sha256(frame) };
};

/**
 * Compile the same fresh native compiler report through the fixed-width PHP-Wasm graph route.
 * This proves source/model/adapter admission; installed Node and browser execution is separate.
 *
 * @param options - Fresh native request/report and compiler execution context.
 */
export const checkRecursivePhpWasmSubtypeSource = async options => {
	const { report, request, context, directory, reports, route, run } = options;
	const component = { id: "recursive-refinements@1.0.0", name: "recursive-refinements", version: "1.0.0" };
	const version = await run(["--version"]), leanCommit = /commit ([a-f0-9]{40})/u.exec(version.stdout)?.[1];
	assert.ok(leanCommit, version.stdout);
	const modules = [];
	for(const module of context.modules)
	{
		const source = await readFile(join(directory, module.sourcePath));
		const olean = await readFile(join(directory, `${module.name}.olean`));
		modules.push({
			module: module.name
			, source: { path: module.sourcePath, bytes: source.length, sha256: module.sourceSha256 }
			, interface: { bytes: olean.length, sha256: sha256(olean), interfaceSha256: module.interfaceSha256 }
		});
	}
	const model = createCompiledPhpWasmModel({
		metadata: report
		, component
		, sourceIdentity: {
			leanVersion: "4.32.2", leanCommit
			, leanCompilerSha256: context.leanCompilerSha256
			, extractorSha256: context.extractorSha256
			, sourceTreeSha256: sha256(canonicalJson(modules))
			, modules, request
		}
	});
	assert.equal(model.profile, "php-wasm-copied-v1");
	assert.equal(model.pointerBits, 32);
	assert.ok(model.copiedGraph);
	assert.equal(model.exports.length, 1);
	const item = model.exports[0];
	assert.equal(item.name, "NominalSelection.recursive");
	assert.equal(item.refinements.parameters[0].kind, "variant");
	assert.equal(item.refinements.parameters[0].cases[1].fields[0].refinement.constructor, "NominalConversion.plusOne");
	assert.equal(item.refinements.parameters[0].cases[1].fields[1].refinement, null);
	const generated = generateCompiledPhpWasmLeanAdapters(model), call = `${generated.module}.export0`;
	const checks = [
		`example : ${call} #[.empty] = #[0] := by decide`
		, `example : ${call} #[.node 40 (.node 80 .empty)] = #[0] := by native_decide`
		, `example : ${call} #[.node 40 (.node 100 .empty)] = #[] := by native_decide`
		, `example : ${call} #[.node 40 (.node 80 (.node 20 .empty))] = #[0] := by native_decide`
	];
	const source = generated.leanSource + "\n" + checks.join("\n") + "\n";
	assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b|_root_\.null|_root_\.undefined/u);
	assert.equal((source.match(/def LbErased\.NominalSelection\.Chain\.via_/gu) ?? []).length, 1);
	await writeFile(join(directory, "RecursivePhpWasmSubtypeAdapters.lean"), source);
	const compiled = await run(["-c", "RecursivePhpWasmSubtypeAdapters.c", "RecursivePhpWasmSubtypeAdapters.lean"]);
	assert.equal(compiled.stdout, ""); assert.equal(compiled.stderr, "");
	if(reports) for(const [suffix, value] of [
		["lean", source]
		, ["model.json", canonicalJson(model)]
		, ["header.h", generated.header]
	]) await writeFile(join(reports, `${route}-php-wasm-adapters.${suffix}`), value, { flag: "wx" });
	return { route
		, kind: "recursive-php-wasm-subtype-source-check"
		, leanAssertions: checks.length
		, metadataAdmission: true, installedAcceptance: false
		, sourceSha256: sha256(source)
		, modelSha256: sha256(canonicalJson(model))
		, generatedCSha256: sha256(await readFile(join(directory, "RecursivePhpWasmSubtypeAdapters.c")))
		, headerSha256: sha256(generated.header) };
};

/**
 * Independent expected results, including two successful normalizers for the same input.
 *
 * @param call - Resolve source declarations to generated public wrappers.
 */
export const nominalComponentAssertions = call => {
	const f = name => call(`NominalConversion.${name}`);
	const n = name => call(`NominalSelection.${name}`);
	return [
		`example : ${f("first")} #[⟨40, 2⟩] = #[41] := by decide`
		, `example : ${f("second")} #[⟨40, 2⟩] = #[42] := by decide`
		, `example : ${f("combine")} #[⟨40, 2⟩] #[⟨40, 2⟩] = #[4142] := by decide`
		, `example : ${f("nested")} #[⟨⟨40, 2⟩, ⟨40, 2⟩⟩] = #[4142] := by decide`
		, `example : ${f("first")} #[⟨100, 2⟩] = #[] := by decide`
		, `example : ${f("first")} #[⟨40, 3⟩] = #[] := by decide`
		, `example : ${f("second")} #[⟨90, 2⟩] = #[] := by decide`
		, `example : ${f("combine")} #[⟨40, 2⟩] #[⟨90, 2⟩] = #[] := by decide`
		, `example : ${f("nested")} #[⟨⟨40, 2⟩, ⟨40, 3⟩⟩] = #[] := by decide`
		, `example : ${f("first")} #[] = #[] := by decide`
		, `example : ${f("first")} #[⟨40, 2⟩, ⟨40, 2⟩] = #[] := by decide`
		, `example : ${f("eventFirst")} #[.empty] = #[0] := by decide`
		, `example : ${f("eventFirst")} #[.box ⟨40, 2⟩] = #[41] := by decide`
		, `example : ${f("eventSecond")} #[.box ⟨40, 2⟩] = #[42] := by decide`
		, `example : ${f("eventFirst")} #[.choices #[none, some (.ok 95)]] = #[96] := by native_decide`
		, `example : ${f("eventFirst")} #[.choices #[some (.error 95)]] = #[] := by native_decide`
		, `example : ${f("eventSecond")} #[.choices #[some (.error 95)]] = #[96] := by native_decide`
		, `example : (${f("echo")} #[⟨40, 2⟩]).map (fun value => value.payload) = #[41] := by native_decide`
		, `example : (${f("produce")} #[120]).map (fun value => value.payload) = #[121] := by native_decide`
		, `example : (${f("produceEvent")} #[120]).map (fun event => match event with | .box value => value.payload | _ => 0) = #[121] := by native_decide`
		, `example : ${call("NominalSelection.aliases")} #[#[some ⟨95, 2⟩]] #[#[some ⟨40, 2⟩]] = #[2] := by native_decide`
		, `example : ${call("NominalSelection.aliases")} #[#[some ⟨40, 2⟩]] #[#[some ⟨95, 2⟩]] = #[] := by native_decide`
		, `example : ${call("NominalSelection.inspectAliasPair")} #[⟨#[some ⟨95, 2⟩], #[some ⟨40, 2⟩]⟩] = #[2] := by native_decide`
		, `example : ${call("NominalSelection.inspectAliasPair")} #[⟨#[some ⟨40, 2⟩], #[some ⟨95, 2⟩]⟩] = #[] := by native_decide`
		, `example : ${n("genericUse")} #[⟨40, 2⟩] = #[43] := by decide`
		, `example : ${n("genericUse")} #[⟨100, 2⟩] = #[] := by decide`
		, `example : (${n("echoGenericFirst")} #[⟨40, 2⟩]).map (fun value => value.value) = #[41] := by native_decide`
		, `example : (${n("echoGenericSecond")} #[⟨40, 2⟩]).map (fun value => value.value) = #[42] := by native_decide`
		, `example : (${n("echoGenericFirst")} #[⟨95, 2⟩]).map (fun value => value.value) = #[96] := by native_decide`
		, `example : ${n("echoGenericSecond")} #[⟨95, 2⟩] = #[] := by decide`
		, `example : ${call("NominalSelection.plainFin")} #[3] = #[] := by decide`
		, `example : ${f("first")}_fin_guard_0 #[⟨100, 2⟩] = 1 := by decide`
		, `example : ${f("first")}_fin_guard_0 #[⟨40, 3⟩] = 0 := by decide`
		, `example : ${f("first")}_refinement_0 #[⟨100, 2⟩] = 0 := by decide`
		, `example : ${f("eventFirst")}_fin_guard_0 #[.empty] = 1 := by decide`
		, `example : ${f("eventFirst")}_fin_guard_0 #[.box ⟨40, 3⟩] = 0 := by decide`
	];
};

/**
 * Constructor-free projections and optional mixed-package input normalization.
 *
 * @param call - Resolve source declarations to generated public wrappers.
 * @param mixed - Include the two independently selected input conversions.
 */
export const resultComponentAssertions = (call, mixed) => {
	const f = name => call(`NominalResults.${name}`);
	const checks = [
		`example : ${f("scalar")} #[120] = #[121] := by decide`
		, `example : (${f("produceEnvelope")} #[120]).map (fun value => value.payload) = #[121] := by native_decide`
		, `example : (${f("produceEnvelope")} #[120]).map (fun value => value.digit) = #[2] := by native_decide`
		, `example : ${f("arrayValues")} #[120] = #[#[121, 122]] := by native_decide`
		, `example : ${f("listValues")} #[120] = #[[121, 122]] := by native_decide`
		, `example : ${f("optional")} #[0] = #[none] := by decide`
		, `example : ${f("optional")} #[120] = #[some 121] := by decide`
		, `example : ${f("product")} #[120] = #[(121, 122)] := by decide`
		, `example : (${f("branch")} #[0]).map (fun result => match result with | .error n => (false, n) | .ok n => (true, n)) = #[(false, 1)] := by native_decide`
		, `example : (${f("branch")} #[120]).map (fun result => match result with | .error n => (false, n) | .ok n => (true, n)) = #[(true, 121)] := by native_decide`
		, `example : (${f("groupValues")} #[120]).map (fun values => values.map (fun value => value.map (fun value => value.payload))) = #[#[none, some 121]] := by native_decide`
		, `example : (${f("pairValues")} #[120]).map (fun pair => pair.right.map (fun value => value.map (fun value => value.payload))) = #[#[none, some 122]] := by native_decide`
		, `example : (${f("eventValue")} #[120]).map (fun event => match event with | .box value => value.payload | _ => 0) = #[121] := by native_decide`
		, `example : (${f("eventEmpty")} #[120]).map (fun event => match event with | .empty => true | _ => false) = #[true] := by native_decide`
		, `example : (${f("eventChoices")} #[120]).map (fun event => (match event with | .choices values => values | _ => #[]).map (fun (value : Option (Except Nat Nat)) => value.map (fun (value : Except Nat Nat) => match value with | .ok n => (true, n) | .error n => (false, n)))) = #[#[none, some (true, 121), some (false, 122)]] := by native_decide`
		, `example : ${f("noItems")} #[120] = #[#[]] := by native_decide`
	];
	if(mixed) checks.push(
		`example : (${f("echoGroups")} #[#[some ⟨40, 2⟩]]).map (fun values => values.map (fun value => value.map (fun value => value.payload))) = #[#[some 41]] := by native_decide`
		, `example : (${f("echoGroups")} #[#[some ⟨100, 2⟩]]).size = 0 := by native_decide`
		, `example : (${f("echoPair")} #[⟨#[some ⟨40, 2⟩], #[some ⟨40, 2⟩]⟩]).map (fun pair => pair.right.map (fun value => value.map (fun value => value.payload))) = #[#[some 42]] := by native_decide`
		, `example : (${f("echoPair")} #[⟨#[some ⟨40, 2⟩], #[some ⟨95, 2⟩]⟩]).size = 0 := by native_decide`
		, `example : (${f("echoGroups")} #[#[some ⟨40, 3⟩]]).size = 0 := by native_decide`
	);
	return checks;
};
