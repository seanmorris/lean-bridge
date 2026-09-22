// Independent C++ caller. Echo callbacks exercise C views without a Lean runtime;
// compiled native calls have their own executable acceptance fixture.
#include "recursive-conversions.hpp"
#include "linked-conversions.hpp"
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <new>

namespace api = lean_bridge::recursive;
namespace d = api::detail;
static size_t attempts, fail_at, live, calls, releases, checks;
#define CHECK(expression) do { ++checks; assert(expression); } while (0)

void* operator new(size_t size) {
  if (++attempts == fail_at) throw std::bad_alloc();
  void* value = std::malloc(size ? size : 1);
  if (!value) throw std::bad_alloc();
  ++live; return value;
}
void* operator new[](size_t size) { return ::operator new(size); }
void operator delete(void* value) noexcept { if (value) { assert(live); --live; std::free(value); } }
void operator delete[](void* value) noexcept { ::operator delete(value); }
void operator delete(void* value, size_t) noexcept { ::operator delete(value); }
void operator delete[](void* value, size_t) noexcept { ::operator delete(value); }

static void release(void* owner) { CHECK(owner == &releases); ++releases; }
static auto echo = [](const auto* input, auto* output) -> uint32_t {
  ++calls; *output = *input;
  if constexpr (requires { output->_bridge_owner; }) {
    output->_bridge_owner = &releases; output->_bridge_release = release;
  }
  return 0;
};
template<class F> static void reject(uint32_t status, F&& action) {
  const size_t before = live;
  try { action(); CHECK(false); }
  catch (const d::GraphConversionError& error) {
    if (error.status != status) std::fprintf(stderr, "Expected status %u, got %u: %s\n", status, error.status, error.what());
    CHECK(error.status == status);
  }
  CHECK(live == before);
}
template<class F> static void allocation_failures(F&& action) {
  const size_t before = live;
  attempts = 0; action(); const size_t count = attempts;
  CHECK(live == before); CHECK(count > 1);
  size_t input_failures = 0, output_failures = 0;
  for (size_t i = 1; i <= count; ++i) {
    const size_t previous_calls = calls, previous_releases = releases;
    fail_at = i; attempts = 0;
    try { action(); CHECK(false); } catch (const std::bad_alloc&) {}
    fail_at = 0;
    if (calls == previous_calls) ++input_failures; else ++output_failures;
    CHECK(releases - previous_releases == calls - previous_calls);
    CHECK(live == before);
  }
  CHECK(input_failures); CHECK(output_failures);
}
static api::Scalars scalars() {
  api::Scalars value{};
  value.bool_ = true;
  value.u8 = UINT8_MAX; value.u16 = UINT16_MAX; value.u32 = UINT32_MAX; value.u64 = UINT64_MAX;
  value.i8 = INT8_MIN; value.i16 = INT16_MIN; value.i32 = INT32_MIN; value.i64 = INT64_MIN;
  value.natural = (api::Nat(1) << 1000) + 7; value.integer = -value.natural;
  value.f32 = 1.5f; value.f64 = -2.25;
  value.text = std::string("A\0🌱", 6); value.bytes = {0, 255, 1}; value.char_ = U'🌱';
  value.word = UINT64_MAX; value.signed_word = INT64_MIN;
  return value;
}
static void round_trips() {
  const auto payload = scalars();
  CHECK(d::graph_call_scalars(echo, payload) == payload);
  auto special = payload; special.f32 = -0.0f; special.f64 = std::numeric_limits<double>::infinity();
  auto floating = d::graph_call_scalars(echo, special);
  CHECK(std::signbit(floating.f32)); CHECK(std::isinf(floating.f64));
  special.f64 = std::numeric_limits<double>::quiet_NaN();
  CHECK(std::isnan(d::graph_call_scalars(echo, special).f64));
  api::Tree tree = api::TreeBranch{{api::TreeLeaf{payload}, api::TreeBranch{}}};
  CHECK(d::graph_call_tree(echo, tree) == tree);
  api::Forest forest(512, tree);
  CHECK(d::graph_call_forest(echo, forest) == forest);
  auto copy = d::graph_call_tree(echo, tree);
  std::get<api::TreeLeaf>(std::get<api::TreeBranch>(copy.value).children[0].value).payload.text = "changed";
  CHECK(copy != tree);
  api::Envelope envelope{};
  envelope.tree = tree; envelope.alternatives = {{}, {tree}}; envelope.fallback = tree;
  envelope.outcome = api::Ok{std::pair{tree, tree}};
  CHECK(d::graph_call_envelope(echo, envelope) == envelope);
  envelope.outcome = api::Err{std::string("nested error")}; envelope.marker.emplace();
  CHECK(d::graph_call_envelope(echo, envelope) == envelope);
  CHECK(!*d::graph_call_envelope(echo, envelope).marker);
  envelope.marker->emplace(); envelope.fallback.reset();
  CHECK(d::graph_call_envelope(echo, envelope) == envelope);
  api::LeftTree mutual = api::LeftTreeNext{api::RightTreeMany{{api::LeftTreeLeaf{7}}}};
  CHECK(d::graph_call_left(echo, mutual) == mutual);
  auto right = api::RightTreeMany{{mutual, api::LeftTreeLeaf{9}}};
  CHECK(d::graph_call_right(echo, right) == api::RightTree(right));
  for (const api::Marker& marker : {api::Marker{api::MarkerEmpty{}}, api::Marker{api::MarkerUnit{{}}}, api::Marker{api::MarkerNext{api::MarkerEmpty{}}}})
    CHECK(d::graph_call_marker(echo, marker) == marker);
  CHECK(d::graph_call_empty_record(echo, {}) == api::EmptyRecord{});
  CHECK(d::graph_call_units(echo, std::vector<std::monostate>(123)).size() == 123);
  api::Wide wide = api::WideNext{};
  auto& next = std::get<api::WideNext>(wide.value);
  next.child = api::WideLeaf{17}; next.field0 = 7; next.field254 = UINT16_MAX;
  CHECK(d::graph_call_wide(echo, wide) == wide);
  allocation_failures([&] { CHECK(d::graph_call_envelope(echo, envelope) == envelope); });
  allocation_failures([&] { CHECK(d::graph_call_wide(echo, wide) == wide); });
}
static void limits() {
  size_t before_calls = calls;
  auto value = scalars(); value.natural = -1;
  reject(1, [&] { (void)d::graph_call_scalars(echo, value); }); CHECK(calls == before_calls);
  for (const auto* invalid : {"\xc0\x80", "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xf0\x9f", "\xe2X\x80", "\x80"}) {
    value = scalars(); value.text = invalid;
    reject(1, [&] { (void)d::graph_call_scalars(echo, value); }); CHECK(calls == before_calls);
  }
  value = scalars(); value.char_ = 0xd800;
  reject(1, [&] { (void)d::graph_call_scalars(echo, value); }); CHECK(calls == before_calls);
  value = scalars(); value.text.resize(16u * 1024u * 1024u);
  reject(2, [&] { (void)d::graph_call_scalars(echo, value); }); CHECK(calls == before_calls);
  value = scalars(); value.integer <<= 16u * 1024u * 1024u * 8u;
  reject(2, [&] { (void)d::graph_call_scalars(echo, value); }); CHECK(calls == before_calls);
  reject(1, [&] { (void)d::graph_call_never(echo, api::Never{}); }); CHECK(calls == before_calls);
  api::Spine spine = api::SpineLeaf{7};
  for (unsigned i = 0; i < 127; ++i) spine = api::SpineNext{std::move(spine)};
  CHECK(d::graph_call_spine(echo, spine) == spine);
  spine = api::SpineNext{std::move(spine)}; before_calls = calls;
  reject(2, [&] { (void)d::graph_call_spine(echo, spine); }); CHECK(calls == before_calls);
  api::Wide wide = api::WideLeaf{17};
  for (unsigned i = 0; i < 127; ++i) {
    api::WideNext next{}; next.child = std::move(wide);
    next.field0 = static_cast<uint16_t>(i); next.field254 = UINT16_MAX;
    wide = std::move(next);
  }
  CHECK(d::graph_call_wide(echo, wide) == wide);
  api::WideNext too_deep{}; too_deep.child = std::move(wide); wide = std::move(too_deep);
  before_calls = calls;
  reject(2, [&] { (void)d::graph_call_wide(echo, wide); }); CHECK(calls == before_calls);
  std::vector<std::monostate> many(262144);
  reject(2, [&] { (void)d::graph_call_units(echo, many); }); CHECK(calls == before_calls);
  // All arguments are checked before any view allocation or native entry.
  const api::Tree valid = api::TreeLeaf{scalars()};
  auto invalid = scalars(); invalid.char_ = 0x110000;
  reject(1, [&] { (void)d::graph_call_join_trees([](const auto*, const auto*, auto*) -> uint32_t { ++calls; return 0; }, valid, api::TreeLeaf{invalid}); });
  CHECK(calls == before_calls);
}
static void malformed_outputs() {
  const api::Spine value = api::SpineLeaf{7};
  const size_t before_releases = releases;
  reject(4, [&] { (void)d::graph_call_spine([](const auto* input, auto* output) {
    echo(input, output); output->kind = UINT32_MAX; return 0u;
  }, value); });
  reject(4, [&] { (void)d::graph_call_spine([](const auto* input, auto* output) {
    echo(input, output); output->kind = 0; output->cases.next.value = nullptr; return 0u;
  }, value); });
  reject(4, [&] { (void)d::graph_call_spine([](const auto* input, auto* output) {
    echo(input, output); output->kind = 0; output->cases.next.value = reinterpret_cast<const recursive_spine_t*>(uintptr_t(1)); return 0u;
  }, value); });
  for (uint32_t status : {1u, 2u, 3u, 4u}) reject(status, [&] {
    (void)d::graph_call_spine([&](const auto* input, auto* output) { echo(input, output); return status; }, value);
  });
  CHECK(releases == before_releases + 7);
  api::Envelope envelope{}; envelope.outcome = api::Err{std::string{}};
  reject(4, [&] { (void)d::graph_call_envelope([](const auto* input, auto* output) {
    echo(input, output); output->marker.has_value = 2; return 0u;
  }, envelope); });
  reject(2, [&] { (void)d::graph_call_scalars([](const auto* input, auto* output) {
    echo(input, output); output->text.data = nullptr; output->text.length = SIZE_MAX; return 0u;
  }, scalars()); });
  reject(4, [&] { (void)d::graph_call_scalars([](const auto* input, auto* output) {
    echo(input, output); output->bytes.data = nullptr; return 0u;
  }, scalars()); });
  reject(4, [&] { (void)d::graph_call_scalars([](const auto* input, auto* output) {
    echo(input, output); const uint8_t invalid = 2; std::memcpy(&output->bool_, &invalid, 1); return 0u;
  }, scalars()); });
  reject(4, [&] { (void)d::graph_call_scalars([](const auto* input, auto* output) {
    echo(input, output); const uint8_t invalid = 2; std::memcpy(&output->integer.negative, &invalid, 1); return 0u;
  }, scalars()); });
  reject(4, [&] { (void)d::graph_call_scalars([](const auto* input, auto* output) {
    echo(input, output); output->text.data = "\xed\xa0\x80"; output->text.length = 3; return 0u;
  }, scalars()); });
  reject(4, [&] { (void)d::graph_call_scalars([](const auto* input, auto* output) {
    echo(input, output); output->bytes.data = reinterpret_cast<const uint8_t*>(UINTPTR_MAX - 1); return 0u;
  }, scalars()); });
}
static void optional_cycles() {
  namespace linked = lean_bridge::linked;
  linked::Link terminal{};
  terminal.flags = {true, false, true}; terminal.options = {std::nullopt, std::monostate{}};
  terminal.outcome = linked::Err{std::monostate{}};
  CHECK(linked::detail::graph_call_tree(echo, terminal) == terminal);
  linked::Link head = terminal;
  head.next = linked::Box<linked::Link>{terminal}; head.outcome = linked::Ok{linked::Box<linked::Link>{terminal}};
  CHECK(linked::detail::graph_call_tree(echo, head) == head);
  auto copy = linked::detail::graph_call_tree(echo, head);
  (**copy.next).flags[0] = false;
  CHECK(copy != head && (**head.next).flags[0]);
  const size_t before = live;
  // This namespace has its own error type; the existing ledger still accounts
  // for both the pointer-to-container C layout and the single boxed C++ node.
  attempts = 0;
  CHECK(linked::detail::graph_call_tree(echo, head) == head);
  const size_t count = attempts;
  for (size_t i = 1; i <= count; ++i) {
    attempts = 0; fail_at = i;
    try { (void)linked::detail::graph_call_tree(echo, head); CHECK(false); } catch (const std::bad_alloc&) {}
    fail_at = 0; CHECK(live == before);
  }
}
int main() {
  round_trips(); limits(); malformed_outputs(); optional_cycles();
  CHECK(live == 0);
  std::printf("cpp-graphs-ok %zu\n", checks);
}
