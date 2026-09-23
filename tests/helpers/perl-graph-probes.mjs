/**
 * Isolated XS graph fixtures, allocation ledgers and pinned ABI compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";

/** Recursive record links test boxed Option and Except members. */
export const perlConversionIr = () => {
	const ir = nativeRecursiveReviewedIr(), record = ir.types.find(type => type.name === "Scalars");
	for(const [name, constructor] of [["Link", "option"], ["ResultLink", "result"]])
	{
		const root = { kind: "named", id: `lean:Recursive.${name}` };
		const tail = { kind: "apply", constructor
			, arguments: [root, ...constructor === "result" ? [{ kind: "primitive", name: "string" }] : []] };
		ir.types.push({ ...record, id: root.id, name
			, fields: [{ ...record.fields[0], name: "tail", type: tail }] });
		const template = ir.declarations[0];
		ir.declarations.push({ ...structuredClone(template)
			, id: `lean:Recursive.echo${name}`
			, name: `echo${name}`, overloadKey: `echo${name}`
			, source: { ...template.source, declaration: `Recursive.echo${name}` }
			, parameters: [{ ...template.parameters[0], type: root }]
			, result: { ...template.result, type: root } });
	}
	return ir;
};

/** Select all four local ABIs or the explicit CI matrix interpreter. */
export const perlGraphCommands = () => {
	const perls = process.env.LEAN_BRIDGE_PERLS ? JSON.parse(process.env.LEAN_BRIDGE_PERLS)
		: process.env.LEAN_BRIDGE_CORPUS_PERL ? [process.env.LEAN_BRIDGE_CORPUS_PERL]
			: ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"].map(abi => `.toolchains/perl/${abi}/bin/perl`);
	assert.ok(Array.isArray(perls) && perls.length && perls.every(perl => typeof perl === "string" && perl.length));
	return perls.map(perl => resolve(perl));
};

export const perlGraphInstrumentation = `#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <stdlib.h>
#include <assert.h>
#include <unistd.h>
#include <signal.h>
static size_t probe_live, probe_attempts, probe_fail, probe_points, probe_die, probe_signal;
static size_t probe_owned, probe_clears, probe_retired, probe_bad;
static void *probe_malloc(size_t size) {
  if (++probe_attempts == probe_fail) return NULL;
  void *value = malloc(size); if (value) ++probe_live; return value;
}
static void probe_free(void *value) { assert(value && probe_live); --probe_live; free(value); }
static void probe_checkpoint(pTHX) {
  if (++probe_points != probe_die) return;
  if (probe_signal) { kill(getpid(), SIGUSR1); PERL_ASYNC_CHECK(); croak("Perl signal did not interrupt conversion"); }
  croak("injected Perl graph exception");
}
static void probe_release(void *value) { assert(value && probe_owned); --probe_owned; ++probe_clears; free(value); }
static void probe_retire(void) { ++probe_retired; }
#define LB_PERL_GRAPH_MALLOC probe_malloc
#define LB_PERL_GRAPH_FREE probe_free
#define LB_PERL_GRAPH_CHECKPOINT() probe_checkpoint(aTHX)
`;

export const perlGraphProbeXs = `
MODULE = LeanBridge::Recursive PACKAGE = LeanBridge::Recursive::Probe
PROTOTYPES: DISABLE

void
reset(fail=0, exception=0, bad=0, signal=0)
    unsigned int fail
    unsigned int exception
    unsigned int bad
    unsigned int signal
  PPCODE:
    if (probe_live || probe_owned) croak("unreleased graph memory");
    probe_attempts = probe_points = probe_clears = probe_retired = 0;
    probe_fail = fail; probe_die = exception; probe_bad = bad; probe_signal = signal;

void
snapshot()
  PPCODE:
    EXTEND(SP, 6);
    PUSHs(sv_2mortal(newSVuv(probe_live))); PUSHs(sv_2mortal(newSVuv(probe_owned)));
    PUSHs(sv_2mortal(newSVuv(probe_attempts))); PUSHs(sv_2mortal(newSVuv(probe_points)));
    PUSHs(sv_2mortal(newSVuv(probe_clears))); PUSHs(sv_2mortal(newSVuv(probe_retired)));
`;

const corrupt = node => {
	if(node.kind === "variant") return "output->kind = UINT32_MAX;";
	if(node.kind === "option") return "output->has_value = 2;";
	if(node.kind === "result") return "output->is_ok = 2;";
	if(node.element || ["string", "bytes", "nat", "int"].includes(node.ref.name)) return `
  if (probe_bad == 1) { output->data = NULL; output->length = 1; }
  if (probe_bad == 2) { output->data = (const void *)(uintptr_t)(UINTPTR_MAX - 1); output->length = 4; }
  if (probe_bad == 3) { output->length = SIZE_MAX; }
  ${["nat", "int"].includes(node.ref.name) || node.element ? "if (probe_bad == 4) { output->data = (const void *)(uintptr_t)1; output->length = 1; }" : ""}
  ${node.ref.name === "string" ? 'if (probe_bad == 5) { output->data = "\\xc0\\x80"; output->length = 2; }' : ""}
  ${node.ref.name === "int" ? "if (probe_bad == 6) memset(&output->negative, 2, 1);" : ""}`;
	if(node.ref.name === "bool") return "memset(output, 2, 1);";
	if(node.ref.name === "unit") return "*output = 1;";
	if(node.ref.name === "char") return "*output = 0xd800;";
	return "";
};

