/**
 * Validate bounded ownership converters before public XS call integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedPerlConversions } from "../src/backends/perl/owned-conversions.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const fixtures = { composition: ownedCppCompositionReviewedIr, scalars: ownedPythonScalarsReviewedIr };

test("Perl owned converters preserve finite schemas, C field types and identity ownership", () => {
	for(const [name, fixture] of Object.entries(fixtures))
	{
		const ir = fixture(), before = structuredClone(ir), generated = generateOwnedPerlConversions(ir, "LeanBridge::OwnedConversions");
		assert.deepEqual(ir, before);
		assert.equal(generated.source, generateOwnedPerlConversions(ir, "LeanBridge::OwnedConversions").source);
		assert.equal(generated.types.length, name === "composition" ? 41 : 26);
		for(const node of generated.types)
		{
			assert.ok(generated.source.includes(`static void lpo_read${node.index}(`));
			assert.ok(generated.source.includes(`static SV *lpo_write${node.index}(`));
			if(node.identity)
			{
				assert.ok(generated.source.includes(`*out = (${node.cName})lpo_borrow(aTHX_ value, ${node.index});`));
				assert.ok(generated.source.includes(`(void *)*value, ${node.index}, "${node.publicType}"`));
			}
		}
		assert.match(generated.source, /SAVEDESTRUCTOR_X\(lpo_clear_integer, number\)/u);
		assert.match(generated.source, /scope->nodes/u);
		assert.match(generated.source, /lpg_enter\(aTHX_ scope/u);
		assert.match(generated.source, /Cyclic Perl copied value/u);
		if(generated.types.some(node => node.kind === "variant"))
			assert.match(generated.source, /Expected an exact generated variant constructor/u);
		if(name === "scalars") assert.equal(generated.types.filter(node => node.kind === "primitive").length, 19);
	}
});

test("owned converters compile against all selected real Perl ABIs and generated public C headers", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 180000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-perl-converters-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const environment = { PATH: "/usr/bin:/bin" };
	let checks = 0;
	for(const perl of perlGraphCommands())
	{
		const config = JSON.parse((await runCopied(perl, ["-MConfig"
			, "-MText::ParseWords", "-MJSON::PP", "-e"
			, 'print encode_json({include => "$Config{archlibexp}/CORE", flags => [Text::ParseWords::shellwords($Config{ccflags} . " " . $Config{cccdlflags})]})'], directory, environment)).stdout);
		for(const [name, fixture] of Object.entries(fixtures))
		{
			const generated = generateOwnedPerlConversions(fixture(), "LeanBridge::OwnedConversions");
			await saveLakeFile(directory, generated.c.prefix + ".h", generated.c.header);
			await saveLakeFile(directory, name + ".c", generated.source);
			await runCopied("/usr/bin/cc", ["-std=gnu11", "-Wall"
				, "-Wextra", "-Werror"
				, "-Wno-unused-function", "-fsyntax-only", ...config.flags
				, "-I", config.include, "-I", directory
				, name + ".c"], directory, environment);
			++checks;
		}
	}
	t.diagnostic(`${checks} ABI/header compile checks; public XS calls and native round-trips are separate.`);
});
