#include "directprooferasure.hpp"

#include <cassert>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <type_traits>

namespace api = lean_bridge::directprooferasure;
static_assert(std::is_same_v<decltype(&api::keep), std::uint32_t (*)(std::uint32_t)>);

static unsigned checks;
#define CHECK(condition) do { assert(condition); ++checks; } while (0)

int main() {
  for (std::uint32_t value = 0; value < 1000; ++value) {
    CHECK(api::keep(value) == value);
  }
  for (const std::uint32_t value : {
    UINT32_C(0), UINT32_C(1), UINT32_C(42), UINT32_C(0x80000000),
    std::numeric_limits<std::uint32_t>::max()
  }) {
    CHECK(api::keep(value) == value);
  }
  std::printf("direct-proof-cpp:%u\n", checks);
  return 0;
}
