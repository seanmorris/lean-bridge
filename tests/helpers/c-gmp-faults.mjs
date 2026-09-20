/**
 * Fail facade-owned allocations without replacing GMP's process-wide allocator.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { saveLakeFile } from "./lake-workspace.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { callableReviewedIr } from "./callable-fixture.mjs";

const probe = async (output, working, p, body, environment) => {
	const adapter = join(output, "native/c-binding"), gmp = join(adapter, "gmp");
	const declarations = "#include <stddef.h>\nvoid *probe_malloc(size_t);\nvoid *probe_calloc(size_t, size_t);\nvoid probe_free(void*);\n";
	const source = await readFile(join(gmp, `src/${p}_gmp.c`), "utf8");
	await saveLakeFile(working, "facade.c", declarations + source.replace(/\b(malloc|calloc|free)\b/g, "probe_$1"));
	await saveLakeFile(working, "probe.c", `#include "${p}.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static int remaining = -1, live;
static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
static int allowed(void) { if (!remaining) return 0; if (remaining > 0) --remaining; return 1; }
void *probe_malloc(size_t n) { if (!allowed()) return NULL; void *p = malloc(n); if (p) ++live; return p; }
void *probe_calloc(size_t n, size_t w) { if (!allowed()) return NULL; void *p = calloc(n, w); if (p) ++live; return p; }
void probe_free(void *p) { if (p) { --live; free(p); } }
${body}
`);
	const flags = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG"];
	await runCopied(environment.CC ?? "cc", [...flags, "-I", join(adapter, "include"), "-I", join(gmp, "include"), "-c", "facade.c", "-o", "facade.o"], working, environment);
	const lib = join(working, "lib");
	await cp(join(output, "native/runtime/lib"), lib, { recursive: true });
	const component = JSON.parse(await readFile(join(output, "native/component/native-component.json")));
	await cp(join(output, "native/component", component.library), join(lib, component.library));
	await cp(join(adapter, "lib", `lib${p}.so`), join(lib, `lib${p}.so`));
	await cp(join(gmp, "lib/libgmp.so.10"), join(lib, "libgmp.so.10"));
	await runCopied(environment.CC ?? "cc", [...flags, "-I", join(gmp, "include"), "probe.c", "facade.o", "-L", lib, "-Wl,-rpath,$ORIGIN/lib", `-l${p}`, "-l:libgmp.so.10", "-o", "probe"], working, environment);
	const result = await runCopied(join(working, "probe"), [], working);
	assert.match(result.stdout, /^gmp-fault-ok:\d+\n$/);
	return Number(result.stdout.trim().split(":")[1]);
};

/**
 * Fail every facade allocation while transporting active and inactive branches.
 *
 * @param output - Fresh compound release.
 * @param working - Isolated probe directory.
 * @param environment - Producer compiler environment.
 */
export const checkGmpCompoundFaults = (output, working, environment) => probe(output, working, "compounds", `int main(void) {
  compounds_packet value, out; compounds_packet_init(&value); compounds_packet_init(&out);
  value.choice.has_value = 1; value.choice.value.is_ok = 1; mpz_setbit(value.choice.value.ok.fst, 100);
  value.products.fst.snd = (compounds_string){"packet", 6, NULL, NULL}; value.products.snd.snd = 65;
  value.nested.is_ok = 0; value.nested.error.has_value = 1; mpz_setbit(value.nested.error.value, 100);
  compounds_error error = {0}; int succeeded = 0;
  for (int limit = 0; limit < 80; ++limit) {
    remaining = limit; compounds_status status = compounds_transform(&value, &out, &error);
    if (status == COMPOUNDS_STATUS_OK) {
      CHECK(out.choice.has_value && out.choice.value.is_ok && mpz_tstbit(out.choice.value.ok.fst, 100));
      compounds_packet_clear(&out); compounds_packet_clear(&out); CHECK(live == 0); succeeded = 1; break;
    }
    CHECK(status == COMPOUNDS_STATUS_UNEXPECTED_ERROR && live == 0);
    CHECK(!out.choice.has_value && !out.products.fst.snd.data);
  }
  CHECK(succeeded); remaining = -1; compounds_packet_clear(&value);
  printf("gmp-fault-ok:%u\\n", checks);
}`, environment);

/**
 * Check List input, output and nested payload allocation cleanup.
 *
 * @param output - Fresh List release.
 * @param working - Isolated probe directory.
 * @param environment - Producer compiler environment.
 */
