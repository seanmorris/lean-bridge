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

// The raw probe uses only Lean's scalar boxing: lean_box(n) = (n << 1) | 1.
const cConsumer = () => `#define _GNU_SOURCE
#include <native_fin.h>
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>

static int checks = 0;
#define REQUIRE(condition) do { if (!(condition)) { fprintf(stderr, "failed at line %d: %s\\n", __LINE__, #condition); return 1; } ++checks; } while (0)

static int rejected(native_fin_status status, const native_fin_error *error) {
  return status == NATIVE_FIN_STATUS_INVALID_ARGUMENT && error->code == NATIVE_FIN_ERROR_INVALID_ARGUMENT
    && error->message && memmem(error->message, error->message_length, "Fin", 3) != NULL;
}
static void set(mpz_ptr value, const char *decimal) { mpz_set_str(value, decimal, 10); }

typedef void *(*raw_unary)(void *);
static void *boxed(size_t value) { return (void *)((value << 1) | 1u); }
static int scalar(void *value) { return ((size_t)value & 1u) == 1u; }

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

  /* 2^70 exceeds every machine word. */
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

  /* Raw calls to the exported Lean adapters recheck the bound before constructing Fin. */
  raw_unary mirror = (raw_unary)dlsym(RTLD_DEFAULT, "${nativeFinSymbol("NativeFin.mirror")}");
  raw_unary impossible = (raw_unary)dlsym(RTLD_DEFAULT, "${nativeFinSymbol("NativeFin.impossible")}");
  REQUIRE(mirror != NULL && impossible != NULL);
  REQUIRE(scalar(mirror(boxed(10))));
  REQUIRE(scalar(mirror(boxed(1000))));
  REQUIRE(scalar(impossible(boxed(0))));
  void *some = mirror(boxed(3));
  REQUIRE(!scalar(some) && ((void **)((char *)some + 8))[0] == boxed(6));

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
  const Nat huge = Nat(1) << 70;
  REQUIRE(rejected([] { api::impossible(Nat(0)); }));
  REQUIRE(api::only(Nat(0)) == 7);
  REQUIRE(rejected([] { api::only(Nat(1)); }));
  REQUIRE(api::mirror(Nat(0)) == 9 && api::mirror(Nat(9)) == 0);
  REQUIRE(rejected([] { api::mirror(Nat(10)); }));
  REQUIRE(rejected([] { api::mirror(Nat(-1)); }));
  REQUIRE(api::twice(Nat(299)) == 598);
  REQUIRE(rejected([] { api::twice(Nat(300)); }));
  REQUIRE(api::succ_huge(huge - 2) == huge - 1 && api::succ_huge(huge - 1) == huge - 1);
  REQUIRE(rejected([&] { api::succ_huge(huge); }));
  REQUIRE(rejected([&] { api::succ_huge(huge + 1); }));
  REQUIRE(api::wrap(huge) == 2);
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
 * Test-only LD_PRELOAD interposer counting Lean source and adapter dispatch.
 * The fixture and production adapters stay unchanged; the dynamic linker routes calls here.
 */
export const nativeFinDispatchInterposer = () => `#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
static unsigned long counts[${counted.length}];
unsigned long native_fin_dispatch_count(unsigned index) { return index < ${counted.length} ? counts[index] : 0; }
${counted.map(wrapper).join("\n")}
`;

/** Probe each public and raw dispatch surface and print cumulative counts after every step. */
export const nativeFinDispatchProbe = () => `#define _GNU_SOURCE
#include <native_fin.h>
#include <dlfcn.h>
#include <stdio.h>
typedef void *(*raw_unary)(void *);
static unsigned long (*count)(unsigned);
static void report(const char *step, int status) {
  printf("%s %d", step, status);
  for (unsigned i = 0; i < ${counted.length}; ++i) printf(" %lu", count(i));
  printf("\\n");
}
static void *boxed(size_t value) { return (void *)((value << 1) | 1u); }
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
  report("raw-invalid-mirror", ((size_t)mirror(boxed(10)) & 1u) == 1u);
  report("raw-invalid-impossible", ((size_t)impossible(boxed(0)) & 1u) == 1u);
  report("raw-valid-mirror", ((size_t)mirror(boxed(3)) & 1u) == 0u);
  mpz_clear(base); mpz_clear(in); native_fin_nat_clear(out); native_fin_string_clear(&text);
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
