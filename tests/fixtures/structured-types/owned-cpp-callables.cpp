/* Execute generated C++ calls against real Lean, including callback lifetimes. */
#include "owned_aggregates.hpp"
#include <cstdio>
#include <cstdlib>
#include <new>
#include <sys/wait.h>

namespace api = lean_bridge::owned_aggregates;
static size_t checks;
static std::atomic<size_t> bridge_live{0};
static thread_local size_t allocations, fail_at;
[[gnu::noinline]] void *operator new(size_t count) {
  if (++allocations == fail_at) throw std::bad_alloc();
  if (void *value = std::malloc(count ? count : 1)) return value;
  throw std::bad_alloc();
}
[[gnu::noinline]] void operator delete(void *value) noexcept { std::free(value); }
[[gnu::noinline]] void operator delete(void *value, size_t) noexcept { std::free(value); }
extern "C" void *owned_test_allocate(size_t size) {
  void *value = std::malloc(size); if (value) ++bridge_live; return value;
}
extern "C" void owned_test_free(void *value) {
  if (value) { --bridge_live; std::free(value); }
}
extern "C" size_t owned_test_identities(void);
#define CHECK(value) do { ++checks; if (!(value)) { \
  std::fprintf(stderr, "owned C++ callable check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
} } while (0)
template<class Operation> static void rejects(Operation operation, owned_aggregates_status status) {
  bool failed = false;
  try { operation(); } catch (const api::Error& error) { failed = true; CHECK(error.status == status); }
  CHECK(failed);
}
struct Sentinel { int identity; };
static void test_malformed();
template<class Operation> static void preserves_exception(Operation operation) {
  auto expected = std::make_exception_ptr(Sentinel{871});
  bool caught = false;
  try { operation(expected); } catch (const Sentinel& error) {
    caught = true; CHECK(error.identity == 871); CHECK(std::current_exception() == expected);
  }
  CHECK(caught);
}
static api::Bundle sample(const api::Ticket& first, const api::Ticket& second) {
  return {first, second, {first, second, first}, {second, first}, {-(api::Int(1) << 1024) - 37, {0, 255, 19}}};
}
struct FaultResult { unsigned failures; size_t checks; };
static FaultResult test_values() {
  auto first = api::new_ticket(0, "zero"), second = api::new_ticket((api::Nat(1) << 4096) + 17, "large");
  CHECK(api::serial(first) == 0); CHECK(api::serial(second) == (api::Nat(1) << 4096) + 17);
  auto value = sample(first, second);
  for (unsigned i = 0; i < 16; ++i) {
    auto result = api::echo_record(value); CHECK(result == value);
    result.payload.bytes[0] = 37; CHECK(value.payload.bytes[0] == 0);
    result.primary.close(); CHECK(!value.primary.is_closed());
  }
  auto retained = first.retain(); first.close(); CHECK(api::serial(retained) == 0);
  rejects([] { (void)api::new_ticket(-1, "invalid"); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  rejects([] { (void)api::new_ticket(1, std::string("\xc0\x80", 2)); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  rejects([] { (void)api::serial(api::Ticket{}); }, OWNED_AGGREGATES_CLOSED);
  auto invalid = value; invalid.primary.close();
  rejects([&] { (void)api::echo_record(invalid); }, OWNED_AGGREGATES_CLOSED);
  std::thread foreign([&] { rejects([&] { (void)api::serial(retained); }, OWNED_AGGREGATES_WRONG_THREAD); });
  foreign.join(); CHECK(api::serial(retained) == 0);
  api::Tree tree = api::TreeBranch{{api::TreeLeaf{retained}, api::TreeBranch{{api::TreeLeaf{second}}}}};
  CHECK(api::callback_recursive(tree, [](const api::Tree& item) { return item; }) == tree);
  unsigned failures = 0; bool completed = false;
  const auto beforeFaults = checks;
  const auto baseline = bridge_live.load(), identities = owned_test_identities();
  for (size_t at = 1; at < 256; ++at) {
    allocations = 0; fail_at = at;
    try {
      auto result = api::callback_record(value, [](const api::Bundle& item) { return item; });
      fail_at = 0; CHECK(result == value); completed = true;
    } catch (const std::bad_alloc&) { fail_at = 0; ++failures; }
    api::detail::current_state()->drain();
    CHECK(bridge_live == baseline && owned_test_identities() == identities);
    CHECK(api::serial(retained) == 0);
    if (completed) break;
  }
  CHECK(completed && failures > 30);
  return {failures, checks - beforeFaults};
}
static void test_borrows() {
  auto value = sample(api::new_ticket(7, "first"), api::new_ticket(9, "second"));
  api::Ticket escaped, retained;
  auto result = api::callback_record(value, [&](const api::Bundle& input) {
    CHECK(api::serial(input.primary) == 7);
    escaped = input.primary; retained = input.primary.retain();
    CHECK(!escaped.is_closed());
    auto local = input; local.payload.bytes = {3, 2, 1};
    local.primary = api::new_ticket(23, "callback-local");
    return local;
  });
  CHECK(escaped.is_closed()); CHECK(api::serial(retained) == 7);
  rejects([&] { (void)api::serial(escaped); }, OWNED_AGGREGATES_CLOSED);
  rejects([&] { (void)escaped.retain(); }, OWNED_AGGREGATES_CLOSED);
  CHECK(api::serial(result.primary) == 23); CHECK(result.payload.bytes == std::vector<uint8_t>({3, 2, 1}));
  preserves_exception([&](std::exception_ptr error) {
    (void)api::callback_record(value, [&](const api::Bundle&) -> api::Bundle { std::rethrow_exception(error); });
  });
  bool nested = false;
  auto outer = api::callback_record(value, [&](const api::Bundle& input) {
    preserves_exception([&](std::exception_ptr error) {
      (void)api::callback_record(input, [&](const api::Bundle&) -> api::Bundle { std::rethrow_exception(error); });
    });
    nested = true; return api::echo_record(input);
  });
  CHECK(nested && outer == value);
  api::Ticket released;
  auto detached = api::callback_record(value, [&](const api::Bundle& input) {
    released = input.primary; value = {};
    return input;
  });
  CHECK(released.is_closed()); CHECK(api::serial(detached.primary) == 7);
}
#ifdef OWNED_FULL_SURFACE
static void test_exports() {
  auto first = api::new_ticket(51, std::string("nul\0\xf0\x9f\x8c\xb1", 8)), second = api::new_ticket(52, "second");
  CHECK(api::label(first) == std::string("nul\0\xf0\x9f\x8c\xb1", 8));
  CHECK(api::retain_ticket(first) == first);
  auto value = sample(first, second);
  CHECK(api::bundle(first, second, value.peers, value.history, value.payload) == value);
  CHECK(api::primary(value) == first && api::payload(value) == value.payload);
  CHECK(api::echo_array({first, second}) == std::vector<api::Ticket>({first, second}));
  CHECK(api::echo_array({}).empty() && api::echo_list({}).empty());
  CHECK(api::echo_list({second, first}) == std::vector<api::Ticket>({second, first}));
  CHECK(!api::echo_option(std::nullopt)); CHECK(api::echo_option(first) == first);
  api::Result<api::Bundle, api::Ticket> ok = api::Ok<api::Bundle>{value}, error = api::Err<api::Ticket>{first};
  CHECK(api::echo_result(ok) == ok && api::echo_result(error) == error);
  const auto tuple = std::make_pair(first, std::make_pair(std::optional<api::Ticket>{second}, value.payload));
  CHECK(api::echo_tuple(tuple) == tuple);
  for (const auto& item : std::vector<api::Choice>{api::ChoiceEmpty{}, api::ChoiceOne{first}, api::ChoicePair{first, second}, api::ChoiceMany{{second, first}}, api::ChoiceMany{}})
    CHECK(api::echo_variant(item) == item);
  CHECK(api::echo_alias(value) == value);
  api::TicketRow row{std::nullopt, first, second}; CHECK(api::echo_row(row) == row);
  const std::vector<std::vector<std::optional<api::Result<api::Bundle, api::Ticket>>>> nested{{}, {std::nullopt, ok, error}};
  CHECK(api::echo_nested(nested) == nested);
  api::Tree tree = api::TreeBranch{{api::TreeLeaf{first}, api::TreeBranch{{api::TreeLeaf{second}}}}};
  CHECK(api::echo_recursive(tree) == tree); CHECK(api::echo_recursive(api::TreeBranch{}) == api::Tree{api::TreeBranch{}});
  auto record = api::make_record(value), recordCopy = record.retain(); record.close();
  auto supplied = sample(second, first);
  CHECK(recordCopy(true, supplied) == value); CHECK(recordCopy(false, supplied) == supplied);
  auto recursive = api::make_recursive(tree); CHECK(recursive(true, api::TreeBranch{}) == tree);
  CHECK(recursive(false, api::TreeBranch{}) == api::Tree{api::TreeBranch{}});
  value = {}; first.close(); second.close();
  CHECK(api::serial(recordCopy(true, supplied).primary) == 51);
  api::Tree deep = api::TreeBranch{};
  for (unsigned i = 0; i < 130; ++i) deep = api::TreeBranch{{std::move(deep)}};
  rejects([&] { (void)api::echo_recursive(deep); }, OWNED_AGGREGATES_LIMIT);
}
#else
template<class F> concept CanFactory = requires(F&& function) { api::factory(std::forward<F>(function)); };
static_assert(!CanFactory<decltype([](const std::monostate&) { return api::Ticket{}; })>);
static_assert(!CanFactory<decltype(api::with_recovery([](const std::monostate&) { return api::Ticket{}; }, 1))>);
static_assert(CanFactory<decltype(api::with_recovery([](const std::monostate&) { return api::Ticket{}; }, api::Ticket{}))>);
static void test_exports() {
  auto first = api::new_ticket(51, "first"), second = api::new_ticket(52, "second");
  auto value = sample(first, second);
  auto identity = api::identity_closure({}); CHECK(identity(value) == value);
  auto retained = api::retain_callback(identity); identity.close(); CHECK(retained(value) == value);
  CHECK(api::callback_record(value, retained) == value);
  api::Ticket previous;
  unsigned invocations = 0;
  auto twice = api::twice(value, [&](const api::Bundle& item) {
    CHECK(previous.is_closed()); previous = item.primary; ++invocations;
    auto copy = item; ++copy.payload.count; return copy;
  });
  CHECK(invocations == 2 && previous.is_closed()); CHECK(twice.payload.count == value.payload.count + 2);
  invocations = 0;
  preserves_exception([&](std::exception_ptr error) {
    (void)api::repeatedly(value, [&](const api::Bundle&) -> api::Bundle { ++invocations; std::rethrow_exception(error); }, 10);
  });
  CHECK(invocations == 1);
  invocations = 0;
  rejects([&] {
    (void)api::repeatedly(value, [&](const api::Bundle& item) { ++invocations; return item; }, 10000);
  }, OWNED_AGGREGATES_LIMIT);
  CHECK(invocations > 1 && invocations < 10000);
  auto expired = api::retain_callback([](const api::Bundle& item) { return item; });
  rejects([&] { (void)expired(value); }, OWNED_AGGREGATES_CALLBACK_FAILED);
  auto made = api::factory(api::with_recovery([](const std::monostate&) { return api::new_ticket(77, "factory"); }, first));
  CHECK(api::serial(made) == 77);
  preserves_exception([&](std::exception_ptr error) {
    (void)api::factory(api::with_recovery([&](const std::monostate&) -> api::Ticket { std::rethrow_exception(error); }, first));
  });
  bool called = false;
  rejects([&] { (void)api::factory(api::with_recovery([&](const std::monostate&) { called = true; return first; }, api::Ticket{})); }, OWNED_AGGREGATES_CLOSED);
  CHECK(!called);
  const auto callback = api::with_recovery([&](const std::monostate&) { return second; }, first);
  CHECK(api::serial(api::factory(callback)) == 52);
  auto constructed = api::construct(first, [&](const api::Ticket& item) { return sample(item, second); });
  CHECK(constructed == value);
  preserves_exception([&](std::exception_ptr error) {
    (void)api::construct(first, [&](const api::Ticket&) -> api::Bundle { std::rethrow_exception(error); });
  });
  auto mutableCallback = [counter = 0](const api::Bundle& item) mutable { auto copy = item; copy.payload.count = ++counter; return copy; };
  CHECK(api::twice(value, mutableCallback).payload.count == 2);
}
#endif
int main() {
  auto state = api::detail::current_state();
  if (std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    state->close(); CHECK(bridge_live == 0 && owned_test_identities() == 0);
    std::puts("{\"cold\":true}"); return 0;
  }
  const auto baseline = bridge_live.load(), identities = owned_test_identities();
  const auto faults = test_values();
  CHECK(bridge_live == baseline && owned_test_identities() == identities);
  test_malformed(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  test_borrows(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  test_exports(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  auto value = sample(api::new_ticket(1, "last"), api::new_ticket(2, "last"));
  rejects([&] {
    (void)api::callback_record(value, [&](const api::Bundle& item) { state->close(); return item; });
  }, OWNED_AGGREGATES_CLOSED);
  CHECK(value.primary.is_closed()); value = {}; state->close();
  CHECK(bridge_live == 0 && owned_test_identities() == 0);
  std::printf("{\"checks\":%zu,\"allocationFailures\":%u,\"faultChecks\":%zu,\"live\":%zu,\"identities\":%zu}\n",
    checks, faults.failures, faults.checks, bridge_live.load(), owned_test_identities());
}
