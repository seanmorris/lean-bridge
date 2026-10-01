/**
 * Instrument fresh native Lean components and generated public Perl XS APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPerlXs } from "../../src/backends/perl/owned-xs.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

export const ownedPerlProbeInstrumentation = `#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <stdlib.h>
#include <assert.h>
#include <unistd.h>
static size_t probe_live, probe_attempts, probe_fail, probe_points, probe_die;
static void *probe_malloc(size_t size) {
  if (++probe_attempts == probe_fail) return NULL;
  void *value = malloc(size); if (value) ++probe_live; return value;
}
static void probe_free(void *value) {
  if (!value) return;
  assert(probe_live); --probe_live; free(value);
}
static void probe_checkpoint(pTHX) {
  if (++probe_points == probe_die) croak("injected Perl ownership exception");
}
__attribute__((destructor)) static void probe_final(void) {
  if (probe_live) { fprintf(stderr, "unreleased Perl ownership allocations: %zu\\n", probe_live); _exit(87); }
}
#define LB_PERL_GRAPH_MALLOC probe_malloc
#define LB_PERL_GRAPH_FREE probe_free
#define LB_PERL_OWNED_MALLOC probe_malloc
#define LB_PERL_OWNED_FREE probe_free
#define LB_PERL_GRAPH_CHECKPOINT() probe_checkpoint(aTHX)
`;

/**
 * Prepare a public XS API; allocation counters remain private probe entrypoints.
 *
 * @param t - Test context that owns native scratch cleanup.
 * @param options - Authored fixture name and optional independent reviewed IR.
 */
export const prepareOwnedPerlNative = async (t, options) => {
	const compiled = await compileOwnedAggregateFixture(t, { ...options, hostCallbacks: true });
	const transferredInputs = Boolean(options.transferredInputs);
	const anchoredResults = Boolean(options.anchoredResults);
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true
		, transferredInputs, anchoredResults });
	const model = generateOwnedPerlXs(c.layout.model.bindingIr, "LeanBridge::OwnedProbe", { transferredInputs, anchoredResults });
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	if(transferredInputs) assert.equal(c.source.split(handoff).length, 2);
	const native = `#include <stdlib.h>
#include <stdio.h>
#include <stddef.h>
#include <unistd.h>
static size_t live = 0; static ptrdiff_t fail_after = -1;${transferredInputs ? "\nstatic size_t handoffs = 0;" : ""}
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${transferredInputs ? c.source.replace(handoff, handoff + "\n  ++handoffs;") : c.source}
size_t owned_test_live(void) { return live; }${transferredInputs ? "\nsize_t owned_test_handoffs(void) { return handoffs; }" : ""}
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
__attribute__((destructor)) static void owned_test_final(void) {
  if (live || owned_test_identities()) {
    fprintf(stderr, "unreleased native ownership: %zu allocations, %zu identities\\n", live, owned_test_identities());
    _exit(88);
  }
}
`;
	for(const [path, source] of Object.entries(c.files))
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
	const template = await readFile("tests/fixtures/structured-types/owned-perl-runtime.xs", "utf8");
	const index = template.indexOf("\nvoid\nreset("); assert.ok(index > 0);
	const xs = `#include "instrumentation.h"
#include "${c.values.prefix}.h"
size_t owned_test_live(void);
size_t owned_test_identities(void);
void owned_test_fail_after(ptrdiff_t);
${transferredInputs ? "size_t owned_test_handoffs(void);\n" : ""}\
${model.declarations}
${model.xs}
MODULE = LeanBridge::OwnedProbe PACKAGE = LeanBridge::OwnedProbe
${template.slice(index)}
${transferredInputs ? `\nUV\nhandoffs()\n  CODE:\n    RETVAL = owned_test_handoffs();\n  OUTPUT:\n    RETVAL\n` : ""}\
`;
	await saveLakeFile(compiled.directory, "instrumentation.h", ownedPerlProbeInstrumentation);
	await saveLakeFile(compiled.directory, "Probe.xs", xs);
	await saveLakeFile(compiled.directory, "LeanBridge/OwnedProbe.pm", `${model.valuesSource}
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
	return { ...compiled, c, model, native, xs, environment };
};
