/**
 * Check native PHP nominal callers without claiming installed Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { bundledBrickMath } from "../../src/backends/php/brick-math.mjs";
import { compileCopiedPhpModel } from "../../src/backends/php/copied-model.mjs";
import { generateCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeFixture, nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypePhpRoutes, nominalSubtypePhpModes, nominalSubtypePhpCounts, nominalSubtypePhpSelection, nominalSubtypePhpReview, nominalSubtypePhpConfiguration, nominalSubtypePhpLeanSource, nominalSubtypePhpCaller, parseNominalSubtypePhpResult } from "./nominal-subtype-php-fixture.mjs";
import { assertNominalSubtypePhpIdentity, nominalSubtypePhpNativeEvidence } from "./nominal-subtype-php-package.mjs";
import { nominalSubtypePhpToolSelection } from "./nominal-subtype-php-tools.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import "./nominal-subtype-php-evidence-tests.mjs";
import "./nominal-subtype-php-ci-report-tests.mjs";
import "./nominal-subtype-php-ci-handoff-tests.mjs";
import "./nominal-subtype-php-ci-tools-tests.mjs";
import "./nominal-subtype-php-ci-shell-tests.mjs";
import "./nominal-subtype-php-ci-workflow-tests.mjs";
import "./nominal-subtype-php-ci-history-tests.mjs";
import "./nominal-subtype-php-promotion-tests.mjs";
import "./nominal-subtype-php-promotion-history-tests.mjs";

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
const callerControls = process.env.LEAN_BRIDGE_PHP !== undefined || existsSync(php);
const restored = value => JSON.parse(JSON.stringify(value).replaceAll(/\bechoEnvelope\b/gu, "echo"));

test("nominal PHP changes only the reserved echo name and preserves both complete author contracts", async () => {
	const original = await readFile(`${nominalSubtypeFixture}/NominalSubtypes.lean`, "utf8");
	const source = await nominalSubtypePhpLeanSource();
	assert.notEqual(source, original); assert.equal(source.replace("def echoEnvelope (", "def echo ("), original);
	const unrenamed = generateCopiedPhpPackage(
		nominalSubtypeInstalledReview()
	)["src/Api.php"];
	assert.match(unrenamed, /function echo_\(/u);
	assert.doesNotMatch(unrenamed, /function echo\(/u);
	for(const route of nominalSubtypePhpRoutes) for(const mode of nominalSubtypePhpModes)
	{
		const expected = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
		const actual = nominalSubtypePhpConfiguration(route, mode);
		assert.deepEqual(restored({ ...actual, targets: expected.targets }), expected);
		assert.deepEqual(actual.targets, { "php-native": { name: "example/nominalsubtypes", version: "1.0.0" } });
		assert.deepEqual(restored(nominalSubtypePhpReview(mode)), nominalSubtypeInstalledReview(mode === "result-only"));
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
		assert.equal(await nominalSubtypePhpCaller("reviewed", mode), (await nominalSubtypePhpCaller("ordinary", mode)).replaceAll(/arg([01])/gu, "value$1"));
	}
	for(const [route, mode] of [["unknown", "full"], ["ordinary", "unknown"]])
	{
		assert.throws(() => nominalSubtypePhpConfiguration(route, mode));
		await assert.rejects(nominalSubtypePhpCaller(route, mode));
	}
	assert.throws(() => nominalSubtypePhpReview("unknown"));
	for(const mode of nominalSubtypePhpModes)
	{
		const counts = nominalSubtypePhpCounts[mode];
		assert.deepEqual(parseNominalSubtypePhpResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts)) assert.throws(() => parseNominalSubtypePhpResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalSubtypePhpResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalSubtypePhpResult("{}", "unknown"));
});

test("nominal PHP selections refuse disabled explicit work, unknown routes and duplicate modes", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypePhpSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypePhpSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true]) assert.throws(() => nominalSubtypePhpSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true]) assert.throws(() => nominalSubtypePhpSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"]) assert.throws(() => nominalSubtypePhpSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypePhpSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of ["OUTPUT", "VERSION", "COMPOSER_VERSION"])
		assert.throws(() => nominalSubtypePhpSelection({ [prefix + name]: "explicit" }));
});

test("nominal PHP tools require explicit absolute commands and exact expected versions", () => {
	const environment = { LEAN_BRIDGE_PHP: "/selected/php"
		, LEAN_BRIDGE_COMPOSER: "/selected/composer"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION: "8.2.33"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION: "2.5.5" };
	assert.deepEqual(nominalSubtypePhpToolSelection(environment), { php: "/selected/php", composer: "/selected/composer", phpVersion: "8.2.33", composerVersion: "2.5.5" });
	for(const key of Object.keys(environment))
	{
		for(const value of [undefined, "", true, "ambient"])
			assert.throws(() => nominalSubtypePhpToolSelection({ ...environment, [key]: value }));
	}
	for(const value of ["8.1.33", "9.0.0", "8.2.33-dev"])
		assert.throws(() => nominalSubtypePhpToolSelection({ ...environment, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION: value }));
	for(const value of ["1.0.0", "3.0.0", "2.5"])
		assert.throws(() => nominalSubtypePhpToolSelection({ ...environment, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION: value }));
});

test("nominal PHP package identity refuses changed coordinates, source, runtime and platform floor", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = { target: "php-native", ecosystem: "composer"
		, role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "example/nominalsubtypes", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/example-nominalsubtypes-1.0.0-linux-x86_64.zip" }] };
	const receipt = { schemaVersion: 1, kind: "lean-bridge-ordinary-php-package"
		, ecosystem: "composer", namespace: "LeanNominalsubtypes"
		, name: pkg.name, version: pkg.version, runtimeIdentity: pkg.runtimeIdentity
		, ...model, glibcMinimumVersion: "2.36" };
	assertNominalSubtypePhpIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalSubtypePhpIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertNominalSubtypePhpIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg))
		assert.throws(() => assertNominalSubtypePhpIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	for(const artifacts of [[], [...pkg.artifacts, ...pkg.artifacts]])
		assert.throws(() => assertNominalSubtypePhpIdentity(receipt, { ...pkg, artifacts }, model, "2.36"));
	assert.throws(() => assertNominalSubtypePhpIdentity(receipt, pkg, model, "2.38"));
});

test("nominal PHP native loader identities refuse missing, extra and substituted libraries", () => {
	const file = digit => ({ sha256: digit.repeat(64), bytes: 1 });
	const runtime = { files: { "include/runtime.h": file("1"), "lib/libruntime.so": file("2") } };
	const identity = { runtimeIdentity: sha256(canonicalJson(runtime)), bindingIrSha256: "3".repeat(64) };
	const component = { ...identity, library: "libcomponent.so", nativeLibrary: file("4") };
	const adapter = { ...identity, library: "libadapter.so", componentReceiptSha256: sha256(canonicalJson(component)), files: { "lib/libadapter.so": file("5") } };
	const files = {
		"native/linux-x64/libruntime.so": file("2")
		, "native/linux-x64/libcomponent.so": file("4")
		, "native/linux-x64/libadapter.so": file("5")
	};
	const receipt = { ...identity, component: { id: "synthetic" }, files };
	const evidence = nominalSubtypePhpNativeEvidence(receipt, component, adapter, runtime);
	assert.deepEqual(Object.keys(evidence.libraries), ["libadapter.so", "libcomponent.so", "libruntime.so"]);
	assert.deepEqual(nominalSubtypePhpNativeEvidence({ ...receipt, files: Object.fromEntries(Object.entries(receipt.files).reverse()) }, component, adapter, runtime), evidence);
	const mutations = [item => { delete item.files["native/linux-x64/libruntime.so"]; }
		, item => { item.files["native/linux-x64/extra.so"] = file("1"); }
		, item => { item.files["native/linux-x64/libcomponent.so"] = file("6"); }
		, item => { item.runtimeIdentity = "0".repeat(64); }
		, item => { item.bindingIrSha256 = "0".repeat(64); }];
	for(const mutate of mutations)
	{
		const changed = structuredClone(receipt); mutate(changed);
		assert.throws(() => nominalSubtypePhpNativeEvidence(changed, component, adapter, runtime));
	}
	assert.throws(() => nominalSubtypePhpNativeEvidence(receipt, component, { ...adapter, componentReceiptSha256: "0".repeat(64) }, runtime));
});

test("nominal PHP declarations retain all records, variants, aliases and constructor-free result exports", () => {
	for(const mode of nominalSubtypePhpModes)
	{
		const review = nominalSubtypePhpReview(mode), before = structuredClone(review);
		const files = generateCopiedPhpPackage(review), source = files["src/Api.php"];
		assert.deepEqual(review, before);
		for(const name of ["Envelope", "AliasPair", "EventEmpty", "EventBox", "EventChoices"])
			assert.match(source, new RegExp(`^final readonly class ${name}(?: extends Event)?$`, "mu"));
		assert.equal([...source.matchAll(/^function /gmu)].length, mode === "full" ? 26 : 13);
		assert.equal(source.includes("function echo_envelope("), mode === "full");
		assert.equal(source.includes("final readonly class Pair\n"), mode === "full");
		assert.ok(source.includes("EnvelopeAlias"));
		assert.doesNotMatch(source, /^function (?:echo|plus_one|plus_two)\(/mu);
	}
});

test("independent nominal PHP weak and strict callers detect wrong results, constructors, refusal order and mutation", {
	skip: !callerControls && "Select LEAN_BRIDGE_PHP to run PHP caller controls"
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-php-controls-"));
	t.after(() => rm(root, { recursive: true }));
	for(const mode of nominalSubtypePhpModes)
	{
		const directory = join(root, mode), review = nominalSubtypePhpReview(mode);
		for(const [path, source] of Object.entries({ ...generateCopiedPhpPackage(review), ...bundledBrickMath() }))
			await saveLakeFile(directory, path, source);
		const model = compileCopiedPhpModel(review, { lists: true, variants: true });
		const checks = Object.fromEntries(model.surface.functions.map(fn => [fn.field, fn.declaration.parameters.map(site => model.surface.copy(site.type).index)]));
		await saveLakeFile(directory, "checks.json", canonicalJson(checks));
		for(const route of nominalSubtypePhpRoutes) for(const strictness of ["weak", "strict"])
		{
			let source = await nominalSubtypePhpCaller(route, mode);
			if(strictness === "strict") source = source.replace("declare(strict_types=0);", "declare(strict_types=1);");
			const caller = `${route}-${strictness}.php`;
			await saveLakeFile(directory, caller, source);
			assert.equal((await runCopied(php, ["-n", "-l", join(directory, caller)], directory)).stderr, "");
			const run = await runCopied(php, ["-n"
				, resolve("tests/helpers/nominal-subtype-php-model.php")
				, join(directory, "dependencies/brick-math/autoload.php")
				, join(directory, "src/Api.php"), join(directory, caller)
				, route === "ordinary" ? "arg" : "value", mode
				, join(directory, "checks.json")], directory);
			assert.equal(run.stderr, "");
			assert.deepEqual(JSON.parse(run.stdout), { ...nominalSubtypePhpCounts[mode], callerMutationControls: mode === "full" ? 16 : 8 });
		}
	}
});
