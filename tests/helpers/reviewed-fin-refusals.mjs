/**
 * Fresh-Lean refusals of changed reviews for the NativeFin and FinContainers fixtures (VO #1438). Each case
 * mutates the independently authored review; the unchanged review is the matching control, so a broken
 * general build cannot satisfy a refusal. A case must stop at reconciliation with the exact mismatched
 * field before any release output exists.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference, validateReviewedSource } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { finContainerTargets } from "./fin-container-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nativeFinReviewedIr } from "./reviewed-fin-fixture.mjs";
import { finContainerReviewedIr } from "./reviewed-fin-container-fixture.mjs";

const fin = bound => ({ kind: "fin", bound });
const inside = (kind, child) => ({ kind, arguments: [child] });
const refinements = (ir, name) => ir.declarations.find(item => item.source.declaration === name).source.extensions["lean-lang.org/refinements"];
const declarationSite = /^bindingIr\.declarations\[\d+\]\.source\.extensions\.lean-lang\.org\/refinements(?:\.|$)/u;
const aliasSite = /^bindingIr\.types\[\d+\]\.source\.extensions\.lean-lang\.org\/nominal-refinements(?:\.|$)/u;

/** The two fixtures with their independent reviews and the changed reviews each must refuse. */
export const reviewedFinRefusalFixtures = Object.freeze([
	{ label: "native-fin"
		, fixture: "tests/fixtures/onboarding/native-fin"
		, module: "NativeFin"
		, target: ["c", { name: "native-fin", version: "1.0.0" }]
		, review: nativeFinReviewedIr
		, cases: [
			["wrong scalar bound", ir => { refinements(ir, "NativeFin.mirror").parameters[0] = fin("11"); }, declarationSite]
			, ["tightened alias bound", ir => { refinements(ir, "NativeFin.twice").parameters[0] = fin("299"); }, declarationSite]
			, ["loosened mixed-argument bound", ir => { refinements(ir, "NativeFin.label").parameters[1] = fin("5"); }, declarationSite]
			, ["inhabited Fin 0", ir => { refinements(ir, "NativeFin.impossible").parameters[0] = fin("1"); }, declarationSite]
			, ["changed bound wider than 64 bits", ir => { refinements(ir, "NativeFin.succHuge").parameters[0] = fin("1180591620717411303423"); }, declarationSite]
			, ["omitted input bound", ir => { refinements(ir, "NativeFin.mirror").parameters[0] = null; }, declarationSite]
			, ["omitted result bound", ir => { refinements(ir, "NativeFin.mirror").result = null; }, declarationSite]
			, ["invented input bound", ir => { refinements(ir, "NativeFin.wrap").parameters[0] = fin("7"); }, declarationSite]
			, ["result bound moved to the parameter", ir => { Object.assign(refinements(ir, "NativeFin.wrap"), { parameters: [fin("7")], result: null }); }, declarationSite]
			, ["whole decision omitted", ir => { delete ir.declarations.find(item => item.source.declaration === "NativeFin.mirror").source.extensions["lean-lang.org/refinements"]; }, declarationSite]
		]
	}
	, { label: "fin-containers"
		, fixture: "tests/fixtures/onboarding/native-fin-containers"
		, module: "FinContainers"
		, target: finContainerTargets.c
		, review: finContainerReviewedIr
		, cases: [
			["tightened nested option bound", ir => { refinements(ir, "FinContainers.present").parameters[0] = inside("array", inside("option", fin("9"))); }, declarationSite]
			, ["changed list bound wider than 64 bits", ir => { refinements(ir, "FinContainers.sumHuge").parameters[0] = inside("list", fin("1180591620717411303425")); }, declarationSite]
			, ["inhabited Fin 0 element", ir => { refinements(ir, "FinContainers.countNone").parameters[0] = inside("array", fin("1")); }, declarationSite]
			, ["omitted option bound", ir => { delete ir.declarations.find(item => item.source.declaration === "FinContainers.orDefault").source.extensions["lean-lang.org/refinements"]; }, declarationSite]
			, ["changed nested result branch", ir => { refinements(ir, "FinContainers.flatten").result = inside("option", inside("list", fin("9"))); }, declarationSite]
			, ["loosened second-argument bound", ir => { refinements(ir, "FinContainers.label").parameters[1] = inside("array", fin("5")); }, declarationSite]
			, ["result bound moved to the parameter", ir => { Object.assign(refinements(ir, "FinContainers.wrapAll"), { parameters: [inside("array", fin("7"))], result: null }); }, declarationSite]
			, ["tightened alias element bound", ir => { ir.types[0].source.extensions["lean-lang.org/nominal-refinements"].target = inside("array", fin("9")); }, aliasSite]
			, ["omitted alias bound", ir => { delete ir.types[0].source.extensions["lean-lang.org/nominal-refinements"]; }, aliasSite]
		]
	}
].map(entry => Object.freeze(entry)));

