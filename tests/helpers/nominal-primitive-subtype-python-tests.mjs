/**
 * Check primitive-base Python callers and package admission without installed claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeReview } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypePythonRoutes, nominalPrimitiveSubtypePythonModes, nominalPrimitiveSubtypePythonConfiguration, nominalPrimitiveSubtypePythonCaller, nominalPrimitiveSubtypePythonCounts, nominalPrimitiveSubtypePythonSelection, nominalPrimitiveSubtypePythonExecutables, parseNominalPrimitiveSubtypePythonResult } from "./nominal-primitive-subtype-python-fixture.mjs";
import { assertNominalPrimitiveSubtypePythonIdentity } from "./nominal-primitive-subtype-python-wheel.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("primitive-base Python configurations preserve both source routes and constructor-free result exports", async () => {
	for(const route of nominalPrimitiveSubtypePythonRoutes) for(const mode of nominalPrimitiveSubtypePythonModes)
	{
		const actual = nominalPrimitiveSubtypePythonConfiguration(route, mode);
		const expected = nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only");
		validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { pypi: { name: "nominalprimitivesubtypes", version: "1.0.0" } });
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
	}
	assert.equal(await nominalPrimitiveSubtypePythonCaller("reviewed"), await nominalPrimitiveSubtypePythonCaller("ordinary"));
	assert.throws(() => nominalPrimitiveSubtypePythonConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypePythonConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalPrimitiveSubtypePythonCaller("unknown"));
	for(const mode of nominalPrimitiveSubtypePythonModes)
	{
		const counts = nominalPrimitiveSubtypePythonCounts[mode];
		assert.deepEqual(parseNominalPrimitiveSubtypePythonResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalPrimitiveSubtypePythonResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypePythonResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalPrimitiveSubtypePythonResult("{}", "unknown"));
});

test("primitive-base Python gates reject disabled selections, non-string values and incomplete interpreter floors", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypePythonSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalPrimitiveSubtypePythonSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypePythonSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => nominalPrimitiveSubtypePythonSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePythonSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypePythonSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHONS"])
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePythonSelection({ [prefix + "TEST"]: flag, [name]: "explicit" }));
	const commands = { "3.11": "/toolchains/python311", "3.12": "/toolchains/python312" };
	assert.deepEqual(nominalPrimitiveSubtypePythonExecutables(JSON.stringify(commands)), commands);
	for(const raw of [undefined, "", "null", "[]", "{}"
		, JSON.stringify({ "3.11": commands["3.11"] })
		, JSON.stringify({ ...commands, "3.13": "/toolchains/python313" })
		, JSON.stringify({ ...commands, "3.12": commands["3.11"] })])
		assert.throws(() => nominalPrimitiveSubtypePythonExecutables(raw));
	for(const command of ["python3", "", null, 0, "/bin/python\0", "/bin/python\n"])
		assert.throws(() => nominalPrimitiveSubtypePythonExecutables(JSON.stringify({ ...commands, "3.11": command })));
});

test("primitive-base Python caller detects all twenty field mutations and four semantic mutations", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-python-controls-"));
	t.after(() => rm(root, { recursive: true }));
	const caller = await nominalPrimitiveSubtypePythonCaller("ordinary"), path = join(root, "consumer.py");
	await saveLakeFile(root, "consumer.py", caller);
	const files = generateCopiedPythonPackage(nominalPrimitiveSubtypeReview(false));
	const generated = join(root, "generated.py");
	await saveLakeFile(root, "generated.py", files["lean_nominalprimitivesubtypes/__init__.py"]);
	const fields = ["unit_value", "bool_value", "uint8_value", "uint16_value"
		, "uint32_value", "uint64_value", "int8_value", "int16_value", "int32_value"
		, "int64_value", "nat_value", "int_value", "float32_value", "float64_value"
		, "text_value", "bytes_value", "char_value", "usize_value"
		, "isize_value", "digit"];
	for(const generatedValueClasses of [false, true])
	{
		const args = ["-I", "-B"
			, resolve("tests/helpers/nominal-primitive-subtype-python-model.py")
			, path, ...generatedValueClasses ? [generated] : []];
		const run = await runCopied(process.env.LEAN_BRIDGE_PYTHON ?? "/usr/bin/python3", args, root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.installedAcceptance, false);
		assert.equal(result.generatedValueClasses, generatedValueClasses);
		assert.deepEqual(result.results, nominalPrimitiveSubtypePythonModes.flatMap(mode => ["arg", "value"].map(parameterPrefix => ({
			resultOnly: mode === "result-only", parameterPrefix
			, ...nominalPrimitiveSubtypePythonCounts[mode] }))));
		assert.deepEqual(result.rejectedMutations, [...fields
			, "wrong-word-width", "normalization-bypass"
			, "unit-refusal-bypass", "inactive-branch-added"]);
	}
	assert.equal(await readFile(path, "utf8"), caller);
	t.diagnostic("Explicit runtime doubles exercise the caller with independent and generated value classes; no installed Lean library executes.");
});

test("primitive-base Python wheel identity rejects changed coordinates, compiler authority and runtime", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = { target: "pypi", ecosystem: "pypi", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "nominalprimitivesubtypes", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/nominalprimitivesubtypes-1.0.0-py3-none-manylinux_2_36_x86_64.whl" }] };
	const receipt = { schemaVersion: 1, kind: "lean-bridge-ordinary-python-package"
		, ecosystem: "pypi", moduleName: "lean_nominalprimitivesubtypes"
		, name: pkg.name
		, version: pkg.version, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.36", tag: "py3-none-manylinux_2_36_x86_64" };
	assertNominalPrimitiveSubtypePythonIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalPrimitiveSubtypePythonIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertNominalPrimitiveSubtypePythonIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg))
		assert.throws(() => assertNominalPrimitiveSubtypePythonIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	assert.throws(() => assertNominalPrimitiveSubtypePythonIdentity(receipt, { ...pkg, artifacts: [] }, model, "2.36"));
	assert.throws(() => assertNominalPrimitiveSubtypePythonIdentity(receipt, { ...pkg, artifacts: [...pkg.artifacts, ...pkg.artifacts] }, model, "2.36"));
	assert.throws(() => assertNominalPrimitiveSubtypePythonIdentity(receipt, pkg, model, "2.38"));
});

test("primitive-base Python declarations retain named records, aliases and separate result-only exports", () => {
	for(const mode of nominalPrimitiveSubtypePythonModes)
	{
		const review = nominalPrimitiveSubtypeReview(mode === "result-only"), before = structuredClone(review);
		const files = generateCopiedPythonPackage(review), source = files["lean_nominalprimitivesubtypes/__init__.py"];
		assert.deepEqual(review, before);
		for(const name of ["Packet", "RawPacket", "Pair", "EventEmpty", "EventBox", "EventChoices"])
			assert.match(source, new RegExp(`@_dataclass\\(frozen=True, slots=True\\)\\nclass ${name}:`, "u"));
		assert.ok(source.includes("PacketAlias: _TypeAlias = Packet"));
		assert.ok(source.includes("Event: _TypeAlias = EventEmpty | EventBox | EventChoices"));
		assert.equal([...source.matchAll(/^def /gmu)].length, mode === "full" ? 14 : 6);
		assert.equal([...files["lean_nominalprimitivesubtypes/__init__.pyi"].matchAll(/^def /gmu)].length, mode === "full" ? 14 : 6);
		assert.equal(source.includes("def echo_a("), mode === "full");
		assert.equal(source.includes("def refuse_unit("), mode === "full");
		assert.doesNotMatch(source, /typing_extensions/u);
		assert.ok(files["binding-manifest.json"].includes('"generator"'));
	}
});
