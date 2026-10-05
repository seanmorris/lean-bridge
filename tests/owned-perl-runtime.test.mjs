/**
 * Compile Perl XS leases against fresh ordinary and reviewed Lean ownership.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { ownedPerlRuntime } from "../src/backends/perl/owned-runtime.mjs";
import { generateOwnedPerlValues } from "../src/backends/perl/owned-values.mjs";
import { generateOwnedPerlConversions } from "../src/backends/perl/owned-conversions.mjs";
import { generateOwnedPerlXs } from "../src/backends/perl/owned-xs.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedHostCallbackReviewedIr } from "./helpers/owned-host-callback-fixture.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { perlGraphCommands } from "./helpers/perl-graph-probes.mjs";
import { ownedPerlConversionProbe } from "./helpers/owned-perl-conversion-probe.mjs";
import { ownedPerlProbeInstrumentation as instrumentation } from "./helpers/owned-perl-native.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("Perl ownership support rejects injected component prefixes", () => {
	for(const name of ["Bad", "a__b", "a;\n#error injected", "", undefined, null, true, {}])
		assert.throws(() => ownedPerlRuntime(name));
});

for(const complete of [false, true])
for(const reviewed of [false, true]) test(`Perl leases clean real Lean results on all selected ABIs (${reviewed ? "reviewed" : "ordinary"}${complete ? ", complete signatures" : ""})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const reportName = `${complete ? "complete-" : ""}${reviewed ? "reviewed" : "ordinary"}`;
	const compiled = await compileOwnedAggregateFixture(t, { fixture: complete ? "owned-dotnet-callables" : "owned-host-callbacks"
		, hostCallbacks: true
		, ...(reviewed ? { reviewedIr: complete ? ownedDotnetCallbacksReviewedIr() : ownedHostCallbackReviewedIr() } : {}) });
	const generated = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const p = generated.values.prefix, values = generateOwnedPerlValues(generated.layout.model.bindingIr, "LeanBridge::OwnedProbe");
	const ticket = values.types.find(node => node.name === "Ticket");
	assert.ok(ticket?.identity);
	const native = `#include <stdlib.h>
#include <stdio.h>
#include <stddef.h>
#include <unistd.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${generated.source}
size_t owned_test_live(void) { return live; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
uint32_t owned_test_new(${p}_session *session, uint64_t serial, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL; ${p}_scalar_string_t label = {"perl", 4};
  mpz_t number; mpz_init_set_ui(number, serial);
  ${p}_status status = ${p}_new_ticket(session, number, label, &value, owner);
  mpz_clear(number); if (!status) *out = value; return (uint32_t)status;
}
uint32_t owned_test_retain(${p}_session *session, void *input, void **out, ${p}_result **owner) {
  ${p}_ticket_t value = NULL;
  ${p}_status status = ${p}_ticket_t_retain(session, input, &value, owner);
  if (!status) *out = value;
  return (uint32_t)status;
}
uint32_t owned_test_serial(${p}_session *session, void *input, uint64_t *out, ${p}_result **owner) {
  mpz_srcptr value = NULL; ${p}_status status = ${p}_serial(session, input, &value, owner);
  if (!status) {
    if (mpz_sgn(value) < 0 || !mpz_fits_ulong_p(value)) return ${p.toUpperCase()}_MALFORMED_RESULT;
    *out = mpz_get_ui(value);
  }
  return (uint32_t)status;
}
__attribute__((destructor)) static void owned_test_final(void) {
  if (live || owned_test_identities()) {
    fprintf(stderr, "unreleased native ownership: %zu allocations, %zu identities\\n", live, owned_test_identities());
    _exit(88);
  }
}
_Static_assert(sizeof(unsigned long) == sizeof(uint64_t), "Probe targets Linux x86-64");
${["OK", "INVALID_ARGUMENT", "LIMIT", "ALLOCATION_FAILED", "CLOSED", "WRONG_THREAD", "WRONG_PROCESS", "RUNTIME_UNAVAILABLE", "CALL_ORDER", "MALFORMED_RESULT", "CALLBACK_FAILED"].map((name, value) => `_Static_assert(${p.toUpperCase()}_${name} == ${value}, "Perl status ABI");`).join("\n")}
`;
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? native : source);
	const environment = { PATH: "/usr/bin:/bin" };
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall"
		, "-Wextra", "-Werror", "-fPIC", "-shared"
		, "-I", join(compiled.directory, "runtime/include"), "public-api.c"
		, "Owned.o", "Carriers.o", "Witness.o", "Callbacks.o"
		, "-L", join(compiled.directory, "runtime/lib")
		, "-llean_bridge_native", "-lleanshared", "-lgmp"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-o", "libowned-perl.so"], compiled.directory, environment);
	const runtime = ownedPerlRuntime(p), xsTemplate = await readFile("tests/fixtures/structured-types/owned-perl-runtime.xs", "utf8");
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-runtime.pl", "utf8");
	const xs = xsTemplate.replaceAll("@PREFIX@", p).replaceAll("@TICKET_TYPE@", String(ticket.index));
	await saveLakeFile(compiled.directory, "runtime.h", runtime);
	await saveLakeFile(compiled.directory, "instrumentation.h", instrumentation);
	await saveLakeFile(compiled.directory, "native-probe.h", `size_t owned_test_live(void);
size_t owned_test_identities(void);
void owned_test_fail_after(ptrdiff_t);
uint32_t owned_test_new(${p}_session *, uint64_t, void **, ${p}_result **);
uint32_t owned_test_retain(${p}_session *, void *, void **, ${p}_result **);
uint32_t owned_test_serial(${p}_session *, void *, uint64_t *, ${p}_result **);
`);
	await saveLakeFile(compiled.directory, "Probe.xs", xs);
	await saveLakeFile(compiled.directory, "consumer.pl", probe);
	await saveLakeFile(compiled.directory, "LeanBridge/OwnedProbe.pm", `${values.source}
package LeanBridge::OwnedProbe;
require DynaLoader; our @ISA = ('DynaLoader'); our $VERSION = '0.001';
__PACKAGE__->bootstrap($VERSION); 1;
`);
	await saveLakeFile(compiled.directory, "build.pl", `use strict; use warnings;
use ExtUtils::ParseXS; use ExtUtils::CBuilder; use File::Path qw(make_path); use Cwd qw(getcwd);
ExtUtils::ParseXS::process_file(filename => 'Probe.xs', output => 'Probe.c', prototypes => 0);
my $builder = ExtUtils::CBuilder->new(quiet => 1);
my $object = $builder->compile(source => 'Probe.c', include_dirs => ['.'],
  extra_compiler_flags => '-std=gnu11 -O1 -g0 -Wall -Wextra -Werror -Wno-unused-function');
make_path('auto/LeanBridge/OwnedProbe');
$builder->link(objects => [$object], module_name => 'LeanBridge::OwnedProbe',
  lib_file => 'auto/LeanBridge/OwnedProbe/OwnedProbe.so',
  extra_linker_flags => '-L. -lowned-perl -Wl,-rpath,' . getcwd() . ' -pthread -lgmp');
`);
	const observations = [];
	for(const perl of perlGraphCommands())
	{
		await runCopied(perl, ["build.pl"], compiled.directory, { ...environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		const modes = [];
		for(const mode of ["main", "shutdown", "reentrant-shutdown", "serialization", "exit"])
		{
			const result = await runCopied(perl, ["-I.", "consumer.pl", mode], compiled.directory, environment);
			assert.equal(result.stderr, "");
			const observed = JSON.parse(result.stdout); modes.push(observed);
			if(mode === "main")
			{
				assert.ok(observed.checks > 100); assert.ok(observed.perlFailures > 0);
				assert.ok(observed.nativeFailures > 0); assert.ok(observed.exceptions > 0);
				assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
				t.diagnostic(JSON.stringify(observed));
			}
		}
		observations.push({ perl, modes });
	}
	await saveLakeFile(resolve("build/owned-perl-runtime"), reportName + ".json", canonicalJson({
		observations, compiledLean: true
		, installedPackage: false, nativeHostCallbacks: false
		, sourceIdentitySha256: sha256(canonicalJson(compiled.sourceIdentity))
		, runtimeSha256: sha256(runtime), xsSha256: sha256(xs)
		, probeSha256: sha256(probe)
	}));
	const conversions = generateOwnedPerlConversions(generated.layout.model.bindingIr, "LeanBridge::OwnedProbe");
	const conversionXs = xs + ownedPerlConversionProbe(conversions);
	const conversionConsumer = await readFile("tests/fixtures/structured-types/owned-perl-conversions.pl", "utf8");
	await saveLakeFile(compiled.directory, "runtime.h", conversions.source);
	await saveLakeFile(compiled.directory, "Probe.xs", conversionXs);
	await saveLakeFile(compiled.directory, "conversions.pl", conversionConsumer);
	const converted = [];
	for(const perl of perlGraphCommands())
	{
		await runCopied(perl, ["build.pl"], compiled.directory, { ...environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		const result = await runCopied(perl, ["-I.", "conversions.pl"], compiled.directory, environment);
		assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		assert.ok(observed.checks > 100); assert.ok(observed.allocatorFailures > 0);
		assert.ok(observed.exceptions > 0); assert.ok(observed.nativeFailures > 0);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		t.diagnostic("conversions " + JSON.stringify(observed)); converted.push({ perl, observed });
	}
	await saveLakeFile(resolve("build/owned-perl-conversions"), reportName + ".json", canonicalJson({
		observations: converted, compiledLean: true, installedPackage: false
		, nativeHostCallbacks: false
		, sourceIdentitySha256: sha256(canonicalJson(compiled.sourceIdentity))
		, convertersSha256: sha256(conversions.source)
		, xsSha256: sha256(conversionXs), probeSha256: sha256(conversionConsumer)
	}));
	const calls = generateOwnedPerlXs(generated.layout.model.bindingIr, "LeanBridge::OwnedProbe");
	const callConsumer = await readFile("tests/fixtures/structured-types/owned-perl-calls.pl", "utf8");
	// Keep instrumentation in the probe namespace; all algorithm calls use the
	// public generated methods, without the earlier private conversion helpers.
	const callXs = `#include "instrumentation.h"
#include "${p}.h"
#include "native-probe.h"
${calls.declarations}
${calls.xs}
MODULE = LeanBridge::OwnedProbe PACKAGE = LeanBridge::OwnedProbe
${xs.slice(xs.indexOf("\nvoid\nreset("))}
`;
	await saveLakeFile(compiled.directory, "Probe.xs", callXs);
	await saveLakeFile(compiled.directory, "calls.pl", callConsumer);
	const signatureConsumer = complete ? await readFile("tests/fixtures/structured-types/owned-perl-signatures.pl", "utf8") : null;
	if(complete) await saveLakeFile(compiled.directory, "signatures.pl", signatureConsumer);
	await saveLakeFile(compiled.directory, "LeanBridge/OwnedProbe.pm", `${calls.valuesSource}
package LeanBridge::OwnedProbe;
require DynaLoader; our @ISA = ('DynaLoader'); our $VERSION = '0.001';
__PACKAGE__->bootstrap($VERSION); 1;
`);
	const called = [], signatures = [];
	for(const perl of perlGraphCommands())
	{
		await runCopied(perl, ["build.pl"], compiled.directory, { ...environment, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
		const result = await runCopied(perl, ["-I.", "calls.pl"], compiled.directory, environment);
		assert.equal(result.stderr, "");
		const observed = JSON.parse(result.stdout);
		assert.ok(observed.checks > 50); assert.ok(observed.allocatorFailures > 0);
		assert.ok(observed.exceptions > 0); assert.ok(observed.nativeFailures > 0);
		assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
		t.diagnostic("public calls " + JSON.stringify(observed)); called.push({ perl, observed });
		if(complete)
		{
			const execution = await runCopied(perl, ["-I.", "signatures.pl"], compiled.directory, environment);
			assert.equal(execution.stderr, "");
			const signature = JSON.parse(execution.stdout);
			assert.deepEqual(signature.exports, calls.functions.map(fn => fn.publicName).sort());
			assert.equal(signature.primitives, 19);
			assert.ok(signature.checks > 100);
			assert.equal(signature.live, 0); assert.equal(signature.identities, 0);
			t.diagnostic("complete signatures " + JSON.stringify(signature));
			signatures.push({ perl, observed: signature });
		}
	}
	await saveLakeFile(resolve("build/owned-perl-calls"), reportName + ".json", canonicalJson({
		observations: called, compiledLean: true
		, installedPackage: false, nativeHostCallbacks: true
		, sourceIdentitySha256: sha256(canonicalJson(compiled.sourceIdentity))
		, declarationsSha256: sha256(calls.declarations), xsSha256: sha256(callXs)
		, valuesSha256: sha256(calls.valuesSource), probeSha256: sha256(callConsumer)
		, ...(complete ? { signatures, signatureConsumerSha256: sha256(signatureConsumer) } : {})
	}));
});
