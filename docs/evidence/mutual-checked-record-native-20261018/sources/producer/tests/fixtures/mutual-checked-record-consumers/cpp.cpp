// Independent installed C++20 caller for a mutually recursive checked record and variant.
#include <mutualcheckedrecords.hpp>
#include <cstdio>
#include <optional>
#include <string>
#include <vector>

namespace api = lean_bridge::mutualcheckedrecords;

#ifndef MUTUAL_CHECKED_PARAMETER
#define MUTUAL_CHECKED_PARAMETER "arg0"
#endif

static unsigned checks;
#define CHECK(test) do { \
  if (!(test)) { std::fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } \
  ++checks; \
} while (0)

template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) {
    const bool matches = error.status == MUTUALCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
      && error.code == MUTUALCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
      && std::string(error.what()) == expected;
    if (!matches) std::fprintf(stderr, "expected: %s\nactual: %s\n",
      expected.c_str(), error.what());
    return matches;
  }
  return false;
}

static api::Envelope nested(api::Nat outer, api::Nat mode,
                            api::Nat inner, api::Nat inner_mode) {
  return {std::move(outer), std::move(mode),
    api::StepMore{api::Envelope{std::move(inner), std::move(inner_mode), std::nullopt}}};
}

int main() {
  api::Envelope value = nested(40, 2, 80, 1);
  const api::Envelope original = value;
  CHECK(api::first(value) == 41);
  CHECK(api::second(value) == 42);
  CHECK(value == original);

  const api::Envelope echoed = api::echo(value);
  const api::Envelope expected = nested(41, 2, 81, 1);
  CHECK(echoed == expected);
  CHECK(value == original);

  const api::Envelope produced = api::produce(5);
  CHECK(produced == nested(6, 1, 7, 2));

  const api::Envelope stopped{40, 2, api::StepStop{}};
  CHECK(api::first(stopped) == 41);

  std::vector<std::optional<api::Envelope>> group{value, std::nullopt};
  const auto group_before = group;
  CHECK(api::groups(group) == 2);
  CHECK(group == group_before);
  const auto echoed_group = api::echo_groups(group);
  CHECK(echoed_group.size() == 2 && echoed_group[0].has_value()
    && *echoed_group[0] == nested(42, 2, 82, 1) && !echoed_group[1]);

  api::Envelope invalid = nested(100, 2, 80, 1);
  auto before = invalid;
  CHECK(rejected([&] { (void)api::first(invalid); },
    MUTUAL_CHECKED_PARAMETER ".value was rejected by MutualCheckedRecords.plusOne"));
  CHECK(invalid == before);

  invalid = nested(40, 2, 100, 1); before = invalid;
  CHECK(rejected([&] { (void)api::first(invalid); },
    MUTUAL_CHECKED_PARAMETER ".next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"));
  CHECK(invalid == before);

  invalid = nested(40, 3, 80, 1); before = invalid;
  CHECK(rejected([&] { (void)api::first(invalid); },
    MUTUAL_CHECKED_PARAMETER ".mode is not below its Fin 3 bound"));
  CHECK(invalid == before);

  invalid = nested(0, 2, 80, 1); before = invalid;
  CHECK(rejected([&] { (void)api::first(invalid); },
    MUTUAL_CHECKED_PARAMETER " was rejected by MutualCheckedRecords.mkEnvelope"));
  CHECK(invalid == before);

  api::Envelope malformed{40, 2, api::StepMore{}};
  CHECK(rejected([&] { (void)api::first(malformed); }, "Invalid copied value"));
  CHECK((malformed == api::Envelope{40, 2, api::StepMore{}}));

  api::Envelope deep{40, 2, std::nullopt};
  for (unsigned i = 0; i < 48; ++i)
    deep = api::Envelope{40, 2, api::StepMore{std::move(deep)}};
  CHECK(rejected([&] { (void)api::first(deep); }, "Copied value limit exceeded"));
  CHECK(value == original);

  CHECK(api::first(value) == 41);
  std::printf("mutual-checked-record-ok:%u\n", checks);
  return 0;
}
