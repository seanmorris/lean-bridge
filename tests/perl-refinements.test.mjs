/**
 * Perl-specific refinement cases: an unboxed checked word and nested Fin 0 controls in installed CPAN packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const site = constructor => ({ ownership: "copy", lifetime: null, refinement: { constructor } });
const plain = { ownership: "copy", lifetime: null, refinement: "reject" };
const fin = bound => ({ kind: "fin", bound });
const inside = (kind, child) => ({ kind, arguments: [child] });
const checked = { kind: "subtype", constructor: "PerlRefinements.checkedDigit32" };
/** Export contracts: the checked word at parameter and result sites; container exports carry compiler bounds. */
export const perlRefinementContracts = Object.freeze({
	"PerlRefinements.twice": { parameters: [site("PerlRefinements.checkedDigit32")], result: plain }
	, "PerlRefinements.wrap32": { parameters: [plain], result: site("PerlRefinements.checkedDigit32") }
	, "PerlRefinements.tag": { parameters: [plain, site("PerlRefinements.checkedDigit32")], result: plain } });
const names = [...Object.keys(perlRefinementContracts), "PerlRefinements.countAbsent", "PerlRefinements.emptyRows", "PerlRefinements.nestedEmpty", "PerlRefinements.nestedDigits"];
/** Refinement trees the native model must carry. */
export const perlRefinementRefinements = Object.freeze({
	"PerlRefinements.twice": { parameters: [checked], result: null }
	, "PerlRefinements.wrap32": { parameters: [null], result: checked }
	, "PerlRefinements.tag": { parameters: [null, checked], result: null }
	, "PerlRefinements.countAbsent": { parameters: [inside("array", inside("option", fin("0")))], result: null }
	, "PerlRefinements.emptyRows": { parameters: [inside("option", inside("array", fin("0")))], result: null }
	, "PerlRefinements.nestedEmpty": { parameters: [inside("array", inside("array", fin("0")))], result: null }
	, "PerlRefinements.nestedDigits": { parameters: [inside("list", inside("option", fin("3")))], result: null } });

/** Public API cases: the unboxed checked word and the nested Fin 0 controls. */
const consumer = () => `use strict;
use warnings;
use Math::BigInt;
use LeanBridge::PerlRefinements;
my $checks = 0;
sub check { die "failed: $_[1]\\n" unless $_[0]; ++$checks; }
sub some { LeanBridge::PerlRefinements::Some->new($_[0]) }
sub n { Math::BigInt->new("$_[0]") }
sub rejected {
  my ($call, $parameter, $constructor) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$parameter was rejected by $constructor") == 0;
}
sub bound {
  my ($call, $parameter, $limit) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$parameter is not below its Fin $limit bound") == 0;
}
sub dies { my ($call) = @_; my $passed = eval { $call->(); 1 }; return !$passed; }
my $ctor = 'PerlRefinements.checkedDigit32';
# An unboxed UInt32 subtype passes by value: endpoints, constructor rejection, then the word's own errors.
check(LeanBridge::PerlRefinements::twice(0) == 0 && LeanBridge::PerlRefinements::twice(9) == 18, 'twice endpoints');
check(rejected(sub { LeanBridge::PerlRefinements::twice(10) }, 'arg0', $ctor) && rejected(sub { LeanBridge::PerlRefinements::twice(4294967295) }, 'arg0', $ctor), 'twice rejects at and far beyond the bound');
for my $bad (-1, 4294967296, 'x', 1.5, undef) {
  check(dies(sub { LeanBridge::PerlRefinements::twice($bad) }) && !rejected(sub { LeanBridge::PerlRefinements::twice($bad) }, 'arg0', $ctor), 'twice word error for ' . (defined $bad ? $bad : 'undef'));
}
# A result-only checked word is the plain base value.
check(LeanBridge::PerlRefinements::wrap32(123) == 3 && LeanBridge::PerlRefinements::wrap32(4294967295) == 5 && LeanBridge::PerlRefinements::wrap32(0) == 0, 'wrap32');
# The checked word after an unchecked String: rejected second, caller data unchanged.
my $label = 'row';
check(LeanBridge::PerlRefinements::tag($label, 9) eq 'row9', 'tag');
check(rejected(sub { LeanBridge::PerlRefinements::tag($label, 10) }, 'arg1', $ctor) && $label eq 'row', 'tag late rejection');
# Nested Fin 0: no present leaf is allowed; absent and empty shapes are valid.
check(LeanBridge::PerlRefinements::count_absent([undef, undef])->bstr eq '2' && LeanBridge::PerlRefinements::count_absent([])->bstr eq '0', 'Array (Option (Fin 0)) with none');
check(bound(sub { LeanBridge::PerlRefinements::count_absent([undef, some(n(0))]) }, 'arg0', '0'), 'Array (Option (Fin 0)) with a present leaf');
check(LeanBridge::PerlRefinements::empty_rows(undef)->bstr eq '7' && LeanBridge::PerlRefinements::empty_rows(some([]))->bstr eq '0', 'Option (Array (Fin 0)) with none and some []');
check(bound(sub { LeanBridge::PerlRefinements::empty_rows(some([n(0)])) }, 'arg0', '0'), 'Option (Array (Fin 0)) with a present leaf');
check(LeanBridge::PerlRefinements::nested_empty([[], []])->bstr eq '2' && LeanBridge::PerlRefinements::nested_empty([])->bstr eq '0', 'nested empty arrays');
my $rows = [[], [n(0)]];
check(bound(sub { LeanBridge::PerlRefinements::nested_empty($rows) }, 'arg0', '0') && $rows->[1][0]->bstr eq '0', 'nested present leaf, caller data unchanged');
check(LeanBridge::PerlRefinements::nested_digits([some(n(1)), undef, some(n(2))])->bstr eq '3', 'nested present digits');
check(bound(sub { LeanBridge::PerlRefinements::nested_digits([some(n(1)), some(n(3))]) }, 'arg0', '3'), 'nested present invalid leaf');
for my $i (0 .. 499) {
  die "invalid word accepted at $i\\n" unless rejected(sub { LeanBridge::PerlRefinements::twice(10 + $i % 7) }, 'arg0', $ctor);
  die "invalid leaf accepted at $i\\n" unless bound(sub { LeanBridge::PerlRefinements::count_absent([some(n($i))]) }, 'arg0', '0');
  die "valid call failed at $i\\n" unless LeanBridge::PerlRefinements::twice($i % 10) == 2 * ($i % 10) && LeanBridge::PerlRefinements::count_absent([undef])->bstr eq '1';
}
$checks += 1500;
print "perl-refinements-ok:$checks\\n";
`;

