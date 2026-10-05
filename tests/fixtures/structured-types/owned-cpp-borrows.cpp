/* Public C++ whole-value lifetime checks, independent of generated internals. */
#include "owned_aggregates.hpp"
#include <cstdio>
#include <cstdlib>
#include <new>
#include <source_location>
#include <sys/wait.h>

namespace api = lean_bridge::owned_aggregates;
static size_t checks;
#ifndef OWNED_BORROW_INSTALLED
static std::atomic<size_t> bridge_live{0};
static size_t initial_live, initial_identities;
static thread_local size_t cpp_allocations, cpp_fail, bridge_allocations, bridge_fail;
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
  std::fprintf(stderr, "owned C++ borrow check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
} } while (0)
template<class Operation> static void rejects(Operation operation, owned_aggregates_status status,
    const std::source_location where = std::source_location::current()) {
  bool failed = false;
  try { operation(); } catch (const api::Error& error) {
    failed = true;
    if (error.status != status) std::fprintf(stderr, "rejection at %s:%u: expected %d, got %d\n", where.file_name(), where.line(), status, error.status);
    CHECK(error.status == status);
  }
  CHECK(failed);
}
template<class T> concept CanTransfer = requires(T&& input) { api::transfer_ticket(std::forward<T>(input)); };
static_assert(CanTransfer<api::Value<api::Ticket>>);
static_assert(!CanTransfer<api::Value<api::Ticket>&> && !CanTransfer<api::Ticket>);
template<class T> concept CanAnchor = requires(const T& input) { api::echo_array(input); };
static_assert(CanAnchor<api::Value<std::vector<api::Ticket>>>);
static_assert(!CanAnchor<std::vector<api::Ticket>>);
static_assert(std::is_nothrow_copy_assignable_v<api::Value<api::Bundle>>);

