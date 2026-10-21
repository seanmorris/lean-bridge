/**
 * Static controls for generic Subtypes in .NET, JVM, native PHP and WIT.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
	genericSubtypeJvmProfiles
	, genericSubtypeManagedWitCaller
	, genericSubtypeManagedWitConfiguration
	, genericSubtypeManagedWitExpected
	, genericSubtypeManagedWitHosts
	, genericSubtypeManagedWitReview
	, genericSubtypeManagedWitSelection
	, parseGenericSubtypeManagedWitResult
} from "./generic-subtype-managed-wit.mjs";
import {
	assertGenericSubtypeManagedWitTap
	, genericSubtypeManagedWitSafePath
	, parseGenericSubtypeManagedWitCiArgs
} from "./generic-subtype-managed-wit-report.mjs";

const targets = { dotnet: "nuget", jvm: "maven", php: "php-native", wit: "wit-wasi" };
const labels = { dotnet: "C#", jvm: "JVM", php: "PHP", wit: "WIT" };

test("generic Subtype managed and WIT selections preserve target constraints", () => {
	for(const host of genericSubtypeManagedWitHosts)
	{
		const prefix = `LEAN_BRIDGE_GENERIC_SUBTYPE_${host.toUpperCase()}_`;
		assert.deepEqual(genericSubtypeManagedWitSelection(host, {}), {
			enabled: false, routes: ["ordinary", "reviewed"]
		});
		assert.deepEqual(genericSubtypeManagedWitSelection(host, {
			[prefix + "TEST"]: "1", [prefix + "ROUTES"]: "reviewed"
		}), { enabled: true, routes: ["reviewed"] });
		for(const flag of ["", "true", "2"])
			assert.throws(() => genericSubtypeManagedWitSelection(host, { [prefix + "TEST"]: flag }));
		for(const routes of ["", "unknown", "ordinary,ordinary", "reviewed,"])
			assert.throws(() => genericSubtypeManagedWitSelection(host, {
				[prefix + "TEST"]: "1", [prefix + "ROUTES"]: routes
			}));
		for(const route of ["ordinary", "reviewed"])
		{
			const configuration = genericSubtypeManagedWitConfiguration(host, route);
			assert.deepEqual(configuration.modules, ["NominalSubtypes", "NominalSubtypes.GenericCompositions"]);
			assert.deepEqual(Object.keys(configuration.targets), [targets[host]]);
			if(route === "ordinary") assert.equal(configuration.specializations.length, 2);
		}
		const review = genericSubtypeManagedWitReview(host);
		assert.ok(review.types.some(type => type.id === "lean:NominalSubtypes.GenericCompositions.GenericNat"));
		assert.equal(review.declarations.filter(declaration =>
			declaration.source.declaration === "NominalSubtypes.GenericCompositions.genericEcho").length, 2);
		if(host === "jvm") assert.ok(review.types.some(type => type.name === "EnvelopePair"));
		if(host === "php") assert.ok(review.declarations.some(declaration => declaration.name === "echoEnvelope"));
	}
	assert.deepEqual(parseGenericSubtypeManagedWitResult(JSON.stringify(genericSubtypeManagedWitExpected))
		, genericSubtypeManagedWitExpected);
	assert.throws(() => parseGenericSubtypeManagedWitResult('{"checks":17,"rejections":3}'));
});

test("generic Subtype public callers retain exact route-specific refusals", async () => {
	for(const host of genericSubtypeManagedWitHosts)
	{
		const profiles = host === "jvm" ? genericSubtypeJvmProfiles : [null];
		for(const profile of profiles)
		{
			const ordinary = await genericSubtypeManagedWitCaller(host, "ordinary", profile);
			const reviewed = await genericSubtypeManagedWitCaller(host, "reviewed", profile);
			assert.ok(ordinary.length > 500); assert.equal(reviewed, ordinary.replaceAll(/arg0/gu, "value0"));
			assert.match(ordinary, /NominalSubtypes\./u); assert.match(ordinary, /plusOne/u); assert.match(ordinary, /plusTwo/u);
			assert.match(ordinary, /generic[_-]?[Uu]se|GenericUse/u);
			assert.match(ordinary, /echo[_-]?[Gg]eneric[_-]?[Ff]irst|EchoGenericFirst/u);
			assert.match(ordinary, /echo[_-]?[Gg]eneric[_-]?[Ss]econd|EchoGenericSecond/u);
			if(host === "wit") assert.doesNotMatch(ordinary, /#include "\.\.\/nominal-subtype-consumers/u);
		}
	}
});

test("generic Subtype hosted controls require every host and exact TAP", async () => {
	const producer = "a".repeat(40), workflow = await readFile(".github/workflows/generic-subtype-managed-wit.yml", "utf8");
	for(const host of genericSubtypeManagedWitHosts)
	{
		const selected = parseGenericSubtypeManagedWitCiArgs([
			"--host", host, "--route", "ordinary", "--producer", producer
			, "--directory", "build/records", "--tap", "build/run.tap"
		]);
		assert.equal(selected.host, host); assert.equal(selected.route, "ordinary");
		const label = `installed generic Subtype ${labels[host]} compositions reproduce and relocate ordinary full`;
		const tap = `TAP version 13\n# Subtest: ${label}\nok 1 - ${label}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
		assertGenericSubtypeManagedWitTap(tap, host, "ordinary");
		assert.throws(() => assertGenericSubtypeManagedWitTap(tap.replace("# pass 1", "# pass 0"), host, "ordinary"));
		const runnerPath = `scripts/run-generic-subtype-${host}-ci.sh`, runner = await readFile(runnerPath, "utf8");
		assert.ok((await stat(runnerPath)).mode & 0o111); assert.match(runner, /check-generic-subtype-managed-wit-ci\.mjs/u);
		assert.match(runner, new RegExp(`LEAN_BRIDGE_GENERIC_SUBTYPE_${host.toUpperCase()}_TEST=1`, "u"));
		assert.match(workflow, new RegExp(`run-generic-subtype-${host}-ci\\.sh`, "u"));
	}
	assert.equal(genericSubtypeManagedWitSafePath("build-0/NominalSubtypes.GenericCompositions.lean")
		, "build-0/NominalSubtypes.GenericCompositions.lean");
	for(const path of ["/absolute", "../escape", "a//b", "a/./b"])
		assert.throws(() => genericSubtypeManagedWitSafePath(path));
	assert.throws(() => parseGenericSubtypeManagedWitCiArgs([]));
});
