/**
 * Independent primitive-base Perl caller controls and source checks, not installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { generatePerlBindingPackage } from "../../src/backends/perl/generate.mjs";
import { projectPerlNames } from "../../src/backends/perl/naming.mjs";
import { validateExportConfiguration } from "../../src/analyze/export-configuration.mjs";
import { nominalPrimitiveSubtypeConfiguration, nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { nominalPrimitiveSubtypePerlModule, nominalPrimitiveSubtypePerlRoutes, nominalPrimitiveSubtypePerlModes, nominalPrimitiveSubtypePerlConfiguration, nominalPrimitiveSubtypePerlCaller, nominalPrimitiveSubtypePerlArguments, nominalPrimitiveSubtypePerlCounts, nominalPrimitiveSubtypePerlSelection, nominalPrimitiveSubtypePerlExecutables, parseNominalPrimitiveSubtypePerlResult } from "./nominal-primitive-subtype-perl-fixture.mjs";
import { checkedRecordPerlConfigurations, probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

test("primitive-base Perl configurations preserve both source routes and constructor-free result exports", async () => {
	for(const route of nominalPrimitiveSubtypePerlRoutes) for(const mode of nominalPrimitiveSubtypePerlModes)
	{
		const actual = nominalPrimitiveSubtypePerlConfiguration(route, mode);
		const expected = nominalPrimitiveSubtypeConfiguration(route, ["c"], mode === "result-only");
		validateExportConfiguration(actual);
		assert.deepEqual({ ...actual, targets: expected.targets }, expected);
		assert.deepEqual(actual.targets, { cpan: { module: nominalPrimitiveSubtypePerlModule, version: "1.000" } });
		if(mode === "result-only") assert.equal(actual.contracts, undefined);
		assert.deepEqual(nominalPrimitiveSubtypePerlArguments(route, mode), ["consumer.pl", ...mode === "result-only" ? ["--result-only"] : [], ...route === "reviewed" ? ["--reviewed"] : []]);
	}
	assert.equal(await nominalPrimitiveSubtypePerlCaller("reviewed"), await nominalPrimitiveSubtypePerlCaller("ordinary"));
	assert.throws(() => nominalPrimitiveSubtypePerlConfiguration("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypePerlConfiguration("ordinary", "unknown"));
	assert.throws(() => nominalPrimitiveSubtypePerlArguments("unknown", "full"));
	assert.throws(() => nominalPrimitiveSubtypePerlArguments("ordinary", "unknown"));
	await assert.rejects(nominalPrimitiveSubtypePerlCaller("unknown"));
	for(const mode of nominalPrimitiveSubtypePerlModes)
	{
		const counts = nominalPrimitiveSubtypePerlCounts[mode];
		assert.deepEqual(parseNominalPrimitiveSubtypePerlResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalPrimitiveSubtypePerlResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalPrimitiveSubtypePerlResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalPrimitiveSubtypePerlResult("{}", "unknown"));
});

test("primitive-base Perl gates reject disabled selections, non-string values and partial ABI matrices", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERL_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalPrimitiveSubtypePerlSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalPrimitiveSubtypePerlSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2", true, null])
		assert.throws(() => nominalPrimitiveSubtypePerlSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`, true, null])
			assert.throws(() => nominalPrimitiveSubtypePerlSelection({ ...enabled, [prefix + name]: raw }));
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePerlSelection({ [prefix + "TEST"]: flag, [prefix + name]: valid }));
		assert.deepEqual(nominalPrimitiveSubtypePerlSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	for(const name of [prefix + "OUTPUT", "LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS"])
		for(const flag of [undefined, "0"])
			assert.throws(() => nominalPrimitiveSubtypePerlSelection({ [prefix + "TEST"]: flag, [name]: "explicit" }));
	const commands = Object.fromEntries(checkedRecordPerlConfigurations.map(name => [name, `/toolchains/perl/${name}/bin/perl`]));
	assert.deepEqual(nominalPrimitiveSubtypePerlExecutables(JSON.stringify(commands)), commands);
	assert.deepEqual(Object.keys(nominalPrimitiveSubtypePerlExecutables(undefined)).sort(), [...checkedRecordPerlConfigurations].sort());
	for(const raw of ["", "null", "[]", "{}"
		, JSON.stringify(Object.fromEntries(Object.entries(commands).slice(0, 3)))
		, JSON.stringify({ ...commands, "5.40.0-threaded": "/toolchains/perl/5.40.0-threaded/bin/perl" })
		, JSON.stringify({ ...commands, "5.38.2-unthreaded": commands["5.38.2-threaded"] })
		, JSON.stringify({ ...commands, "5.36.3-threaded": "perl" })])
		assert.throws(() => nominalPrimitiveSubtypePerlExecutables(raw));
});

const executables = nominalPrimitiveSubtypePerlExecutables(process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS);
const rejectedMutations = [...nominalPrimitiveSubtypeFields.map(field => field.name)
	, "digit", "wrong-word-width", "normalization-bypass"
	, "unit-refusal-bypass", "inactive-branch-added"];
for(const configuration of checkedRecordPerlConfigurations)
	test(`primitive-base Perl caller detects twenty field mutations and four semantic mutations on ${configuration}`, {
		skip: !process.env.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS && !existsSync(executables[configuration])
			&& "Select LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PERLS to execute caller controls"
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-primitive-perl-controls-"));
		t.after(() => rm(root, { recursive: true }));
		await probeCheckedRecordPerl(configuration, executables[configuration], root);
		const caller = await nominalPrimitiveSubtypePerlCaller("ordinary"), path = join(root, "consumer.pl");
		await saveLakeFile(root, "consumer.pl", caller);
		const run = await runCopied(executables[configuration], [resolve("tests/helpers/nominal-primitive-subtype-perl-model.pl"), path], root);
		assert.equal(run.stderr, ""); const result = JSON.parse(run.stdout);
		assert.equal(result.installedAcceptance, false); assert.equal(result.diagnosticControls, 12);
		assert.deepEqual(result.results, nominalPrimitiveSubtypePerlModes.flatMap(mode => ["arg", "value"].map(parameterPrefix => ({
			resultOnly: mode === "result-only", parameterPrefix
			, ...nominalPrimitiveSubtypePerlCounts[mode] }))));
		assert.deepEqual(result.rejectedMutations, rejectedMutations);
		assert.equal(await readFile(path, "utf8"), caller);
		t.diagnostic("An explicit runtime double exercises the caller; no installed Lean library executes.");
	});

test("primitive-base Perl source preserves per-site constructors, Fin priority and constructor-free result projections", async () => {
	// Authenticate existing Lean models for source generation only. No Perl package was installed here.
	const root = "docs/evidence/nominal-primitive-subtype-python-20261014";
	const indexBytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(indexBytes), "6ca71a8845f0025aad297334f8c72dd4e6b90228697e02bde65c84b2ff36aa7b");
	const index = JSON.parse(indexBytes), moduleName = nominalPrimitiveSubtypePerlModule;
	for(const route of nominalPrimitiveSubtypePerlRoutes) for(const mode of nominalPrimitiveSubtypePerlModes)
	{
		const path = `${route}/${mode}/records/build-0/model.json`, entry = index.files.find(item => item.path === path);
		const bytes = await readFile(`${root}/${path}`);
		assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256);
		const native = JSON.parse(bytes), model = { ...native, moduleName, exports: projectPerlNames(moduleName, native.exports) };
		const before = structuredClone(model), files = generatePerlBindingPackage(model, {
			library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }
			, runtimeIdentity: "c".repeat(64)
			, initializer: "initialize_NominalPrimitiveSubtypes"
		});
		assert.deepEqual(model, before);
		const xs = files["Component.xs"], pm = files["lib/LeanBridge/NominalPrimitiveSubtypes.pm"];
		const body = name => {
			const start = xs.indexOf(`\n${name}(...)\n`); assert.ok(start > 0, name);
			const end = xs.indexOf("\nvoid\n", start + 1);
			return xs.slice(start, end < 0 ? undefined : end);
		};
		for(const item of model.exports)
		{
			const source = body(item.publicName), parameters = item.refinements?.parameters ?? [];
			if(mode === "full" && parameters.some(tree => JSON.stringify(tree).includes('"subtype"')))
			{
				const validator = source.indexOf(`${item.symbol}_refinement_`);
				assert.ok(validator > 0 && validator < source.indexOf(`lean_object *checked = ${item.symbol}(`), item.publicName);
			}
			else assert.doesNotMatch(source, /_refinement_/u);
		}
		for(const name of ["Some", "Ok", "Err", "Packet", "RawPacket", "Pair", "Event", "Event::Empty", "Event::Box", "Event::Choices"])
			assert.ok(pm.includes(`package ${moduleName}::${name};`), name);
		if(mode === "result-only")
		{
			assert.equal(model.exports.length, 6);
			assert.doesNotMatch(xs, /was rejected by NominalPrimitiveSubtypes\.|\necho_a\(\.\.\.\)|\nrefuse_unit\(\.\.\.\)/u);
			continue;
		}
		assert.equal(model.exports.length, 14);
		for(const name of ["combine", "aliases", "echo_pair", "echo_event_a", "echo_event_b"])
			assert.ok(body(name).indexOf("is not below its Fin 3 bound") < body(name).indexOf("was rejected by NominalPrimitiveSubtypes."), name);
		for(const field of nominalPrimitiveSubtypeFields)
		{
			assert.ok(body("echo_a").includes(`%s.${field.name} was rejected by NominalPrimitiveSubtypes.${field.constructor}A`), field.name);
			assert.ok(body("echo_b").includes(`%s.${field.name} was rejected by NominalPrimitiveSubtypes.${field.constructor}B`), field.name);
			assert.ok(!body("echo_a").includes(`NominalPrimitiveSubtypes.${field.constructor}B`), field.name);
			assert.ok(!body("echo_b").includes(`NominalPrimitiveSubtypes.${field.constructor}A`), field.name);
		}
		assert.ok(body("refuse_unit").includes("%s.unitValue was rejected by NominalPrimitiveSubtypes.unitReject"));
		assert.ok(!body("refuse_unit").includes("NominalPrimitiveSubtypes.unitA"));
		assert.ok(body("combine").includes("%s.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("combine").includes("%s.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_pair").includes("%s.left[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_pair").includes("%s.right[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("aliases").includes("%s[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("aliases").includes("%s[%zu]?.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_a").includes("%s.box.value.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_event_a").includes("%s.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_event_a").includes("%s.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_b").includes("%s.box.value.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_b").includes("%s.choices.values[%zu]?.ok.natValue was rejected by NominalPrimitiveSubtypes.natB"));
		assert.ok(body("echo_event_b").includes("%s.choices.values[%zu]?.error.natValue was rejected by NominalPrimitiveSubtypes.natA"));
		assert.ok(body("echo_event_a").includes("%s.box.value.digit is not below its Fin 3 bound"));
		assert.ok(body("echo_event_a").includes("%s.choices.values[%zu]?.error.digit is not below its Fin 3 bound"));
	}
});