test("relocated source-free CPAN packages check an unboxed word subtype and nested Fin 0 shapes", { skip: process.env.LEAN_BRIDGE_PERL_REFINEMENT_TEST !== "1", timeout: 2_400_000 }, async t => {
	const environment = nativeFixtureEnvironment(["perl"]);
	const perls = JSON.parse(process.env.LEAN_BRIDGE_PERLS ?? environment.LEAN_BRIDGE_PERLS);
	environment.LEAN_BRIDGE_PERLS = JSON.stringify(perls);
	const reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-perl-refinements-author-"));
		const consumerRoot = await mkdtemp(join(tmpdir(), "lean-bridge-perl-refinements-consumer-"));
		t.after(() => Promise.all([author, consumerRoot].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumerRoot, "handoff");
		await cp("tests/fixtures/onboarding/perl-refinements", projectRoot, { recursive: true });
		const targets = { cpan: { module: "LeanBridge::PerlRefinements", version: "1.000" } };
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["PerlRefinements"], exports: names, contracts: perlRefinementContracts, targets }));
		t.diagnostic(`build ${attempt}: compiling XS for ${perls.length} Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), perlRefinementRefinements);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		// The archived XS passes the word by value to its validator and walks every nested shape.
		const archive = receipt.packages.find(pkg => pkg.target === "cpan" && pkg.role === "component").artifacts[0].path;
		const xs = (await runCopied("/usr/bin/tar", ["-xOzf", join(handoff, archive), "--wildcards", "*/Component.xs"], consumerRoot, copiedCleanEnvironment)).stdout;
		assert.equal((xs.match(/was rejected by PerlRefinements\.checkedDigit32"/g) ?? []).length, 2);
		assert.doesNotMatch(xs.slice(xs.indexOf("\ntwice(...)"), xs.indexOf("XSRETURN(1);", xs.indexOf("\ntwice(...)"))), /lean_inc\(a0\)/);
		assert.equal((xs.match(/lean_cstr_to_nat\("0"\)/g) ?? []).length, 3);
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const [index, perl] of perls.entries())
		{
			t.diagnostic(`offline prebuilt installation on ${perl}`);
			const root = join(consumerRoot, `abi-${index}`);
			const selected = { ...environment, LEAN_BRIDGE_CORPUS_PERL: perl };
			const { command, ...observation } = await installCopiedConsumer({ profile: "perl", consumer: root, handoff, packages: receipt.packages, environment: selected, fixture: { source: consumer, success: "perl-refinements-ok" } });
			const installed = join(root, "perl"), library = join(installed, "installed/lib/perl5");
			const repeated = await runCopied(command, ["consumer.pl"], installed, { ...copiedCleanEnvironment, PERL5LIB: library });
			assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `perl-refinements-ok:${observation.checks}`);
			const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
			reports.push({ profile: "perl", perl, path: "ordinary-source"
				, ...observation
				, packages: receipt.packages
				, refinements: perlRefinementRefinements
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256
				, sourceRemovedBeforeInstallation: true, repeatExecution: true });
		}
		await rm(consumerRoot, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/perl-refinements", "perl.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