/**
 * Exact admitted review input, as the build reads it.
 *
 * @param ir - Reviewed Binding IR.
 */
export const reviewedFinRefusalInput = ir => {
	const source = canonicalJson(ir);
	return { schemaVersion: 1, path: "api.binding-ir.json", source, sourceSha256: sha256(source), semanticSha256: hashBindingIr(ir) };
};

/**
 * Every changed review is admitted and differs from the unchanged review only inside its named extension;
 * the returned field is the exact path reconciliation must report against fresh Lean.
 *
 * @param entry - One fixture entry.
 */
export const reviewedFinRefusalExpectations = entry => {
	const control = entry.review();
	validateReviewedSource(reviewedFinRefusalInput(control));
	return entry.cases.map(([label, mutate, site]) => {
		const changed = entry.review(); mutate(changed);
		// A changed review that admission already refuses would not reach fresh Lean.
		validateReviewedSource(reviewedFinRefusalInput(changed));
		const field = reviewedContractDifference(changed, control);
		assert.ok(field, `${label}: the review must change`);
		assert.match(field, site, label);
		return { label, field, reviewSha256: sha256(canonicalJson(changed)), changed };
	});
};

const prepare = async (entry, ir) => {
	const directory = await mkdtemp(join(tmpdir(), `lean-bridge-${entry.label}-refusal-`));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
	await cp(entry.fixture, projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(ir));
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: [entry.module], targets: Object.fromEntries([entry.target]) }));
	const run = () => buildCanonicalProject({ projectRoot, outputRoot, targets: [entry.target[0]], environment: nativeFixtureEnvironment([entry.target[0]]) });
	return { directory, outputRoot, run };
};

/**
 * Build the matching control, then every changed review, against fresh Lean on the C route, and return an
 * auditable per-case report. The control must publish its release; each case must be refused with the
 * exact field and leave the release root absent.
 *
 * @param t - Running test context.
 * @param entry - One fixture entry.
 */
export const checkReviewedFinRefusals = async (t, entry) => {
	const expectations = reviewedFinRefusalExpectations(entry);
	const control = entry.review(), controlSource = canonicalJson(control);
	const built = await prepare(entry, control);
	t.after(() => rm(built.directory, { recursive: true, force: true }));
	await built.run();
	// The same route publishes the unchanged review, so each refusal below is caused by its one change.
	const model = JSON.parse(await readFile(join(built.outputRoot, "native/component/model.json"), "utf8"));
	assert.equal(model.sourceIdentity.reviewedBindingIr.source, controlSource, "the control built from the unchanged review");
	assert.equal(reviewedContractDifference(control, model.bindingIr), null, "the control review matches fresh Lean");
	const cases = [];
	for(const expectation of expectations) await t.test(expectation.label, async subtest => {
		const attempt = await prepare(entry, expectation.changed);
		subtest.after(() => rm(attempt.directory, { recursive: true, force: true }));
		let refused = null;
		await assert.rejects(attempt.run(), error => {
			refused = error;
			return true;
		});
		assert.equal(refused.code, "reviewed-ir-source-mismatch", `${expectation.label}: ${refused.message}`);
		assert.equal(refused.details?.field, expectation.field, expectation.label);
		await assert.rejects(access(attempt.outputRoot), { code: "ENOENT" }, `${expectation.label}: no release output`);
		cases.push({ label: expectation.label, reviewSha256: expectation.reviewSha256, code: refused.code, field: refused.details.field, releaseRoot: "ENOENT" });
	});
	assert.equal(cases.length, expectations.length, "every case reached its refusal");
	const published = { reviewSha256: sha256(controlSource), bindingIrSha256: hashBindingIr(model.bindingIr), published: true };
	return { schemaVersion: 1, fixture: entry.fixture, module: entry.module, target: entry.target[0], control: published, cases };
};