export const checkGmpListFaults = (output, working, environment) => probe(output, working, "lists", `int main(void) {
  lists_packet value, out; lists_packet_init(&value); lists_packet_init(&out);
  lists_option_result_tuple_nat_unit_string_value branches[2];
  for (unsigned i = 0; i < 2; ++i) lists_option_result_tuple_nat_unit_string_value_init(&branches[i]);
  branches[0].has_value = 1; branches[0].value.is_ok = 1; mpz_setbit(branches[0].value.ok.fst, 100);
  branches[1].has_value = 1; branches[1].value.error = (lists_string){"bad", 3, NULL, NULL};
  value.branches = (lists_list_option_result_tuple_nat_unit_string_span){branches, 2, NULL, NULL};
  uint8_t bytes[] = {0,255}; lists_bytes buffers[] = {{bytes, 2, NULL, NULL}};
  value.buffers = (lists_list_bytes_span){buffers, 1, NULL, NULL};
  out.buffers = value.buffers;
  lists_error error = {0}; int succeeded = 0;
  for (int limit = 0; limit < 80; ++limit) {
    remaining = limit; lists_status status = lists_transform(&value, &out, &error);
    if (status == LISTS_STATUS_OK) {
      CHECK(out.branches.length == 2 && out.branches.data[1].has_value && out.branches.data[1].value.is_ok);
      CHECK(mpz_tstbit(out.branches.data[1].value.ok.fst, 100) && mpz_tstbit(out.branches.data[1].value.ok.fst, 0));
      CHECK(out.branches.data[0].value.error.length == 4 && out.buffers.data[0].data != bytes);
      lists_packet_clear(&out); lists_packet_clear(&out); CHECK(live == 0); succeeded = 1; break;
    }
    CHECK(status == LISTS_STATUS_UNEXPECTED_ERROR && live == 0);
    CHECK(!out.branches.length && out.buffers.data == buffers);
  }
  CHECK(succeeded); remaining = -1; lists_packet_clear(&value);
  for (unsigned i = 0; i < 2; ++i) lists_option_result_tuple_nat_unit_string_value_clear(&branches[i]);
  printf("gmp-fault-ok:%u\\n", checks);
}`, environment);

/**
 * Check callback conversions at every facade allocation checkpoint.
 *
 * @param output - Fresh native release.
 * @param working - Isolated probe directory.
 * @param environment - Producer compiler environment.
 */
export const checkGmpCallableFaults = (output, working, environment) => {
	const callback = callableReviewedIr().declarations.find(fn => fn.name === "callNat").parameters[1].type.id.replace("bridge:Callback", "callables_callback");
	return probe(output, working, "callables", `static unsigned calls;
static callables_status echo(void *context, mpz_srcptr value, mpz_ptr out, callables_error *error) {
  (void)context; (void)error; ++calls; mpz_set(out, value); return CALLABLES_STATUS_OK;
}
int main(void) {
  mpz_t value, out; mpz_init(value); mpz_init(out); mpz_setbit(value, 16384);
  ${callback} callback = {echo, NULL}; callables_error error = {0}; int succeeded = 0;
  for (int limit = 0; limit < 20; ++limit) {
    remaining = limit; calls = 0; mpz_set_ui(out, 91);
    callables_status status = callables_twice_nat(value, &callback, out, &error);
    CHECK(live == 0);
    if (status == CALLABLES_STATUS_OK) { CHECK(calls == 2 && !mpz_cmp(out, value)); succeeded = 1; break; }
    CHECK(status == CALLABLES_STATUS_UNEXPECTED_ERROR && mpz_cmp_ui(out, 91) == 0);
    CHECK(error.code == CALLABLES_ERROR_UNEXPECTED && strstr(error.message, "allocate"));
  }
  CHECK(succeeded); mpz_clear(value); mpz_clear(out);
  printf("gmp-fault-ok:%u\\n", checks);
}`, environment);
};

/**
 * Check recursive GMP array and record cleanup at every facade allocation.
 *
 * @param output - Fresh native release.
 * @param working - Isolated probe directory.
 * @param p - Fixture component prefix.
 * @param environment - Producer compiler environment.
 */
export const checkGmpCopiedFaults = (output, working, p, environment) => probe(output, working, p, `int main(void) {
  ${p}_zleaf leaf; ${p}_zleaf_init(&leaf); mpz_setbit(leaf.v_nat, 16384); mpz_set_si(leaf.v_integer, -27);
  leaf.v_text = (${p}_string){"leaf", 4, NULL, NULL};
  ${p}_array_lean_${p}_zleaf_span row = {&leaf, 1, NULL, NULL};
  ${p}_array_array_lean_${p}_zleaf_span rows = {&row, 1, NULL, NULL};
  ${p}_envelope input, out; ${p}_envelope_init(&input); ${p}_envelope_init(&out);
  input.title = (${p}_string){"record", 6, NULL, NULL}; input.rows = rows; mpz_setbit(input.leaf.v_nat, 53);
  out.title = (${p}_string){"held", 4, NULL, NULL}; mpz_set_ui(out.leaf.v_nat, 91);
  ${p}_error error = {0}; int succeeded = 0;
  for (int limit = 0; limit < 100; ++limit) {
    remaining = limit; ${p}_status status = ${p}_echo_record(&input, &out, &error);
    if (status == ${p.toUpperCase()}_STATUS_OK) {
      CHECK(!mpz_cmp(out.rows.data[0].data[0].v_nat, leaf.v_nat)); succeeded = 1;
      ${p}_envelope_clear(&out); ${p}_envelope_clear(&out); CHECK(live == 0); break;
    }
    CHECK(status == ${p.toUpperCase()}_STATUS_UNEXPECTED_ERROR && live == 0);
    CHECK(out.title.length == 4 && !mpz_cmp_ui(out.leaf.v_nat, 91));
  }
  CHECK(succeeded); ${p}_envelope_clear(&input); ${p}_zleaf_clear(&leaf);
  printf("gmp-fault-ok:%u\\n", checks);
}`, environment);
