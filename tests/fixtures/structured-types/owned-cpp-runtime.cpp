/* Ownership-control probe, not a claim of complete generated C++ value support. */
#include "owned_aggregates.hpp"
#include <cstdio>
#include <cstdlib>
#include <new>
#include <sys/wait.h>

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
  std::fprintf(stderr, "owned C++ runtime check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
} } while (0)
namespace api = lean_bridge::owned_aggregates;
using TicketKind = api::detail::TICKET_KIND;
struct OtherKind {};
using Ticket = api::Ticket;
static_assert(!std::is_convertible_v<Ticket, api::Resource<OtherKind>>);
static_assert(std::is_nothrow_copy_constructible_v<Ticket>);
static_assert(std::is_nothrow_move_constructible_v<Ticket>);

static Ticket ticket(unsigned serial) {
  auto state = api::detail::current_state();
  mpz_t number; mpz_init_set_ui(number, serial);
  api::detail::NativeOwner owner; owned_aggregates_ticket_t value = nullptr;
  auto status = owned_aggregates_new_ticket(state->require(), number,
    {"cpp", 3}, &value, &owner.value);
  mpz_clear(number); api::detail::checked(status);
  return api::detail::ResourceAccess::make<TicketKind>(state->adopt(owner), value);
}
static unsigned serial(const Ticket& ticket) {
  auto state = api::detail::current_state();
  auto raw = api::detail::ResourceAccess::get<owned_aggregates_ticket_t>(ticket, state);
  api::detail::NativeOwner owner; mpz_srcptr number = nullptr;
  api::detail::checked(owned_aggregates_serial(state->require(), raw, &number, &owner.value));
  return static_cast<unsigned>(mpz_get_ui(number));
}
template<class Operation> static void rejects(Operation operation, owned_aggregates_status status) {
  bool failed = false;
  try { operation(); } catch (const api::Error& error) { failed = true; CHECK(error.status == status); }
  CHECK(failed);
}
int main() {
  auto state = api::detail::current_state();
  const auto baseline = bridge_live.load(), identities = owned_test_identities();
  if (std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    state->close(); CHECK(bridge_live == 0 && owned_test_identities() == 0);
    std::puts("{\"cold\":true}"); return 0;
  }
  for (unsigned iteration = 0; iteration < 32; ++iteration) {
    {
      auto first = ticket(42), second = ticket(99);
      CHECK(first != second); CHECK(serial(first) == 42 && serial(second) == 99);
      auto copied = first; CHECK(copied == first);
      first.close(); CHECK(first.is_closed() && !copied.is_closed());
      CHECK(serial(copied) == 42);
      auto moved = std::move(copied); CHECK(copied.is_closed() && serial(moved) == 42);
      copied = moved; moved.close(); CHECK(serial(copied) == 42);
      second = std::move(copied); CHECK(copied.is_closed() && serial(second) == 42);
      second = second; CHECK(serial(second) == 42);
    }
    state->drain(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
  }
  unsigned copyFailures = 0;
  {
    auto first = ticket(7), second = ticket(8);
    api::Bundle value{first, std::nullopt, {first, second}, {second}, {-123, {0, 255}}};
    bool copied = false;
    for (size_t at = 1; at < 16; ++at) {
      allocations = 0; fail_at = at;
      try { auto clone = value; fail_at = 0; CHECK(clone == value); copied = true; }
      catch (const std::bad_alloc&) { fail_at = 0; ++copyFailures; }
      CHECK(serial(value.primary) == 7 && serial(value.history[0]) == 8);
      if (copied) break;
    }
    CHECK(copied && copyFailures == 3);
    auto copy = value; CHECK(copy == value);
    first.close(); value.primary.close(); CHECK(serial(copy.primary) == 7);
    copy.payload.bytes[0] = 9; CHECK(value.payload.bytes[0] == 0);
    copy.peers[0].close(); CHECK(serial(value.peers[0]) == 7);
    CHECK(serial(copy.history[0]) == 8);
    api::Tree tree = api::TreeBranch{{api::TreeLeaf{copy.primary}}};
    auto copiedTree = tree; CHECK(copiedTree == tree);
    auto& branch = std::get<api::TreeBranch>(copiedTree.value);
    std::get<api::TreeLeaf>(branch.children[0].value).ticket.close();
    CHECK(copiedTree != tree);
    CHECK(serial(std::get<api::TreeLeaf>(std::get<api::TreeBranch>(tree.value).children[0].value).ticket) == 7);
    std::optional<std::optional<Ticket>> marker;
    CHECK(!marker); marker.emplace(); CHECK(marker && !*marker);
    marker->emplace(copy.primary); CHECK(marker && *marker && serial(**marker) == 7);
    api::Result<Ticket, Ticket> success = api::Ok<Ticket>{copy.primary};
    api::Result<Ticket, Ticket> failure = api::Err<Ticket>{copy.primary};
    CHECK(success != failure);
  }
  CHECK(bridge_live == baseline && owned_test_identities() == identities);
  unsigned failures = 0; bool completed = false;
  rejects([&] { (void)serial(Ticket{}); }, OWNED_AGGREGATES_CLOSED);
  for (size_t at = 1; at < 16; ++at) {
    {
      api::detail::NativeOwner owner; owned_aggregates_ticket_t raw = nullptr;
      mpz_t number; mpz_init_set_ui(number, 8);
      api::detail::checked(owned_aggregates_new_ticket(state->require(), number, {"fault", 5}, &raw, &owner.value));
      mpz_clear(number);
      allocations = 0; fail_at = at;
      try {
        auto value = api::detail::ResourceAccess::make<TicketKind>(state->adopt(owner), raw);
        fail_at = 0; CHECK(owner.value == nullptr && serial(value) == 8); completed = true;
      } catch (const std::bad_alloc&) {
        fail_at = 0; ++failures; CHECK(owner.value != nullptr);
      }
    }
    state->drain(); CHECK(bridge_live == baseline && owned_test_identities() == identities);
    if (completed) break;
  }
  CHECK(completed && failures == 4);
  {
    auto value = ticket(111);
    std::thread foreign([&] {
      rejects([&] { (void)serial(value); }, OWNED_AGGREGATES_WRONG_THREAD);
    });
    foreign.join(); CHECK(serial(value) == 111);
    auto other = std::make_shared<api::detail::State>();
    rejects([&] {
      (void)api::detail::ResourceAccess::get<owned_aggregates_ticket_t>(value, other);
    }, OWNED_AGGREGATES_INVALID_ARGUMENT);
    other->close(); CHECK(serial(value) == 111);
  }
  CHECK(bridge_live == baseline && owned_test_identities() == identities);
  {
    auto value = ticket(123);
    const auto active = bridge_live.load();
    std::thread worker([owned = std::move(value)]() mutable {
      // No allocation is allowed during deferred destruction on a foreign thread.
      allocations = 0; fail_at = 1;
      owned.close(); fail_at = 0;
    });
    worker.join(); CHECK(value.is_closed());
    CHECK(bridge_live == active); state->drain();
    CHECK(bridge_live == baseline && owned_test_identities() == identities);
  }
  Ticket escaped;
  std::thread origin([&] {
    escaped = ticket(200); CHECK(serial(escaped) == 200);
    // Thread-local retirement releases all registered owners, including escaped
    // wrappers whose C++ lifetime continues after this native thread exits.
  });
  origin.join(); CHECK(escaped.is_closed()); escaped.close();
  CHECK(bridge_live == baseline && owned_test_identities() == identities);
  for (unsigned iteration = 0; iteration < 16; ++iteration) {
    Ticket retired;
    std::thread owner([&] { retired = ticket(iteration); });
    owner.join(); CHECK(retired.is_closed());
    // A newly created thread can reuse a former thread id, but never its state.
    std::thread successor([&] {
      rejects([&] { (void)serial(retired); }, OWNED_AGGREGATES_CLOSED);
      auto fresh = ticket(iteration + 1); CHECK(serial(fresh) == iteration + 1);
    });
    successor.join(); retired.close();
    CHECK(bridge_live == baseline && owned_test_identities() == identities);
  }
  auto surviving = ticket(321);
  const auto child = ::fork(); CHECK(child >= 0);
  if (child == 0) {
    rejects([&] { (void)serial(surviving); }, OWNED_AGGREGATES_WRONG_PROCESS);
    surviving.close(); ::_exit(0);
  }
  int status = 0; CHECK(::waitpid(child, &status, 0) == child);
  CHECK(WIFEXITED(status) && WEXITSTATUS(status) == 0); CHECK(serial(surviving) == 321);
  state->close(); CHECK(surviving.is_closed());
  rejects([&] { (void)serial(surviving); }, OWNED_AGGREGATES_CLOSED);
  surviving.close(); state->close();
  CHECK(bridge_live == 0 && owned_test_identities() == 0);
  std::printf("{\"checks\":%zu,\"allocationFailures\":%u,\"valueCopyFailures\":%u,\"live\":%zu,\"identities\":%zu}\n",
    checks, failures, copyFailures, bridge_live.load(), owned_test_identities());
}
