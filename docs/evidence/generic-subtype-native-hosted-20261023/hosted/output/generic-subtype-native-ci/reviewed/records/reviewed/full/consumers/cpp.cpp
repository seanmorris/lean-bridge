#include <nominalsubtypes.hpp>
#include <cstdio>
#include <string>

namespace api = lean_bridge::nominalsubtypes;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) {
    return error.status == NOMINALSUBTYPES_STATUS_INVALID_ARGUMENT
      && error.code == NOMINALSUBTYPES_ERROR_INVALID_ARGUMENT
      && std::string(error.what()) == expected;
  }
  return false;
}

int main() {
  const api::GenericNat input{40, 2};
  CHECK(api::generic_use(input) == 43);
  CHECK((input == api::GenericNat{40, 2}));
  CHECK((api::echo_generic_first(input) == api::GenericNat{41, 2}));
  CHECK((api::echo_generic_second(input) == api::GenericNat{42, 2}));
  CHECK((input == api::GenericNat{40, 2}));
  CHECK(api::generic_use(api::GenericNat{99, 7}) == 107);
  CHECK((api::echo_generic_first(api::GenericNat{99, 7}) == api::GenericNat{100, 7}));
  CHECK(rejected([] { api::generic_use(api::GenericNat{100, 2}); },
    "value0.value was rejected by NominalSubtypes.plusOne"));
  CHECK(rejected([] { api::echo_generic_first(api::GenericNat{100, 2}); },
    "value0.value was rejected by NominalSubtypes.plusOne"));
  CHECK(rejected([] { api::echo_generic_second(api::GenericNat{90, 2}); },
    "value0.value was rejected by NominalSubtypes.plusTwo"));
  CHECK((api::echo_generic_second(input) == api::GenericNat{42, 2}));
  CHECK(api::generic_use(input) == 43);
  std::printf("generic-subtype-ok:%u\n", checks);
  return 0;
}
