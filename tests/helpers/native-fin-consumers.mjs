/**
 * Installed consumers for checked top-level Fin sites in C and C++ packages.
 *
 * @file
 */
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Name the compiler-emitted Lean adapter that public calls reach through the runtime table.
 *
 * @param name - Lean declaration identity.
 */
export const nativeFinSymbol = name => `lb_${sha256(`native-fin@1.0.0\0${name}`).slice(0, 24)}`;

const cConsumer = () => `#define _GNU_SOURCE
#include <native_fin.h>
#include <stdio.h>
#include <string.h>

static int checks = 0;
#define REQUIRE(condition) do { if (!(condition)) { fprintf(stderr, "failed at line %d: %s\\n", __LINE__, #condition); return 1; } ++checks; } while (0)

static int rejected(native_fin_status status, const native_fin_error *error) {
  return status == NATIVE_FIN_STATUS_INVALID_ARGUMENT && error->code == NATIVE_FIN_ERROR_INVALID_ARGUMENT
    && error->message && memmem(error->message, error->message_length, "Fin", 3) != NULL;
}
static void set(mpz_ptr value, const char *decimal) { mpz_set_str(value, decimal, 10); }

int main(void) {
  native_fin_error error = {0};
  native_fin_nat in, base, out, kept;
  native_fin_string text;
  mpz_init(in); mpz_init(base);
  native_fin_nat_init(out); native_fin_nat_init(kept); native_fin_string_init(&text);

  /* Fin 0 is uninhabited: every input is rejected. */
  set(in, "0"); REQUIRE(rejected(native_fin_impossible(in, out, &error), &error));
  set(in, "1"); REQUIRE(rejected(native_fin_impossible(in, out, &error), &error));
  REQUIRE(mpz_sgn(out) == 0);

  /* Fin 1 admits only zero; failed calls leave initialized outputs unchanged. */
  set(in, "0"); REQUIRE(native_fin_only(in, kept, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp_ui(kept, 7) == 0);
  set(in, "1"); REQUIRE(rejected(native_fin_only(in, kept, &error), &error));
  REQUIRE(mpz_cmp_ui(kept, 7) == 0);

  /* Fin 10 with a Fin result: endpoints, beyond-bound and negative inputs. */
  set(in, "0"); REQUIRE(native_fin_mirror(in, out, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp_ui(out, 9) == 0);
  set(in, "9"); REQUIRE(native_fin_mirror(in, out, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp_ui(out, 0) == 0);
  set(in, "10"); REQUIRE(rejected(native_fin_mirror(in, out, &error), &error));
  set(in, "11"); REQUIRE(rejected(native_fin_mirror(in, out, &error), &error));
  set(in, "4294967296"); REQUIRE(rejected(native_fin_mirror(in, out, &error), &error));
  set(in, "-1"); REQUIRE(native_fin_mirror(in, out, &error) == NATIVE_FIN_STATUS_INVALID_ARGUMENT);
  REQUIRE(mpz_cmp_ui(out, 0) == 0 && mpz_cmp_si(in, -1) == 0); /* Output and caller value unchanged. */

  /* A transparent alias keeps its exact bound. */
  set(in, "299"); REQUIRE(native_fin_twice(in, out, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp_ui(out, 598) == 0);
  set(in, "300"); REQUIRE(rejected(native_fin_twice(in, out, &error), &error));
  set(in, "301"); REQUIRE(rejected(native_fin_twice(in, out, &error), &error));

  /* 2^70 exceeds every machine word. */
  set(in, "4294967296"); REQUIRE(native_fin_succ_huge(in, out, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp_ui(out, 4294967297u) == 0);
  set(in, "1180591620717411303422"); REQUIRE(native_fin_succ_huge(in, out, &error) == NATIVE_FIN_STATUS_OK);
  set(base, "1180591620717411303423"); REQUIRE(mpz_cmp(out, base) == 0);
  REQUIRE(native_fin_succ_huge(base, out, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp(out, base) == 0);
  set(in, "1180591620717411303424"); REQUIRE(rejected(native_fin_succ_huge(in, out, &error), &error));
  set(in, "1180591620717411303425"); REQUIRE(rejected(native_fin_succ_huge(in, out, &error), &error));
  set(in, "340282366920938463463374607431768211456"); REQUIRE(rejected(native_fin_succ_huge(in, out, &error), &error));
  REQUIRE(mpz_cmp(out, base) == 0);

  /* A result-only refinement projects the Lean value after it returns. */
  set(in, "100"); REQUIRE(native_fin_wrap(in, out, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp_ui(out, 2) == 0);
  set(in, "1180591620717411303424"); REQUIRE(native_fin_wrap(in, out, &error) == NATIVE_FIN_STATUS_OK && mpz_cmp_ui(out, 2) == 0);

  /* Multiargument calls reject the Fin argument and leave copied inputs and outputs unchanged. */
  const native_fin_string name = {"slot", 4, NULL, NULL};
  set(base, "5"); set(in, "3");
  REQUIRE(native_fin_label(base, in, &name, &text, &error) == NATIVE_FIN_STATUS_OK && text.length == 6 && memcmp(text.data, "slot:8", 6) == 0);
  set(in, "4"); REQUIRE(rejected(native_fin_label(base, in, &name, &text, &error), &error));
  REQUIRE(text.length == 6 && memcmp(text.data, "slot:8", 6) == 0 && memcmp(name.data, "slot", 4) == 0 && mpz_cmp_ui(base, 5) == 0);

  /* Repeated invalid and valid calls recover without retiring the runtime. */
  for (unsigned i = 0; i < 1000; ++i) {
    mpz_set_ui(in, 10u + i);
    if (!rejected(native_fin_mirror(in, out, &error), &error)) { fprintf(stderr, "invalid call %u accepted\\n", i); return 1; }
    mpz_set_ui(in, i % 10u);
    if (native_fin_mirror(in, out, &error) != NATIVE_FIN_STATUS_OK || mpz_cmp_ui(out, 9u - i % 10u) != 0) { fprintf(stderr, "valid call %u failed\\n", i); return 1; }
  }
  checks += 2000;

  mpz_clear(in); mpz_clear(base);
  native_fin_nat_clear(out); native_fin_nat_clear(kept); native_fin_string_clear(&text);
  printf("fin-ok:%d\\n", checks);
  return 0;
}
`;

