/**
 * Fresh ordinary and independent-review result-only adapters, with no input constructor choices.
 * Source checks are not installed-package acceptance.
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
import { reviewedContractDifference, reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { nominalSubtypeReviewInput } from "./nominal-subtype-reviewed-fixture.mjs";
import { subtypeResultReviewedFixture, subtypeResultMixedFixture } from "./subtype-result-fixture.mjs";
import { assertJsonSchema } from "./json-schema.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { brokerHeader } from "../../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../../src/build/native-component.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_SUBTYPE_RESULT_SOURCE_TEST === "1"
	|| process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_EXTRACTOR_TEST === "1"
	|| (process.env.LEAN_BRIDGE_SUBTYPE_PROFILES?.split(",") ?? []).includes("c");

test("fresh Lean projects constructor-free native Subtype results and retains input and graph gates", { skip: !enabled, timeout: 600_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-subtype-results-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true, force: true });
		else t.diagnostic(`Failed source-check artifacts retained at ${directory}`);
	});
	const reports = process.env.LEAN_BRIDGE_SUBTYPE_RESULT_REPORTS;
	if(reports) await mkdir(reports, { recursive: false });
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2", "bin/lean");
	const extractor = resolve("src/analyze/NativeExports.lean"), commands = [];
	const environment = { ...process.env, LEAN_PATH: directory, PATH: `${dirname(lean)}:${process.env.PATH ?? "/usr/bin:/bin"}` };
	const run = async (args, command = lean) => {
		try
		{
			const result = await promisify(execFile)(command, args, { cwd: directory, env: environment, maxBuffer: 16 * 1024 * 1024, signal: t.signal });
			commands.push({ command: command === lean ? "lean" : command, arguments: args.map(value => value === extractor ? "src/analyze/NativeExports.lean" : value), ...result });
			return result;
		}
		catch(error)
		{ error.message += `\n${error.stdout ?? ""}\n${error.stderr ?? ""}`; throw error; }
	};
	const sourcePath = "tests/fixtures/nominal-subtype-result/NominalResults.lean";
	await cp(sourcePath, join(directory, "NominalResults.lean"));
	assert.deepEqual(await run(["-o", "NominalResults.olean", "NominalResults.lean"]), { stdout: "", stderr: "" });
	const identity = await identifyLeanInterface(join(directory, "NominalResults.olean"));
	const source = await readFile(sourcePath), olean = await readFile(join(directory, "NominalResults.olean"));
	const context = {
		toolchain: "leanprover/lean4:v4.32.2"
		, leanCompilerSha256: sha256(await readFile(lean))
		, extractorSha256: sha256(await readFile(extractor))
		, modules: [{ name: "NominalResults", sourcePath: "NominalResults.lean", sourceSha256: sha256(source), interfaceSha256: identity.interfaceSha256 }]
	};
	const authored = subtypeResultReviewedFixture(), observations = [];
	assert.equal(reviewedSubtypeContracts(authored), undefined);
	const extract = async (route, selection, review) => {
		const request = createMetadataRequest({ profile: "native-library-v1", modules: ["NominalResults"], exportModules: ["NominalResults"], resources: [], arities: [], ...selection },
			{ ...context, ...(review ? { reviewedBindingIrSha256: sha256(canonicalJson(review)) } : {}) });
		const path = join(directory, `${route}-request.json`);
		await writeFile(path, canonicalJson(request));
		const output = await run(["--run", extractor, "--metadata", path]);
		assert.equal(output.stderr, "");
		const report = JSON.parse(output.stdout);
		await assertJsonSchema("elaborated-export-metadata", report);
		validateElaboratedMetadata(report, request);
		if(reports)
		{
			await cp(path, join(reports, `${route}-request.json`));
			await writeFile(join(reports, `${route}-metadata.json`), output.stdout, { flag: "wx" });
		}
		observations.push({ route, requestSha256: sha256(canonicalJson(request)), metadataSha256: sha256(output.stdout) });
		return { report, request, projections: new Map(report.modules.flatMap(module => module.declarations.filter(item => item.selected).map(item => [item.identity, item.projection]))) };
	};
	let ordinary;
	for(const route of ["ordinary", "reversed", "reviewed", "mixed-reviewed"])
	{
		const mixed = route === "mixed-reviewed", expected = mixed ? subtypeResultMixedFixture() : authored;
		const review = route.endsWith("reviewed") ? nominalSubtypeReviewInput(expected) : undefined;
		const names = expected.declarations.map(item => item.source.declaration);
		const selection = review ? reviewedSourceSelection(review) : { exports: route === "reversed" ? names.toReversed() : names };
		const { report, request, projections } = await extract(route, selection, review);
		assert.equal(projections.size, mixed ? 15 : 13);
		for(const [name, projection] of projections)
		{
			assert.equal(projection.status, "supported", `${name}: ${projection.expression}`);
			assert.equal(projectionCheckedSelection(projection.result), null);
		}
		if(ordinary && mixed) for(const [name, projection] of ordinary) assert.deepEqual(projections.get(name), projection);
		else if(ordinary) assert.deepEqual(projections, ordinary);
		else ordinary = projections;
		const version = await run(["--version"]), leanCommit = /commit ([a-f0-9]{40})/u.exec(version.stdout)?.[1];
		assert.ok(leanCommit);
		const modules = [{ module: "NominalResults"
			, source: { path: "NominalResults.lean", bytes: source.length, sha256: sha256(source) }
			, interface: { bytes: olean.length, sha256: sha256(olean), interfaceSha256: identity.interfaceSha256 } }];
		const configuration = canonicalJson({ schemaVersion: 1, modules: ["NominalResults"] });
		const sourceIdentity = { leanVersion: "4.32.2", leanCommit
			, leanCompilerSha256: context.leanCompilerSha256
			, extractorSha256: context.extractorSha256
			, sourceTreeSha256: sha256(canonicalJson(modules)), modules, request
			, exportConfigurationSource: configuration
			, exportConfigurationSha256: sha256(configuration)
			, ...(review ? { reviewedBindingIr: review } : {}) };
		const model = createNativeModel({ metadata: report, sourceIdentity, component: authored.component }, { refinements: true });
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		assert.deepEqual(reviewedSubtypeContracts(model.bindingIr), reviewedSubtypeContracts(expected));
		const generated = generateNativeLeanAdapters(model);
		assert.doesNotMatch(generated.leanSource, /_root_\.null/u);
		if(!mixed)
		{
			assert.doesNotMatch(generated.leanSource, /_refinement_|def lb_checked_|checkedOne|checkedTwo/u);
			assert.doesNotMatch(generated.header, /_refinement_/u);
		}
		const call = name => `${generated.module}.f_${model.exports.find(item => item.name === `NominalResults.${name}`).symbol}`;
		const checks = [
			`example : ${call("scalar")} 120 = 121 := by decide`
			, `example : (${call("produceEnvelope")} 120).payload = 121 := by decide`
			, `example : (${call("produceEnvelope")} 120).digit = 2 := by decide`
			, `example : ${call("arrayValues")} 120 = #[121, 122] := by native_decide`
			, `example : ${call("listValues")} 120 = [121, 122] := by decide`
			, `example : ${call("optional")} 0 = none := by decide`
			, `example : ${call("optional")} 120 = some 121 := by decide`
			, `example : ${call("product")} 120 = (121, 122) := by decide`
			, `example : (match ${call("branch")} 0 with | .error value => (false, value) | .ok value => (true, value)) = (false, 1) := by decide`
			, `example : (match ${call("branch")} 120 with | .error value => (false, value) | .ok value => (true, value)) = (true, 121) := by decide`
			, `example : ((${call("groupValues")} 120)[1]!).map (fun value => value.payload) = some 121 := by native_decide`
			, `example : ((${call("pairValues")} 120).right[1]!).map (fun value => value.payload) = some 122 := by native_decide`
			, `example : (match ${call("eventValue")} 120 with | .box value => value.payload | _ => 0) = 121 := by decide`
			, `example : (match ${call("eventEmpty")} 120 with | .empty => true | _ => false) = true := by decide`
			, `example : ((match ${call("eventChoices")} 120 with | .choices values => values | _ => #[]).map (fun (item : Option (Except Nat Nat)) => item.map (fun (value : Except Nat Nat) => match value with | .ok n => (true, n) | .error n => (false, n)))) = #[none, some (true, 121), some (false, 122)] := by native_decide`
			, `example : ${call("noItems")} 120 = #[] := by native_decide`
		];
		if(mixed) checks.push(
			`example : ((${call("echoGroups")} #[some ⟨40, 2⟩]).bind (fun values => values[0]!)).map (fun value => value.payload) = some 41 := by native_decide`
			, `example : (${call("echoGroups")} #[some ⟨100, 2⟩]).isNone = true := by native_decide`
			, `example : ((${call("echoPair")} ⟨#[some ⟨40, 2⟩], #[some ⟨40, 2⟩]⟩).bind (fun value => value.right[0]!)).map (fun value => value.payload) = some 42 := by native_decide`
			, `example : (${call("echoPair")} ⟨#[some ⟨40, 2⟩], #[some ⟨95, 2⟩]⟩).isNone = true := by native_decide`
			, `example : (${call("echoGroups")} #[some ⟨40, 3⟩]).isNone = true := by native_decide`
		);
		const adapter = generated.leanSource + "\n" + checks.join("\n") + "\n";
		await saveLakeFile(directory, "ResultAdapters.lean", adapter);
		const compiled = await run(["ResultAdapters.lean"]);
		assert.equal(compiled.stderr, "");
		assert.doesNotMatch(compiled.stdout, /error:|sorry/u);
		const warnings = [...compiled.stdout.matchAll(/^ResultAdapters\.lean:\d+:\d+: warning: (.+)$/gmu)].map(match => match[1]);
		assert.equal(warnings.length, 8);
		assert.ok(warnings.every(warning => warning === "Variable name `unit` is not explicitly referenced."
			|| warning === "Local variable 'unit' resembles constructor 'PUnit.unit' - write '.unit' (with a dot) or 'PUnit.unit' to use the constructor."));
		for(const [path, value] of Object.entries({ ...generateCBindingPackage(model.bindingIr), ...generateCppBindingPackage(model.bindingIr), ...boostSources() })) await saveLakeFile(directory, path, value);
		await saveLakeFile(directory, "component.h", generated.header);
		await saveLakeFile(directory, "lean_bridge_native_runtime.h", brokerHeader + nativeCallbackHeader);
		const native = generateNativePrimitiveC(model, { initializer: `initialize_${generated.module}` });
		await saveLakeFile(directory, "native.c", native);
		await run(["-std=c11", "-Wall", "-Wextra", "-Werror", "-pthread", "-fsyntax-only", "-I", directory, "-I", join(directory, "include"), "-I", join(directory, "internal"), "-I", join(dirname(dirname(lean)), "include"), "native.c"], "/usr/bin/cc");
		await run(["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", join(directory, "include"), "src/subtype_results.cpp"], "/usr/bin/c++");
		if(reports) for(const [suffix, value] of [["lean", adapter], ["c", native], ["model.json", canonicalJson(model)]]) await writeFile(join(reports, `${route}-adapters.${suffix}`), value, { flag: "wx" });
		observations.push({ route, leanAssertions: checks.length, cSyntax: true, cppSyntax: true, adapterSha256: sha256(adapter), nativeSha256: sha256(native), modelSha256: sha256(canonicalJson(model)) });
	}
	const refusedNames = ["uncheckedInput", "uncheckedEnvelope", "callbackResult", "genericResult", "recursiveResult", "checkedResult"];
	const refused = await extract("refusals", { exports: refusedNames.map(name => `NominalResults.${name}`), arities: [["NominalResults.callbackResult", 1]] });
	for(const [name, projection] of refused.projections) assert.equal(projection.status, "unsupported", `${name}: ${canonicalJson(projection)}`);
	assert.match(refused.projections.get("NominalResults.recursiveResult").expression, /acyclic copied/u);
	const control = await extract("controls", { exports: ["NominalResults.plainRecursive", "NominalResults.finOnly"] });
	assert.ok([...control.projections.values()].every(projection => projection.status === "supported"));
	assert.equal(control.projections.get("NominalResults.plainRecursive").result.kind, "graph");
	assert.deepEqual(control.projections.get("NominalResults.finOnly").result.fields[0].type.predicate, { kind: "fin", bound: "3" });
	const component = await extract("component-refusals", { profile: "component-scalars-v1", exports: authored.declarations.map(item => item.source.declaration) });
	assert.ok([...component.projections.values()].every(projection => projection.status === "unsupported"));
	if(reports) await writeFile(join(reports, "report.json"), canonicalJson({ schemaVersion: 1, context, observations, commands, installedSupport: false }), { flag: "wx" });
	complete = true;
});
