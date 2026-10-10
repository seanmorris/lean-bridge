#include <finrecordzero.hpp>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
namespace api = lean_bridge::finrecordzero;
using Nat = api::Nat;
static unsigned checks;
#define CHECK(value) do { if (!(value)) { std::fprintf(stderr, "failed at %d\n", __LINE__); std::exit(1); } ++checks; } while (0)
static api::Fields fields(const std::string& member = "", const Nat& digit = 0) {
  return {"kept", {Nat(7), Nat(1) << 100}, member == "array" ? std::vector<Nat>{digit} : std::vector<Nat>{}, member == "list" ? std::vector<Nat>{digit} : std::vector<Nat>{}};
}
template<class Call, class Build> static bool refused(Call call, Build build, const std::string& path) {
  auto value = build(); const auto before = build();
  try { call(value); }
  catch (const api::Error& error) {
    return error.status == FINRECORDZERO_STATUS_INVALID_ARGUMENT && std::string(error.what()) == path + " is not below its Fin 0 bound" && value == before;
  }
  return false;
}
int main() {
  for (const auto call : {api::array_records, api::list_records}) {
    CHECK(call({}).empty());
    for (const Nat& digit : std::vector<Nat>{0, 1, Nat(1) << 100})
      CHECK(refused(call, [&] { return std::vector<api::Zero>{{digit}}; }, "arg0[0].digit"));
    CHECK(call({}).empty());
  }
  CHECK(api::field_collections(fields()) == fields());
  for (const std::string& member : {std::string("array"), std::string("list")})
    for (const Nat& digit : std::vector<Nat>{0, 1, Nat(1) << 100})
      CHECK(refused(api::field_collections, [&] { return fields(member, digit); }, "arg0." + member + "[0]"));
  CHECK(api::field_collections(fields()) == fields());
  for (const auto call : {api::array_fields, api::list_fields}) {
    const auto row = [] { return std::vector<api::Fields>{fields(), fields(), fields()}; };
    CHECK(call({}).empty());
    CHECK(call(row()) == row());
    for (unsigned index = 0; index < 3; ++index) for (const std::string& member : {std::string("array"), std::string("list")}) {
      CHECK(refused(call, [&] { auto values = row(); values[index] = fields(member); return values; }, "arg0[" + std::to_string(index) + "]." + member + "[0]"));
      CHECK(call(row()) == row());
    }
  }
  for (unsigned index = 0; index < 1000; ++index) {
    CHECK(api::field_collections(fields()) == fields());
    const std::string member = index % 2 ? "list" : "array";
    CHECK(refused(api::field_collections, [&] { return fields(member, index); }, "arg0." + member + "[0]"));
  }
  std::printf("fin-record-zero-ok:%u\n", checks);
}
