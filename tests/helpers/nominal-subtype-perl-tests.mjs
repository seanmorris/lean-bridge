/**
 * Independent Perl caller controls and source checks, not installed acceptance.
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
import { nominalSubtypeInstalledConfiguration } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypePerlModule, nominalSubtypePerlRoutes, nominalSubtypePerlModes, nominalSubtypePerlConfiguration, nominalSubtypePerlCaller, nominalSubtypePerlCounts, nominalSubtypePerlSelection, parseNominalSubtypePerlResult } from "./nominal-subtype-perl-fixture.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlExecutables, probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

test("nominal Perl selections preserve both author routes and constructor-free result packages", async () => {
	for(const route of nominalSubtypePerlRoutes) for(const mode of nominalSubtypePerlModes)
	{
		const configured = nominalSubtypePerlConfiguration(route, mode);
		const previous = nominalSubtypeInstalledConfiguration(route, ["c"], mode === "result-only");
		assert.deepEqual({ ...configured, targets: previous.targets }, previous);
		assert.deepEqual(configured.targets, { cpan: { module: nominalSubtypePerlModule, version: "1.000" } });
		if(mode === "result-only") assert.equal(configured.contracts, undefined);
	}
	assert.equal(await nominalSubtypePerlCaller("reviewed"), (await nominalSubtypePerlCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => nominalSubtypePerlConfiguration("unknown", "full"));
	assert.throws(() => nominalSubtypePerlConfiguration("ordinary", "unknown"));
	await assert.rejects(nominalSubtypePerlCaller("unknown"));
	for(const mode of nominalSubtypePerlModes)
	{
		const counts = nominalSubtypePerlCounts[mode];
		assert.deepEqual(parseNominalSubtypePerlResult(JSON.stringify(counts), mode), counts);
		for(const key of Object.keys(counts))
			assert.throws(() => parseNominalSubtypePerlResult(JSON.stringify({ ...counts, [key]: counts[key] + 1 }), mode));
		assert.throws(() => parseNominalSubtypePerlResult(JSON.stringify({ ...counts, extra: 1 }), mode));
	}
	assert.throws(() => parseNominalSubtypePerlResult("{}", "unknown"));
});

test("nominal Perl installed gates reject partial, duplicate and disabled selections", () => {
	const prefix = "LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_", enabled = { [prefix + "TEST"]: "1" };
	assert.deepEqual(nominalSubtypePerlSelection({}), { enabled: false, routes: ["ordinary", "reviewed"], modes: ["full", "result-only"] });
	assert.equal(nominalSubtypePerlSelection(enabled).enabled, true);
	for(const flag of ["", "true", "yes", "2"]) assert.throws(() => nominalSubtypePerlSelection({ [prefix + "TEST"]: flag }));
	for(const [name, valid] of [["ROUTES", "ordinary"], ["MODES", "full"]])
	{
		for(const raw of ["", "unknown", `${valid},`, `${valid},${valid}`])
			assert.throws(() => nominalSubtypePerlSelection({ ...enabled, [prefix + name]: raw }));
		assert.throws(() => nominalSubtypePerlSelection({ [prefix + name]: valid }));
		assert.throws(() => nominalSubtypePerlSelection({ [prefix + "TEST"]: "0", [prefix + name]: valid }));
		assert.deepEqual(nominalSubtypePerlSelection({ ...enabled, [prefix + name]: valid })[name.toLowerCase()], [valid]);
	}
	assert.throws(() => nominalSubtypePerlSelection({ [prefix + "OUTPUT"]: "build/nominal-perl" }));
});

const executables = checkedRecordPerlExecutables(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PERLS);
for(const configuration of checkedRecordPerlConfigurations)
	test(`nominal Perl oracle detects wrong normalization, lossy results and input mutation on ${configuration}`, {
		skip: !process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_PERLS && !existsSync(executables[configuration])
			&& "Select LEAN_BRIDGE_NOMINAL_SUBTYPE_PERLS to execute caller controls"
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-perl-controls-"));
		t.after(() => rm(root, { recursive: true }));
		await probeCheckedRecordPerl(configuration, executables[configuration], root);
		for(const route of nominalSubtypePerlRoutes) for(const mode of nominalSubtypePerlModes)
		{
			await saveLakeFile(root, `${route}.pl`, await nominalSubtypePerlCaller(route));
			const run = await runCopied(executables[configuration], [
				resolve("tests/helpers/nominal-subtype-perl-model.pl")
				, join(root, `${route}.pl`)
				, route === "ordinary" ? "arg" : "value", mode], root);
			assert.equal(run.stderr, "");
			assert.deepEqual(JSON.parse(run.stdout), { ...nominalSubtypePerlCounts[mode], callerMutationControls: mode === "full" ? 16 : 7, diagnosticControls: 12 });
		}
	});

test("nominal Perl source preserves per-use constructors, Fin priority and constructor-free result projections", async () => {
	// Authenticate existing Lean models for source generation only. No Perl package was installed here.
	const root = "docs/evidence/nominal-subtype-native-20261011";
	const indexBytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(indexBytes), "ce84736ea4a7e580e66eeacf49412aba3c6291e301a730a603d342ec7b57d992");
	const index = JSON.parse(indexBytes), moduleName = nominalSubtypePerlModule;
	for(const route of nominalSubtypePerlRoutes) for(const mode of nominalSubtypePerlModes)
	{
		const path = `${route}-${mode}/records/build-0/model.json`, entry = index.files.find(item => item.path === path);
		const bytes = await readFile(`${root}/${path}`);
		assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256);
		const native = JSON.parse(bytes), model = { ...native, moduleName, exports: projectPerlNames(moduleName, native.exports) };
		const before = structuredClone(model), files = generatePerlBindingPackage(model, {
			library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }
			, runtimeIdentity: "c".repeat(64), initializer: "initialize_NominalSubtypes"
		});
		assert.deepEqual(model, before);
		const xs = files["Component.xs"];
		const body = name => {
			const start = xs.indexOf(`\n${name}(...)\n`); assert.ok(start > 0);
			const end = xs.indexOf("\nvoid\n", start + 1);
			return xs.slice(start, end < 0 ? undefined : end);
		};
		for(const item of model.exports)
		{
			const source = body(item.publicName);
			if(mode === "full" && item.refinements.parameters.some(tree => JSON.stringify(tree).includes('"subtype"')))
			{
				const validator = source.indexOf(`${item.symbol}_refinement_`);
				assert.ok(validator > 0 && validator < source.indexOf(`lean_object *checked = ${item.symbol}(`));
			}
			else assert.doesNotMatch(source, /_refinement_/u);
		}
		for(const name of ["Envelope", "AliasPair", "Event::Empty", "Event::Box", "Event::Choices"])
			assert.ok(files["lib/LeanBridge/NominalSubtypes.pm"].includes(`package ${moduleName}::${name};`));
		if(mode === "result-only")
		{
			assert.equal(model.exports.length, 13);
			assert.doesNotMatch(xs, /was rejected by NominalSubtypes\.|\nfirst\(\.\.\.\)/u);
			continue;
		}
		assert.equal(model.exports.length, 26);
		for(const name of ["combine", "nested", "aliases", "echo_event"])
			assert.ok(body(name).indexOf("is not below its Fin 3 bound") < body(name).indexOf("was rejected by NominalSubtypes."));
		assert.ok(body("nested").includes("%s.left.payload was rejected by NominalSubtypes.plusOne"));
		assert.ok(body("nested").includes("%s.right.payload was rejected by NominalSubtypes.plusTwo"));
		assert.ok(body("echo_pair").includes("%s.right[%zu]?.payload was rejected by NominalSubtypes.plusTwo"));
		assert.ok(body("event_first").includes("%s.choices.values[%zu]?.ok was rejected by NominalSubtypes.plusOne"));
		assert.ok(body("event_second").includes("%s.choices.values[%zu]?.ok was rejected by NominalSubtypes.plusTwo"));
		assert.ok(body("event_first").includes("%s.choices.values[%zu]?.error was rejected by NominalSubtypes.plusTwo"));
		assert.ok(body("event_second").includes("%s.choices.values[%zu]?.error was rejected by NominalSubtypes.plusOne"));
	}
});