const cppConsumer = () => `#include <native_fin.hpp>
#include <iostream>
#include <string>

namespace api = lean_bridge::native_fin;
static int checks = 0;
#define REQUIRE(condition) do { if (!(condition)) { std::cerr << "failed at line " << __LINE__ << ": " #condition "\\n"; return 1; } ++checks; } while (0)

template<class F> static bool rejected(F&& call) {
  try { call(); }
  catch (const api::Error& error) {
    return error.status == NATIVE_FIN_STATUS_INVALID_ARGUMENT;
  }
  return false;
}

int main() {
  using Nat = api::Nat;
  const Nat huge = Nat(1) << 70, word = Nat(1) << 32;
  REQUIRE(rejected([] { api::impossible(Nat(0)); }));
  REQUIRE(rejected([] { api::impossible(Nat(1)); }));
  REQUIRE(api::only(Nat(0)) == 7);
  REQUIRE(rejected([] { api::only(Nat(1)); }));
  REQUIRE(api::mirror(Nat(0)) == 9 && api::mirror(Nat(9)) == 0);
  REQUIRE(rejected([] { api::mirror(Nat(10)); }));
  REQUIRE(rejected([] { api::mirror(Nat(11)); }));
  REQUIRE(rejected([&] { api::mirror(word); }));
  REQUIRE(rejected([] { api::mirror(Nat(-1)); }));
  REQUIRE(api::twice(Nat(299)) == 598);
  REQUIRE(rejected([] { api::twice(Nat(300)); }));
  REQUIRE(rejected([] { api::twice(Nat(301)); }));
  REQUIRE(api::succ_huge(word) == word + 1);
  REQUIRE(api::succ_huge(huge - 2) == huge - 1 && api::succ_huge(huge - 1) == huge - 1);
  REQUIRE(rejected([&] { api::succ_huge(huge); }));
  REQUIRE(rejected([&] { api::succ_huge(huge + 1); }));
  REQUIRE(rejected([] { api::succ_huge(Nat(1) << 128); }));
  REQUIRE(api::wrap(Nat(100)) == 2 && api::wrap(huge) == 2);
  REQUIRE(api::label(Nat(5), Nat(3), "slot") == "slot:8");
  REQUIRE(rejected([] { api::label(Nat(5), Nat(4), "slot"); }));
  for (unsigned i = 0; i < 1000; ++i) {
    if (!rejected([i] { api::mirror(Nat(10u + i)); }) || api::mirror(Nat(i % 10u)) != 9u - i % 10u) {
      std::cerr << "recovery failed at " << i << "\\n"; return 1;
    }
  }
  checks += 2000;
  std::cout << "fin-ok:" << checks << "\\n";
  return 0;
}
`;

