// Independent public-value caller of the private staged C++ call boundary.
// No Lean heap layout, numeric constructors or serialized value frames here.
#include "recursive-conversions.hpp"
#include "recursive-graph.h"
#include "lean_bridge_native_runtime.h"
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <new>

extern "C" {
void* COMPONENT_INITIALIZER(uint8_t);
extern size_t cpp_graph_live, cpp_graph_attempts, cpp_graph_fail_at, cpp_graph_decodes, cpp_graph_encodes, cpp_graph_bad_encode;
}
namespace api = lean_bridge::recursive;
namespace d = api::detail;
static size_t checks, attempts, fail_at, live;
static const char* stage = "initialization";
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
template<class F> static void reject(uint32_t status, F&& action) {
  const size_t before = live;
  try { action(); CHECK(false); }
  catch (const d::GraphConversionError& error) {
    if (error.status != status) std::fprintf(stderr, "Expected status %u, got %u: %s\n", status, error.status, error.what());
    CHECK(error.status == status);
  }
  CHECK(live == before); CHECK(cpp_graph_live == 0);
}
static void exercise() {
  stage = "scalar round trips";
  api::Scalars payload{};
  payload.bool_ = true;
  payload.u8 = UINT8_MAX; payload.u16 = UINT16_MAX; payload.u32 = UINT32_MAX; payload.u64 = UINT64_MAX;
  payload.i8 = INT8_MIN; payload.i16 = INT16_MIN; payload.i32 = INT32_MIN; payload.i64 = INT64_MIN;
  payload.natural = (api::Nat(1) << 128) + 1; payload.integer = -payload.natural;
  payload.f32 = 1.5f; payload.f64 = -2.25;
  payload.text = std::string("A\0🌱", 6); payload.bytes = {0, 255, 1}; payload.char_ = U'🌱';
  payload.word = UINT32_MAX; payload.signed_word = INT32_MIN;
  CHECK(d::graph_call_inspect(recursive_inspect_graph, payload));
  CHECK(d::graph_call_scalars(recursive_scalars_graph, payload) == payload);
  CHECK(d::graph_call_word_max(recursive_word_max_graph, UINT64_MAX));
  CHECK(d::graph_call_signed_min(recursive_signed_min_graph, INT64_MIN));
  auto large = payload; large.natural = (api::Nat(1) << 1000) + 7; large.integer = -large.natural;
  CHECK(d::graph_call_scalars(recursive_scalars_graph, large) == large);
  auto zero = payload; zero.natural = 0; zero.integer = 0; zero.text.clear(); zero.bytes.clear();
  CHECK(d::graph_call_scalars(recursive_scalars_graph, zero) == zero);
  stage = "tree and sequence round trips";
  const api::Tree leaf = api::TreeLeaf{payload};
  const api::Tree tree = api::TreeBranch{{leaf, api::TreeBranch{}}};
  CHECK(d::graph_call_tree(recursive_tree_graph, tree) == tree);
  CHECK(d::graph_call_join_trees(recursive_join_trees_graph, tree, leaf) == api::Tree(api::TreeBranch{{tree, leaf}}));
  CHECK(d::graph_call_empty(recursive_empty_graph) == api::Tree(api::TreeBranch{}));
  api::Forest forest(512, tree);
  CHECK(d::graph_call_forest(recursive_forest_graph, forest) == forest);
  stage = "envelope and mutual round trips";
  api::Envelope envelope{};
  envelope.tree = tree; envelope.alternatives = {{}, {tree}}; envelope.fallback = leaf;
  envelope.outcome = api::Ok{std::pair{tree, leaf}};
  CHECK(d::graph_call_envelope(recursive_envelope_graph, envelope) == envelope);
  envelope.outcome = api::Err{std::string("nested error")}; envelope.marker.emplace();
  CHECK(d::graph_call_envelope(recursive_envelope_graph, envelope) == envelope);
  CHECK(!*d::graph_call_envelope(recursive_envelope_graph, envelope).marker);
  envelope.marker->emplace(); envelope.fallback.reset();
  CHECK(d::graph_call_envelope(recursive_envelope_graph, envelope) == envelope);
  api::LeftTree left = api::LeftTreeNext{api::RightTreeMany{{api::LeftTreeLeaf{9}}}};
  CHECK(d::graph_call_left(recursive_left_graph, left) == left);
  api::RightTree right = api::RightTreeMany{{left}};
  CHECK(d::graph_call_right(recursive_right_graph, right) == right);
  stage = "depth boundary";
  api::Spine spine = api::SpineLeaf{41};
  for (unsigned i = 0; i < 127; ++i) spine = api::SpineNext{std::move(spine)};
  auto copy = d::graph_call_spine(recursive_spine_graph, spine);
  CHECK(copy == spine);
  auto* a = &spine; auto* b = &copy;
  for (unsigned i = 0; i < 127; ++i) {
    CHECK(a != b);
    a = &*std::get<api::SpineNext>(a->value).value;
    b = &*std::get<api::SpineNext>(b->value).value;
  }
  std::get<api::SpineLeaf>(b->value).value = 42; CHECK(copy != spine);
  reject(2, [&] { (void)d::graph_call_grow(recursive_grow_graph, spine); });
  CHECK(d::graph_call_grow(recursive_grow_graph, api::SpineLeaf{7}) == api::Spine(api::SpineNext{api::SpineLeaf{7}}));
  stage = "wide and empty round trips";
  api::Wide wide = api::WideNext{};
  auto& wide_next = std::get<api::WideNext>(wide.value);
  wide_next.child = api::WideLeaf{17}; wide_next.field0 = 7; wide_next.field254 = UINT16_MAX;
  CHECK(d::graph_call_wide(recursive_wide_graph, wide) == wide);
  for (const api::Marker& marker : {api::Marker{api::MarkerEmpty{}}, api::Marker{api::MarkerUnit{{}}}, api::Marker{api::MarkerNext{api::MarkerEmpty{}}}})
    CHECK(d::graph_call_marker(recursive_marker_graph, marker) == marker);
  CHECK(d::graph_call_empty_record(recursive_empty_record_graph, {}) == api::EmptyRecord{});
  CHECK(d::graph_call_units(recursive_units_graph, std::vector<std::monostate>(123)).size() == 123);
  stage = "invalid input";
  cpp_graph_decodes = 0;
  auto invalid = payload; invalid.natural = -1;
  reject(1, [&] { (void)d::graph_call_join_trees(recursive_join_trees_graph, tree, api::TreeLeaf{invalid}); });
  CHECK(cpp_graph_decodes == 0);
  invalid = payload; invalid.text = std::string("\xc0\x80", 2);
  reject(1, [&] { (void)d::graph_call_scalars(recursive_scalars_graph, invalid); });
  CHECK(cpp_graph_decodes == 0);
  reject(1, [&] { (void)d::graph_call_never(recursive_never_graph, api::Never{}); });
  CHECK(cpp_graph_decodes == 0);
  // Fail each native arena allocation, then each C++ input/output allocation.
  const auto call = [&] { CHECK(d::graph_call_envelope(recursive_envelope_graph, envelope) == envelope); };
  cpp_graph_attempts = 0; attempts = 0; call();
  const size_t native_count = cpp_graph_attempts, cpp_count = attempts, before = live;
  stage = "native allocation failures";
  CHECK(native_count > 1); CHECK(cpp_count > 1); CHECK(cpp_graph_live == 0);
  for (size_t i = 1; i <= native_count; ++i) {
    cpp_graph_attempts = 0; cpp_graph_fail_at = i;
    reject(3, call); cpp_graph_fail_at = 0;
  }
  size_t input_failures = 0, output_failures = 0;
  stage = "C++ allocation failures";
  for (size_t i = 1; i <= cpp_count; ++i) {
    attempts = 0; fail_at = i; cpp_graph_decodes = 0;
    try { call(); CHECK(false); } catch (const std::bad_alloc&) {}
    fail_at = 0;
    if (cpp_graph_decodes) ++output_failures; else ++input_failures;
    CHECK(live == before); CHECK(cpp_graph_live == 0);
  }
  CHECK(input_failures); CHECK(output_failures);
  stage = "malformed carrier";
  cpp_graph_encodes = 0; cpp_graph_bad_encode = 1;
  reject(4, call); cpp_graph_bad_encode = 0;
  // This private test bypasses retirement policy; public admission stays off.
  call(); CHECK(cpp_graph_live == 0);
}
int main() {
  CHECK(lean_bridge_native_component_initialize("recursive@1.0.0", COMPONENT_INITIALIZER));
  const size_t before = live;
  try { exercise(); }
  catch (const d::GraphConversionError& error) {
    fail_at = cpp_graph_fail_at = 0;
    std::fprintf(stderr, "%s: unexpected graph status %u: %s (allocation %zu)\n", stage, error.status, error.what(), attempts);
    return 2;
  }
  catch (const std::exception& error) {
    fail_at = cpp_graph_fail_at = 0;
    std::fprintf(stderr, "%s: %s (allocation %zu)\n", stage, error.what(), attempts);
    return 2;
  }
  CHECK(live == before); CHECK(cpp_graph_live == 0);
  lean_bridge_native_component_detach("recursive@1.0.0");
  std::printf("cpp-native-graphs-ok %zu\n", checks);
}
