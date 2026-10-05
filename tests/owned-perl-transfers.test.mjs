/**
 * Compile Perl consuming calls and verify native handoffs on each XS ABI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPerlXs } from "../src/backends/perl/owned-xs.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { ownedRustTransferConfiguration, ownedRustTransferReviewedIr, ownedRustTransferSource } from "./helpers/owned-rust-transfer-fixture.mjs";
import { prepareOwnedPerlNative } from "./helpers/owned-perl-native.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("Perl transfers require explicit capability and leave borrowed APIs unchanged", () => {
	const ir = ownedRustTransferReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe"), /call-scoped input borrows/u);
	const generated = generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", { transferredInputs: true });
	assert.deepEqual(ir, original);
	assert.equal(generated.functions.filter(fn => fn.transfers?.length).length, 20);
	assert.match(generated.declarations, /SAVEDESTRUCTOR_X\(lpo_input_entry_end, entry\)/u);
	assert.match(generated.declarations, /inputs->scope != scope/u);
	assert.match(generated.xs, /lpo_finish_inputs\(aTHX_ moves\);\n {4}lpo_finish_frame/u);
	for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr])
	{
		const normal = generateOwnedPerlXs(fixture(), "LeanBridge::OwnedProbe");
		const enabled = generateOwnedPerlXs(fixture(), "LeanBridge::OwnedProbe", { transferredInputs: true });
		for(const field of ["declarations", "xs", "valuesSource"]) assert.equal(enabled[field], normal[field]);
	}
});

test("Perl XS transfer signatures compile on each selected ABI", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_TRANSFER_TEST !== "1", timeout: 240000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-transfer-signatures-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const generated = generateOwnedPerlXs(ownedRustTransferReviewedIr(), "LeanBridge::OwnedProbe", { transferredInputs: true });
	await saveLakeFile(directory, generated.c.prefix + ".h", generated.c.header);
	await saveLakeFile(directory, "Probe.xs", generated.declarations + "\n" + generated.xs);
	for(const perl of perlGraphCommands())
	{
		const environment = { PATH: "/usr/bin:/bin" };
		const config = JSON.parse((await runCopied(perl, [
			"-MConfig", "-MText::ParseWords", "-MJSON::PP", "-e"
			, 'print encode_json({include => "$Config{archlibexp}/CORE", flags => [Text::ParseWords::shellwords($Config{ccflags} . " " . $Config{cccdlflags})]})'], directory, environment)).stdout);
		await runCopied(perl, ["-MExtUtils::ParseXS", "-e"
			, 'ExtUtils::ParseXS::process_file(filename => "Probe.xs", output => "Probe.c", prototypes => 0)'], directory, environment);
		await runCopied("/usr/bin/cc", ["-std=gnu11", "-Wall", "-Wextra", "-Werror"
			, "-Wno-unused-function", "-fsyntax-only", ...config.flags
			, "-I", config.include, "-I", directory, "Probe.c"], directory, environment);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`Perl aliases follow real Lean input transfers (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_TRANSFER_TEST !== "1"
	, timeout: 1200000
}, async t => {
	const compiled = await prepareOwnedPerlNative(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustTransferConfiguration() } : { reviewedIr: ownedRustTransferReviewedIr() })
		, sourceSuffix: ownedRustTransferSource, transferredInputs: true
		, evidenceName: `perl-transfers-${mode}-inputs.json`
	});
	const consumer = await readFile("tests/fixtures/structured-types/owned-perl-transfers.pl", "utf8");
	await saveLakeFile(compiled.directory, "consumer.pl", consumer);
	const observations = [];
	for(const perl of perlGraphCommands())
	{
		let execution;
		try
		{
			await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
			execution = await runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment);
		}
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
		assert.equal(execution.stderr, ""); const observed = JSON.parse(execution.stdout);
		assert.ok(observed.checks > 100);
		assert.equal(observed.managedLive, 0); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		for(const name of ["single", "multiple"])
			for(const domain of ["allocator", "exception", "native"])
				for(const phase of ["before", "after"]) assert.ok(observed[name][domain][phase] > 0, `${name}/${domain}/${phase}`);
		observations.push({ perl, observed }); t.diagnostic(JSON.stringify({ perl, observed }));
	}
	await saveLakeFile(resolve("build/owned-perl-transfers"), `${mode}.json`, canonicalJson({
		mode, compiledLean: true, installedPackage: false, observations
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs)
		, consumerSha256: sha256(consumer)
	}));
});
