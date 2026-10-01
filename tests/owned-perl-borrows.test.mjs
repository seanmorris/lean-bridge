/**
 * Actual Lean borrowed results, original-owner transfers and Perl XS ABIs.
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
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { prepareOwnedPerlNative } from "./helpers/owned-perl-native.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { transferredInputs: true, anchoredResults: true };

test("Perl anchored results require explicit capability and preserve unanchored APIs", () => {
	const ir = ownedRustBorrowReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", { transferredInputs: true }), /explicit output leases/u);
	const model = generateOwnedPerlXs(ir, "LeanBridge::OwnedProbe", options);
	assert.deepEqual(ir, original);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.match(model.xs, /lpo_anchor_owner\(aTHX_ owner, input_owner2\)/u);
	assert.match(model.xs, /&input_owner0->result/u);
	assert.match(model.valuesSource, /package LeanBridge::OwnedProbe::Value/u);
	for(const fixture of [ownedAggregateReviewedIr, ownedRustTransferReviewedIr])
	{
		const baseline = generateOwnedPerlXs(fixture(), "LeanBridge::OwnedProbe", { transferredInputs: true });
		const enabled = generateOwnedPerlXs(fixture(), "LeanBridge::OwnedProbe", options);
		for(const field of ["declarations", "xs", "valuesSource"]) assert.equal(enabled[field], baseline[field]);
	}
	const reversed = structuredClone(ir); reversed.types.reverse();
	const reordered = generateOwnedPerlXs(reversed, "LeanBridge::OwnedProbe", options);
	for(const field of ["declarations", "xs", "valuesSource"]) assert.equal(reordered[field], model[field]);
});

test("Perl borrowed-result signatures compile on every selected XS ABI", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_BORROW_TEST !== "1", timeout: 240000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-perl-borrow-signatures-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const generated = generateOwnedPerlXs(ownedRustBorrowReviewedIr(), "LeanBridge::OwnedProbe", options);
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
			, "-I", config.include
			, "-I", directory, "Probe.c"], directory, environment);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`Perl borrowed values expire with their original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_BORROW_TEST !== "1", timeout: 1200000
}, async t => {
	const compiled = await prepareOwnedPerlNative(t, {
		...(mode === "ordinary" ? { configuration: await ownedRustBorrowConfiguration() } : { reviewedIr: ownedRustBorrowReviewedIr() })
		, sourceSuffix: ownedRustBorrowSource
		, ...options
		, evidenceName: `perl-borrows-${mode}-inputs.json`
	});
	const consumer = await readFile("tests/fixtures/structured-types/owned-perl-borrows.pl", "utf8");
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
		for(const domain of ["allocator", "exception", "native"])
			for(const phase of ["before", "after"]) assert.ok(observed.faults[domain][phase] > 0);
		const equal = `${compiled.model.types.find(node => node.name === "Ticket").cName}_equal`;
		const mutants = [
			["unchecked-whole-value"
				, "if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);"
				, "if (!wrapper->payload) lpo_status(aTHX_ 4);"]
			, ["unchecked-empty-value"
				, "if (lpo_closed(wrapper) || !wrapper->payload) lpo_status(aTHX_ 4);"
				, "if (!wrapper->payload || (SvOK(wrapper->payload) && !(SvROK(wrapper->payload) && SvTYPE(SvRV(wrapper->payload)) == SVt_PVAV && av_len((AV *)SvRV(wrapper->payload)) < 0) && lpo_closed(wrapper))) lpo_status(aTHX_ 4);"]
			, ["discarded-whole-owner"
				, "    owner->valid = 0;\n    if (!owner->pins) lpo_release_native(aTHX_ owner);"
				, "    owner->valid = 1;"]
			, ["escaped-callback-frame", "if (!owner->published || owner->borrowed) {"
				, "if (!owner->published && !owner->borrowed) {"]
			, ["pointer-equality"
				, `lpo_status(aTHX_ ${equal}(lpo_state.session, left, right, &equal));`
				, "equal = left == right;"]
		];
		const rejectedMutations = [];
		for(const [name, before, after] of mutants)
		{
			assert.equal(compiled.xs.split(before).length, 2, name);
			const changed = compiled.xs.replace(before, after);
			await saveLakeFile(compiled.directory, "Probe.xs", changed);
			try
			{
				await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
				await assert.rejects(runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment), error => {
					assert.match(error.details.stderr, /borrow check \d+/u);
					assert.doesNotMatch(error.details.stderr, /syntax error|Undefined subroutine|Can't locate/u);
					return true;
				});
				rejectedMutations.push({ name, compiled: true, sourceSha256: sha256(changed) });
			}
			finally
			{ await saveLakeFile(compiled.directory, "Probe.xs", compiled.xs); }
		}
		observations.push({ perl, observed, rejectedMutations }); t.diagnostic(JSON.stringify({ perl, observed, rejectedMutations }));
	}
	await saveLakeFile(resolve("build/owned-perl-borrows"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observations
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
		, nativeSourceSha256: sha256(compiled.native)
		, declarationsSha256: sha256(compiled.model.declarations)
		, valuesSha256: sha256(compiled.model.valuesSource)
		, xsSha256: sha256(compiled.xs), consumerSha256: sha256(consumer)
	}));
});

test("Perl borrowed results execute without consuming-input capability", {
	skip: process.env.LEAN_BRIDGE_OWNED_PERL_BORROW_TEST !== "1", timeout: 1200000
}, async t => {
	const probe = `use strict; use warnings; use Math::BigInt; use LeanBridge::OwnedProbe;
my $root = LeanBridge::OwnedProbe::new_ticket(Math::BigInt->new(42), 'borrow-only');
my $view = LeanBridge::OwnedProbe::retain_ticket($root);
my $retained = $view->retain;
my $empty = LeanBridge::OwnedProbe::copy_value(undef, result_of => 'echo_option');
my $empty_view = LeanBridge::OwnedProbe::echo_option($empty);
die 'empty option changed' if defined $empty_view->get;
$root->close; $empty->close;
for my $expired ($view, $empty_view) {
  die 'borrow remained open' unless $expired->closed;
  my $ok = eval { $expired->get; 1 };
  die 'borrowed value escaped' if $ok || $@ !~ /status=4/;
}
die 'retained value expired' unless LeanBridge::OwnedProbe::serial($retained->get)->bcmp(42) == 0;
$_->close for ($root, $view, $retained, $empty, $empty_view);
undef $root; undef $view; undef $retained; undef $empty; undef $empty_view;
LeanBridge::OwnedProbe::Runtime::shutdown();
my @final = LeanBridge::OwnedProbe::snapshot();
die 'borrow-only leaked' if grep { $_ } @final[0..3,6,7];
print "borrow-only-ok\\n";
`;
	const observations = [];
	for(const mode of ["ordinary", "reviewed"])
	{
		const compiled = await prepareOwnedPerlNative(t, {
			...(mode === "ordinary" ? { configuration: await ownedBorrowConfiguration() } : { reviewedIr: ownedBorrowReviewedIr() })
			, anchoredResults: true, evidenceName: `perl-borrow-only-${mode}-inputs.json`
		});
		assert.ok(compiled.model.functions.every(fn => !fn.transfers?.length));
		await saveLakeFile(compiled.directory, "consumer.pl", probe);
		for(const perl of perlGraphCommands())
		{
			await runCopied(perl, ["build.pl"], compiled.directory, { ...compiled.environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" }).catch(error => {
				throw new Error(JSON.stringify(error.details), { cause: error });
			});
			const run = await runCopied(perl, ["-I.", "consumer.pl"], compiled.directory, compiled.environment);
			assert.equal(run.stderr, ""); assert.equal(run.stdout, "borrow-only-ok\n");
			observations.push({ mode, perl, ...run, actualLean: true
				, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.c.layout.model.component }
				, nativeSourceSha256: sha256(compiled.native)
				, xsSha256: sha256(compiled.xs) });
		}
	}
	await saveLakeFile(resolve("build/owned-perl-borrows"), "borrow-only.json", canonicalJson({ observations, probe, probeSha256: sha256(probe) }));
});
