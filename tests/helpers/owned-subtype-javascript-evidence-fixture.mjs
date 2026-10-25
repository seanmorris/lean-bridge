/**
 * Inert owned-Subtype npm archives for verifier controls, never runtime evidence.
 *
 * @file
 */
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { ownedSubtypePackageReviewedIr } from "./owned-aggregate-fixture.mjs";
import { writeSyntheticOwnedCheckedRecordJavaScriptRoute } from "./owned-checked-record-javascript-evidence-fixture.mjs";
import { ownedSubtypeJavaScriptObserved } from "./owned-subtype-javascript-evidence.mjs";
import {
	retainOwnedSubtypeRoute, writeOwnedSubtypeRetainedPackages
} from "./owned-subtype-retained-packages.mjs";

/**
 * Write a synthetic two-route receipt-closed npm fixture under a test directory.
 *
 * @param root - Isolated temporary test directory.
 * @param relativeReport - Report location relative to that directory.
 */
export const writeSyntheticOwnedSubtypeJavaScriptEvidence = async (
	root, relativeReport = "acceptance/report.json"
) => {
	const reportPath = join(root, relativeReport), reports = [], retained = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const original = await writeSyntheticOwnedCheckedRecordJavaScriptRoute(
			join(root, "producer"), route, {
				bindingIr: ownedSubtypePackageReviewedIr()
				, component: { id: "owned-subtypes@1.0.0", name: "owned-subtypes", version: "1.0.0" }
				, componentName: "@example/owned-subtypes"
			}
		);
		const handoff = join(root, `${route}-consumer`);
		const { entry } = await retainOwnedSubtypeRoute({ output: reportPath, route
			, source: join(root, `producer/evidence/${route}/handoff`), handoff });
		retained.push(entry);
		const report = Object.fromEntries(Object.entries(original).filter(([key]) =>
			!["route", "authorRoute", "mode", "retainedPackageSet"].includes(key)));
		report.reviewed = route === "reviewed";
		report.observed = { ...ownedSubtypeJavaScriptObserved };
		report.transferredInputCheckedBeforeHandoff = true;
		report.independentBuilds = [0, 1].map(attempt => structuredClone({
			authorRoot: `author-${attempt}`, componentIdentity: report.componentIdentity
			, bindingIrSha256: report.bindingIrSha256
			, sourceIdentity: report.sourceIdentity
			, wasm: report.wasm, archives: report.archives
			, sourceUnchanged: true, removedBeforeInstall: true
		}));
		report.browser.executions = report.browser.executions.flatMap(execution => [
			{ ...execution, checks: 18, variant: "production" }
			, ...execution.profile === "react" ? [{ ...execution, checks: 18, variant: "strict" }] : []
		]);
		reports.push(report);
		await rm(handoff, { recursive: true });
	}
	await writeOwnedSubtypeRetainedPackages(reportPath, retained);
	const report = { schemaVersion: 2, profile: "installed-owned-subtype-javascript", reports };
	await writeFile(reportPath, canonicalJson(report));
	await rm(join(root, "producer"), { recursive: true });
	return { root, reportPath, report };
};
