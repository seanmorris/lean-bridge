/**
 * Keep nominal JVM contracts, names, source sections and selection gates exact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateBindingIr } from "../../src/binding-ir/contract.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { reviewedSubtypeContracts } from "../../src/analyze/reviewed-subtypes.mjs";
import { generateCopiedJvmKotlinPackage } from "../../src/backends/jvm/copied-kotlin.mjs";
import { nominalSubtypeFixture, nominalSubtypeInstalledReview, nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeJvmCaller, nominalSubtypeJvmConfiguration, nominalSubtypeJvmCounts, nominalSubtypeJvmLeanSource, nominalSubtypeJvmModes, nominalSubtypeJvmModel, nominalSubtypeJvmProfiles, nominalSubtypeJvmReview, nominalSubtypeJvmRoutes, nominalSubtypeJvmSelection, parseNominalSubtypeJvmResult } from "./nominal-subtype-jvm-fixture.mjs";
import "./nominal-subtype-jvm-evidence-tests.mjs";
import "./nominal-subtype-jvm-ci-report-tests.mjs";
import "./nominal-subtype-jvm-ci-handoff-tests.mjs";
import "./nominal-subtype-jvm-ci-tools-tests.mjs";
import "./nominal-subtype-jvm-ci-shell-tests.mjs";
import "./nominal-subtype-jvm-ci-workflow-tests.mjs";
import "./nominal-subtype-jvm-ci-history-tests.mjs";
import "./nominal-subtype-jvm-promotion-tests.mjs";
import "./nominal-subtype-jvm-promotion-history-tests.mjs";

test("nominal JVM contracts preserve the complete fixture and only rename the reserved Pair record", async () => {
	const restore = value => JSON.parse(JSON.stringify(value).replaceAll("EnvelopePair", "Pair"));
	const original = await readFile(nominalSubtypeFixture + "/NominalSubtypes.lean", "utf8");
	assert.equal((await nominalSubtypeJvmLeanSource()).replaceAll(/\bEnvelopePair\b/gu, "Pair"), original);
	for(const mode of nominalSubtypeJvmModes)
	{
		const review = nominalSubtypeJvmReview(mode); validateBindingIr(review);
		assert.deepEqual(restore(review), nominalSubtypeInstalledReview(mode === "result-only"));
		assert.equal(review.declarations.length, mode === "full" ? 26 : 13);
		for(const route of nominalSubtypeJvmRoutes)
		{
			const configuration = nominalSubtypeJvmConfiguration(route, mode); validateExportConfiguration(configuration);
			const original = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
			assert.deepEqual({ ...restore(configuration), targets: original.targets }, original);
			assert.deepEqual(configuration.targets, { maven: { name: "org.leanbridge:nominalsubtypes", version: "1.0.0" } });
			if(route === "ordinary") assert.deepEqual(reviewedSubtypeContracts(review), configuration.contracts);
			if(mode === "result-only") assert.equal(Object.hasOwn(configuration, "contracts"), false);
		}
	}
	assert.throws(() => nominalSubtypeJvmReview("unknown"));
	assert.throws(() => nominalSubtypeJvmConfiguration("unknown", "full"));
	assert.throws(() => nominalSubtypeJvmConfiguration("ordinary", "unknown"));
});

test("nominal JVM selection refuses disabled explicit work and duplicate or malformed routes", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypeJvmSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypeJvmSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2"]) assert.throws(() => nominalSubtypeJvmSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, ` ${valid}`])
			assert.throws(() => nominalSubtypeJvmSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalSubtypeJvmSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypeJvmSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	assert.throws(() => nominalSubtypeJvmSelection({ [prefix + "OUTPUT"]: "explicit" }));
});

test("nominal JVM caller sections and independent counters distinguish host and API modes", async () => {
	for(const profile of nominalSubtypeJvmProfiles) for(const mode of nominalSubtypeJvmModes)
	{
		const ordinary = await nominalSubtypeJvmCaller(profile, "ordinary", mode), reviewed = await nominalSubtypeJvmCaller(profile, "reviewed", mode);
		assert.equal(reviewed, ordinary.replaceAll(/arg([01])/gu, "value$1"));
		assert.doesNotMatch(ordinary, /BEGIN (?:FULL|RESULT)_ONLY|END (?:FULL|RESULT)_ONLY/u);
		assert.equal(ordinary.includes("EnvelopePair"), mode === "full");
		assert.ok(ordinary.includes("writeSnapshot") && ordinary.includes("shiftLeft(100)"));
		const model = await nominalSubtypeJvmModel(profile, mode);
		assert.equal(model.includes("public static BigInteger first("), mode === "full");
		assert.doesNotMatch(model, /FIXTURE_NAMESPACE|FULL_ONLY/u);
		const counts = nominalSubtypeJvmCounts[profile][mode];
		assert.deepEqual(parseNominalSubtypeJvmResult(JSON.stringify(counts), profile, mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalSubtypeJvmResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), profile, mode));
		assert.throws(() => parseNominalSubtypeJvmResult(JSON.stringify({ ...counts, extra: 1 }), profile, mode));
	}
	await assert.rejects(nominalSubtypeJvmCaller("unknown", "ordinary", "full"));
	await assert.rejects(nominalSubtypeJvmCaller("java", "unknown", "full"));
	await assert.rejects(nominalSubtypeJvmCaller("kotlin", "ordinary", "unknown"));
	await assert.rejects(nominalSubtypeJvmModel("unknown", "full"));
	await assert.rejects(nominalSubtypeJvmModel("java", "unknown"));
	assert.throws(() => parseNominalSubtypeJvmResult("{}", "unknown", "full"));
	assert.throws(() => parseNominalSubtypeJvmResult("{}", "java", "unknown"));
});

test("nominal JVM generators retain all public carriers and a distinct result-only API", () => {
	for(const mode of nominalSubtypeJvmModes)
	{
		const review = nominalSubtypeJvmReview(mode), before = structuredClone(review);
		const files = generateCopiedJvmKotlinPackage(review);
		assert.deepEqual(review, before);
		const java = "src/main/java/org/leanbridge/nominalsubtypes/", kotlin = "src/main/kotlin/org/leanbridge/nominalsubtypes/kotlin/";
		for(const name of ["Envelope", "AliasPair", "Event", "EventEmpty", "EventBox", "EventChoices", "Pair", "Option", "Result"])
			assert.ok(files[java + name + ".java"] && files[kotlin + name + ".kt"], name);
		assert.equal(Object.hasOwn(files, java + "EnvelopePair.java"), mode === "full");
		assert.equal(Object.hasOwn(files, kotlin + "EnvelopePair.kt"), mode === "full");
		assert.equal([...files[java + "Api.java"].matchAll(/^ {4}public static /gmu)].length, mode === "full" ? 26 : 13);
		assert.equal([...files[kotlin + "Api.kt"].matchAll(/^ {8}fun /gmu)].length, mode === "full" ? 26 : 13);
		assert.equal(files[java + "Api.java"].includes(" first("), mode === "full");
		assert.equal(files[kotlin + "Api.kt"].includes("fun `first`("), mode === "full");
	}
	assert.throws(() => generateCopiedJvmKotlinPackage(nominalSubtypeInstalledReview(false)));
});