/**
 * Copy raw C values without Lean, and corrupt only readable, controlled storage.
 *
 * @param model - Generated converters and checked layout.
 */
export const perlGraphIsolatedXs = model => {
	const functions = model.types.map(node => `static SV *probe_echo${node.index}(pTHX_ lpg_scope *scope, SV *value) {
  ${node.name} *input = lpg_allocate(aTHX_ scope, 1, sizeof(*input));
  lpg_read${node.index}(aTHX_ scope, value, input, 0, 1);
  ${node.name} *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
  memcpy(output, input, sizeof(*output));
  ${node.aggregate ? 'scope->output = output; scope->clear = probe_clear; output->_bridge_owner = malloc(1); if (!output->_bridge_owner) croak("probe malloc"); output->_bridge_release = probe_release; ++probe_owned;' : ""}
  if (probe_bad) { ${corrupt(node)} }
  ${node.ref.id === "lean:Recursive.Spine" ? `if (probe_bad == 7) { output->kind = ${node.cases.find(branch => branch.sourceName === "next").tag}; output->cases.next.value = output; }` : ""}
  return lpg_write${node.index}(aTHX_ scope, output, 0, 1);
}`).join("\n");
	return `${perlGraphInstrumentation}
${model.source}
static void probe_clear(void *value) {
  struct { void *owner; void (*release)(void *); } owned;
  memcpy(&owned, value, sizeof(owned)); memset(value, 0, sizeof(owned));
  if (owned.owner && owned.release) owned.release(owned.owner);
}
${functions}
MODULE = LeanBridge::Recursive PACKAGE = LeanBridge::Recursive::Probe
PROTOTYPES: DISABLE

void
echo(index, value)
    unsigned int index
    SV *value
  PPCODE:
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ probe_retire);
    SV *output = NULL;
    switch (index) {
${model.types.map(node => `    case ${node.index}: output = probe_echo${node.index}(aTHX_ scope, value); break;`).join("\n")}
    default: croak("invalid probe type");
    }
    lpg_close(scope); LEAVE;
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(output);
${perlGraphProbeXs}`;
};

/**
 * Prepare the private probe module without any installed-package assertions.
 *
 * @param root - Test-owned compilation directory.
 * @param model - Generated declarations, converters and graph types.
 * @param xs - Probe translation unit with exact production conversions.
 * @param flags - Explicit private compiler and linker flags.
 */
export const preparePerlGraphProbe = async (root, model, xs, flags = {}) => {
	await saveLakeFile(root, `${model.layout.prefix}-graph-types.h`, model.typesHeader);
	await saveLakeFile(root, "Probe.xs", xs);
	await saveLakeFile(root, "flags.json", canonicalJson(flags));
	await saveLakeFile(root, "types.json", canonicalJson(model.types.map(node => ({ index: node.index, ref: node.ref, kind: node.kind, element: node.element }))));
	await saveLakeFile(root, "LeanBridge/Recursive.pm", `${model.valuesSource}
package LeanBridge::Recursive;
require DynaLoader; our @ISA = ('DynaLoader'); our $VERSION = '0.001';
__PACKAGE__->bootstrap($VERSION); 1;
`);
	await saveLakeFile(root, "build.pl", `use strict; use warnings; use ExtUtils::ParseXS; use ExtUtils::CBuilder; use File::Path qw(make_path); use JSON::PP;
open my $input, '<', 'flags.json' or die $!; my $flags = decode_json(do { local $/; <$input> }); close $input;
ExtUtils::ParseXS::process_file(filename => 'Probe.xs', output => 'Probe.c', prototypes => 0);
my $builder = ExtUtils::CBuilder->new(quiet => 1);
my $object = $builder->compile(source => 'Probe.c', include_dirs => ['.', @{$flags->{include} // []}],
  extra_compiler_flags => '-std=gnu11 -O1 -g0 -Wall -Wextra -Werror -Wno-unused-function ' . ($flags->{compile} // ''));
make_path('auto/LeanBridge/Recursive');
$builder->link(objects => [$object, @{$flags->{objects} // []}], module_name => 'LeanBridge::Recursive',
  lib_file => 'auto/LeanBridge/Recursive/Recursive.so', extra_linker_flags => $flags->{link} // '');
`);
};

/**
 * Build the same XS source with the selected interpreter's actual ABI flags.
 *
 * @param root - Prepared private probe directory.
 * @param perl - Absolute pinned interpreter executable.
 */
export const compilePerlGraphProbe = (root, perl) => runCopied(perl, ["build.pl"], root, { ...process.env, CC: "/usr/bin/cc", LD: "/usr/bin/cc" });
