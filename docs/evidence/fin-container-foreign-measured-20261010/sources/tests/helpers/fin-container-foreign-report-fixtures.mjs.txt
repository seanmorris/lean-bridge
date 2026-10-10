/**
 * Synthetic format fixtures only; no execution or package acceptance is claimed.
 *
 * @file
 */
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { finContainerEdgeCompilerModel } from "./fin-container-edge-compiled-fixture.mjs";
import { finContainerEdgeInterposer } from "./fin-container-edge-dispatch.mjs";
import { syntheticFinContainerEdgeReport } from "./fin-container-edge-report-fixtures.mjs";
import { finForeignCases, finForeignExpected, finForeignHeader, finForeignProbe, finForeignSymbols } from "./fin-container-foreign-carriers.mjs";

/**
 * Add the full foreign observation to the existing explicitly synthetic raw/public format.
 *
 * @param profiles - Exact host selection.
 */
export const syntheticFinForeignReport = async profiles => {
	const report = await syntheticFinContainerEdgeReport(profiles), model = finContainerEdgeCompilerModel();
	for(const item of report.reports)
	{
		item.bindingIrSha256 = hashBindingIr(model.bindingIr);
		const raw = structuredClone(item.dispatch.rawAdapter);
		const definitions = { ...raw.definitions, ...Object.fromEntries(finForeignSymbols.map(symbol => [symbol, "component.so"])) };
		const paths = symbols => Object.fromEntries(symbols.map(symbol => [symbol, join(raw.libraryDirectory, definitions[symbol])]));
		item.foreignCarriers = { ...raw
			, kind: "fin-container-foreign-carriers-v1"
			, packageProfile: item.profile
			, caller: "Separate C foreign-carrier probe of receipt-verified installed native libraries; not a public-language consumer"
			, definitions, publicSymbols: finForeignSymbols
			, bindingIr: structuredClone(model.bindingIr)
			, headerOrigin: "production-generated from receipt-pinned Binding IR"
			, headerSha256: sha256(finForeignHeader(model))
			, probeSha256: sha256(await finForeignProbe(model, paths(finForeignSymbols)))
			, interposerSha256: sha256(finContainerEdgeInterposer(model, model.component, paths(raw.columns)))
			, observed: true, observations: structuredClone(finForeignExpected)
			, measuredCalls: finForeignExpected.at(-1)[2]
			, cases: finForeignCases.length, recoveryPairsPerEntrypoint: 1000
			, stdoutSha256: sha256(finForeignExpected.map(([name, status, calls, counts]) => `foreign-carrier ${name} ${status} ${calls} ${counts.join(" ")}\n`).join("")) };
	}
	return report;
};
