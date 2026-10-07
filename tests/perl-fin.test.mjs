/**
 * Checked top-level Fin sites in generated XS and installed CPAN packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generatePerlBindingPackage } from "../src/backends/perl/generate.mjs";
import { createNativeModel, nativeTypeKey } from "../src/build/native-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi: { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true } };
const fin = bound => ({ kind: "fin", bound });

/** Public API cases: exact bounds, error messages, cleanup and recovery. */
const perlFinConsumer = () => `use strict;
use warnings;
use Math::BigInt;
use LeanBridge::NativeFin;
my $checks = 0;
sub check { die "failed: $_[1]\\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub rejected {
  my ($call, $parameter, $bound) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$parameter is not below its Fin $bound bound") == 0;
}
sub dies { my ($call) = @_; my $passed = eval { $call->(); 1 }; return !$passed; }
my $huge = Math::BigInt->new(2)->bpow(70); my $word = Math::BigInt->new(2)->bpow(32);
check(rejected(sub { LeanBridge::NativeFin::impossible(n(0)) }, 'arg0', '0'), 'Fin 0 rejects zero');
check(rejected(sub { LeanBridge::NativeFin::impossible(n(1)) }, 'arg0', '0'), 'Fin 0 rejects one');
check(LeanBridge::NativeFin::only(n(0))->bstr eq '7', 'Fin 1 accepts zero');
check(rejected(sub { LeanBridge::NativeFin::only(n(1)) }, 'arg0', '1'), 'Fin 1 rejects its bound');
check(LeanBridge::NativeFin::mirror(n(0))->bstr eq '9' && LeanBridge::NativeFin::mirror(n(9))->bstr eq '0', 'Fin 10 endpoints');
check(ref(LeanBridge::NativeFin::mirror(n(4))) && LeanBridge::NativeFin::mirror(n(4))->isa('Math::BigInt'), 'exact Math::BigInt results');
for my $value (n(10), n(11), $word->copy, $huge->copy) {
  check(rejected(sub { LeanBridge::NativeFin::mirror($value) }, 'arg0', '10'), "Fin 10 rejects $value");
}
check(dies(sub { LeanBridge::NativeFin::mirror(n(-1)) }) && !rejected(sub { LeanBridge::NativeFin::mirror(n(-1)) }, 'arg0', '10'), 'negative is the Nat error');
check(dies(sub { LeanBridge::NativeFin::mirror(3) }) && dies(sub { LeanBridge::NativeFin::mirror('3') }), 'non-BigInt is rejected');
check(LeanBridge::NativeFin::twice(n(299))->bstr eq '598', 'alias accepts its largest value');
check(rejected(sub { LeanBridge::NativeFin::twice(n(300)) }, 'arg0', '300'), 'alias rejects its bound');
check(rejected(sub { LeanBridge::NativeFin::twice(n(301)) }, 'arg0', '300'), 'alias rejects beyond its bound');
check(LeanBridge::NativeFin::succ_huge($word)->bstr eq $word->copy->badd(1)->bstr, 'large Fin crosses a limb');
my $last = $huge->copy->bsub(1);
check(LeanBridge::NativeFin::succ_huge($huge->copy->bsub(2))->bstr eq $last->bstr && LeanBridge::NativeFin::succ_huge($last)->bstr eq $last->bstr, 'large Fin endpoints');
for my $value ($huge->copy, $huge->copy->badd(1), Math::BigInt->new(2)->bpow(128)) {
  check(rejected(sub { LeanBridge::NativeFin::succ_huge($value) }, 'arg0', $huge->bstr), "large Fin rejects $value");
}
check(LeanBridge::NativeFin::wrap(n(100))->bstr eq '2' && LeanBridge::NativeFin::wrap($huge)->bstr eq '2' && LeanBridge::NativeFin::wrap(n(0))->bstr eq '0', 'result-only Fin values');
my $base = n(5); my $name = 'slot';
check(LeanBridge::NativeFin::label($base, n(3), $name) eq 'slot:8', 'mixed arguments');
check(rejected(sub { LeanBridge::NativeFin::label($base, n(4), $name) }, 'arg1', '4'), 'mixed arguments reject the Fin site');
check($base->bstr eq '5' && $name eq 'slot' && LeanBridge::NativeFin::label($base, n(0), $name) eq 'slot:5', 'caller data unchanged');
for my $i (0 .. 999) {
  die "invalid call accepted at $i\\n" unless rejected(sub { LeanBridge::NativeFin::mirror(n(10 + $i)) }, 'arg0', '10');
  die "valid call failed at $i\\n" unless LeanBridge::NativeFin::mirror(n($i % 10))->bstr eq (9 - $i % 10);
}
$checks += 2000;
print "perl-fin-ok:$checks\\n";
`;

