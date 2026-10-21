#include <zeropayloadcheckedrecords.hpp>
#include <iostream>
#include <string>
#include <type_traits>
#include <utility>

using namespace lean_bridge::zeropayloadcheckedrecords;

static unsigned checks;
static unsigned calls;
static unsigned rejections;
static unsigned recoveries;
#define CHECK(test) do { if (!(test)) { std::cerr << "failed at line " << __LINE__ << ": " #test "\n"; return 1; } ++checks; } while (0)

static_assert(sizeof(Witness) >= 1);
static_assert(sizeof(Marker) >= 1);
static_assert(!std::is_same_v<Witness, Marker>);
static_assert(std::is_empty_v<Witness> && std::is_empty_v<Marker>);

template<class Call>
static bool refused(Call&& call, const std::string& expected) {
  ++calls;
  try { std::forward<Call>(call)(); }
  catch (const Error& error) {
    return error.status == ZEROPAYLOADCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
      && error.code == ZEROPAYLOADCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
      && error.what() == expected;
  }
  return false;
}

int main() {
  Witness witness{}; Token token{}; Marker marker{};
  ++calls; CHECK(witness_count(witness) == 1 && witness == Witness{});
  CHECK(refused([&] { (void)absent_count(witness); },
    "value0 was rejected by ZeroPayloadCheckedRecords.mkAbsent")
    && witness == Witness{});
  ++rejections;
  ++calls; CHECK(witness_count(witness) == 1 && witness == Witness{});
  ++recoveries;
  ++calls; token_tag(token); CHECK(token == Token{});
  ++calls; CHECK(marker_count(marker) == 0 && marker == Marker{});
  ++calls; CHECK(mark_count(MarkBlank{}) == 0);
  ++calls; CHECK(mark_count(MarkMarked{Witness{}}) == 1);
  ++calls; CHECK(produce_witness() == Witness{});
  ++calls; CHECK(produce_token() == Token{});
  ++calls; CHECK(witnesses(3) == std::vector<Witness>(3));
  ++calls; CHECK(maybe_witness(true) == std::optional<Witness>{Witness{}});
  ++calls; CHECK(maybe_witness(false) == std::nullopt);
  ++calls; CHECK(produce_marker() == Marker{});
  ++calls; CHECK(produce_mark(false) == Mark{MarkBlank{}});
  ++calls; CHECK(produce_mark(true) == Mark{MarkMarked{Witness{}}});
  CHECK(calls == 15 && rejections == 1 && recoveries == 1);
  std::cout << "{\"calls\":" << calls << ",\"checks\":" << checks
    << ",\"recoveries\":" << recoveries << ",\"rejections\":"
    << rejections << "}\n";
  return 0;
}
