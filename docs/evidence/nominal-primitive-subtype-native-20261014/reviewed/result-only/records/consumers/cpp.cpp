#define PRIMITIVE_RESULT_ONLY
#define PRIMITIVE_PARAMETER_PREFIX "value"
#include <nominalprimitivesubtypes.hpp>
#include <bit>
#include <cmath>
#include <cstdio>
#include <limits>
#include <optional>
#include <stdexcept>
#include <string>
#include <tuple>
#include <type_traits>
#include <utility>
#include <variant>
#include <vector>

#ifndef PRIMITIVE_PARAMETER_PREFIX
#define PRIMITIVE_PARAMETER_PREFIX "arg"
#endif
namespace api = lean_bridge::nominalprimitivesubtypes;
using Packet = api::Packet;
using RawPacket = api::RawPacket;
using Maybe = std::optional<Packet>;
using Group = std::vector<Maybe>;
using Choice = api::Result<Packet, Packet>;
using Choices = std::vector<std::optional<Choice>>;
static unsigned checks, rejections, snapshot_controls;
static void check(bool condition, const std::string& label) {
  if (!condition) throw std::runtime_error(label);
  ++checks;
}
static std::string frame(const std::string& text) { return std::to_string(text.size()) + ":" + text; }

// Independent snapshots preserve all primitive fields, branch tags and IEEE bits.
// They do not inspect generated metadata, adapters or runtime results for expectations.
template<class T> static std::string snapshot(const T& value) {
  if constexpr (std::is_same_v<T, std::monostate>) return "unit";
  else if constexpr (std::is_same_v<T, bool>) return value ? "true" : "false";
  else if constexpr (std::is_same_v<T, float>) return "float32:" + std::to_string(std::bit_cast<uint32_t>(value));
  else if constexpr (std::is_same_v<T, double>) return "float64:" + std::to_string(std::bit_cast<uint64_t>(value));
  else if constexpr (std::is_integral_v<T>) return "integer:" + std::to_string(value);
  else if constexpr (std::is_same_v<T, api::Nat> || std::is_same_v<T, api::Int>) return "bigint:" + value.template convert_to<std::string>();
  else if constexpr (std::is_same_v<T, std::string>) return "text:" + frame(value);
  else if constexpr (std::is_same_v<T, Packet> || std::is_same_v<T, RawPacket>) {
    const auto fields = std::tie(value.unit_value, value.bool_value, value.uint8_value,
      value.uint16_value, value.uint32_value, value.uint64_value, value.int8_value,
      value.int16_value, value.int32_value, value.int64_value, value.nat_value,
      value.int_value, value.float32_value, value.float64_value, value.text_value,
      value.bytes_value, value.char_value, value.usize_value, value.isize_value, value.digit);
    return (std::is_same_v<T, Packet> ? "packet:" : "raw:") + snapshot(fields);
  } else if constexpr (std::is_same_v<T, api::Pair>) return "pair:" + frame(snapshot(value.left)) + frame(snapshot(value.right));
  else if constexpr (std::is_same_v<T, api::EventEmpty>) return "empty";
  else if constexpr (std::is_same_v<T, api::EventBox>) return "box:" + snapshot(value.value);
  else if constexpr (std::is_same_v<T, api::EventChoices>) return "choices:" + snapshot(value.values);
  else if constexpr (std::is_same_v<T, api::Ok<Packet>>) return "ok:" + snapshot(value.value);
  else if constexpr (std::is_same_v<T, api::Err<Packet>>) return "error:" + snapshot(value.value);
  else if constexpr (requires { std::tuple_size<T>::value; }) {
    std::string result = "tuple:";
    std::apply([&](const auto&... items) { ((result += frame(snapshot(items))), ...); }, value);
    return result;
  } else if constexpr (requires { std::variant_size<T>::value; }) {
    if (value.valueless_by_exception()) throw std::runtime_error("snapshot received empty variant");
    return "variant:" + std::to_string(value.index()) + ":" + std::visit([](const auto& child) { return snapshot(child); }, value);
  } else if constexpr (requires { value.has_value(); }) return value ? "some:" + snapshot(*value) : "none";
  else if constexpr (requires { value.begin(); value.end(); value.size(); }) {
    std::string result = "sequence:" + std::to_string(value.size()) + ":";
    for (const auto& child : value) result += frame(snapshot(child));
    return result;
  } else static_assert(sizeof(T) == 0, "Unsupported independent snapshot type");
}
template<class T = Packet> static T packet() {
  return T{{}, true, 42, 42, 42, 42, -42, -42, -42, -42,
    api::Nat(42), api::Int(-42), 1.5f, 1.5, "a", {0, 128, 255}, U'a', 42, -42, api::Nat(2)};
}
template<class T> static Packet project(const T& value) {
  return Packet{value.unit_value, value.bool_value, value.uint8_value, value.uint16_value,
    value.uint32_value, value.uint64_value, value.int8_value, value.int16_value,
    value.int32_value, value.int64_value, value.nat_value, value.int_value,
    value.float32_value, value.float64_value, value.text_value, value.bytes_value,
    value.char_value, value.usize_value, value.isize_value, value.digit};
}
#ifndef PRIMITIVE_RESULT_ONLY
static Packet normalized() {
  return Packet{{}, true, 44, 44, 44, 44, -40, -40, -40, -40,
    api::Nat(44), api::Int(-40), -1.5f, -1.5, "a!", {0, 128, 255, 255}, U'b', 44, -40, api::Nat(2)};
}
#endif
template<class T = Packet> static T produced() {
  return T{{}, true, 200, 200, 200, 200, 120, 120, 120, 120,
    api::Nat(1) << 100, -(api::Int(1) << 100), 12.5f, 12.5,
    "long λ text", {0, 1, 2, 3, 4, 5, 128, 254, 255}, U'λ', 200, 200, api::Nat(2)};
}
template<class F, class A, class E> static auto call(const std::string& name, F callable, const A& args, const E& expected) {
  const auto before = snapshot(args);
  auto actual = std::apply(callable, args);
  check(snapshot(actual) == snapshot(expected), name + " exact output");
  check(snapshot(args) == before, name + " caller unchanged");
  return actual;
}
#ifndef PRIMITIVE_RESULT_ONLY
template<class F, class A> static void refuse(F callable, const A& args, const std::string& expected) {
  const auto before = snapshot(args); bool refused = false;
  try { (void)std::apply(callable, args); }
  catch (const api::Error& error) {
    check(error.status == NOMINALPRIMITIVESUBTYPES_STATUS_INVALID_ARGUMENT
      && error.code == NOMINALPRIMITIVESUBTYPES_ERROR_INVALID_ARGUMENT
      && error.what() == expected, "exact refusal: " + expected);
    refused = true;
  }
  if (!refused) throw std::runtime_error("invalid input accepted: " + expected);
  check(snapshot(args) == before, "refused caller unchanged"); ++rejections;
}
#endif
template<class Change> static void invalid_field(Change change, const std::string& field, const std::string& constructor) {
  auto raw = packet<RawPacket>(); change(raw);
  call("produce refuses " + field, api::produce, std::tie(raw), Maybe{});
#ifndef PRIMITIVE_RESULT_ONLY
  auto value = packet(); change(value);
  const std::string path = PRIMITIVE_PARAMETER_PREFIX "0." + field;
  refuse(api::echo_a, std::tie(value), field == "digit" ? path + " is not below its Fin 3 bound"
    : path + " was rejected by NominalPrimitiveSubtypes." + constructor);
#else
  (void)constructor;
#endif
}
#ifndef PRIMITIVE_RESULT_ONLY
template<class Change> static void strict_constructor(Change change, const std::string& field, const std::string& constructor) {
  auto raw = packet<RawPacket>(); change(raw);
  call("weak predicate accepts " + field, api::produce, std::tie(raw), Maybe{project(raw)});
  auto value = packet(); change(value);
  refuse(api::echo_a, std::tie(value), PRIMITIVE_PARAMETER_PREFIX "0." + field + " was rejected by NominalPrimitiveSubtypes." + constructor);
}
#endif
static void run() {
  const auto out = produced(); const auto raw_out = produced<RawPacket>();
  const auto different = [](const auto& a, const auto& b) { check(snapshot(a) != snapshot(b), "snapshot mutation"); ++snapshot_controls; };
  different(std::monostate{}, false); different(false, 0); different(0, 0.0);
  different(0.0, -0.0); different(std::vector<uint8_t>{0}, std::vector<uint8_t>{1});
  different(std::string("a\0λ😀", 8), std::string("aλ😀"));
  different(Group{std::nullopt, out}, Group{out, std::nullopt});
  different(api::Event(api::EventBox{out}), api::Event(api::EventChoices{Choices{Choice{api::Ok<Packet>{out}}}}));
  different(packet(), packet<RawPacket>());
  call("word_bits", api::word_bits, std::tuple{}, uint32_t(64));
  const Group group{std::nullopt, out};
  call("produce", api::produce, std::tie(raw_out), Maybe{out});
  call("produce_group", api::produce_group, std::tie(raw_out), group);
  call("produce_pair", api::produce_pair, std::tie(raw_out), api::Pair{group, group});
  call("produce_event", api::produce_event, std::tie(raw_out), api::Event(api::EventBox{out}));
  call("produce_choices", api::produce_choices, std::tie(raw_out), api::Event(api::EventChoices{
    Choices{std::nullopt, Choice{api::Ok<Packet>{out}}, Choice{api::Err<Packet>{out}}}}));
#define INVALID(field, value, diagnostic, constructor) invalid_field([](auto& p) { p.field = value; }, diagnostic, constructor)
  INVALID(bool_value, false, "boolValue", "boolA");
  INVALID(uint8_value, 43, "uint8Value", "uint8A");
  INVALID(uint16_value, 43, "uint16Value", "uint16A");
  INVALID(uint32_value, 43, "uint32Value", "uint32A");
  INVALID(uint64_value, 43, "uint64Value", "uint64A");
  INVALID(int8_value, -43, "int8Value", "int8A");
  INVALID(int16_value, -43, "int16Value", "int16A");
  INVALID(int32_value, -43, "int32Value", "int32A");
  INVALID(int64_value, -43, "int64Value", "int64A");
  INVALID(nat_value, 43, "natValue", "natA");
  INVALID(int_value, -43, "intValue", "intA");
  INVALID(float32_value, std::numeric_limits<float>::infinity(), "float32Value", "float32A");
  INVALID(float64_value, std::numeric_limits<double>::infinity(), "float64Value", "float64A");
  INVALID(text_value, "", "textValue", "textA");
  INVALID(bytes_value, std::vector<uint8_t>{}, "bytesValue", "bytesA");
  INVALID(char_value, U'\0', "charValue", "charA");
  INVALID(usize_value, 43, "usizeValue", "usizeA");
  INVALID(isize_value, -43, "isizeValue", "isizeA");
  INVALID(digit, 3, "digit", "");
#undef INVALID
  auto absent = packet<RawPacket>(); absent.nat_value = 43;
  call("absent group", api::produce_group, std::tie(absent), Group{std::nullopt});
  call("absent pair", api::produce_pair, std::tie(absent), api::Pair{{std::nullopt}, {std::nullopt}});
  call("absent event", api::produce_event, std::tie(absent), api::Event(api::EventEmpty{}));
  call("absent choices", api::produce_choices, std::tie(absent), api::Event(api::EventChoices{{std::nullopt}}));
#ifdef PRIMITIVE_RESULT_ONLY
  for (unsigned round = 0; round < 256; ++round) {
    auto raw = produced<RawPacket>(); raw.nat_value += round * 2;
    call("repeated result", api::produce, std::tie(raw), Maybe{project(raw)});
  }
#else
  const auto a = packet(), n = normalized(); auto b = packet(); b.bool_value = false;
#define STRICT(field, value, diagnostic, constructor) strict_constructor([](auto& p) { p.field = value; }, diagnostic, constructor)
  STRICT(uint8_value, 100, "uint8Value", "uint8A"); STRICT(uint16_value, 100, "uint16Value", "uint16A");
  STRICT(uint32_value, 100, "uint32Value", "uint32A"); STRICT(uint64_value, 100, "uint64Value", "uint64A");
  STRICT(int8_value, 100, "int8Value", "int8A"); STRICT(int16_value, 100, "int16Value", "int16A");
  STRICT(int32_value, 100, "int32Value", "int32A"); STRICT(int64_value, 100, "int64Value", "int64A");
  STRICT(nat_value, 100, "natValue", "natA"); STRICT(int_value, 100, "intValue", "intA");
  STRICT(float32_value, 12.5f, "float32Value", "float32A"); STRICT(float64_value, 12.5, "float64Value", "float64A");
  STRICT(text_value, "long λ text", "textValue", "textA");
  STRICT(bytes_value, (std::vector<uint8_t>{0, 1, 2, 3, 4, 5, 6, 7}), "bytesValue", "bytesA");
  STRICT(char_value, U'λ', "charValue", "charA");
  STRICT(usize_value, 100, "usizeValue", "usizeA"); STRICT(isize_value, 100, "isizeValue", "isizeA");
#undef STRICT
  call("echo_a", api::echo_a, std::tie(a), a); call("echo_b", api::echo_b, std::tie(b), n);
  refuse(api::refuse_unit, std::tie(a), PRIMITIVE_PARAMETER_PREFIX "0.unitValue was rejected by NominalPrimitiveSubtypes.unitReject");
  call("combine", api::combine, std::tie(a, b), std::make_pair(a, n));
  const api::Pair pair{{std::nullopt, a}, {b}};
  call("echo_pair", api::echo_pair, std::tie(pair), api::Pair{{std::nullopt, a}, {n}});
  const Group left{std::nullopt, a}, right{b, std::nullopt};
  call("aliases", api::aliases, std::tie(left, right), Group{std::nullopt, a, n, std::nullopt});
  const api::Event empty = api::EventEmpty{}, box_a = api::EventBox{a}, box_b = api::EventBox{b};
  call("empty A", api::echo_event_a, std::tie(empty), empty);
  call("empty B", api::echo_event_b, std::tie(empty), empty);
  call("box A", api::echo_event_a, std::tie(box_a), box_a);
  call("box B", api::echo_event_b, std::tie(box_b), api::Event(api::EventBox{n}));
  const api::Event choices_a = api::EventChoices{Choices{std::nullopt, Choice{api::Ok<Packet>{a}}, Choice{api::Err<Packet>{b}}}};
  const api::Event choices_b = api::EventChoices{Choices{std::nullopt, Choice{api::Ok<Packet>{b}}, Choice{api::Err<Packet>{a}}}};
  call("choices A", api::echo_event_a, std::tie(choices_a), api::Event(api::EventChoices{Choices{std::nullopt, Choice{api::Ok<Packet>{a}}, Choice{api::Err<Packet>{n}}}}));
  call("choices B", api::echo_event_b, std::tie(choices_b), api::Event(api::EventChoices{Choices{std::nullopt, Choice{api::Ok<Packet>{n}}, Choice{api::Err<Packet>{a}}}}));
  for (unsigned second = 0; second < 2; ++second) {
    const auto echo = second ? api::echo_event_b : api::echo_event_a;
    auto bad = second ? b : a; bad.nat_value = 43;
    const api::Event invalid_box = api::EventBox{bad};
    refuse(echo, std::tie(invalid_box), std::string(PRIMITIVE_PARAMETER_PREFIX "0.box.value.natValue was rejected by NominalPrimitiveSubtypes.nat") + (second ? "B" : "A"));
    const auto& valid_box = second ? box_b : box_a;
    call("box recovery", echo, std::tie(valid_box), api::Event(api::EventBox{second ? n : a}));
    for (unsigned branch = 0; branch < 2; ++branch) {
      auto invalid_choices = second ? choices_b : choices_a;
      auto& values = std::get<api::EventChoices>(invalid_choices).values;
      if (branch) std::get<api::Err<Packet>>(*values[2]).value.nat_value = 43;
      else std::get<api::Ok<Packet>>(*values[1]).value.nat_value = 43;
      refuse(echo, std::tie(invalid_choices), std::string(PRIMITIVE_PARAMETER_PREFIX "0.choices.values[")
        + std::to_string(branch + 1) + "]?." + (branch ? "error" : "ok")
        + ".natValue was rejected by NominalPrimitiveSubtypes.nat" + (second != branch ? "B" : "A"));
      const auto& valid_choices = second ? choices_b : choices_a;
      call("choices recovery", echo, std::tie(valid_choices), api::Event(api::EventChoices{
        Choices{std::nullopt, Choice{api::Ok<Packet>{second ? n : a}}, Choice{api::Err<Packet>{second ? a : n}}}}));
    }
  }
#define EDGE(field, value, expected) do { auto input = b, output = n; input.field = value; output.field = expected; call("edge " #field, api::echo_b, std::tie(input), output); } while (0)
  EDGE(uint8_value, 254, 0); EDGE(uint16_value, 65534, 0);
  EDGE(uint32_value, UINT32_MAX - 1, 0); EDGE(uint64_value, UINT64_MAX - 1, 0);
  EDGE(int8_value, 126, INT8_MIN); EDGE(int16_value, 32766, INT16_MIN);
  EDGE(int32_value, INT32_MAX - 1, INT32_MIN); EDGE(int64_value, INT64_MAX - 1, INT64_MIN);
  EDGE(usize_value, UINT64_MAX - 1, 0); EDGE(isize_value, INT64_MAX - 1, INT64_MIN);
  EDGE(nat_value, api::Nat(1) << 100, (api::Nat(1) << 100) + 2);
  EDGE(int_value, -(api::Int(1) << 100), -(api::Int(1) << 100) + 2);
  EDGE(float32_value, 0.0f, -0.0f); EDGE(float64_value, 0.0, -0.0);
  EDGE(float32_value, -0.0f, 0.0f); EDGE(float64_value, -0.0, 0.0);
  EDGE(text_value, std::string("a\0λ😀", 8), std::string("a\0λ😀!", 9));
  EDGE(bytes_value, std::vector<uint8_t>{}, std::vector<uint8_t>{255});
  EDGE(char_value, U'😀', U'😀');
#undef EDGE
  for (double number : {std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(), -std::numeric_limits<double>::infinity()}) {
    auto input32 = b, input64 = b; auto raw32 = packet<RawPacket>(), raw64 = packet<RawPacket>();
    input32.float32_value = static_cast<float>(number); input64.float64_value = number;
    raw32.float32_value = static_cast<float>(number); raw64.float64_value = number;
    refuse(api::echo_b, std::tie(input32), PRIMITIVE_PARAMETER_PREFIX "0.float32Value was rejected by NominalPrimitiveSubtypes.float32B");
    refuse(api::echo_b, std::tie(input64), PRIMITIVE_PARAMETER_PREFIX "0.float64Value was rejected by NominalPrimitiveSubtypes.float64B");
    call("produce invalid float32", api::produce, std::tie(raw32), Maybe{});
    call("produce invalid float64", api::produce, std::tie(raw64), Maybe{});
  }
  auto copy = call("owned copied bytes", api::echo_a, std::tie(a), a); copy.bytes_value[0] = 17;
  check(a.bytes_value[0] == 0, "output storage does not alias input bytes");
  call("recover after output mutation", api::echo_a, std::tie(a), a);
  auto bad_a = a, bad_b = b; bad_a.nat_value = 43; bad_b.digit = 3;
  refuse(api::combine, std::tie(bad_a, bad_b), PRIMITIVE_PARAMETER_PREFIX "1.digit is not below its Fin 3 bound");
  for (unsigned round = 0; round < 256; ++round) {
    api::Pair input{{a}, {b, std::nullopt, b}}; auto bad = b; bad.nat_value = 43; input.right[round % 3] = bad;
    refuse(api::echo_pair, std::tie(input), PRIMITIVE_PARAMETER_PREFIX "0.right[" + std::to_string(round % 3) + "]?.natValue was rejected by NominalPrimitiveSubtypes.natB");
    call("recovery", api::echo_b, std::tie(b), n);
  }
#endif
}
int main() {
  try {
    run();
    std::printf("{\"checks\":%u,\"rejections\":%u,\"rounds\":256,\"snapshotControls\":%u,\"wordBits\":64}\n", checks, rejections, snapshot_controls);
    return 0;
  } catch (const std::exception& error) { std::fprintf(stderr, "%s\n", error.what()); return 1; }
}
