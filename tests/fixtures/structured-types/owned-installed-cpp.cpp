/* Independent source-free consumer. Only the prepared public C++ header is used. */
#include "owned_aggregates.hpp"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <new>
#include <sys/wait.h>

namespace api = lean_bridge::owned_aggregates;
static size_t checks;
static thread_local size_t allocations, fail_at;
[[gnu::noinline]] void *operator new(size_t count) {
  if (++allocations == fail_at) throw std::bad_alloc();
  if (void *value = std::malloc(count ? count : 1)) return value;
  throw std::bad_alloc();
}
[[gnu::noinline]] void operator delete(void *value) noexcept { std::free(value); }
[[gnu::noinline]] void operator delete(void *value, size_t) noexcept { std::free(value); }
#define CHECK(value) do { ++checks; if (!(value)) { \
  std::fprintf(stderr, "installed owned C++ check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
} } while (0)
template<class F> static void rejects(F function, owned_aggregates_status expected) {
  bool rejected = false;
  try { function(); } catch (const api::Error& error) { rejected = true; CHECK(error.status == expected); }
  CHECK(rejected);
}
struct Sentinel { int id; };
template<class F> static void preserves_exception(F function) {
  auto expected = std::make_exception_ptr(Sentinel{917}); bool caught = false;
  try { function(expected); } catch (const Sentinel& error) {
    caught = true; CHECK(error.id == 917); CHECK(std::current_exception() == expected);
  }
  CHECK(caught);
}
static api::Bundle bundle(const api::Ticket& first, const api::Ticket& second) {
  return {first, second, {first, second, first}, {second, first}, {-(api::Int(1) << 1024) - 29, {0, 255, 3}}};
}
static api::Chain chain(const api::Ticket& ticket, unsigned depth) {
  api::Chain value = api::ChainStop{};
  for (unsigned i = 0; i < depth; ++i) value = api::ChainLink{ticket, std::move(value)};
  return value;
}
static void values(const api::Ticket& first, const api::Ticket& second) {
  auto input = bundle(first, second);
  CHECK(api::bundle(first, second, input.peers, input.history, input.payload) == input);
  CHECK(api::primary(input) == first); CHECK(api::payload(input) == input.payload);
  CHECK(api::retain_ticket(first) == first && first.retain() == first);
  CHECK(api::echo_array(input.peers) == input.peers && api::echo_array({}).empty());
  CHECK(api::echo_list(input.history) == input.history && api::echo_list({}).empty());
  CHECK(!api::echo_option(std::nullopt)); CHECK(api::echo_option(first) == first);
  api::Result<api::Bundle, api::Ticket> ok = api::Ok<api::Bundle>{input}, error = api::Err<api::Ticket>{first};
  CHECK(api::echo_result(ok) == ok && api::echo_result(error) == error);
  auto product = std::make_pair(first, std::make_pair(std::optional<api::Ticket>{second}, input.payload));
  CHECK(api::echo_tuple(product) == product);
  CHECK(api::echo_record(input) == input && api::echo_alias(input) == input);
  for (const auto& value : std::vector<api::Choice>{api::ChoiceEmpty{}, api::ChoiceOne{first}, api::ChoicePair{first, second}, api::ChoiceMany{}, api::ChoiceMany{{first, second}}})
    CHECK(api::echo_variant(value) == value);
  api::TicketRow row{std::nullopt, first, second}; CHECK(api::echo_row(row) == row);
  const std::vector<std::vector<std::optional<api::Result<api::Bundle, api::Ticket>>>> nested{{}, {std::nullopt, ok, error}};
  CHECK(api::echo_nested(nested) == nested);
  api::Tree tree = api::TreeBranch{{api::TreeLeaf{first}, api::TreeBranch{{api::TreeLeaf{second}}}}};
  CHECK(api::echo_recursive(tree) == tree);
  auto choose = api::make_record(input); CHECK(choose(true, input) == input);
  auto alternate = bundle(second, first); CHECK(choose(false, alternate) == alternate);
  auto recursive = api::make_recursive(tree); CHECK(recursive(true, api::TreeBranch{}) == tree);
  CHECK(recursive(false, api::TreeBranch{}) == api::Tree{api::TreeBranch{}});
  api::Mixed mixed{}; mixed.ticket = first; mixed.markers.resize(4);
  mixed.markers[1].emplace(); mixed.markers[2].emplace(false); mixed.markers[3].emplace(true);
  mixed.unit.emplace(); mixed.result = ok; mixed.signed_ = -(api::Int(1) << 2048) - 19;
  mixed.unsigned_ = (api::Nat(1) << 3072) + 27; mixed.scalar = U'\U0001f331';
  mixed.precise = -0.0; mixed.approximate = std::numeric_limits<float>::infinity();
  mixed.bytes = {0, 255}; mixed.words = {0, UINT64_MAX, UINT64_C(1) << 63};
  mixed.product = product; mixed.chain = chain(first, 24);
  auto copy = api::echo_mixed(mixed); CHECK(copy == mixed);
  CHECK(!copy.markers[0] && copy.markers[1] && !*copy.markers[1]);
  CHECK(copy.markers[2] && *copy.markers[2] && !**copy.markers[2]);
  CHECK(copy.markers[3] && *copy.markers[3] && **copy.markers[3]);
  CHECK(copy.unit && std::signbit(copy.precise));
  CHECK(std::isinf(copy.approximate) && !std::signbit(copy.approximate));
  mixed.unit.reset(); mixed.result = error; CHECK(api::echo_mixed(mixed) == mixed);
  mixed.precise = std::numeric_limits<double>::quiet_NaN();
  mixed.approximate = -std::numeric_limits<float>::infinity();
  copy = api::echo_mixed(mixed); CHECK(std::isnan(copy.precise)); CHECK(std::isinf(copy.approximate) && std::signbit(copy.approximate));
  mixed.precise = 4.5; mixed.approximate = -0.0f; CHECK(std::signbit(api::echo_mixed(mixed).approximate));
  auto linked = chain(first, 24); CHECK(api::echo_chain(linked) == linked);
  CHECK(api::echo_chain(api::ChainStop{}) == api::Chain{api::ChainStop{}});
  CHECK((api::echo_chain(api::ChainLink{first, std::nullopt}) == api::Chain{api::ChainLink{first, std::nullopt}}));
  auto copiedChain = linked;
  std::get<api::ChainLink>(copiedChain.value).next.value()->value = api::ChainStop{};
  CHECK(copiedChain != linked); CHECK(api::echo_chain(linked) == linked);
  rejects([&] { (void)api::echo_chain(chain(first, 140)); }, OWNED_AGGREGATES_LIMIT);
  auto broken = api::ChainLink{first, api::Box<api::Chain>{}};
  rejects([&] { (void)api::echo_chain(broken); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  mixed.scalar = 0xd800;
  rejects([&] { (void)api::echo_mixed(mixed); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  mixed.scalar = U'A'; mixed.unsigned_ = -1;
  rejects([&] { (void)api::echo_mixed(mixed); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  mixed.unsigned_ = 0;
  // Exercise every C++ allocation in a mixed/boxed round trip. Fault-loop
  // assertions are counted separately so sanitizer allocation elision is valid.
  const auto before = checks; bool completed = false; unsigned failures = 0;
  for (size_t position = 1; position < 1024; ++position) {
    allocations = 0; fail_at = position;
    try { auto result = api::echo_mixed(mixed); fail_at = 0; CHECK(result == mixed); completed = true; }
    catch (const std::bad_alloc&) { fail_at = 0; ++failures; }
    CHECK(api::serial(first) == 1);
    if (completed) break;
  }
  CHECK(completed && failures > 50);
  // Stable functional count; the loop above still aborts on any failed assertion.
  checks = before + 2;
}
static void callbacks(const api::Ticket& first, const api::Ticket& second) {
  auto input = bundle(first, second); api::Ticket escaped, kept;
  auto returned = api::callback_record(input, [&](const api::Bundle& value) {
    escaped = value.primary; kept = value.primary.retain();
    auto copy = value; copy.primary = api::new_ticket(91, "callback"); copy.payload.bytes = {9, 8}; return copy;
  });
  CHECK(escaped.is_closed() && api::serial(kept) == 1);
  CHECK(api::serial(returned.primary) == 91 && returned.payload.bytes == std::vector<uint8_t>({9, 8}));
  rejects([&] { (void)escaped.retain(); }, OWNED_AGGREGATES_CLOSED);
  preserves_exception([&](std::exception_ptr error) {
    (void)api::callback_record(input, [&](const api::Bundle&) -> api::Bundle { std::rethrow_exception(error); });
  });
  CHECK(api::callback_record(input, [&](const api::Bundle& value) {
    preserves_exception([&](std::exception_ptr error) {
      (void)api::callback_record(value, [&](const api::Bundle&) -> api::Bundle { std::rethrow_exception(error); });
    });
    return api::echo_record(value);
  }) == input);
  auto mutableCallback = [count = 0](const api::Bundle& value) mutable { auto copy = value; copy.payload.count = ++count; return copy; };
  CHECK(api::twice(input, mutableCallback).payload.count == 2);
  auto dispatcher = api::dispatch(input);
  CHECK(dispatcher(mutableCallback).payload.count == 3);
  CHECK(dispatcher([count = 4](const api::Bundle& value) mutable { auto copy = value; copy.payload.count = ++count; return copy; }).payload.count == 5);
  preserves_exception([&](std::exception_ptr error) {
    (void)dispatcher([&](const api::Bundle&) -> api::Bundle { std::rethrow_exception(error); });
  });
  auto identity = api::identity_closure({}); CHECK(dispatcher(identity) == input);
  auto clone = dispatcher.retain(); dispatcher.close(); CHECK(clone(identity) == input);
  auto retained = api::retain_callback(identity); identity.close(); CHECK(retained(input) == input);
  auto expired = api::retain_callback([](const api::Bundle& value) { return value; });
  rejects([&] { (void)expired(input); }, OWNED_AGGREGATES_CALLBACK_FAILED);
  auto made = api::factory(api::with_recovery([](const std::monostate&) { return api::new_ticket(92, "factory"); }, first));
  CHECK(api::serial(made) == 92);
  preserves_exception([&](std::exception_ptr error) {
    (void)api::factory(api::with_recovery([&](const std::monostate&) -> api::Ticket { std::rethrow_exception(error); }, first));
  });
  CHECK(api::construct(first, [&](const api::Ticket& ticket) { return bundle(ticket, second); }) == input);
  unsigned count = 0;
  rejects([&] { (void)api::repeatedly(input, [&](const api::Bundle& value) { ++count; return value; }, 10000); }, OWNED_AGGREGATES_LIMIT);
  CHECK(count > 1 && count < 10000);
  api::Tree tree = api::TreeLeaf{first};
  CHECK(api::callback_recursive(tree, [](const api::Tree& value) { return value; }) == tree);
}
int main() {
  { auto warmup = api::new_ticket(0, "warmup"); }
  if (std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) { std::puts("cold"); return 0; }
  auto first = api::new_ticket(1, std::string("a\0\xf0\x9f\x8c\xb1", 6));
  auto second = api::new_ticket((api::Nat(1) << 1024) + 3, "second");
  CHECK(api::label(first) == std::string("a\0\xf0\x9f\x8c\xb1", 6));
  CHECK(api::serial(second) == (api::Nat(1) << 1024) + 3);
  values(first, second); callbacks(first, second);
  for (unsigned i = 0; i < 160; ++i) {
    auto local = api::new_ticket(i, "loop");
    auto value = bundle(local, first); auto copy = api::echo_record(value);
    auto retained = copy.primary.retain(); value = {}; copy = {}; local.close();
    CHECK(api::serial(retained) == i); CHECK(api::serial(first) == 1);
    auto recursive = api::echo_chain(chain(retained, 24)); CHECK(!std::get<api::ChainLink>(recursive.value).ticket.is_closed());
  }
  rejects([] { (void)api::new_ticket(-1, "invalid"); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  rejects([] { (void)api::new_ticket(1, std::string("\xc0\x80", 2)); }, OWNED_AGGREGATES_INVALID_ARGUMENT);
  std::thread foreign([&] { rejects([&] { (void)api::serial(first); }, OWNED_AGGREGATES_WRONG_THREAD); }); foreign.join();
  auto detached = first.retain();
  std::thread dispose([owned = std::move(detached)]() mutable { owned.close(); }); dispose.join();
  CHECK(api::serial(first) == 1);
  api::Ticket escaped;
  std::thread owner([&] { escaped = api::new_ticket(7, "retired"); }); owner.join();
  CHECK(escaped.is_closed()); rejects([&] { (void)api::serial(escaped); }, OWNED_AGGREGATES_CLOSED);
  const auto child = ::fork(); CHECK(child >= 0);
  if (child == 0) { rejects([&] { (void)api::serial(first); }, OWNED_AGGREGATES_WRONG_PROCESS); ::_exit(0); }
  int status = 0; CHECK(::waitpid(child, &status, 0) == child); CHECK(WIFEXITED(status) && WEXITSTATUS(status) == 0);
  auto kept = second.retain(); first.close(); second.close(); CHECK(api::serial(kept) == (api::Nat(1) << 1024) + 3);
  kept.close(); rejects([&] { (void)api::serial(kept); }, OWNED_AGGREGATES_CLOSED);
  std::printf("owned-installed-cpp:%zu\n", checks);
}
