#include "defaults.hpp"

#include <cassert>
#include <cstdint>
#include <cstdio>
#include <optional>
#include <string>
#include <variant>

namespace api = lean_bridge::defaults;
static unsigned checks;
#define CHECK(condition) do { assert(condition); ++checks; } while (0)

int main() {
  CHECK(api::word() == 7);
  CHECK(api::word(7) == 7);
  CHECK(api::word(11) == 11);

  const api::Nat large{"184467440737095516160"};
  CHECK(api::natural() == large);
  CHECK(api::natural(large) == large);
  CHECK(api::natural(api::Nat{11}) == 11);

  CHECK(api::text() == "Lean\nBridge");
  CHECK(api::text("Lean\nBridge") == "Lean\nBridge");
  CHECK(api::text("other") == "other");

  CHECK(api::character() == U'λ');
  CHECK(api::character(U'λ') == U'λ');
  CHECK(api::character(U'猫') == U'猫');

  CHECK(api::maybe() == std::nullopt);
  CHECK(api::maybe(std::nullopt) == std::nullopt);
  CHECK(api::maybe(std::optional<std::uint32_t>{11}) == 11);
  CHECK(api::present() == 9);
  CHECK(api::present(std::optional<std::uint32_t>{9}) == 9);
  CHECK(api::present(std::nullopt) == std::nullopt);

  api::unit_value();
  ++checks;
  api::unit_value(std::monostate{});
  ++checks;
  try {
    (void)api::natural(api::Nat{-1});
    assert(false);
  } catch (const api::Error& error) {
    CHECK(error.status == DEFAULTS_STATUS_INVALID_ARGUMENT);
  }

  std::printf("optional-parameter-cpp:%u\n", checks);
  return 0;
}
