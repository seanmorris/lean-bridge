#include "collections.hpp"
#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <limits>
#include <new>
#include <set>
#include <type_traits>

namespace api=lean_bridge::collections;
static size_t checks,calls,rejected,allocation_failures,live;
static long remaining=-1;
#define CHECK(x) do { ++checks; assert((x)); } while (0)
void* operator new(size_t size) {
  if (remaining==0) throw std::bad_alloc();
  if (remaining>0) --remaining;
  void* value=std::malloc(size?size:1);
  if (!value) throw std::bad_alloc();
  ++live; return value;
}
void* operator new[](size_t size) { return ::operator new(size); }
void operator delete(void* value) noexcept { if (value) { --live; std::free(value); } }
void operator delete[](void* value) noexcept { ::operator delete(value); }
void operator delete(void* value,size_t) noexcept { ::operator delete(value); }
void operator delete[](void* value,size_t) noexcept { ::operator delete(value); }
template<class F> static auto call(F fn) { ++calls; return fn(); }
template<class F> static void invalid(F fn) {
  try { ++calls; fn(); CHECK(false); }
  catch (const api::Error& error) { CHECK(error.status==COLLECTIONS_STATUS_INVALID_ARGUMENT); ++rejected; }
}
template<class T> static bool same(const T& a,const T& b) {
  if constexpr (std::is_floating_point_v<T>)
    return (std::isnan(a)&&std::isnan(b)) || (a==b && (a!=0 || std::signbit(a)==std::signbit(b)));
  else return a==b;
}
static api::Primitives primitives() {
  api::Primitives p{};
  p.flag=true; p.u8=UINT8_MAX; p.u16=UINT16_MAX; p.u32=UINT32_MAX; p.u64=UINT64_MAX;
  p.i8=INT8_MIN; p.i16=INT16_MIN; p.i32=INT32_MIN; p.i64=INT64_MIN;
  p.natural=api::Nat(1)<<200; p.integer=-(api::Int(1)<<200);
  p.f32=-0.0f; p.f64=3.25; p.text=std::string("🌱\0",5); p.bytes={255,0,1};
  p.char_=U'🌱'; p.usize=UINT64_MAX; p.isize=INT32_MIN; return p;
}
static void arrays() {
  /* array cases */
  const auto p=primitives();
  /* independent Lean element checks */
  const auto words=call([] { return api::array_words(); });
  CHECK(words==std::vector<std::vector<std::string>>({{std::string("\xef\xbb\xbfLean",7),std::string("🌱\0",5)},{}}));
  const api::Int big=(api::Int(1)<<5120)+31;
  const std::vector<std::vector<api::Int>> integers{{big,-big,0},{},{-1}};
  CHECK(call([&] { return api::array_add(big,integers); })==std::vector<std::vector<api::Int>>({{big+big,0,big},{},{big-1}}));
  CHECK(call([&] { return api::array_total({{api::Nat(1)<<5120,17},{},{3}}); })==(api::Nat(1)<<5120)+20);
  CHECK(call([] { return api::array_size({{},{},{}}); })==3);
  CHECK(call([] { return api::array_size({}); })==0);
  for (char32_t value : {char32_t(0xd800),char32_t(0xdfff),char32_t(0x110000)})
    invalid([&] { api::array_reverse_char({{U'A'},{value},{U'Z'}}); });
  invalid([] { api::array_reverse_nat({{1},{-1},{2}}); });
  for (const auto& text : {std::string("\xff",1),std::string("\xc0\x80",2),std::string("\xed\xa0\x80",3)})
    invalid([&] { api::array_reverse_string({{"valid"},{text},{"later"}}); });
  CHECK(call([] { return api::array_reverse_char({{U'A'}}); })==std::vector<std::vector<char32_t>>{{U'A'}});
}
static api::Packet packet() {
  const auto p=primitives();
  return api::Packet{"start",{{p,p},{},{p}},api::Empty{},api::Single{UINT64_MAX},api::Count{api::Nat(1)<<5120},api::Pair{17,"pair"},api::Reversed{"reversed",23}};
}
static void records() {
  const auto p=primitives();
  CHECK(call([&] { return api::record_inspect(p); }));
  for (unsigned field=0;field<18;++field) {
    auto wrong=p;
    switch (field) {
      case 0: wrong.flag=false; break; case 1: wrong.u8=0; break; case 2: wrong.u16=0; break;
      case 3: wrong.u32=0; break; case 4: wrong.u64=0; break; case 5: wrong.i8=0; break;
      case 6: wrong.i16=0; break; case 7: wrong.i32=0; break; case 8: wrong.i64=0; break;
      case 9: wrong.natural=0; break; case 10: wrong.integer=0; break; case 11: wrong.f32=0; break;
      case 12: wrong.f64=0; break; case 13: wrong.text="wrong"; break; case 14: wrong.bytes={}; break;
      case 15: wrong.char_=U'A'; break; case 16: wrong.usize=0; break; case 17: wrong.isize=0; break;
    }
    CHECK(!call([&] { return api::record_inspect(wrong); }));
  }
  const auto original=packet(); auto expected=original;
  expected.label+="!"; std::reverse(expected.values.begin(),expected.values.end());
  for (auto& row:expected.values) std::reverse(row.begin(),row.end());
  expected.single.value=0; expected.count.value+=7;
  ++expected.pair.first; expected.pair.second+="p"; expected.reversed.first+=2; expected.reversed.second+="r";
  for (unsigned round=0;round<128;++round) {
    auto output=call([&] { return api::record_shuffle(original); }); CHECK(output==expected);
    CHECK(output.values[0][0].text.data()!=original.values[2][0].text.data());
    output.values[0][0].bytes[0]=13; output.values[0][0].natural+=1;
    CHECK(original.values[2][0]==p); CHECK(output.values[2][0]==p); CHECK(output.values[2][1]==p);
    CHECK(call([&] { return api::record_reverse({p,p}); })==std::vector<api::Primitives>({p,p}));
    CHECK(call([] { return api::record_empty({}); })==api::Empty{});
    CHECK(call([] { return api::record_single({UINT64_MAX}); }).value==0);
    CHECK(call([&] { return api::record_count(original.count); }).value==original.count.value+1);
  }
  auto siblings=call([&] { return api::record_duplicate(original); }); CHECK(siblings==std::vector<api::Packet>({original,original}));
  siblings[0].values[0][0].bytes[0]=7; siblings[0].count.value+=1;
  CHECK(siblings[1]==original);
  auto empty=original; empty.values.clear(); CHECK(call([&] { return api::record_duplicate(empty); })==std::vector<api::Packet>({empty,empty}));
  CHECK(call([] { return api::record_reverse({}); }).empty());
  const auto made=call([] { return api::record_make(); }); CHECK(made.first==42 && made.second==std::string("\xef\xbb\xbf🌱\0",8));
  auto bad=p; bad.char_=0xd800; invalid([&] { api::record_reverse({p,bad,p}); });
  bad=p; bad.natural=-1; invalid([&] { api::record_inspect(bad); });
  bad=p; bad.text=std::string("\xff",1); invalid([&] { api::record_inspect(bad); });
  CHECK(call([&] { return api::record_inspect(p); }));
}
static void deep() {
  /* deep cases */
}
static void ownership() {
  std::vector<std::vector<uint8_t>> saved;
  { std::vector<std::vector<uint8_t>> input{{0,255,1},{}}; saved=call([&] { return api::array_duplicate(input); }); input[0][0]=7; }
  CHECK(saved==std::vector<std::vector<uint8_t>>({{0,255,1},{},{0,255,1},{}}));
  saved[0][0]=13; CHECK(saved[2][0]==0);
  const auto input=packet();
  CHECK(call([&] { return api::record_duplicate(input); })==std::vector<api::Packet>({input,input}));
  const size_t baseline=live; bool succeeded=false;
  for (long limit=0;limit<4096;++limit) {
    remaining=limit;
    try { auto result=call([&] { return api::record_duplicate(input); }); remaining=-1; CHECK(result==std::vector<api::Packet>({input,input})); succeeded=true; }
    catch (const std::bad_alloc&) { remaining=-1; ++allocation_failures; }
    CHECK(live==baseline); if (succeeded) break;
  }
  CHECK(succeeded && allocation_failures>10);
  const std::vector<uint8_t> large(6u*1024u*1024u,0);
  invalid([&] { api::array_duplicate({large}); });
  invalid([] { api::generate(api::Nat(17u*1024u*1024u)); });
  const auto generated=call([] { return api::generate(30000); }); CHECK(generated.size()==30000);
  for (auto value:generated) CHECK(value==std::monostate{});
  CHECK(call([&] { return api::record_inspect(primitives()); }));
}
int main() {
  static_assert(sizeof(size_t)==8); arrays(); records(); deep(); ownership();
  std::ifstream maps("/proc/self/maps"); std::string line; std::set<std::string> libraries;
  while (std::getline(maps,line)) {
    const auto start=line.find('/'); if (start==std::string::npos) continue; const auto path=line.substr(start);
    if (path.find("libcollections.so")!=std::string::npos || path.find("libcomponent_")!=std::string::npos || path.find("liblean_")!=std::string::npos || path.find("libleanshared.so")!=std::string::npos) libraries.insert(path);
  }
  CHECK(libraries.size()==4);
  std::printf("collection-ok:%zu:%zu:%zu:%zu\n",checks,calls,rejected,allocation_failures);
  for (const auto& path:libraries) std::printf("library:%s\n",path.c_str());
}
