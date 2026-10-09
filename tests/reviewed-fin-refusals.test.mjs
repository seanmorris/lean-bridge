/**
 * Changed NativeFin and FinContainers reviews are refused against fresh Lean with their exact field and no
 * release output, beside a matching control that publishes (VO #1438).
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { finFixtureProfiles } from "./helpers/fin-fixture-installed.mjs";
import { checkReviewedFinRefusals, reviewedFinRefusalExpectations, reviewedFinRefusalFixtures } from "./helpers/reviewed-fin-refusals.mjs";

const fixtures = Object.fromEntries(reviewedFinRefusalFixtures.map(entry => [entry.label, entry]));
const selection = finFixtureProfiles("LEAN_BRIDGE_REVIEWED_FIN_REFUSALS", fixtures);
const reportRoot = resolve(process.env.LEAN_BRIDGE_REVIEWED_FIN_REFUSAL_REPORT_DIR ?? "build/reviewed-fin-refusals");

test("every changed review is admitted and differs from its unchanged review only in its named bound", () => {
	for(const entry of reviewedFinRefusalFixtures)
	{
		const expectations = reviewedFinRefusalExpectations(entry);
		assert.equal(new Set(expectations.map(item => item.label)).size, expectations.length, entry.label);
		assert.equal(new Set(expectations.map(item => item.reviewSha256)).size, expectations.length, `${entry.label}: each case is a distinct review`);
		// A fixed review must not leak between cases.
		assert.equal(canonicalJson(entry.review()), canonicalJson(entry.review()), entry.label);
	}
});

test("the cases cover each bound site the fixtures expose", () => {
	const labels = Object.fromEntries(reviewedFinRefusalFixtures.map(entry => [entry.label, entry.cases.map(([label]) => label)]));
	for(const label of ["wrong scalar bound", "tightened alias bound", "loosened mixed-argument bound", "inhabited Fin 0", "changed bound wider than 64 bits", "omitted input bound", "omitted result bound", "invented input bound", "result bound moved to the parameter", "whole decision omitted"])
		assert.ok(labels["native-fin"].includes(label), label);
	for(const label of ["tightened nested option bound", "changed list bound wider than 64 bits", "inhabited Fin 0 element", "omitted option bound", "changed nested result branch", "loosened second-argument bound", "result bound moved to the parameter", "tightened alias element bound", "omitted alias bound"])
		assert.ok(labels["fin-containers"].includes(label), label);
});

for(const label of Object.keys(fixtures))
	test(`changed ${label} reviews are refused against fresh Lean beside a publishing control`, { skip: !selection.includes(label), timeout: 2_400_000 }, async t => {
		const report = await checkReviewedFinRefusals(t, fixtures[label]);
		await mkdir(reportRoot, { recursive: true });
		await writeFile(join(reportRoot, `${label}.json`), `${canonicalJson(report)}\n`, { flag: "wx" });
	});
