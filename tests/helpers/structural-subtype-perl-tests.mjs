/**
 * Independent Perl caller controls, without an installed-package claim.
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
import { structuralSubtypeConfiguration } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypePerlConfiguration, structuralSubtypePerlCaller, structuralSubtypePerlCounts, parseStructuralSubtypePerlResult } from "./structural-subtype-perl-fixture.mjs";
import { checkedRecordPerlConfigurations, checkedRecordPerlExecutables, probeCheckedRecordPerl } from "./checked-record-perl-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import "./structural-subtype-perl-evidence-tests.mjs";

test("structural Perl configurations retain independent ordinary and reviewed contracts", async () => {
	for(const route of ["ordinary", "reviewed"])
	{
		const configured = structuralSubtypePerlConfiguration(route), previous = structuralSubtypeConfiguration(route, ["c"]);
		assert.deepEqual({ ...configured, targets: previous.targets }, previous);
		assert.deepEqual(configured.targets, { cpan: { module: "LeanBridge::StructuralSubtypes", version: "1.000" } });
	}
	assert.equal(await structuralSubtypePerlCaller("reviewed"), (await structuralSubtypePerlCaller("ordinary")).replaceAll(/arg([01])/gu, "value$1"));
	assert.throws(() => structuralSubtypePerlConfiguration("unknown"));
	await assert.rejects(structuralSubtypePerlCaller("unknown"));
	assert.deepEqual(parseStructuralSubtypePerlResult(JSON.stringify(structuralSubtypePerlCounts)), structuralSubtypePerlCounts);
	for(const key of Object.keys(structuralSubtypePerlCounts))
		assert.throws(() => parseStructuralSubtypePerlResult(JSON.stringify({ ...structuralSubtypePerlCounts, [key]: 0 })));
	assert.throws(() => parseStructuralSubtypePerlResult(JSON.stringify({ ...structuralSubtypePerlCounts, unexpected: 1 })));
});

const executables = checkedRecordPerlExecutables(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERLS);
for(const configuration of checkedRecordPerlConfigurations)
	test(`Perl structural caller detects dropped checks, damaged strings, mutable BigInts and error suffixes on ${configuration}`, {
		skip: !process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERLS && !existsSync(executables[configuration])
			&& "Select LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERLS to execute caller controls"
	}, async t => {
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-structural-perl-controls-"));
		t.after(() => rm(root, { recursive: true }));
		await probeCheckedRecordPerl(configuration, executables[configuration], root);
		for(const route of ["ordinary", "reviewed"])
		{
			await saveLakeFile(root, `${route}.pl`, await structuralSubtypePerlCaller(route));
			const run = await runCopied(executables[configuration], [
				resolve("tests/helpers/structural-subtype-perl-model.pl")
				, join(root, `${route}.pl`)
				, route === "ordinary" ? "arg" : "value"], root);
			assert.equal(run.stderr, "");
			assert.deepEqual(JSON.parse(run.stdout), { ...structuralSubtypePerlCounts, callerMutationControls: 8, diagnosticControls: 12 });
		}
	});

test("Perl structural XS preserves nested paths, Fin priority and scalar unboxing", async () => {
	// Reuse authenticated semantic models for source generation only, not Perl acceptance.
	const root = "docs/evidence/structural-subtype-wit-20261011";
	const indexBytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(indexBytes), "c630598ad8ecedce13f1bc7b469dc416ff615d53cd8c82486c5c98b15280ba9f");
	const index = JSON.parse(indexBytes), moduleName = "LeanBridge::StructuralSubtypes";
	for(const route of ["ordinary", "reviewed"])
	{
		const path = `${route}/records/build-0/model.json`, entry = index.files.find(item => item.path === path);
		const bytes = await readFile(`${root}/${path}`);
		assert.equal(bytes.length, entry.bytes); assert.equal(sha256(bytes), entry.sha256);
		const native = JSON.parse(bytes), model = { ...native, moduleName, exports: projectPerlNames(moduleName, native.exports) };
		const before = structuredClone(model), files = generatePerlBindingPackage(model, {
			library: "libcomponent_test.so"
			, nativeLibrary: { sha256: "b".repeat(64) }
			, runtimeIdentity: "c".repeat(64)
			, initializer: "initialize_StructuralSubtypes"
		});
		assert.deepEqual(model, before);
		const xs = files["Component.xs"];
		const body = name => {
			const start = xs.indexOf(`\n${name}(...)\n`); assert.ok(start > 0);
			const end = xs.indexOf("\nvoid\n", start + 1);
			return xs.slice(start, end < 0 ? undefined : end);
		};
		for(const name of ["scalar", "arrays", "lists", "options", "product", "branch", "byte_branches", "nested", "alias_pair", "alias_arguments", "specialized"])
		{
			const source = body(name), item = model.exports.find(exported => exported.publicName === name);
			const validator = source.indexOf(`${item.symbol}_refinement_`);
			assert.ok(validator > 0 && validator < source.indexOf(`lean_object *checked = ${item.symbol}(`));
		}
		const nested = body("nested");
		assert.ok(nested.indexOf("is not below its Fin") < nested.indexOf("was rejected by StructuralSubtypes.checkedPositive"));
		assert.ok(nested.includes("%s[%zu][%zu]?.0 was rejected by StructuralSubtypes.checkedPositive"));
		assert.ok(body("byte_branches").includes("uint8_t"));
		assert.ok(body("byte_branches").includes("?.0 was rejected by StructuralSubtypes.checkedByte"));
		assert.ok(body("alias_pair").includes("%s.0[%zu]? was rejected by StructuralSubtypes.checkedPositive"));
		assert.ok(body("alias_pair").includes("%s.1[%zu]? was rejected by StructuralSubtypes.normalizePositive"));
		assert.doesNotMatch(body("plain_fin"), /_refinement_/u);
		assert.ok(files["lib/LeanBridge/StructuralSubtypes.pm"].includes("=head1 CHECKED VALUES"));
	}
});
