/**
 * Compile adapters from fresh nominal metadata and an independently authored review.
 * This checks source compilation, not source-free installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { generateCBindingPackage } from "../../src/backends/c/generate.mjs";
import { generateCppBindingPackage } from "../../src/backends/cpp/generate.mjs";
import { boostSources } from "../../src/backends/cpp/boost.mjs";
import { generateNativePrimitiveC } from "../../src/backends/c/native-primitives.mjs";
import { brokerHeader } from "../../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../../src/build/native-component.mjs";
import { nominalSubtypeReviewedFixture } from "./nominal-subtype-reviewed-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Build each route's model from separately measured sources, compile Lean assertions and both C surfaces.
 *
 * @param options - Fresh request/report, measured identities and the abortable compiler runner.
 */
export const checkNominalNativeSource = async options => {
	const { report, request, context, directory, reports, route, run, lean, review } = options;
	const version = await run(["--version"]);
	const leanCommit = /commit ([a-f0-9]{40})/u.exec(version.stdout)?.[1];
	assert.ok(leanCommit, version.stdout);
	const modules = [];
	for(const module of context.modules)
	{
		const source = await readFile(join(directory, module.sourcePath));
		const olean = await readFile(join(directory, `${module.name}.olean`));
		modules.push({ module: module.name
			, source: { path: module.sourcePath, bytes: source.length, sha256: sha256(source) }
			, interface: { bytes: olean.length, sha256: sha256(olean), interfaceSha256: module.interfaceSha256 } });
	}
	const configuration = canonicalJson({ schemaVersion: 1, modules: context.modules.map(module => module.name) });
	const sourceIdentity = { leanVersion: "4.32.2", leanCommit
		, leanCompilerSha256: context.leanCompilerSha256
		, extractorSha256: context.extractorSha256
		, sourceTreeSha256: sha256(canonicalJson(modules)), modules, request
		, exportConfigurationSource: configuration
		, exportConfigurationSha256: sha256(configuration)
		, ...(review ? { reviewedBindingIr: review } : {}) };
	const authored = nominalSubtypeReviewedFixture();
	const model = createNativeModel({ metadata: report, sourceIdentity, component: authored.component }, { refinements: true });
	assert.equal(reviewedContractDifference(authored, model.bindingIr), null);
	assert.deepEqual(reviewedSubtypeContracts(model.bindingIr), reviewedSubtypeContracts(authored));
	if(review) assert.ok(model.bindingIr.declarations.every(item => item.parameters.every(parameter => parameter.name.startsWith("value"))));
	const generated = generateNativeLeanAdapters(model);
	const call = name => `${generated.module}.f_${model.exports.find(item => item.name === name).symbol}`;
	const f = name => call(`NominalConversion.${name}`);
	const checks = [
		`example : ${f("first")} ⟨40, 2⟩ = some 41 := by decide`
		, `example : ${f("second")} ⟨40, 2⟩ = some 42 := by decide`
		, `example : ${f("combine")} ⟨40, 2⟩ ⟨40, 2⟩ = some 4142 := by decide`
		, `example : ${f("nested")} ⟨⟨40, 2⟩, ⟨40, 2⟩⟩ = some 4142 := by decide`
		, `example : ${f("first")} ⟨100, 2⟩ = none := by decide`
		, `example : ${f("first")} ⟨40, 3⟩ = none := by decide`
		, `example : ${f("second")} ⟨90, 2⟩ = none := by decide`
		, `example : ${f("combine")} ⟨40, 2⟩ ⟨90, 2⟩ = none := by decide`
		, `example : ${f("nested")} ⟨⟨40, 2⟩, ⟨40, 3⟩⟩ = none := by decide`
		, `example : ${f("eventFirst")} .empty = some 0 := by decide`
		, `example : ${f("eventFirst")} (.box ⟨40, 2⟩) = some 41 := by decide`
		, `example : ${f("eventSecond")} (.box ⟨40, 2⟩) = some 42 := by decide`
		, `example : ${f("eventFirst")} (.choices #[none, some (.ok 95)]) = some 96 := by native_decide`
		, `example : ${f("eventFirst")} (.choices #[some (.error 95)]) = none := by native_decide`
		, `example : ${f("eventSecond")} (.choices #[some (.error 95)]) = some 96 := by native_decide`
		, `example : ((${f("echo")} ⟨40, 2⟩).map fun value => value.payload) = some 41 := by decide`
		, `example : (${f("produce")} 120).payload = 121 := by decide`
		, `example : (match ${f("produceEvent")} 120 with | .box value => value.payload | _ => 0) = 121 := by decide`
		, `example : ${call("NominalSelection.aliases")} #[some ⟨95, 2⟩] #[some ⟨40, 2⟩] = some 2 := by native_decide`
		, `example : ${call("NominalSelection.aliases")} #[some ⟨40, 2⟩] #[some ⟨95, 2⟩] = none := by native_decide`
		, `example : ${call("NominalSelection.inspectAliasPair")} ⟨#[some ⟨95, 2⟩], #[some ⟨40, 2⟩]⟩ = some 2 := by native_decide`
		, `example : ${call("NominalSelection.inspectAliasPair")} ⟨#[some ⟨40, 2⟩], #[some ⟨95, 2⟩]⟩ = none := by native_decide`
		, `example : ${call("NominalSelection.plainFin")} 3 = none := by decide`
	];
	const adapter = generated.leanSource + "\n" + checks.join("\n") + "\n";
	await saveLakeFile(directory, "NominalAdapters.lean", adapter);
	const compiled = await run(["NominalAdapters.lean"]);
	assert.equal(compiled.stderr, "");
	assert.equal(compiled.stdout, "");
	for(const [path, source] of Object.entries(generateCBindingPackage(model.bindingIr))) await saveLakeFile(directory, path, source);
	for(const [path, source] of Object.entries(generateCppBindingPackage(model.bindingIr))) await saveLakeFile(directory, path, source);
	for(const [path, source] of Object.entries(boostSources())) await saveLakeFile(directory, path, source);
	await saveLakeFile(directory, "component.h", generated.header);
	await saveLakeFile(directory, "lean_bridge_native_runtime.h", brokerHeader + nativeCallbackHeader);
	const native = generateNativePrimitiveC(model, { initializer: `initialize_${generated.module}` });
	await saveLakeFile(directory, "native.c", native);
	await run(["-std=c11", "-Wall", "-Wextra", "-Werror", "-pthread", "-fsyntax-only", "-I", directory, "-I", join(directory, "include"), "-I", join(directory, "internal"), "-I", join(dirname(dirname(lean)), "include"), "native.c"], "/usr/bin/cc");
	await run(["-std=c++20", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", join(directory, "include"), "src/nominal_subtypes.cpp"], "/usr/bin/c++");
	if(reports)
	{
		for(const [suffix, source] of [["lean", adapter], ["c", native], ["model.json", canonicalJson(model)]])
			await writeFile(join(reports, `${route}-adapters.${suffix}`), source, { flag: "wx" });
	}
	return { route, leanAssertions: checks.length
		, cSyntax: true, cppSyntax: true, reviewed: Boolean(review)
		, modelSha256: sha256(canonicalJson(model))
		, adapterSha256: sha256(adapter), nativeSha256: sha256(native) };
};
