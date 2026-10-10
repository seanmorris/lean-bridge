#include <subtypes.hpp>
#include <cstdio>
#include <string>
#include <vector>
namespace api = lean_bridge::subtypes;
using Nat = api::Nat;
using Int = api::Int;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)
/* A rejected call carries the invalid-argument status and names the parameter and its checked constructor. */
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) { return error.status == SUBTYPES_STATUS_INVALID_ARGUMENT && std::string(error.what()) == expected; }
  return false;
}
template<class F> static bool invalid(F&& call) {
  try { call(); } catch (const api::Error& error) { return error.status == SUBTYPES_STATUS_INVALID_ARGUMENT; }
  return false;
}

int main() {
  const std::string hello = "h\xc3\xa9llo \xf0\x9f\x99\x82", nul("a\0b", 3);
  /* Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected. */
  CHECK(api::shout(hello) == hello + "!" && api::shout(nul) == std::string("a\0b!", 4));
  CHECK(rejected([] { api::shout(""); }, "arg0 was rejected by Subtypes.checkedWord"));
  /* Even Nat: a heap-backed base beyond 64 bits. */
  CHECK(api::half(42) == 21 && api::half(Nat(1) << 100) == Nat(1) << 99);
  CHECK(rejected([] { api::half(7); }, "arg0 was rejected by Subtypes.checkedEven"));
  CHECK(invalid([] { api::half(Nat(-2)); })); /* Negative is the Nat error. */
  /* Small Int after an unchecked argument. */
  CHECK(api::scale(-3, -128) == 384 && api::scale(-3, 127) == -381);
  CHECK(rejected([] { api::scale(-3, 128); }, "arg1 was rejected by Subtypes.checkedSmall"));
  CHECK(rejected([] { api::scale(-3, -129); }, "arg1 was rejected by Subtypes.checkedSmall"));
  /* Nonempty ByteArray. */
  CHECK(api::head({0, 255}) == 0);
  CHECK(rejected([] { api::head({}); }, "arg0 was rejected by Subtypes.checkedPayload"));
  /* A result-only subtype and two checked arguments. */
  CHECK(api::pad(21) == 42);
  CHECK(api::join("ab", "cd") == "abcd");
  CHECK(rejected([] { api::join("ab", ""); }, "arg1 was rejected by Subtypes.checkedWord"));
  CHECK(rejected([] { api::join("", "cd"); }, "arg0 was rejected by Subtypes.checkedWord"));
  /* A normalizing constructor: the export sees the constructed value. */
  CHECK(api::clamp(250) == 100 && api::clamp(7) == 7);
  /* A checked constructor beside a Fin bound: the Fin precheck runs first. */
  CHECK(api::mix(4, 3) == 7);
  CHECK(rejected([] { api::mix(4, 10); }, "arg1 is not below its Fin 10 bound"));
  CHECK(rejected([] { api::mix(5, 10); }, "arg1 is not below its Fin 10 bound"));
  CHECK(rejected([] { api::mix(5, 3); }, "arg0 was rejected by Subtypes.checkedEven"));
  for (unsigned i = 0; i < 1000; ++i) {
    if (!rejected([i] { api::half(2 * i + 1); }, "arg0 was rejected by Subtypes.checkedEven") || api::half(2 * i) != i) { std::fprintf(stderr, "recovery failed at %u\n", i); return 1; }
  }
  checks += 2000;
  std::printf("subtype-ok:%u\n", checks);
  return 0;
}
