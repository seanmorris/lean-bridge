/* Public C++ callback-result lifetime checks against compiled Lean. */
#include "owned_aggregates.hpp"
#include <cstdio>
#include <cstdlib>
#include <new>
#include <source_location>

namespace api = lean_bridge::owned_aggregates;
static size_t checks;
#ifndef CALLBACK_RESULTS_INSTALLED
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
extern "C" size_t owned_test_handoffs(void);
#endif
#define CHECK(value) do { ++checks; if (!(value)) { \
  std::fprintf(stderr, "owned C++ callback result check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
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
using Closure = decltype(api::make_record(std::declval<const api::Bundle&>()));
template<class T> concept CanAnchor = requires(const Closure& callback, const T& input) { callback(false, input); };
static_assert(CanAnchor<api::Value<api::Bundle>>);
static_assert(!CanAnchor<api::Bundle> && !CanAnchor<api::Value<api::Ticket>>);
static_assert(std::same_as<decltype(std::declval<Closure>()(false, std::declval<const api::Value<api::Bundle>&>())), api::Value<api::Bundle>>);
static api::Bundle sample(unsigned serial = 42) {
  auto ticket = api::new_ticket(serial, std::string("callback\0", 9) + "\xf0\x9f\x92\xa0");
  return {ticket.get(), {}, {}, {}, {-(api::Int(1) << 140) - 7, {0, 255, 42}}};
}
static void test_lifetimes() {
  auto captured = api::echo_record(sample()), supplied = api::echo_record(sample(99));
  auto alias = supplied; auto closure = api::make_record(captured);
  auto leased = api::make_leased_record(captured);
  auto view = closure(true, supplied), nested = closure(false, view);
  CHECK(api::serial(nested->primary) == 42 && nested->payload == captured->payload);
  CHECK(api::label(nested->primary) == std::string("callback\0", 9) + "\xf0\x9f\x92\xa0");
  auto retained = nested.retain(), independent = leased(false, supplied);
  captured.close(); closure.close(); leased.close();
  CHECK(api::serial(nested->primary) == 42);
  supplied.close(); CHECK(supplied.is_closed() && !view.is_closed());
  alias.close(); CHECK(view.is_closed() && nested.is_closed());
  rejects([&] { (void)nested.get(); }, OWNED_AGGREGATES_CLOSED);
  CHECK(api::serial(retained->primary) == 42 && api::serial(independent->primary) == 99);
  for (unsigned i = 0; i < 32; ++i) {
    auto fresh = api::echo_record(sample(i));
    CHECK(api::serial(fresh->primary) == i && nested.is_closed());
  }
  auto root = api::echo_record(sample()); auto callback = api::make_record(root);
  auto parent = callback(false, root), child = callback(false, parent);
  auto leaf = child->primary;
  parent.close(); CHECK(!root.is_closed() && child.is_closed() && leaf.is_closed());
  rejects([&] { (void)api::serial(leaf); }, OWNED_AGGREGATES_CLOSED);
  std::vector<api::Value<api::Bundle>> chain{root}; bool limited = false;
  for (unsigned i = 0; i < 150; ++i) {
    try { chain.push_back(callback(false, chain.back())); }
    catch (const api::Error& error) { CHECK(error.status == OWNED_AGGREGATES_LIMIT); limited = true; break; }
  }
  CHECK(limited && chain.size() >= 100);
  chain[48].close(); CHECK(!chain[47].is_closed() && chain[49].is_closed() && chain.back().is_closed());
}
static void test_recursive() {
  auto root = api::echo_recursive(api::Tree{api::TreeBranch{}});
  auto callback = api::make_recursive(root);
  auto view = callback(false, root), nested = callback(false, view), retained = nested.retain();
  view.close(); CHECK(nested.is_closed() && !root.is_closed());
  rejects([&] { (void)nested.get(); }, OWNED_AGGREGATES_CLOSED);
  CHECK(std::get<api::TreeBranch>(retained->value).children.empty());
  auto record = sample(); api::Tree tree = api::TreeLeaf{record.primary};
  for (unsigned i = 0; i < 20; ++i) tree = api::TreeBranch{{std::move(tree)}};
  auto deep = api::echo_recursive(tree), deepView = callback(false, deep);
  CHECK(deepView.get() == tree); auto saved = deepView.retain();
  deep.close(); CHECK(deepView.is_closed() && saved.get() == tree);
}
#if HOST_CALLBACKS
struct GoodOwnerReply { api::Value<api::Bundle> operator()(const api::Bundle&) const; };
struct WrongOwnerReply { api::Value<api::Ticket> operator()(const api::Bundle&) const; };
template<class F> concept CanReply = requires(const api::Bundle& value, F function) { api::callback_record(value, function); };
static_assert(CanReply<GoodOwnerReply> && !CanReply<WrongOwnerReply>);
struct Sentinel { int value; };
static void test_host() {
  auto root = api::echo_record(sample()); api::Ticket escaped, retained;
  auto reply = api::callback_record(root, [&](const api::Bundle& value) {
    escaped = value.primary; retained = value.primary.retain(); return value;
  });
  CHECK(escaped.is_closed() && api::serial(retained) == 42 && api::serial(reply->primary) == 42);
  rejects([&] { (void)api::serial(escaped); }, OWNED_AGGREGATES_CLOSED);
  api::Value<api::Bundle> returned;
  reply = api::callback_record(root, [&](const api::Bundle& value) {
    returned = api::echo_record(value); return returned;
  });
  returned.close(); CHECK(api::serial(reply->primary) == 42);
  reply = api::callback_record(root, api::with_recovery([](const api::Bundle& value) { return value; }, root));
  CHECK(api::serial(reply->primary) == 42);
  const auto expected = std::make_exception_ptr(Sentinel{91}); bool caught = false;
  try { (void)api::callback_record(root, [&](const api::Bundle&) -> api::Value<api::Bundle> { std::rethrow_exception(expected); }); }
  catch (const Sentinel& error) { caught = true; CHECK(error.value == 91 && std::current_exception() == expected); }
  CHECK(caught && !root.is_closed());
  rejects([&] { (void)api::callback_record(root, [&](const api::Bundle& value) {
    auto invalid = value; invalid.primary = escaped; return invalid;
  }); }, OWNED_AGGREGATES_CLOSED);
  rejects([&] { (void)api::callback_record(root, [&](const api::Bundle& value) {
    auto invalid = api::echo_record(value); invalid.close(); return invalid;
  }); }, OWNED_AGGREGATES_CLOSED);
  reply = api::callback_record(root, [&](const api::Bundle& value) {
    root.close(); return value;
  });
  CHECK(root.is_closed() && api::serial(reply->primary) == 42);
  auto empty = api::callback_recursive(api::Tree{api::TreeBranch{}}, [](const api::Tree& value) { return value; });
  CHECK(std::get<api::TreeBranch>(empty->value).children.empty());
}
#endif
#if COMBINED
static void test_combinations() {
  auto root = api::echo_record(sample()), alias = root; auto callback = root.make_record();
  auto view = callback(false, root), child = view.borrow_record(), saved = child.retain();
  unsigned calls = 0;
  rejects([&] { (void)std::move(view).move_record([&](const api::Bundle& value) { ++calls; return value; }); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  CHECK(calls == 0 && !root.is_closed() && !view.is_closed());
  api::Ticket escaped;
  auto moved = std::move(root).move_record([&](const api::Bundle& value) {
    ++calls; CHECK(root.is_closed() && alias.is_closed() && view.is_closed() && child.is_closed());
    CHECK(api::serial(value.primary) == 42 && api::serial(saved->primary) == 42);
    escaped = value.primary; return api::echo_record(value);
  });
  CHECK(calls == 1 && escaped.is_closed() && api::serial(moved->primary) == 42);
  auto fromCapture = callback(true, moved); CHECK(api::serial(fromCapture->primary) == 42);
  auto failing = api::echo_record(sample()), dependent = callback(false, failing);
  bool caught = false;
  try { (void)std::move(failing).move_record([&](const api::Bundle&) -> api::Bundle {
    CHECK(failing.is_closed() && dependent.is_closed()); throw Sentinel{77};
  }); } catch (const Sentinel& error) { caught = true; CHECK(error.value == 77); }
  CHECK(caught && failing.is_closed() && dependent.is_closed());
}
#endif
#ifndef CALLBACK_RESULTS_INSTALLED
struct FaultCounts { size_t cpp = 0, native = 0; };
static FaultCounts test_faults() {
  FaultCounts counts;
  auto root = api::echo_record(sample()); auto callback = api::make_record(root);
  const auto live = bridge_live.load(), identities = owned_test_identities();
  for (unsigned operation = 0; operation < (HOST_CALLBACKS ? 3u : 2u); ++operation)
    for (bool native : {false, true}) {
      bool complete = false;
      for (size_t at = 1; at < 1024; ++at) {
        cpp_allocations = bridge_allocations = 0;
        (native ? bridge_fail : cpp_fail) = at;
        try {
          auto output = operation == 0 ? callback(false, root) : operation == 1 ? root.retain()
#if HOST_CALLBACKS
            : api::callback_record(root, [](const api::Bundle& value) { return api::echo_record(value); });
#else
            : root.retain();
#endif
          cpp_fail = bridge_fail = 0; CHECK(api::serial(output->primary) == 42); complete = true;
        } catch (const std::bad_alloc&) { cpp_fail = bridge_fail = 0; ++counts.cpp; }
        catch (const api::Error& error) {
          cpp_fail = bridge_fail = 0; CHECK(error.status == OWNED_AGGREGATES_ALLOCATION_FAILED); ++counts.native;
        }
        api::detail::current_state()->drain();
        CHECK(bridge_live == live && owned_test_identities() == identities);
        CHECK(api::serial(root->primary) == 42);
        if (complete) break;
      }
      CHECK(complete);
    }
  CHECK(counts.cpp > 0 && counts.native > 0); return counts;
}
#if COMBINED
struct TransferFaultCounts { size_t cpp_before = 0, cpp_after = 0, native_before = 0, native_after = 0; };
static TransferFaultCounts test_transfer_faults() {
  TransferFaultCounts counts;
  const auto live = bridge_live.load(), identities = owned_test_identities();
  for (bool whole_reply : {false, true}) for (bool native : {false, true}) {
    bool complete = false;
    for (size_t at = 1; at < 1024; ++at) {
      {
        auto root = api::echo_record(sample()), alias = root;
        auto closure = root.make_record();
        auto view = closure(false, root), child = view.borrow_record();
        auto saved = child.retain(); unsigned calls = 0;
        const auto handoffs = owned_test_handoffs();
        auto entered = [&](const api::Bundle& value) {
          ++calls;
          CHECK(root.is_closed() && alias.is_closed() && view.is_closed() && child.is_closed());
          CHECK(api::serial(value.primary) == 42 && api::serial(saved->primary) == 42);
        };
        bool failed = false;
        cpp_allocations = bridge_allocations = 0;
        (native ? bridge_fail : cpp_fail) = at;
        try {
          api::Value<api::Bundle> output;
          if (whole_reply) output = std::move(root).move_record([&](const api::Bundle& value) {
            entered(value); return api::echo_record(value);
          });
          else output = std::move(root).move_record([&](const api::Bundle& value) { entered(value); return value; });
          cpp_fail = bridge_fail = 0;
          CHECK(api::serial(output->primary) == 42 && calls == 1); complete = true;
        } catch (const std::bad_alloc&) { cpp_fail = bridge_fail = 0; failed = true; }
        catch (const api::Error& error) {
          cpp_fail = bridge_fail = 0; CHECK(error.status == OWNED_AGGREGATES_ALLOCATION_FAILED); failed = true;
        }
        const bool consumed = owned_test_handoffs() != handoffs;
        CHECK(owned_test_handoffs() == handoffs + (consumed ? 1 : 0));
        CHECK(root.is_closed() == consumed && alias.is_closed() == consumed);
        CHECK(view.is_closed() == consumed && child.is_closed() == consumed);
        CHECK(calls <= 1 && api::serial(saved->primary) == 42);
        if (!consumed) CHECK(calls == 0 && api::serial(root->primary) == 42 && api::serial(child->primary) == 42);
        if (failed) ++(native ? (consumed ? counts.native_after : counts.native_before)
          : (consumed ? counts.cpp_after : counts.cpp_before));
      }
      api::detail::current_state()->drain();
      CHECK(bridge_live == live && owned_test_identities() == identities);
      if (complete) break;
    }
    CHECK(complete);
  }
  CHECK(counts.cpp_before > 0 && counts.cpp_after > 0 && counts.native_before > 0 && counts.native_after > 0);
  return counts;
}
#endif
#endif
static void check_clean() {
  api::detail::current_state()->drain();
#ifndef CALLBACK_RESULTS_INSTALLED
  CHECK(bridge_live == initial_live && owned_test_identities() == initial_identities);
#endif
}
int main() {
  { auto cold = api::new_ticket(0, "cold"); CHECK(api::serial(cold) == 0); }
  auto state = api::detail::current_state();
  if (std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { state->close(); std::puts("{\"cold\":true}"); return 0; }
#ifndef CALLBACK_RESULTS_INSTALLED
  initial_live = bridge_live; initial_identities = owned_test_identities();
#endif
  test_lifetimes(); check_clean(); test_recursive(); check_clean();
#if HOST_CALLBACKS
  test_host(); check_clean();
#endif
#if COMBINED
  test_combinations(); check_clean();
#endif
#ifndef CALLBACK_RESULTS_INSTALLED
  const auto faults = test_faults(); check_clean();
#if COMBINED
  const auto transfers = test_transfer_faults(); check_clean();
#endif
#endif
  state->close();
#ifdef CALLBACK_RESULTS_INSTALLED
  std::printf("owned-cpp-callback-results-installed:%zu\n", checks);
#else
  CHECK(bridge_live == 0 && owned_test_identities() == 0);
  std::printf("{\"checks\":%zu,\"cppFaults\":%zu,\"nativeFaults\":%zu,\"live\":%zu,\"identities\":%zu",
    checks, faults.cpp, faults.native, bridge_live.load(), owned_test_identities());
#if COMBINED
  std::printf(",\"transfers\":{\"cppBefore\":%zu,\"cppAfter\":%zu,\"nativeBefore\":%zu,\"nativeAfter\":%zu}",
    transfers.cpp_before, transfers.cpp_after, transfers.native_before, transfers.native_after);
#endif
  std::puts("}");
#endif
}
