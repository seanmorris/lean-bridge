/**
 * Reconcile fresh nominal primitive metadata and execute the generated native Lean wrappers.
 * These source checks do not establish an installed C ABI or consumer-runtime result.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../../src/build/native-model.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { nominalPrimitiveSubtypeAssertions } from "./nominal-primitive-subtype-assertions.mjs";

/**
 * Accept only the complete, known unit-binding diagnostics from native wrapper generation.
 *
 * @param output - Unmodified Lean stdout, also retained in the command record.
 */
export const assertNominalPrimitiveNativeDiagnostics = output => {
	for(const warning of [
		"Variable name `unit` is not explicitly referenced.\n\nThe binding can be removed (if unused) or named `_` (if used implicitly).\n\nNote: This linter can be disabled with `set_option linter.unusedVariables false`\n"
		, "Local variable 'unit' resembles constructor 'PUnit.unit' - write '.unit' (with a dot) or 'PUnit.unit' to use the constructor.\n\nNote: This linter can be disabled with `set_option linter.constructorNameAsVariable false`\n"
	]) {
		const escaped = warning.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
		output = output.replace(new RegExp(`^PrimitiveNativeAdapters\\.lean:[0-9]+:[0-9]+: warning: ${escaped}`, "gmu"), "");
	}
	assert.equal(output, "", "Unexpected output from generated native primitive adapters");
};

/**
 * Build from measured compiler facts, compare the independently authored API and execute every case.
 *
 * @param options - Fresh request/report, source context, review, artifact paths and compiler runner.
 */
export const checkNominalPrimitiveNativeSource = async options => {
	const { report, request, context, directory, reports, route, run, review, expected, resultOnly, leanCommit } = options;
	const modules = [];
	for(const module of context.modules)
	{
		const source = await readFile(join(directory, module.sourcePath));
		const olean = await readFile(join(directory, `${module.name}.olean`));
		assert.equal(sha256(source), module.sourceSha256);
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
	const model = createNativeModel({ metadata: report, sourceIdentity, component: expected.component }, { refinements: true });
	assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
	assert.deepEqual(reviewedSubtypeContracts(model.bindingIr), reviewedSubtypeContracts(expected));
	const generated = generateNativeLeanAdapters(model);
	const call = name => {
		const entry = model.exports.find(item => item.name === name); assert.ok(entry, name);
		return `${generated.module}.f_${entry.symbol}`;
	};
	const cases = nominalPrimitiveSubtypeAssertions({ call, component: false, resultOnly });
	const source = generated.leanSource + "\n" + cases.map(item => item.source).join("\n\n") + "\n";
	assert.doesNotMatch(source, /\b(?:sorry|axiom|unsafe|partial|unsafeCast|defaultValue)\b|_root_\.null|_root_\.undefined/u);
	await writeFile(join(directory, "PrimitiveNativeAdapters.lean"), source);
	const built = await run(["-c", "PrimitiveNativeAdapters.c", "PrimitiveNativeAdapters.lean"]);
	assert.equal(built.stderr, ""); assertNominalPrimitiveNativeDiagnostics(built.stdout);
	if(reports) for(const [suffix, value] of [["lean", source], ["model.json", canonicalJson(model)], ["cases.json", canonicalJson(cases)]])
		await writeFile(join(reports, `${route}-native-adapters.${suffix}`), value, { flag: "wx" });
	return { route, kind: "nominal-primitive-native-source-check"
		, exports: model.exports.length, leanRuntimeChecks: cases.length
		, execution: "host-Lean-evaluator", installedAcceptance: false
		, modelSha256: sha256(canonicalJson(model)), sourceSha256: sha256(source)
		, generatedCSha256: sha256(await readFile(join(directory, "PrimitiveNativeAdapters.c"))) };
};
