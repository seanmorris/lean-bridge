#define INHERITED_CHECKED_RECORD_RESULT_ONLY
#define INHERITED_PARAMETER_PREFIX "value"
#include <inheritedcheckedrecords.hpp>
#include <cstdio>
#include <string>
#include <utility>

namespace api = lean_bridge::inheritedcheckedrecords;
using Nat = api::Nat;

#ifndef INHERITED_PARAMETER_PREFIX
#define INHERITED_PARAMETER_PREFIX "arg"
#endif

static unsigned checks;
static unsigned rejections;
static constexpr unsigned rounds = 256;

#define CHECK(test) do { \
  if (!(test)) { std::fprintf(stderr, "line %d: %s\n", __LINE__, #test); return 1; } \
  ++checks; \
} while (0)

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
template<class F> static bool rejected(F&& call, const std::string& expected) {
  try { call(); }
  catch (const api::Error& error) {
    if (error.status == INHERITEDCHECKEDRECORDS_STATUS_INVALID_ARGUMENT
        && error.code == INHERITEDCHECKEDRECORDS_ERROR_INVALID_ARGUMENT
        && std::string(error.what()) == expected) {
      ++rejections;
      return true;
    }
  }
  return false;
}

static std::string path(const std::string& suffix) {
  return std::string(INHERITED_PARAMETER_PREFIX) + suffix;
}
#endif

int main() {
  for (unsigned round = 0; round < rounds; ++round) {
    const Nat value = round;
    CHECK((api::produce(value) == api::Ticket{api::Span{value, value}, value + 1}));
    CHECK((api::produce_stamped(value)
      == api::Stamped{api::Ticket{api::Span{value, value}, value + 1}, 0}));
  }

#ifndef INHERITED_CHECKED_RECORD_RESULT_ONLY
  const api::Ticket first{api::Span{2, 3}, 4};
  CHECK(api::first(first) == 9);
  CHECK(api::normalized(api::Ticket{api::Span{4, 1}, 0}) == 11);
  CHECK(api::pair(first, api::Ticket{api::Span{4, 1}, 999}) == 10);
  CHECK(api::aliased(api::TicketAlias{api::Span{4, 1}, 4}) == 5);
  CHECK(api::nested(api::Stamped{api::Ticket{api::Span{1, 2}, 4}, 3}) == 7);
  CHECK((api::echo(api::Ticket{api::Span{1, 2}, 0})
    == api::Ticket{api::Span{1, 2}, 3}));

  api::Ticket invalid{api::Span{4, 1}, 5};
  auto before = invalid;
  CHECK(rejected([&] { api::first(invalid); }, path("0.toSpan was rejected by InheritedCheckedRecords.mkSpan"))
    && invalid == before);
  invalid = api::Ticket{api::Span{1, 2}, 0}; before = invalid;
  CHECK(rejected([&] { api::first(invalid); }, path("0.word was rejected by InheritedCheckedRecords.mkWord"))
    && invalid == before);
  invalid = api::Ticket{api::Span{1, 5}, 3}; before = invalid;
  CHECK(rejected([&] { api::first(invalid); }, path("0 was rejected by InheritedCheckedRecords.mkTicket"))
    && invalid == before);
  api::Stamped stamped{api::Ticket{api::Span{1, 2}, 9}, 8};
  auto stampedBefore = stamped;
  CHECK(rejected([&] { api::nested(stamped); }, path("0.mark is not below its Fin 8 bound"))
    && stamped == stampedBefore);
  stamped = api::Stamped{api::Ticket{api::Span{1, 2}, 4}, 5};
  stampedBefore = stamped;
  CHECK(rejected([&] { api::nested(stamped); }, path("0 was rejected by InheritedCheckedRecords.mkStamped"))
    && stamped == stampedBefore);
  api::TicketAlias alias{api::Span{1, 5}, 3};
  const auto aliasBefore = alias;
  CHECK(rejected([&] { api::aliased(alias); }, path("0 was rejected by InheritedCheckedRecords.mkTicket"))
    && alias == aliasBefore);

  for (unsigned round = 0; round < rounds; ++round) {
    const Nat n = round + 10;
    const api::Ticket valid{api::Span{n, n + 1}, n + 2};
    CHECK(api::first(valid) == 3 * n + 3);
    CHECK(api::normalized(api::Ticket{api::Span{n + 2, n}, 0}) == 4 * n + 5);
    CHECK(api::pair(valid, api::Ticket{api::Span{n + 2, n}, 0}) == 3 * n + 5);
    CHECK(api::aliased(api::TicketAlias{api::Span{n + 2, n}, 2 * n + 1}) == 2 * n + 2);
    const Nat mark = round % 8;
    CHECK(api::nested(api::Stamped{
      api::Ticket{api::Span{mark, mark}, mark + 1}, mark
    }) == 2 * mark + 1);

    invalid = api::Ticket{api::Span{n + 1, n}, n + 2}; before = invalid;
    CHECK(rejected([&] { api::first(invalid); }, path("0.toSpan was rejected by InheritedCheckedRecords.mkSpan"))
      && invalid == before);
    invalid = api::Ticket{api::Span{0, 1}, 0}; before = invalid;
    CHECK(rejected([&] { api::first(invalid); }, path("0.word was rejected by InheritedCheckedRecords.mkWord"))
      && invalid == before);
    invalid = api::Ticket{api::Span{0, n + 2}, n + 1}; before = invalid;
    CHECK(rejected([&] { api::first(invalid); }, path("0 was rejected by InheritedCheckedRecords.mkTicket"))
      && invalid == before);
    stamped = api::Stamped{api::Ticket{api::Span{0, 9}, 9}, 8};
    stampedBefore = stamped;
    CHECK(rejected([&] { api::nested(stamped); }, path("0.mark is not below its Fin 8 bound"))
      && stamped == stampedBefore);
    stamped = api::Stamped{api::Ticket{api::Span{0, 6}, 6}, 7};
    stampedBefore = stamped;
    CHECK(rejected([&] { api::nested(stamped); }, path("0 was rejected by InheritedCheckedRecords.mkStamped"))
      && stamped == stampedBefore);
    CHECK(api::first(valid) == 3 * n + 3);
  }
#endif

  std::printf("{\"checks\":%u,\"rejections\":%u,\"rounds\":%u}\n"
    , checks, rejections, rounds);
}
