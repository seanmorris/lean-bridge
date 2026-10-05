// Independent C++20 caller, using only the prepared public header.
#include "recursive.hpp"
#include <cassert>
#include <cstdio>
namespace api = lean_bridge::recursive;
static size_t checks;
#define CHECK(expression) do { ++checks; assert(expression); } while (0)
template<class F> static void reject(F&& action) {
  try { action(); CHECK(false); }
  catch (const api::Error& error) { CHECK(error.status == RECURSIVE_STATUS_INVALID_ARGUMENT); CHECK(error.code == RECURSIVE_ERROR_INVALID_ARGUMENT); CHECK(*error.what()); }
}
int main() {
  api::Scalars payload{};
  payload.bool_ = true; payload.u8 = UINT8_MAX; payload.u16 = UINT16_MAX; payload.u32 = UINT32_MAX; payload.u64 = UINT64_MAX;
  payload.i8 = INT8_MIN; payload.i16 = INT16_MIN; payload.i32 = INT32_MIN; payload.i64 = INT64_MIN;
  payload.natural = (api::Nat(1) << 128) + 1; payload.integer = -payload.natural;
  payload.f32 = 1.5f; payload.f64 = -2.25;
  payload.text = std::string("A\0🌱", 6); payload.bytes = {0, 255, 1}; payload.char_ = U'🌱';
  payload.word = UINT32_MAX; payload.signed_word = INT32_MIN;
  CHECK(api::inspect(payload)); CHECK(api::scalars(payload) == payload);
  CHECK(api::word_max(UINT64_MAX)); CHECK(api::signed_min(INT64_MIN));
  auto large = payload; large.natural = (api::Nat(1) << 1000) + 7; large.integer = -large.natural;
  CHECK(api::scalars(large) == large);
  auto zero = payload; zero.natural = 0; zero.integer = 0; zero.text.clear(); zero.bytes.clear();
  CHECK(api::scalars(zero) == zero);
  const api::Tree leaf = api::TreeLeaf{payload};
  const api::Tree tree = api::TreeBranch{{leaf, api::TreeBranch{}}};
  CHECK(api::tree(tree) == tree);
  CHECK(api::join_trees(tree, leaf) == api::Tree(api::TreeBranch{{tree, leaf}}));
  CHECK(api::empty() == api::Tree(api::TreeBranch{}));
  api::Forest forest(512, tree); CHECK(api::forest(forest) == forest);
  api::Envelope envelope{};
  envelope.tree = tree; envelope.alternatives = {{}, {tree}}; envelope.fallback = leaf;
  envelope.outcome = api::Ok{std::pair{tree, leaf}};
  CHECK(api::envelope(envelope) == envelope);
  envelope.outcome = api::Err{std::string("nested\0error", 12)}; envelope.marker.emplace();
  CHECK(api::envelope(envelope) == envelope); CHECK(!*api::envelope(envelope).marker);
  envelope.marker->emplace(); envelope.fallback.reset(); CHECK(api::envelope(envelope) == envelope);
  api::LeftTree left = api::LeftTreeNext{api::RightTreeMany{{api::LeftTreeLeaf{9}}}};
  CHECK(api::left(left) == left);
  api::RightTree right = api::RightTreeMany{{left}}; CHECK(api::right(right) == right);
  api::Spine spine = api::SpineLeaf{41};
  for (unsigned i = 0; i < 127; ++i) spine = api::SpineNext{std::move(spine)};
  auto copy = api::spine(spine), own_copy = spine; CHECK(copy == spine && own_copy == spine);
  auto* a = &spine; auto* b = &copy; auto* c = &own_copy;
  for (unsigned i = 0; i < 127; ++i) {
    CHECK(a != b && a != c && b != c);
    a = &*std::get<api::SpineNext>(a->value).value;
    b = &*std::get<api::SpineNext>(b->value).value;
    c = &*std::get<api::SpineNext>(c->value).value;
  }
  std::get<api::SpineLeaf>(b->value).value = 42; CHECK(copy != spine && own_copy == spine);
  reject([&] { (void)api::grow(spine); });
  CHECK(api::grow(api::SpineLeaf{7}) == api::Spine(api::SpineNext{api::SpineLeaf{7}}));
  api::Wide wide = api::WideNext{};
  auto& wide_next = std::get<api::WideNext>(wide.value);
  wide_next.child = api::WideLeaf{17}; wide_next.field0 = 7; wide_next.field254 = UINT16_MAX;
  CHECK(api::wide(wide) == wide);
  for (const api::Marker& marker : {api::Marker{api::MarkerEmpty{}}, api::Marker{api::MarkerUnit{{}}}, api::Marker{api::MarkerNext{api::MarkerEmpty{}}}})
    CHECK(api::marker(marker) == marker);
  CHECK(api::empty_record({}) == api::EmptyRecord{});
  CHECK(api::units(std::vector<std::monostate>(123)).size() == 123);
  auto invalid = payload; invalid.natural = -1;
  reject([&] { (void)api::join_trees(tree, api::TreeLeaf{invalid}); });
  invalid = payload; invalid.text = std::string("\xc0\x80", 2);
  reject([&] { (void)api::scalars(invalid); });
  invalid = payload; invalid.char_ = 0xd800; reject([&] { (void)api::scalars(invalid); });
  reject([&] { (void)api::never(api::Never{}); });
  reject([&] { (void)api::spine(api::SpineNext{}); });
  for (unsigned i = 0; i < 100; ++i) CHECK(api::envelope(envelope) == envelope);
  std::printf("recursive-installed-ok:%zu\n", checks);
}