static api::Bundle sample() {
  auto first = api::new_ticket(7, "first"), second = api::new_ticket(9, "second");
  return {first.get(), second.get(), {first.get(), second.get(), first.get()}, {second.get(), first.get()},
    {-(api::Int(1) << 1024) - 37, {0, 255, 19}}};
}
static void test_owners() {
  auto root = api::new_ticket(17, "owner"), alias = root, retained = root.retain();
  auto borrowed = api::retain_ticket(root), descendant = api::retain_ticket(borrowed);
  CHECK(borrowed == root && descendant == retained);
  auto independent = descendant.retain(); auto leaf = descendant.get();
  root.close(); CHECK(!borrowed.is_closed() && api::serial(alias) == 17);
  alias.close(); CHECK(borrowed.is_closed() && descendant.is_closed() && leaf.is_closed());
  rejects([&] { (void)api::serial(leaf); }, OWNED_AGGREGATES_CLOSED);
  rejects([&] { (void)borrowed.retain(); }, OWNED_AGGREGATES_CLOSED);
  rejects([&] { (void)(borrowed == retained); }, OWNED_AGGREGATES_CLOSED);
  CHECK(api::serial(retained) == 17 && api::serial(independent) == 17);
  auto value = api::copy_value(sample());
  auto view = api::echo_record(value), copied = view.retain();
  CHECK(view == value && api::primary(view).get() == value->primary);
  CHECK(api::payload(view) == value->payload);
  value.close(); CHECK(view.is_closed()); CHECK(api::serial(copied->primary) == 7);
  for (unsigned i = 0; i < 64; ++i) {
    auto fresh = api::new_ticket(i, "reuse");
    CHECK(api::serial(fresh) == i && borrowed.is_closed());
  }
}
template<class T, class Echo> static void shape(const T& raw, Echo echo) {
  auto root = api::copy_value(raw); CHECK(!root.is_closed());
  auto view = echo(root); CHECK(!view.is_closed()); auto independent = view.retain();
  CHECK(view.get() == raw && independent == root);
  auto descendant = echo(view);
  root.close(); CHECK(view.is_closed() && descendant.is_closed());
  rejects([&] { (void)view.get(); }, OWNED_AGGREGATES_CLOSED);
  CHECK(independent.get() == raw);
}
static void test_shapes() {
  auto value = sample(); auto ticket = value.primary;
  shape(std::vector<api::Ticket>{}, api::echo_array);
  shape(std::vector<api::Ticket>{ticket, ticket}, api::echo_array);
  shape(std::vector<api::Ticket>{}, api::echo_list);
  shape(std::vector<api::Ticket>{ticket}, api::echo_list);
  shape(std::optional<api::Ticket>{}, api::echo_option);
  shape(std::optional<api::Ticket>{ticket}, api::echo_option);
  shape(api::Result<api::Bundle, api::Ticket>{api::Ok<api::Bundle>{value}}, api::echo_result);
  shape(api::Result<api::Bundle, api::Ticket>{api::Err<api::Ticket>{ticket}}, api::echo_result);
  shape(std::make_pair(ticket, std::make_pair(std::optional<api::Ticket>{ticket}, value.payload)), api::echo_tuple);
  shape(value, api::echo_record); shape(value, api::echo_alias);
  for (const api::Choice& choice : std::vector<api::Choice>{api::ChoiceEmpty{}, api::ChoiceOne{ticket}, api::ChoicePair{ticket, ticket}, api::ChoiceMany{{ticket, ticket}}, api::ChoiceMany{}})
    shape(choice, api::echo_variant);
  shape(api::TicketRow{std::nullopt, ticket}, api::echo_row); shape(api::TicketRow{}, api::echo_row);
  using Nested = std::vector<std::vector<std::optional<api::Result<api::Bundle, api::Ticket>>>>;
  shape(Nested{{}, {std::nullopt, api::Ok<api::Bundle>{value}, api::Err<api::Ticket>{ticket}}}, api::echo_nested);
  shape(Nested{}, api::echo_nested);
  shape(api::Tree{api::TreeBranch{}}, api::echo_recursive);
  api::Tree tree = api::TreeLeaf{ticket};
  for (unsigned i = 0; i < 35; ++i) tree = api::TreeBranch{{std::move(tree)}};
  shape(tree, api::echo_recursive);
  auto peers = api::copy_value(std::vector<api::Ticket>{ticket});
  auto bundle = api::bundle(ticket, {}, peers, {}, {});
  CHECK(bundle->primary == ticket); peers.close(); CHECK(bundle.is_closed());
}
static void test_transfers() {
  auto root = api::new_ticket(23, "move"), alias = root, retained = root.retain();
  auto borrowed = api::retain_ticket(root), descendant = api::retain_ticket(borrowed);
  rejects([&] { (void)api::transfer_ticket(std::move(borrowed)); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(api::serial(borrowed) == 23);
  auto moved = api::transfer_ticket(std::move(root));
  CHECK(root.is_closed() && alias.is_closed() && borrowed.is_closed() && descendant.is_closed());
  CHECK(api::serial(moved) == 23 && api::serial(retained) == 23);
  auto other = api::new_ticket(0, "consumed"), otherAlias = other;
  auto mixed = api::mixed_ticket(moved, std::move(other));
  CHECK(other.is_closed() && otherAlias.is_closed() && mixed == moved);
  rejects([&] { (void)api::mixed_ticket(moved, std::move(moved)); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(api::serial(moved) == 23 && !mixed.is_closed());
  rejects([&] { (void)api::mixed_ticket(mixed, std::move(moved)); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(!moved.is_closed() && !mixed.is_closed());
  moved.close(); CHECK(mixed.is_closed());
  auto empty = api::copy_value(std::vector<api::Ticket>{}), emptyAlias = empty;
  auto emptyView = api::echo_array(empty), emptyChild = api::echo_array(emptyView);
  auto movedEmpty = api::move_array(std::move(empty));
  CHECK(movedEmpty->empty());
  CHECK(empty.is_closed() && emptyAlias.is_closed() && emptyView.is_closed() && emptyChild.is_closed());
}
static void test_depth() {
  auto root = api::new_ticket(33, "deep"), retained = root.retain();
  std::vector<api::Value<api::Ticket>> chain{root}; bool limited = false;
  for (unsigned i = 0; i < 140; ++i) {
    try { chain.push_back(api::retain_ticket(chain.back())); }
    catch (const api::Error& error) { CHECK(error.status == OWNED_AGGREGATES_LIMIT); limited = true; break; }
  }
  CHECK(limited && chain.size() >= 100 && api::serial(chain.back()) == 33);
  chain[48].close(); CHECK(!chain[47].is_closed() && chain[49].is_closed() && chain.back().is_closed());
  CHECK(api::serial(retained) == 33); root.close(); chain[0].close();
  for (size_t i = 1; i < chain.size(); ++i) CHECK(chain[i].is_closed());
}
struct Sentinel { unsigned value; };
static void test_callbacks() {
  auto root = api::copy_value(sample()); api::Ticket escaped, retained;
  auto view = api::callback_record(root, [&](const api::Bundle& input) {
    escaped = input.primary; retained = input.primary.retain();
    auto own = api::copy_value(input), nested = api::echo_record(own);
    CHECK(nested.get() == input); return input;
  });
  CHECK(escaped.is_closed() && !retained.is_closed() && view == root);
  auto closure = api::make_record(root), closureKept = closure.retain();
  auto output = closure(true, sample()); CHECK(output.get() == root.get());
  auto expected = std::make_exception_ptr(Sentinel{87}); bool caught = false;
  try { (void)api::callback_record(root, [&](const api::Bundle&) -> api::Bundle { std::rethrow_exception(expected); }); }
  catch (const Sentinel& error) { caught = true; CHECK(error.value == 87 && std::current_exception() == expected); }
  CHECK(caught && !root.is_closed());
  root.close(); CHECK(view.is_closed() && closure.is_closed());
  CHECK(api::serial(closureKept(true, sample())->primary) == 7);
  auto closing = api::copy_value(sample()); bool invoked = false;
  rejects([&] { (void)api::callback_record(closing, [&](const api::Bundle& input) {
    invoked = true; closing.close(); return input;
  }); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(invoked && closing.is_closed());
  auto consuming = api::copy_value(sample()), old = consuming, dependent = api::echo_record(consuming);
  auto descendant = api::echo_record(dependent), independent = dependent.retain();
  auto moved = api::move_record(std::move(consuming), [&](const api::Bundle& input) {
    CHECK(consuming.is_closed() && old.is_closed() && dependent.is_closed() && descendant.is_closed());
    CHECK(api::serial(independent->primary) == 7 && api::serial(input.primary) == 7);
    rejects([&] { (void)dependent.get(); }, OWNED_AGGREGATES_CLOSED);
    return input;
  });
  CHECK(api::serial(moved->primary) == 7);
}
static void test_affinity() {
  auto root = api::new_ticket(41, "affinity"), view = api::retain_ticket(root);
  std::thread foreign([&] { rejects([&] { (void)view.get(); }, OWNED_AGGREGATES_WRONG_THREAD); }); foreign.join();
  CHECK(api::serial(view) == 41);
  const auto child = ::fork(); CHECK(child >= 0);
  if (!child) { rejects([&] { (void)view.get(); }, OWNED_AGGREGATES_WRONG_PROCESS); std::_Exit(0); }
  int status = 0; CHECK(::waitpid(child, &status, 0) == child); CHECK(WIFEXITED(status) && WEXITSTATUS(status) == 0);
  std::thread dispose([input = std::move(root)]() mutable { input.close(); }); dispose.join();
  CHECK(view.is_closed());
}
#ifndef OWNED_BORROW_INSTALLED
struct FaultCounts { size_t cpp = 0, native = 0, before = 0, after = 0; };
static FaultCounts test_faults() {
  FaultCounts counts;
  auto root = api::copy_value(sample());
  const auto live = bridge_live.load(), identities = owned_test_identities();
  for (bool native : {false, true}) {
    bool complete = false;
    for (size_t at = 1; at < 512; ++at) {
      cpp_allocations = bridge_allocations = 0;
      (native ? bridge_fail : cpp_fail) = at;
      try {
        auto output = api::callback_record(root, [](const api::Bundle& input) { return input; });
        cpp_fail = bridge_fail = 0; CHECK(output == root); complete = true;
      } catch (const std::bad_alloc&) { cpp_fail = bridge_fail = 0; ++counts.cpp; }
      catch (const api::Error& error) {
        cpp_fail = bridge_fail = 0; CHECK(error.status == OWNED_AGGREGATES_ALLOCATION_FAILED); ++counts.native;
      }
      api::detail::current_state()->drain();
      CHECK(bridge_live == live && owned_test_identities() == identities);
      CHECK(api::serial(root->primary) == 7);
      if (complete) break;
    }
    CHECK(complete);
  }
  CHECK(counts.cpp > 0 && counts.native > 0);
  for (bool native : {false, true}) {
    bool complete = false;
    for (size_t at = 1; at < 128; ++at) {
      {
        auto input = api::new_ticket(67, "fault"), alias = input, view = api::retain_ticket(input), kept = view.retain();
        cpp_allocations = bridge_allocations = 0;
        (native ? bridge_fail : cpp_fail) = at;
        try {
          auto output = api::transfer_ticket(std::move(input));
          cpp_fail = bridge_fail = 0; CHECK(api::serial(output) == 67); complete = true;
        } catch (const std::bad_alloc&) { cpp_fail = bridge_fail = 0; ++counts.cpp; }
        catch (const api::Error& error) {
          cpp_fail = bridge_fail = 0; CHECK(error.status == OWNED_AGGREGATES_ALLOCATION_FAILED); ++counts.native;
        }
        CHECK(input.is_closed() == alias.is_closed() && input.is_closed() == view.is_closed());
        CHECK(api::serial(kept) == 67);
        if (!complete) { if (input.is_closed()) ++counts.after; else { ++counts.before; CHECK(api::serial(view) == 67); } }
      }
      api::detail::current_state()->drain();
      CHECK(bridge_live == live && owned_test_identities() == identities);
      if (complete) break;
    }
    CHECK(complete);
  }
  CHECK(counts.before > 0 && counts.after > 0); return counts;
}
#endif
static void check_clean(const std::source_location where = std::source_location::current()) {
  api::detail::current_state()->drain();
#ifndef OWNED_BORROW_INSTALLED
  if (bridge_live != initial_live || owned_test_identities() != initial_identities)
    std::fprintf(stderr, "cleanup at %u: live %zu, expected %zu, identities %zu, expected %zu\n", where.line(), bridge_live.load(), initial_live, owned_test_identities(), initial_identities);
  CHECK(bridge_live == initial_live && owned_test_identities() == initial_identities);
#else
  (void)where;
#endif
}
int main() {
  { auto cold = api::new_ticket(0, "cold"); CHECK(api::serial(cold) == 0); }
  auto state = api::detail::current_state();
  if (std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { state->close(); std::puts("{\"cold\":true}"); return 0; }
#ifndef OWNED_BORROW_INSTALLED
  initial_live = bridge_live; initial_identities = owned_test_identities();
#endif
  test_owners(); check_clean(); test_shapes(); check_clean();
  test_transfers(); check_clean(); test_depth(); check_clean();
  test_callbacks(); check_clean(); test_affinity(); check_clean();
#ifndef OWNED_BORROW_INSTALLED
  const auto faults = test_faults();
#endif
  check_clean();
  auto closing = api::copy_value(sample()), expired = api::echo_record(closing);
  rejects([&] { (void)api::callback_record(closing, [&](const api::Bundle& input) {
    state->close(); return input;
  }); }, OWNED_AGGREGATES_CLOSED);
  CHECK(expired.is_closed() && closing.is_closed());
  expired.close(); closing.close(); state->close();
#ifndef OWNED_BORROW_INSTALLED
  CHECK(bridge_live == 0 && owned_test_identities() == 0);
#endif
#ifdef OWNED_BORROW_INSTALLED
  std::printf("owned-cpp-borrows-installed:%zu\n", checks);
#else
  std::printf("{\"checks\":%zu,\"live\":%zu,\"identities\":%zu", checks, bridge_live.load(), owned_test_identities());
#ifndef OWNED_BORROW_INSTALLED
  std::printf(",\"cppFaults\":%zu,\"nativeFaults\":%zu,\"before\":%zu,\"after\":%zu", faults.cpp, faults.native, faults.before, faults.after);
#endif
  std::puts("}");
#endif
}
