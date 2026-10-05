#include "compounds.hpp"
#include <cassert>
#include <cmath>
#include <cstdio>
#include <limits>
namespace api = lean_bridge::compounds;
static unsigned checks;
#define CHECK(x) do { ++checks; assert(x); } while (0)
template<class T> bool same(const T& a, const T& b) {
  if constexpr (std::is_floating_point_v<T>) return (std::isnan(a) && std::isnan(b)) || (a == b && (a != 0 || std::signbit(a) == std::signbit(b)));
  else return a == b;
}
int main() {
  /* scalar cases */
  std::optional<std::optional<std::monostate>> state;
  for (unsigned step = 0; step < 30; ++step) { CHECK(api::classify(state) == step % 3); state = api::next(state); }
  auto made = api::make(); CHECK(made.has_value());
  using Made = std::pair<uint64_t, std::monostate>;
  CHECK(std::holds_alternative<api::Ok<Made>>(*made)); CHECK(std::get<api::Ok<Made>>(*made).value.first == UINT64_MAX);
  using Pair = std::pair<uint32_t, std::optional<std::monostate>>;
  auto flipped = api::flip(api::Ok<Pair>{{42, std::monostate{}}});
  CHECK(std::holds_alternative<api::Err<Pair>>(flipped)); CHECK(std::get<api::Err<Pair>>(flipped).value.first == 42);
  CHECK(std::get<api::Err<Pair>>(flipped).value.second.has_value());
  api::Packet packet{};
  using Choice = std::pair<api::Nat, std::monostate>;
  packet.choice = api::Ok<Choice>{{api::Nat(1) << 100, {}}}; packet.products = {{4, std::string("a\0", 2)}, {true, U'🌱'}};
  using RowOk = std::pair<std::string, uint64_t>; using RowErr = std::pair<std::vector<uint8_t>, api::Int>;
  packet.rows = {std::nullopt, api::Ok<RowOk>{{std::string("x\0🌱", 6), UINT64_MAX}}, api::Err<RowErr>{{{0, 255}, -(api::Int(1) << 96)}}};
  packet.nested = api::Err<std::optional<api::Nat>>{std::optional<api::Nat>{123}};
  for (unsigned round = 0; round < 30; ++round) {
    auto copied = api::transform(packet); CHECK(copied.choice.has_value());
    CHECK(std::get<api::Ok<Choice>>(*copied.choice).value.first == (api::Nat(1) << 100) + 1);
    CHECK(copied.products.first.first == 5 && copied.products.first.second == std::string("a\0!", 3));
    CHECK(!copied.products.second.first && copied.products.second.second == U'🌱'); CHECK(copied.rows.size() == 3 && !copied.rows[2]);
    CHECK(std::get<api::Err<RowErr>>(*copied.rows[0]).value.second == -(api::Int(1) << 96));
    CHECK(std::get<api::Ok<RowOk>>(*copied.rows[1]).value.first == std::string("x\0🌱", 6));
    CHECK(std::get<api::Err<std::optional<api::Nat>>>(copied.nested).value == std::optional<api::Nat>{123});
    std::get<api::Err<RowErr>>(*copied.rows[0]).value.first[0] = 5;
    CHECK(std::get<api::Err<RowErr>>(*packet.rows[2]).value.first[0] == 0);
  }
  for (double value : {std::numeric_limits<double>::quiet_NaN(), double(INFINITY), -double(INFINITY), -0.0, 0.0}) {
    CHECK(same(*api::option_float64(value), value)); auto result = api::result_float64(api::Ok<double>{value}); CHECK(same(std::get<api::Err<double>>(result).value, value));
  }
  try { api::option_nat(api::Nat(-1)); CHECK(false); } catch(const api::Error& error) { CHECK(error.status == COMPOUNDS_STATUS_INVALID_ARGUMENT); }
  try { api::option_char(char32_t(0xd800)); CHECK(false); } catch(const api::Error& error) { CHECK(error.status == COMPOUNDS_STATUS_INVALID_ARGUMENT); }
  try { api::duplicate(std::vector<uint8_t>(6u * 1024u * 1024u)); CHECK(false); } catch(const api::Error& error) { CHECK(error.status == COMPOUNDS_STATUS_INVALID_ARGUMENT); }
  auto duplicated = api::duplicate(std::vector<uint8_t>{0, 255});
  using Bytes = std::optional<std::vector<std::vector<uint8_t>>>;
  auto& rows = *std::get<api::Ok<Bytes>>(duplicated).value; CHECK(rows.size() == 2 && rows[0] == rows[1]); rows[0][0] = 5; CHECK(rows[1][0] == 0);
  auto empty = api::duplicate(std::nullopt); CHECK(std::get<api::Err<std::string>>(empty).value == "empty");
  /* deep cases */
  printf("compound-ok:%u\n", checks);
}
