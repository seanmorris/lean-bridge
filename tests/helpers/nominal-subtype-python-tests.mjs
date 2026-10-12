/**
 * Python caller mutation controls and closed author selections. No installed claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { nominalSubtypeInstalledConfiguration, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypePythonRoutes, nominalSubtypePythonModes, nominalSubtypePythonConfiguration, nominalSubtypePythonCaller, nominalSubtypePythonCounts, nominalSubtypePythonSelection, nominalSubtypePythonExecutables, parseNominalSubtypePythonResult } from "./nominal-subtype-python-fixture.mjs";
import { assertNominalSubtypePythonIdentity } from "./nominal-subtype-python-wheel.mjs";
import { nominalSubtypePythonGenerator, nominalSubtypePythonOriginal } from "./nominal-subtype-python-generators.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("nominal Python configurations preserve independent routes and result-only contracts", async () => {
	for(const route of nominalSubtypePythonRoutes) for(const mode of nominalSubtypePythonModes)
	{
		const actual = nominalSubtypePythonConfiguration(route, mode);
		const expected = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { pypi: { name: "nominalsubtypes", version: "1.0.0" } });
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
	}
	assert.equal(await nominalSubtypePythonCaller("reviewed"), (await nominalSubtypePythonCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => nominalSubtypePythonConfiguration("unknown", "full"));
	assert.throws(() => nominalSubtypePythonConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalSubtypePythonCaller("unknown"));
	for(const mode of nominalSubtypePythonModes)
	{
		const counts = nominalSubtypePythonCounts[mode];
		assert.deepEqual(parseNominalSubtypePythonResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalSubtypePythonResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalSubtypePythonResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalSubtypePythonResult("{}", "unknown"));
});

test("nominal Python gates require complete, unambiguous selections and both interpreter floors", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHON_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypePythonSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypePythonSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2"]) assert.throws(() => nominalSubtypePythonSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`])
			assert.throws(() => nominalSubtypePythonSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalSubtypePythonSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypePythonSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NOMINAL_SUBTYPE_PYTHONS"])
		assert.throws(() => nominalSubtypePythonSelection({ [name]: "explicit" }));
	const commands = { "3.11": "/toolchains/python311", "3.12": "/toolchains/python312" };
	assert.deepEqual(nominalSubtypePythonExecutables(JSON.stringify(commands)), commands);
	for(const raw of [undefined, "", "null", "[]", "{}"
		, JSON.stringify({ "3.11": commands["3.11"] })
		, JSON.stringify({ ...commands, "3.13": "/toolchains/python313" })
		, JSON.stringify({ ...commands, "3.12": commands["3.11"] })])
		assert.throws(() => nominalSubtypePythonExecutables(raw));
	for(const command of ["python3", "", null, 0, "/bin/python\0", "/bin/python\n"])
		assert.throws(() => nominalSubtypePythonExecutables(JSON.stringify({ ...commands, "3.11": command })));
});

test("independent nominal Python caller detects wrong constructors, truncated results and input mutation", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-python-controls-"));
	t.after(() => rm(root, { recursive: true }));
	for(const route of nominalSubtypePythonRoutes) for(const mode of nominalSubtypePythonModes)
	{
		await saveLakeFile(root, `${route}.py`, await nominalSubtypePythonCaller(route));
		const args = ["-I", "-B"
			, resolve("tests/helpers/nominal-subtype-python-model.py")
			, join(root, `${route}.py`)
			, route === "ordinary" ? "arg" : "value", mode];
		const run = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", args, root);
		assert.equal(run.stderr, "");
		assert.deepEqual(JSON.parse(run.stdout), { ...nominalSubtypePythonCounts[mode], callerMutationControls: mode === "full" ? 10 : 5 });
	}
});

test("nominal Python package selection rejects coordinates, floor, source and runtime drift", () => {
	// Deliberately synthetic identities. This tests admission, not wheel execution.
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = { target: "pypi", ecosystem: "pypi", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "nominalsubtypes", version: "1.0.0", runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/nominalsubtypes-1.0.0-py3-none-manylinux_2_36_x86_64.whl" }] };
	const receipt = { schemaVersion: 1, kind: "lean-bridge-ordinary-python-package"
		, ecosystem: "pypi", moduleName: "lean_nominalsubtypes", name: pkg.name
		, version: pkg.version, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.36", tag: "py3-none-manylinux_2_36_x86_64" };
	assertNominalSubtypePythonIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalSubtypePythonIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertNominalSubtypePythonIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg))
		assert.throws(() => assertNominalSubtypePythonIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	assert.throws(() => assertNominalSubtypePythonIdentity(receipt, { ...pkg, artifacts: [] }, model, "2.36"));
	assert.throws(() => assertNominalSubtypePythonIdentity(receipt, { ...pkg, artifacts: [...pkg.artifacts, ...pkg.artifacts] }, model, "2.36"));
	assert.throws(() => assertNominalSubtypePythonIdentity(receipt, pkg, model, "2.38"));
});

test("nominal Python declarations retain named variants, copied aliases and separate result-only exports", () => {
	for(const mode of nominalSubtypePythonModes)
	{
		const review = nominalSubtypeInstalledReview(mode === "result-only"), before = structuredClone(review);
		const files = generateCopiedPythonPackage(review), source = files["lean_nominalsubtypes/__init__.py"];
		assert.deepEqual(review, before);
		for(const name of ["Envelope", "AliasPair", "EventEmpty", "EventBox", "EventChoices"])
			assert.match(source, new RegExp(`class ${name}:`, "u"));
		assert.ok(source.includes("EnvelopeAlias: _TypeAlias = Envelope"));
		assert.ok(source.includes("Event: _TypeAlias = EventEmpty | EventBox | EventChoices"));
		assert.equal([...source.matchAll(/^def /gmu)].length, mode === "full" ? 26 : 13);
		assert.equal([...files["lean_nominalsubtypes/__init__.pyi"].matchAll(/^def /gmu)].length, mode === "full" ? 26 : 13);
		assert.equal(source.includes("def first("), mode === "full");
		assert.doesNotMatch(source, /typing_extensions/u);
		assert.ok(files["binding-manifest.json"].includes('"generator"'));
	}
});

test("nominal Python evidence generator loads its complete frozen source closure", async t => {
	const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const generator = await nominalSubtypePythonGenerator(revision);
	assert.ok(generator.paths.includes("src/backends/python/copied-values.mjs"));
	assert.ok(generator.paths.includes("src/backends/python/copied-conversions.mjs"));
	assert.equal(new Set(generator.paths).size, generator.paths.length);
	for(const mode of nominalSubtypePythonModes)
		assert.deepEqual(generator.generateCopiedPythonPackage(nominalSubtypeInstalledReview(mode === "result-only")), generateCopiedPythonPackage(nominalSubtypeInstalledReview(mode === "result-only")));
	const path = "src/backends/python/copied-values.mjs", original = nominalSubtypePythonOriginal(revision, path);
	original.fill(0);
	assert.notEqual(nominalSubtypePythonOriginal(revision, path)[0], 0, "Cached source must not alias a caller's mutable buffer");
	for(const invalid of ["HEAD", revision.slice(0, 7), "-".repeat(40)])
		assert.throws(() => nominalSubtypePythonOriginal(invalid, path));
	for(const invalid of ["/tmp/source", "src/../package.json", "build/model.json"])
		assert.throws(() => nominalSubtypePythonOriginal(revision, invalid));
	t.diagnostic(`${generator.paths.length} frozen transitive generator modules`);
});
