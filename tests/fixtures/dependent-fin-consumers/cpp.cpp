#include <dependentfin.hpp>
#include <cstdio>
#include <string>
#include <type_traits>
namespace api = lean_bridge::dependentfin;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

template<class F> static bool rejected(F&& call, const std::string& parameter,
    const std::string& bound) {
  try { call(); }
  catch (const api::Error& error) {
    return error.status == DEPENDENTFIN_STATUS_INVALID_ARGUMENT
      && std::string(error.what()) == parameter
        + " is not below its dependent Fin bound " + bound;
  }
  return false;
}

template<class F> static bool invalid_not_dependent(F&& call) {
  try { call(); }
  catch (const api::Error& error) {
    return error.status == DEPENDENTFIN_STATUS_INVALID_ARGUMENT
      && std::string(error.what()).find("dependent Fin bound")
        == std::string::npos;
  }
  return false;
}

int main() {
  static_assert(std::is_same_v<decltype(api::mirror(Nat(1), Nat(0))), Nat>);
  const Nat huge = Nat(1) << 70, word = Nat(1) << 32;
  /* Fin 0 and Fin 1 use the live first argument. */
  CHECK(rejected([&] { api::mirror(0, 0); }, "arg1", "arg0"));
  CHECK(rejected([&] { api::mirror(0, 1); }, "arg1", "arg0"));
  CHECK(api::mirror(1, 0) == 0);
  CHECK(rejected([&] { api::mirror(1, 1); }, "arg1", "arg0"));
  /* Exact endpoints, word-sized values and 2^70 values. */
  CHECK(api::mirror(10, 0) == 9 && api::mirror(10, 9) == 0);
  for (const Nat& value : {Nat(10), Nat(11), word, huge})
    CHECK(rejected([&] { api::mirror(10, value); }, "arg1", "arg0"));
  CHECK(api::mirror(word, word - 1) == 0
    && api::mirror(word + 1, word) == 0);
  CHECK(rejected([&] { api::mirror(word, word); }, "arg1", "arg0"));
  CHECK(api::mirror(huge, huge - 1) == 0
    && api::mirror(huge, 0) == huge - 1);
  CHECK(api::mirror(huge + 1, huge) == 0);
  for (const Nat& value : {huge, huge + 1, Nat(1) << 128})
    CHECK(rejected([&] { api::mirror(huge, value); }, "arg1", "arg0"));
  /* The bound changes every call and cannot be frozen into generated code. */
  for (unsigned bound = 0; bound < 12; ++bound) {
    if (bound > 5) CHECK(api::mirror(bound, 5) == bound - 6);
    else CHECK(rejected([&] { api::mirror(bound, 5); }, "arg1", "arg0"));
  }
  /* The later arg2 depends on arg1, not the unrelated larger arg0. */
  CHECK(api::label(100, 3, 2, "slot") == "slot:102");
  CHECK(rejected([&] { api::label(100, 3, 3, "slot"); }, "arg2", "arg1"));
  CHECK(rejected([&] { api::label(100, 0, 0, "slot"); }, "arg2", "arg1"));
  CHECK(api::label(0, huge, huge - 1, "x")
    == "x:" + (huge - 1).convert_to<std::string>());
  CHECK(invalid_not_dependent([&] { api::mirror(Nat(-1), 0); }));
  CHECK(invalid_not_dependent([&] { api::mirror(5, Nat(-1)); }));
  /* Rejection leaves all caller-owned objects unchanged. */
  const Nat start = 7, bound = 4, value = 4;
  const std::string name = "slot";
  CHECK(rejected([&] { api::label(start, bound, value, name); },
    "arg2", "arg1"));
  CHECK(start == 7 && bound == 4 && value == 4 && name == "slot"
    && api::label(start, bound, 3, name) == "slot:10");
  /* 1000 rejection/recovery cycles keep the runtime usable. */
  for (unsigned i = 0; i < 1000; ++i) {
    if (!rejected([&] { api::mirror(10, 10 + i % 5); }, "arg1", "arg0")) {
      std::fprintf(stderr, "invalid call accepted at %u\n", i); return 1;
    }
    if (api::mirror(i % 7 + 1, i % 7) != 0
      || api::mirror(10, i % 10) != 9 - i % 10) {
      std::fprintf(stderr, "valid call failed at %u\n", i); return 1;
    }
  }
  checks += 2000;
  std::printf("dependent-fin-ok:%u\n", checks);
  return 0;
}
