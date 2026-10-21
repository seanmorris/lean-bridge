#include <zeropayloadcheckedrecords.hpp>
#include <iostream>
#include <type_traits>

using namespace lean_bridge::zeropayloadcheckedrecords;

static unsigned checks;
static unsigned calls;
#define CHECK(test) do { if (!(test)) { std::cerr << "failed at line " << __LINE__ << ": " #test "\n"; return 1; } ++checks; } while (0)

static_assert(sizeof(Witness) >= 1);
static_assert(!std::is_same_v<Witness, Marker>);
static_assert(std::is_empty_v<Witness> && std::is_empty_v<Marker>);

int main() {
  ++calls; CHECK(produce_witness() == Witness{});
  ++calls; CHECK(produce_token() == Token{});
  ++calls; CHECK(witnesses(3) == std::vector<Witness>(3));
  ++calls; CHECK(maybe_witness(true) == std::optional<Witness>{Witness{}});
  ++calls; CHECK(maybe_witness(false) == std::nullopt);
  ++calls; CHECK(produce_marker() == Marker{});
  ++calls; CHECK(produce_mark(false) == Mark{MarkBlank{}});
  ++calls; CHECK(produce_mark(true) == Mark{MarkMarked{Witness{}}});
  CHECK(calls == 8);
  std::cout << "{\"calls\":" << calls << ",\"checks\":" << checks
    << ",\"recoveries\":0,\"rejections\":0}\n";
  return 0;
}
