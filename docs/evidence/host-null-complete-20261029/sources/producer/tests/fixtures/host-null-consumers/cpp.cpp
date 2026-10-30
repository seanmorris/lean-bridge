/* Independent installed C++ consumer using only generated public values. */
#include "host_null_demo.hpp"
#include <cassert>
#include <cstdint>
#include <iostream>
#include <optional>

namespace api = lean_bridge::host_null_demo;
static unsigned checks;
#define CHECK(value) do { ++checks; assert(value); } while (0)

int main() {
  using direct = std::optional<std::uint32_t>;
  using nested = std::optional<direct>;
  CHECK(api::echo(std::nullopt) == std::nullopt);
  CHECK(api::echo(direct{42}) == direct{42});
  for (const nested value : {nested{}, nested{direct{}}, nested{direct{42}}})
    CHECK(api::nullable_option(value) == value);
  for (const nested value : {nested{}, nested{direct{}}, nested{direct{42}}})
    CHECK(api::optional_nullable(value) == value);

  const api::Packet packet{std::nullopt, nested{direct{}}, nested{direct{}}};
  CHECK(api::echo_packet(packet) == packet);
  unsigned callback_calls = 0;
  CHECK(api::call_host(std::nullopt, [&](direct value) -> nested {
    ++callback_calls; CHECK(!value); return direct{};
  }) == nested{direct{}});
  CHECK(api::call_host(direct{42}, [&](direct value) -> nested {
    ++callback_calls; CHECK(value == direct{42}); return direct{43};
  }) == nested{direct{43}});
  CHECK(callback_calls == 2);

  auto closure = api::make_closure(nested{direct{77}});
  CHECK(!closure.is_closed());
  CHECK(closure.call(std::nullopt) == nested{direct{77}});
  CHECK(closure(direct{2}) == nested{direct{77}});
  closure.close(); closure.close(); CHECK(closure.is_closed());
  bool rejected = false;
  try { (void)closure.call(std::nullopt); }
  catch (const api::Error&) { rejected = true; }
  CHECK(rejected);
  std::cout << "host-null-cpp:" << checks << '\n';
}