const counted = [
	["l_NativeFin_mirror", 1]
	, ["l_NativeFin_impossible", 1]
	, ["l_NativeFin_label", 3]
	, [nativeFinSymbol("NativeFin.mirror"), 1]
	, [nativeFinSymbol("NativeFin.impossible"), 1]
	, [nativeFinSymbol("NativeFin.label"), 3]
];
const wrapper = ([symbol, arity], index) => {
	const parameters = Array.from({ length: arity }, (_, i) => `void *a${i}`).join(", ");
	const values = Array.from({ length: arity }, (_, i) => `a${i}`).join(", ");
	return `void *${symbol}(${parameters}) {
  static void *(*next)(${Array(arity).fill("void *").join(", ")});
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "${symbol}"); if (!next) abort(); }
  ++counts[${index}];
  return next(${values});
}`;
};

/**
 * Test-only LD_PRELOAD interposer. It counts Lean source and adapter dispatch and
 * records the runtime table that the package installs; generated code is unchanged.
 */
export const nativeFinDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
static unsigned long counts[${counted.length}];
static const void *captured;
unsigned long native_fin_dispatch_count(unsigned index) { return index < ${counted.length} ? counts[index] : 0; }
const void *native_fin_captured_runtime(void) { return captured; }
int native_fin_runtime_install_v1(const void *runtime, void *error) {
  static int (*next)(const void *, void *);
  if (!next) { *(void **)&next = dlsym(RTLD_NEXT, "native_fin_runtime_install_v1"); if (!next) abort(); }
  captured = runtime;
  return next(runtime, error);
}
${counted.map(wrapper).join("\n")}
`;

/** Probe public and exported-adapter dispatch; raw results use the pinned Lean object API. */
export const nativeFinDispatchProbe = () => `#define _GNU_SOURCE
#include <native_fin.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
typedef lean_object *(*raw_unary)(lean_object *);
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${counted.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
/* An exported adapter consumes its argument and returns an owned Option. */
static int rejected(raw_unary adapter, size_t value) {
  lean_object *result = adapter(lean_box(value));
  int none = lean_is_scalar(result);
  lean_dec(result);
  return none;
}
static int accepted(raw_unary adapter, size_t value, size_t expected) {
  lean_object *result = adapter(lean_box(value));
  int ok = !lean_is_scalar(result) && lean_is_scalar(lean_ctor_get(result, 0)) && lean_unbox(lean_ctor_get(result, 0)) == expected;
  lean_dec(result);
  return ok;
}
int main(void) {
  *(void **)&count = dlsym(RTLD_DEFAULT, "native_fin_dispatch_count");
  if (!count) { fprintf(stderr, "interposer is not loaded\\n"); return 1; }
  native_fin_error error = {0};
  native_fin_nat base, in, out;
  native_fin_string text;
  const native_fin_string name = {"slot", 4, NULL, NULL};
  mpz_init_set_ui(base, 5); mpz_init(in); native_fin_nat_init(out); native_fin_string_init(&text);
  report("start", 0);
  mpz_set_ui(in, 3); report("public-valid-mirror", native_fin_mirror(in, out, &error));
  mpz_set_ui(in, 10); report("public-invalid-mirror", native_fin_mirror(in, out, &error));
  mpz_set_ui(in, 0); report("public-invalid-impossible", native_fin_impossible(in, out, &error));
  mpz_set_ui(in, 4); report("public-invalid-label", native_fin_label(base, in, &name, &text, &error));
  mpz_set_ui(in, 3); report("public-valid-label", native_fin_label(base, in, &name, &text, &error));
  raw_unary mirror = (raw_unary)dlsym(RTLD_DEFAULT, "${nativeFinSymbol("NativeFin.mirror")}");
  raw_unary impossible = (raw_unary)dlsym(RTLD_DEFAULT, "${nativeFinSymbol("NativeFin.impossible")}");
  if (!mirror || !impossible) { fprintf(stderr, "exported adapters are not visible\\n"); return 1; }
  report("raw-invalid-mirror", rejected(mirror, 10));
  report("raw-invalid-impossible", rejected(impossible, 0));
  report("raw-valid-mirror", accepted(mirror, 3, 6));
  report("raw-invalid-mirror-large", rejected(mirror, 1000));
  mpz_clear(base); mpz_clear(in); native_fin_nat_clear(out); native_fin_string_clear(&text);
  return 0;
}
`;

/**
 * Call the installed runtime table directly with caller limbs, as a raw C ABI caller would.
 * The headers are the build's generated internal runtime declarations.
 */
export const nativeFinRuntimeProbe = () => `#define _GNU_SOURCE
#include "native_fin_runtime.h"
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
static int checks = 0;
#define REQUIRE(condition) do { if (!(condition)) { fprintf(stderr, "failed at line %d: %s\\n", __LINE__, #condition); return 1; } ++checks; } while (0)
#define NAT(...) ((native_fin_nat){(const uint32_t[]){__VA_ARGS__}, sizeof((const uint32_t[]){__VA_ARGS__}) / sizeof(uint32_t), NULL, NULL})
static const native_fin_nat zero = {NULL, 0, NULL, NULL};
static const native_fin_runtime_v1 *rt;
static unsigned long (*count)(unsigned);
static unsigned long dispatched(void) { unsigned long total = 0; for (unsigned i = 0; i < ${counted.length}; ++i) total += count(i); return total; }
static int equals(const native_fin_nat *value, const uint32_t *expected, size_t length) {
  size_t used = value->length;
  while (used && value->data[used - 1] == 0) --used;
  while (length && expected[length - 1] == 0) --length;
  return used == length && (!length || memcmp(value->data, expected, length * sizeof(uint32_t)) == 0);
}
static int rejected(native_fin_status status, const native_fin_error *error) {
  return status == NATIVE_FIN_STATUS_INVALID_ARGUMENT && error->code == NATIVE_FIN_ERROR_INVALID_ARGUMENT
    && error->message && memmem(error->message, error->message_length, "Fin", 3) != NULL;
}
/* A rejected raw call must leave the output exactly as it was and dispatch no Lean code. */
#define REJECT(call, value) do { native_fin_nat before = out; unsigned long seen = dispatched(); \\
  REQUIRE(rejected(rt->call(rt->context, value, &out, &error), &error)); \\
  REQUIRE(memcmp(&before, &out, sizeof out) == 0 && dispatched() == seen); } while (0)
