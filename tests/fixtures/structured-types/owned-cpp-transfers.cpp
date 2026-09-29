/* Exercise explicit C++ moves against real Lean, including both allocators. */
#include "owned_aggregates.hpp"
#include <cstdio>
#include <cstdlib>
#include <new>
#include <sys/wait.h>

namespace api = lean_bridge::owned_aggregates;
static size_t checks;
#ifndef OWNED_TRANSFER_INSTALLED
static std::atomic<size_t> bridge_live{0};
static thread_local size_t cpp_allocations, cpp_fail, bridge_allocations, bridge_fail;
static thread_local size_t handoffs;
extern "C" void owned_test_handoff(void) { ++handoffs; }
[[gnu::noinline]] void *operator new(size_t count) {
  if (++cpp_allocations == cpp_fail) throw std::bad_alloc();
  if (void *value = std::malloc(count ? count : 1)) return value;
  throw std::bad_alloc();
}
[[gnu::noinline]] void operator delete(void *value) noexcept { std::free(value); }
[[gnu::noinline]] void operator delete(void *value, size_t) noexcept { std::free(value); }
extern "C" void *owned_test_allocate(size_t count) {
  if (++bridge_allocations == bridge_fail) return nullptr;
  void *value = std::malloc(count); if (value) ++bridge_live; return value;
}
extern "C" void owned_test_free(void *value) {
  if (value) { --bridge_live; std::free(value); }
}
extern "C" size_t owned_test_identities(void);
#endif
#define CHECK(value) do { ++checks; if (!(value)) { \
  std::fprintf(stderr, "owned C++ transfer check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
} } while (0)
template<class Operation> static void rejects(Operation operation, owned_aggregates_status status) {
  bool failed = false;
  try { operation(); } catch (const api::Error& error) { failed = true; CHECK(error.status == status); }
  CHECK(failed);
}
template<class T> concept CanTransfer = requires(T&& input) { api::retain_ticket(std::forward<T>(input)); };
static_assert(CanTransfer<api::Ticket>);
static_assert(!CanTransfer<api::Ticket&> && !CanTransfer<const api::Ticket>);
static api::Bundle sample() {
  auto first = api::new_ticket(7, "first"), second = api::new_ticket(9, "second");
  return {first, second, {first, second, first}, {second, first}, {-(api::Int(1) << 1024) - 37, {0, 255, 19}}};
}
static void test_owners() {
#ifndef OWNED_TRANSFER_INSTALLED
  const auto initial = owned_test_identities();
  {
    auto source = api::new_ticket(16, "released lease");
    auto output = api::retain_ticket(std::move(source)); output.close();
    CHECK(source.is_closed() && owned_test_identities() == initial);
  }
#endif
  auto first = api::new_ticket(17, "input"), alias = first, kept = first.retain();
  auto moved = api::retain_ticket(std::move(first));
  CHECK(first.is_closed() && alias.is_closed());
  CHECK(api::serial(moved) == 17 && api::serial(kept) == 17);
  rejects([&] { (void)api::serial(alias); }, OWNED_AGGREGATES_CLOSED);
  auto value = sample(), old = value;
  auto independent = value.primary.retain(); const auto payload = value.payload;
  auto result = api::echo_record(std::move(value));
  CHECK(value.primary.is_closed() && value.spare->is_closed() && old.peers[2].is_closed());
  CHECK(api::serial(result.primary) == 7 && api::serial(*result.spare) == 9);
  CHECK(result.payload == payload && api::serial(independent) == 7);
  auto one = result.primary, sibling = *result.spare, siblingKept = sibling.retain();
  auto detached = api::retain_ticket(std::move(one));
  CHECK(one.is_closed() && sibling.is_closed() && result.primary.is_closed());
  CHECK(api::serial(detached) == 7 && api::serial(siblingKept) == 9);
  auto invalid = sample(); invalid.spare = api::Ticket{};
  rejects([&] { (void)api::echo_record(std::move(invalid)); }, OWNED_AGGREGATES_CLOSED);
  CHECK(!invalid.primary.is_closed() && api::serial(invalid.primary) == 7);
  auto duplicate = api::new_ticket(23, "duplicate"); std::vector<api::Ticket> repeated{duplicate};
  rejects([&] { (void)api::bundle(std::move(duplicate), {}, std::move(repeated), {}, {}); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!duplicate.is_closed() && !repeated[0].is_closed()); CHECK(api::serial(duplicate) == 23);
  auto primary = api::new_ticket(31, "primary"); auto peer = api::new_ticket(32, "peer");
  std::optional<api::Ticket> borrowed = primary; std::vector<api::Ticket> peers{peer}, history{peer};
  auto bundled = api::bundle(std::move(primary), borrowed, std::move(peers), history, {});
  CHECK(primary.is_closed() && peer.is_closed() && borrowed->is_closed() && history[0].is_closed());
  CHECK(api::serial(bundled.primary) == 31 && api::serial(bundled.peers[0]) == 32);
}
static void test_shapes() {
  auto arrayTicket = api::new_ticket(41, "array"); std::vector<api::Ticket> array{arrayTicket, arrayTicket};
  auto arrayOut = api::echo_array(std::move(array)); CHECK(arrayOut.size() == 2 && arrayTicket.is_closed());
  CHECK(api::serial(arrayOut[1]) == 41); CHECK(api::echo_array({}).empty());
  auto listTicket = api::new_ticket(42, "list"); std::vector<api::Ticket> list{listTicket};
  CHECK(api::serial(api::echo_list(std::move(list))[0]) == 42 && listTicket.is_closed());
  CHECK(api::echo_list({}).empty()); CHECK(!api::echo_option(std::nullopt));
  auto optionTicket = api::new_ticket(43, "option"); std::optional<api::Ticket> option{optionTicket};
  CHECK(api::serial(*api::echo_option(std::move(option))) == 43 && optionTicket.is_closed());
  api::Result<api::Bundle, api::Ticket> ok = api::Ok<api::Bundle>{sample()};
  auto okOut = api::echo_result(std::move(ok)); CHECK(api::serial(std::get<0>(okOut).value.primary) == 7);
  CHECK(std::get<0>(ok).value.primary.is_closed());
  auto errorTicket = api::new_ticket(44, "error"); api::Result<api::Bundle, api::Ticket> error = api::Err<api::Ticket>{errorTicket};
  CHECK(api::serial(std::get<1>(api::echo_result(std::move(error))).value) == 44 && errorTicket.is_closed());
  auto tupleTicket = api::new_ticket(45, "tuple");
  auto tuple = std::make_pair(tupleTicket, std::make_pair(std::optional<api::Ticket>{tupleTicket}, api::Payload{}));
  CHECK(api::serial(api::echo_tuple(std::move(tuple)).first) == 45 && tupleTicket.is_closed());
  for (unsigned branch = 0; branch < 5; ++branch) {
    auto ticket = api::new_ticket(46 + branch, "variant"); api::Choice value = api::ChoiceEmpty{};
    if (branch == 1) value = api::ChoiceOne{ticket};
    if (branch == 2) value = api::ChoicePair{ticket, ticket};
    if (branch == 3) value = api::ChoiceMany{{ticket, ticket}};
    if (branch == 4) value = api::ChoiceMany{};
    auto result = api::echo_variant(std::move(value)); CHECK(result.value.index() == (branch == 4 ? 3 : branch));
    CHECK(ticket.is_closed() == (branch > 0 && branch < 4));
  }
  auto alias = sample(); CHECK(api::serial(api::echo_alias(std::move(alias)).primary) == 7 && alias.primary.is_closed());
  auto rowTicket = api::new_ticket(51, "row"); api::TicketRow row{std::nullopt, rowTicket};
  auto rowOut = api::echo_row(std::move(row)); CHECK(!rowOut[0] && api::serial(*rowOut[1]) == 51 && rowTicket.is_closed());
  using Nested = std::vector<std::vector<std::optional<api::Result<api::Bundle, api::Ticket>>>>;
  auto nestedTicket = api::new_ticket(52, "nested"); auto nestedBundle = sample();
  Nested nested{{}, {std::nullopt, api::Ok<api::Bundle>{nestedBundle}, api::Err<api::Ticket>{nestedTicket}}};
  auto nestedOut = api::echo_nested(std::move(nested));
  CHECK(nestedOut[0].empty() && !nestedOut[1][0] && nestedBundle.primary.is_closed() && nestedTicket.is_closed());
  CHECK(api::serial(std::get<0>(*nestedOut[1][1]).value.primary) == 7);
  CHECK(api::serial(std::get<1>(*nestedOut[1][2]).value) == 52);
  auto treeTicket = api::new_ticket(53, "tree"); api::Tree tree = api::TreeLeaf{treeTicket};
  for (unsigned i = 0; i < 40; ++i) tree = api::TreeBranch{{std::move(tree)}};
  auto deep = api::echo_recursive(std::move(tree)); CHECK(treeTicket.is_closed());
  auto treeOut = api::callback_recursive(std::move(deep), [](const api::Tree& input) { return input; });
  CHECK(treeOut.value.index() == 1); CHECK(api::echo_recursive(api::TreeBranch{}).value.index() == 1);
  const api::Tree *cursor = &treeOut;
  for (unsigned i = 0; i < 40; ++i) {
    CHECK(cursor->value.index() == 1);
    const auto& children = std::get<api::TreeBranch>(cursor->value).children;
    CHECK(children.size() == 1); cursor = &children[0];
  }
  CHECK(cursor->value.index() == 0);
  CHECK(api::serial(std::get<api::TreeLeaf>(cursor->value).ticket) == 53);
  auto tooDeepTicket = api::new_ticket(54, "deep"); api::Tree tooDeep = api::TreeLeaf{tooDeepTicket};
  for (unsigned i = 0; i < 130; ++i) tooDeep = api::TreeBranch{{std::move(tooDeep)}};
  rejects([&] { (void)api::echo_recursive(std::move(tooDeep)); }, OWNED_AGGREGATES_LIMIT);
  CHECK(api::serial(tooDeepTicket) == 54);
}
struct Sentinel { unsigned value; };
static void test_callbacks() {
  auto input = sample(); api::Ticket escaped, retained; bool invoked = false;
  auto result = api::callback_record(std::move(input), [&](const api::Bundle& borrowed) {
    invoked = true; CHECK(input.primary.is_closed() && input.spare->is_closed());
    rejects([&] { (void)api::serial(input.primary); }, OWNED_AGGREGATES_CLOSED);
    CHECK(api::serial(borrowed.primary) == 7); escaped = borrowed.primary; retained = borrowed.primary.retain();
    auto copy = borrowed;
    rejects([&] { (void)api::echo_record(std::move(copy)); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
    CHECK(api::serial(copy.primary) == 7);
    auto local = sample(); auto nested = api::callback_record(std::move(local), [](const api::Bundle& value) { return value; });
    CHECK(local.primary.is_closed() && api::serial(nested.primary) == 7); return borrowed;
  });
  CHECK(invoked && escaped.is_closed() && api::serial(retained) == 7 && api::serial(result.primary) == 7);
  auto failed = sample(); const auto expected = std::make_exception_ptr(Sentinel{87}); bool caught = false;
  try {
    (void)api::callback_record(std::move(failed), [&](const api::Bundle&) -> api::Bundle {
      CHECK(failed.primary.is_closed()); std::rethrow_exception(expected);
    });
  } catch (const Sentinel& error) { caught = true; CHECK(error.value == 87 && std::current_exception() == expected); }
  CHECK(caught && failed.primary.is_closed());
  auto captured = sample(), supplied = sample(); auto factory = api::make_record(std::move(captured));
  CHECK(captured.primary.is_closed()); CHECK(api::serial(factory(true, supplied).primary) == 7);
  auto callback = api::new_record_callback(), independent = callback.retain();
  auto moved = api::transfer_callback(std::move(callback)); CHECK(callback.is_closed());
  CHECK(api::serial(moved(supplied).primary) == 7 && api::serial(independent(supplied).primary) == 7);
  auto ticket = api::new_ticket(61, "closure tree"); api::Tree tree = api::TreeLeaf{ticket};
  auto recursive = api::make_recursive(std::move(tree)); CHECK(ticket.is_closed());
  CHECK(recursive(true, api::TreeBranch{}).value.index() == 0);
}
static void test_affinity() {
  auto ticket = api::new_ticket(71, "thread"); bool rejected = false;
  std::thread foreign([&] {
    try { (void)api::retain_ticket(std::move(ticket)); }
    catch (const api::Error& error) { rejected = error.status == OWNED_AGGREGATES_WRONG_THREAD; }
  });
  foreign.join(); CHECK(rejected && api::serial(ticket) == 71);
  const auto child = ::fork(); CHECK(child >= 0);
  if (!child) {
    try { (void)api::retain_ticket(std::move(ticket)); }
    catch (const api::Error& error) { ::_exit(error.status == OWNED_AGGREGATES_WRONG_PROCESS ? 0 : 2); }
    ::_exit(3);
  }
  int status = 0; CHECK(::waitpid(child, &status, 0) == child && WIFEXITED(status) && WEXITSTATUS(status) == 0);
  CHECK(api::serial(ticket) == 71);
  std::atomic<bool> observing{true};
  std::thread observer([&] { while (observing.load()) (void)ticket.is_closed(); });
  auto transferred = api::retain_ticket(std::move(ticket)); observing.store(false); observer.join();
  CHECK(ticket.is_closed() && api::serial(transferred) == 71);
}
#ifndef OWNED_TRANSFER_INSTALLED
struct Faults { size_t before = 0, after = 0, checks = 0; };
static Faults test_faults(bool native, bool multiple) {
  Faults faults; const auto initial = checks;
  const auto baseline = bridge_live.load(), identities = owned_test_identities();
  bool complete = false;
  for (size_t at = 1; at < 4096 && !complete; ++at) {
    {
      auto value = sample(); auto independent = value.primary.retain(), independentSecond = value.spare->retain();
      const auto handoffsBefore = handoffs;
      cpp_allocations = bridge_allocations = 0;
      if (native) bridge_fail = at; else cpp_fail = at;
      bool failed = false;
      try {
        auto invoke = [&] {
          if (multiple) {
            auto primary = value.primary; std::vector<api::Ticket> peers{*value.spare};
            return api::bundle(std::move(primary), value.primary, std::move(peers), value.history, value.payload);
          }
          return api::callback_record(std::move(value), [&](const api::Bundle& input) {
            CHECK(value.primary.is_closed()); return input;
          });
        };
        auto result = invoke();
        cpp_fail = bridge_fail = 0; CHECK(api::serial(result.primary) == 7); complete = true;
      } catch (const std::bad_alloc&) { cpp_fail = bridge_fail = 0; failed = true; }
      catch (const api::Error& error) { cpp_fail = bridge_fail = 0; CHECK(error.status == OWNED_AGGREGATES_ALLOCATION_FAILED); failed = true; }
      CHECK(handoffs - handoffsBefore <= 1);
      CHECK(value.primary.is_closed() == (handoffs != handoffsBefore));
      CHECK(value.spare->is_closed() == value.primary.is_closed());
      if (failed) {
        if (value.primary.is_closed()) ++faults.after;
        else { ++faults.before; CHECK(api::serial(value.primary) == 7); }
      }
      CHECK(api::serial(independent) == 7 && api::serial(independentSecond) == 9);
    }
    api::detail::current_state()->drain();
    CHECK(bridge_live == baseline && owned_test_identities() == identities);
  }
  CHECK(complete && faults.before > 0 && faults.after > 0); faults.checks = checks - initial; return faults;
}
#endif
int main() {
  auto state = api::detail::current_state();
  if (std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
#ifdef OWNED_TRANSFER_INSTALLED
    state->close(); std::puts("cold"); return 0;
#else
    state->close(); CHECK(bridge_live == 0 && owned_test_identities() == 0); std::puts("{\"cold\":true}"); return 0;
#endif
  }
#ifdef OWNED_TRANSFER_INSTALLED
  test_owners(); test_shapes(); test_callbacks(); test_affinity();
#else
  const auto baseline = bridge_live.load(), identities = owned_test_identities();
  test_owners(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  test_shapes(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  test_callbacks(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  test_affinity(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  const auto cpp = test_faults(false, false), native = test_faults(true, false);
  const auto multiCpp = test_faults(false, true), multiNative = test_faults(true, true);
#endif
  auto value = sample();
  rejects([&] { (void)api::callback_record(std::move(value), [&](const api::Bundle& input) { state->close(); return input; }); }, OWNED_AGGREGATES_CLOSED);
  CHECK(value.primary.is_closed()); value = {}; state->close();
#ifdef OWNED_TRANSFER_INSTALLED
  std::printf("owned-cpp-transfers-installed:%zu\n", checks);
#else
  CHECK(bridge_live == 0 && owned_test_identities() == 0);
  std::printf("{\"checks\":%zu,\"cppBefore\":%zu,\"cppAfter\":%zu,\"nativeBefore\":%zu,\"nativeAfter\":%zu,\"multiCppBefore\":%zu,\"multiCppAfter\":%zu,\"multiNativeBefore\":%zu,\"multiNativeAfter\":%zu,\"faultChecks\":%zu,\"live\":%zu,\"identities\":%zu}\n",
    checks, cpp.before, cpp.after, native.before, native.after, multiCpp.before, multiCpp.after, multiNative.before, multiNative.after,
    cpp.checks + native.checks + multiCpp.checks + multiNative.checks, bridge_live.load(), owned_test_identities());
#endif
}
