/**
 * Require the foreign-carrier supplement as well as the existing raw/public installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { finContainerEdgeReviewedIr } from "./fin-container-edges.mjs";
import { assertFinContainerEdgeReport, finContainerEdgeReportModel } from "./fin-container-edge-report.mjs";
import { finContainerEdgeInterposer } from "./fin-container-edge-dispatch.mjs";
import { finForeignCases, finForeignExpected, finForeignHeader, finForeignProbe, finForeignSymbols } from "./fin-container-foreign-carriers.mjs";

const signatures = ir => {
	const shape = (type, depth = 0) => {
		assert.ok(depth < 32, "Finite alias depth required");
		if(type.kind === "primitive") return type.name;
		if(type.kind === "named")
		{
			const aliases = ir.types.filter(item => item.id === type.id);
			assert.equal(aliases.length, 1); assert.equal(aliases[0].kind, "alias");
			return shape(aliases[0].target, depth + 1);
		}
		assert.equal(type.kind, "apply");
		return { [type.constructor]: type.arguments.map(item => shape(item, depth + 1)) };
	};
	return ir.declarations.map(item => ({
		name: item.source.declaration
		, parameters: item.parameters.map(parameter => shape(parameter.type))
		, result: shape(item.result.type)
		, refinements: item.source.extensions?.["lean-lang.org/refinements"]
	})).sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Verify exact ordinary-source signatures before using recorded IR to regenerate the foreign header.
 *
 * @param ir - Receipt-bound full Binding IR.
 * @param expectedHash - The producer and package report's original IR digest.
 */
export const assertFinForeignBindingIr = (ir, expectedHash) => {
	assert.ok(ir && typeof ir === "object");
	assert.equal(hashBindingIr(ir), expectedHash);
	assert.deepEqual(signatures(ir), signatures(finContainerEdgeReviewedIr()));
};

/**
 * Refuse partial, re-labelled, stale or uninstrumented installed selections.
 *
 * @param report - Full canonical installed report with the additive foreignCarriers observation.
 * @param profiles - Exact sorted native profiles.
 * @param options - Optional Python floor, passed to the existing complete report gate.
 */
export const assertFinForeignReport = async (report, profiles, options = {}) => {
	await assertFinContainerEdgeReport(report, profiles, options);
	for(const item of report.reports)
	{
		const value = item.foreignCarriers, raw = item.dispatch.rawAdapter;
		assert.ok(value && typeof value === "object", `${item.profile}: missing foreign-carrier observation`);
		assert.equal(value.kind, "fin-container-foreign-carriers-v1");
		assert.equal(value.packageProfile, item.profile);
		assert.equal(value.caller, "Separate C foreign-carrier probe of receipt-verified installed native libraries; not a public-language consumer");
		assert.equal(value.instrument, "LD_PRELOAD with runtime defining-library checks");
		assert.equal(value.componentId, raw.componentId);
		assert.equal(value.libraryDirectory, raw.libraryDirectory);
		assert.deepEqual(value.libraries, raw.libraries);
		for(const key of ["columns", "measuredAdapters", "measuredSources", "sourceFunctionsNotMeasured", "modelSha256", "installedFilesSha256", "receiptSha256"])
			assert.deepEqual(value[key], raw[key], key);
		for(const key of ["observed", "missingInstrumentRefused", "installedFilesUnchanged", "runtimeDefinitionsChecked"])
			assert.equal(value[key], true, key);
		if(item.profile === "python")
		{
			assert.equal(Object.hasOwn(value, "exactPackageFiles"), false);
			assert.equal(Object.hasOwn(value, "packageFileSetSha256"), false);
		}
		else
		{
			assert.equal(value.exactPackageFiles, true);
			assert.equal(value.packageFileSetSha256, item.packageFileSetSha256);
		}
		assert.deepEqual(Object.keys(value.definitions).sort(), [...new Set([...Object.keys(raw.definitions), ...finForeignSymbols])].sort());
		for(const owner of Object.values(value.definitions)) assert.ok(Object.hasOwn(value.libraries, owner));
		for(const [symbol, owner] of Object.entries(raw.definitions)) assert.equal(value.definitions[symbol], owner);
		assert.deepEqual(value.publicSymbols, finForeignSymbols);
		assert.equal(value.cases, finForeignCases.length);
		assert.equal(value.recoveryPairsPerEntrypoint, 1000);
		assert.equal(value.measuredCalls, finForeignExpected.at(-1)[2]);
		assert.deepEqual(value.observations, finForeignExpected);
		const transcript = finForeignExpected.map(([name, status, calls, counts]) => `foreign-carrier ${name} ${status} ${calls} ${counts.join(" ")}\n`).join("");
		assert.equal(value.stdoutSha256, sha256(transcript));
		assertFinForeignBindingIr(value.bindingIr, item.bindingIrSha256);
		assert.equal(value.headerOrigin, "production-generated from receipt-pinned Binding IR");
		const model = { ...finContainerEdgeReportModel(value.componentId), bindingIr: value.bindingIr };
		assert.equal(value.bindingIr.component.id, value.componentId);
		const paths = symbols => Object.fromEntries(symbols.map(symbol => [symbol, join(value.libraryDirectory, value.definitions[symbol])]));
		assert.equal(value.headerSha256, sha256(finForeignHeader(model)));
		assert.equal(value.probeSha256, sha256(await finForeignProbe(model, paths(finForeignSymbols))));
		assert.equal(value.interposerSha256, sha256(finContainerEdgeInterposer(model, model.component, paths(value.columns))));
	}
};