#define ACCEPT(call, value, ...) do { native_fin_nat_clear(&out); \\
  REQUIRE(rt->call(rt->context, value, &out, &error) == NATIVE_FIN_STATUS_OK && equals(&out, (const uint32_t[]){__VA_ARGS__}, sizeof((const uint32_t[]){__VA_ARGS__}) / sizeof(uint32_t))); } while (0)

int main(void) {
  const void *(*captured)(void);
  *(void **)&captured = dlsym(RTLD_DEFAULT, "native_fin_captured_runtime");
  *(void **)&count = dlsym(RTLD_DEFAULT, "native_fin_dispatch_count");
  if (!captured || !count || !(rt = captured())) { fprintf(stderr, "runtime table was not captured\\n"); return 1; }
  native_fin_error error = {0};
  native_fin_nat out = {0};
  native_fin_string text = {0};
  REQUIRE(rt->abi_version == NATIVE_FIN_BINDING_ABI_VERSION);
  REQUIRE(rt->initialize(rt->context, &error) == NATIVE_FIN_STATUS_OK);

  /* Fin 0: zero-length and zero-padded inputs are both rejected. */
  REJECT(impossible, &zero);
  REJECT(impossible, &NAT(0, 0));
  /* Fin 1: zero is accepted with or without high-zero padding. */
  ACCEPT(only, &zero, 7);
  ACCEPT(only, &NAT(0, 0, 0), 7);
  REJECT(only, &NAT(1));
  REJECT(only, &NAT(1, 0));
  /* Fin 10 with a Fin result. */
  ACCEPT(mirror, &zero, 9);
  ACCEPT(mirror, &NAT(9, 0, 0), 0);
  REJECT(mirror, &NAT(10));
  REJECT(mirror, &NAT(10, 0, 0));
  REJECT(mirror, &NAT(11));
  REJECT(mirror, &NAT(0, 1));
  /* Alias bound 300. */
  ACCEPT(twice, &NAT(299), 598);
  ACCEPT(twice, &NAT(299, 0), 598);
  REJECT(twice, &NAT(300));
  REJECT(twice, &NAT(300, 0));
  REJECT(twice, &NAT(301));
  /* Exact 2^70 bound: limbs {0, 0, 0x40}. */
  ACCEPT(succ_huge, &NAT(0, 1), 1, 1);
  ACCEPT(succ_huge, &NAT(0xffffffffu, 0xffffffffu, 0x3fu), 0xffffffffu, 0xffffffffu, 0x3fu);
  ACCEPT(succ_huge, &NAT(0xffffffffu, 0xffffffffu, 0x3fu, 0, 0), 0xffffffffu, 0xffffffffu, 0x3fu);
  REJECT(succ_huge, &NAT(0, 0, 0x40u));
  REJECT(succ_huge, &NAT(0, 0, 0x40u, 0));
  REJECT(succ_huge, &NAT(1, 0, 0x40u));
  REJECT(succ_huge, &NAT(0, 0, 0, 1));
  /* Multiargument raw calls reject the Fin argument without touching the output. */
  const native_fin_string name = {"slot", 4, NULL, NULL};
  REQUIRE(rt->label(rt->context, &NAT(5), &NAT(3), &name, &text, &error) == NATIVE_FIN_STATUS_OK && text.length == 6 && memcmp(text.data, "slot:8", 6) == 0);
  native_fin_string kept = text; unsigned long seen = dispatched();
  REQUIRE(rejected(rt->label(rt->context, &NAT(5), &NAT(4, 0), &name, &text, &error), &error));
  REQUIRE(memcmp(&kept, &text, sizeof text) == 0 && dispatched() == seen && memcmp(text.data, "slot:8", 6) == 0);
  /* Repeated raw rejection and recovery. */
  for (unsigned i = 0; i < 500; ++i) {
    REJECT(mirror, &NAT(10u + i, 0));
    ACCEPT(mirror, &NAT(i % 10u), 9u - i % 10u);
  }
  native_fin_nat_clear(&out); native_fin_string_clear(&text);
  printf("runtime-ok:%d\\n", checks);
  return 0;
}
`;

/** Columns printed by the dispatch probe, in interposer order. */
export const nativeFinDispatchColumns = counted.map(([symbol]) => symbol);

/**
 * Select the installed consumer source for one C-family profile.
 *
 * @param profile - Installed C or C++ profile.
 */
export const nativeFinConsumer = profile => profile === "c" ? cConsumer() : cppConsumer();