/** Count Lean source dispatch in the Perl process; counts are written at exit. */
const perlFinInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
static unsigned long counts[3];
#define FORWARD(symbol) static void *(*next)(); if (!next) { *(void **)&next = dlsym(RTLD_NEXT, #symbol); if (!next) abort(); }
void *l_NativeFin_mirror(void *a0) { FORWARD(l_NativeFin_mirror) ++counts[0]; return next(a0); }
void *l_NativeFin_impossible(void *a0) { FORWARD(l_NativeFin_impossible) ++counts[1]; return next(a0); }
void *l_NativeFin_label(void *a0, void *a1, void *a2) { FORWARD(l_NativeFin_label) ++counts[2]; return next(a0, a1, a2); }
__attribute__((destructor)) static void report(void) {
  const char *path = getenv("NATIVE_FIN_COUNTS");
  FILE *file = path ? fopen(path, "w") : NULL;
  if (!file) return;
  fprintf(file, "%lu %lu %lu\\n", counts[0], counts[1], counts[2]);
  fclose(file);
}
`;
const prelude = "use strict; use warnings; use Math::BigInt; use LeanBridge::NativeFin; sub n { Math::BigInt->new($_[0]) } ";
// Columns: source mirror, source impossible, source label.
const dispatchColumns = ["l_NativeFin_mirror", "l_NativeFin_impossible", "l_NativeFin_label"];
const dispatchSteps = [
	["valid-mirror", "LeanBridge::NativeFin::mirror(n(3));", [1, 0, 0]]
	, ["invalid-only", "eval { LeanBridge::NativeFin::mirror(n(10)) }; eval { LeanBridge::NativeFin::impossible(n(0)) }; eval { LeanBridge::NativeFin::label(n(5), n(4), 'slot') }; eval { LeanBridge::NativeFin::mirror(n(-1)) };", [0, 0, 0]]
	, ["valid-label", "LeanBridge::NativeFin::label(n(5), n(3), 'slot');", [0, 0, 1]]
	, ["invalid-then-valid", "eval { LeanBridge::NativeFin::mirror(n(10)) }; LeanBridge::NativeFin::mirror(n(9));", [1, 0, 0]]
];

test("CPAN packages are checked Fin consumers with every other native projection", () => {
	for(const targets of [["cpan"], ["c", "cpan"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native", "wit-wasi", "cpan"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
});

test("generated XS checks each exact bound before dispatch and unwraps the checked adapter result", () => {
	const base = createNativeModel({ component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" }, moduleName: "LeanBridge::Sample", ...nativeMetadataFixture() });
	const item = (name, parameters, result, refinements) => ({
		...base.exports[0]
		, name: `Sample.${name}`, publicName: name, symbol: `lb_${name}`
		, parameters: parameters.map(([parameter, type]) => ({ name: parameter, type }))
		, result
		, ...(refinements ? { refinements } : {})
	});
	const model = { ...base
		, types: [nat, text].map(type => ({ ...type, key: nativeTypeKey(type) }))
		, exports: [
			item("mirror", [["value", nat]], nat, { parameters: [fin(huge)], result: fin(huge) })
			, item("label", [["base", nat], ["offset", nat], ["name", text]], text, { parameters: [null, fin("4"), null], result: null })
			, item("wrap", [["value", nat]], nat, { parameters: [null], result: fin("7") })
			, item("plain", [["value", nat]], nat)] };
	const receipt = { library: "libcomponent_test.so", nativeLibrary: { sha256: "b".repeat(64) }, runtimeIdentity: "c".repeat(64), initializer: "initialize_Sample" };
	const files = generatePerlBindingPackage(model, receipt);
	const xs = files["Component.xs"], section = name => xs.slice(xs.indexOf(`\n${name}(...)`), xs.indexOf("XSRETURN(1);", xs.indexOf(`\n${name}(...)`)));
	// The bound is compared on the scope-owned argument before any retain or Lean call.
	const mirror = section("mirror");
	assert.match(mirror, new RegExp(`lean_cstr_to_nat\\("${huge}"\\); int below = lean_nat_lt\\(a0, bound\\); lean_dec\\(bound\\);\\s+if \\(!below\\) croak\\("%s", "arg0 is not below its Fin ${huge} bound"\\);`));
	assert.ok(mirror.indexOf("lean_nat_lt(a0, bound)") < mirror.indexOf("lean_inc(a0)"));
	assert.ok(mirror.indexOf("lean_inc(a0)") < mirror.indexOf("lean_object *checked = lb_mirror(a0);"));
	assert.match(mirror, /if \(lean_is_scalar\(checked\)\) croak\("Lean rejected an argument outside its Fin bound"\);\s+lean_object \*boxed = lean_ctor_get\(checked, 0\);\s+lean_inc\(boxed\);\s+lean_object \* result = boxed;\s+lean_dec\(checked\);/);
	const label = section("label");
	assert.match(label, /lean_cstr_to_nat\("4"\); int below = lean_nat_lt\(a1, bound\);/);
	assert.match(label, /"arg1 is not below its Fin 4 bound"/);
	assert.doesNotMatch(label, /lean_nat_lt\(a0|lean_nat_lt\(a2/);
	// Result-only and unrefined exports keep the direct call.
	for(const name of ["wrap", "plain"])
	{
		assert.doesNotMatch(section(name), /lean_nat_lt|checked|boxed/, name);
		assert.match(section(name), new RegExp(`lean_object \\* result = lb_${name}\\(a0\\);`), name);
		// No guard line, not even an empty one: unrefined XS stays byte-identical.
		assert.match(section(name), /LBP_ENTER\(\);\n {4}lean_object \* a0 = \w+\(aTHX_ scope, ST\(0\)\);\n {4}lean_inc\(a0\);\n {4}lean_object \* result = /, name);
	}
	const pod = files["lib/LeanBridge/Sample.pm"];
	assert.match(pod, new RegExp(`=head2 mirror\\n\\nCalls C<Sample\\.mirror> in the compiled Lean component\\.\\n\\nChecked Lean Fin bounds: arg0 < ${huge}; result < ${huge}\\.\\n`));
	assert.match(pod, /=head2 label\n\n[^\n]+\n\nChecked Lean Fin bounds: arg1 < 4\.\n/);
	assert.match(pod, /=head2 wrap\n\n[^\n]+\n\nChecked Lean Fin bounds: result < 7\.\n/);
	assert.doesNotMatch(pod, /=head2 plain\n\n[^\n]+\n\nChecked/);
	assert.match(pod, /=head1 BOUNDED INTEGERS/);
	// Packages without refined exports are unchanged.
	const plain = generatePerlBindingPackage(base, receipt);
	assert.doesNotMatch(plain["Component.xs"], /lean_nat_lt|Fin/);
	assert.doesNotMatch(plain["lib/LeanBridge/Sample.pm"], /BOUNDED INTEGERS|Fin/);
});

test("relocated source-free CPAN packages check Fin bounds before Lean dispatch on every selected ABI", { skip: process.env.LEAN_BRIDGE_PERL_FIN_TEST !== "1", timeout: 2_400_000 }, async t => {
	const environment = nativeFixtureEnvironment(["perl"]);
	const perls = JSON.parse(process.env.LEAN_BRIDGE_PERLS ?? environment.LEAN_BRIDGE_PERLS);
	environment.LEAN_BRIDGE_PERLS = JSON.stringify(perls);
	const reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-perl-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-perl-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { cpan: { module: "LeanBridge::NativeFin", version: "1.000" } } }));
		t.diagnostic(`build ${attempt}: compiling XS for ${perls.length} Perl ABIs`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["cpan"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const [index, perl] of perls.entries())
		{
			t.diagnostic(`offline prebuilt installation on ${perl}`);
			const root = join(consumer, `abi-${index}`);
			const fixture = { source: perlFinConsumer, success: "perl-fin-ok" };
			const selected = { ...environment, LEAN_BRIDGE_CORPUS_PERL: perl };
			const { command, ...observation } = await installCopiedConsumer({ profile: "perl", consumer: root, handoff, packages: receipt.packages, environment: selected, fixture });
			const installed = join(root, "perl"), library = join(installed, "installed/lib/perl5");
			await saveLakeFile(installed, "interposer.c", perlFinInterposer());
			await runCopied("/usr/bin/cc", ["-std=gnu11", "-Wall", "-Wextra", "-Werror", "-Wno-strict-prototypes", "-shared", "-fPIC", "interposer.c", "-o", "libdispatch.so"], installed
				, { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" });
			// Valid calls are the positive control; rejected calls must not reach any Lean source function.
			const dispatch = [];
			for(const [step, code, expected] of dispatchSteps)
			{
				const counts = join(installed, `counts-${step}.txt`);
				const run = await runCopied(command, ["-e", prelude + code], installed
					, { ...copiedCleanEnvironment, PERL5LIB: library, LD_PRELOAD: join(installed, "libdispatch.so"), NATIVE_FIN_COUNTS: counts });
				assert.equal(run.stderr, "", step);
				const observed = (await readFile(counts, "utf8")).trim().split(" ").map(Number);
				assert.deepEqual(observed, expected, step);
				dispatch.push([step, observed]);
			}
			const repeated = await runCopied(command, ["consumer.pl"], installed, { ...copiedCleanEnvironment, PERL5LIB: library });
			assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `perl-fin-ok:${observation.checks}`);
			reports.push({ profile: "perl", perl, path: "ordinary-source"
				, ...observation
				, dispatch: {
					columns: dispatchColumns, observed: dispatch
					, interposer: "LD_PRELOAD"
					, positiveControl: "valid public calls increment their source count"
				}
				, packages: receipt.packages
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true, repeatExecution: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	// Two clean authoring roots must produce byte-identical CPAN archives.
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", "perl.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
