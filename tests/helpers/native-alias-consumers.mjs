/**
 * Independent public C/GMP and C++ alias consumers, without conversion glue.
 *
 * @file
 */
import { aliasPrimitives } from "./native-alias-fixture.mjs";

const entries = Object.entries(aliasPrimitives);
const cName = name => `aliases_${name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}_t`;
const aggregate = type => ["nat", "int", "string", "bytes"].includes(type);
const integer = type => ["nat", "int"].includes(type);
const address = (type, value) => integer(type) || !aggregate(type) ? value : `&${value}`;
const output = (type, value) => integer(type) ? value : `&${value}`;
const literal = (type, field = false) => ({
	unit: "0", bool: "true", char: "0x1f331"
	, usize: field ? "UINT32_MAX" : "UINT64_MAX"
	, isize: field ? "INT32_MIN" : "INT64_MIN", float32: "1.5f", float64: "-2.25"
})[type] ?? (/^uint/.test(type) ? `UINT${type.slice(4)}_MAX` : `INT${type.slice(3)}_MIN`);
const cValue = (type, value, field = false) => integer(type)
	? `mpz_set_ui(${value}, 1); mpz_mul_2exp(${value}, ${value}, 5120); mpz_add_ui(${value}, ${value}, ${type === "nat" ? 19 : 31}); ${type === "int" ? `mpz_neg(${value}, ${value});` : ""}`
	: type === "string" ? `${value} = (aliases_atext_t){"A\\0\\xf0\\x9f\\x8c\\xb1", 6, NULL, NULL};`
		: type === "bytes" ? `${value} = (aliases_abytes_t){bytes, 3, NULL, NULL};`
			: `${value} = ${literal(type, field)};`;
const cEqual = (type, a, b) => integer(type) ? `mpz_cmp(${a}, ${b}) == 0` : aggregate(type)
	? `${a}.length == ${b}.length && !memcmp(${a}.data, ${b}.data, ${a}.length)` : `${a} == ${b}`;
const cScalar = (name, type) => {
	const n = cName(name), init = aggregate(type) ? `${n} input, result; ${n}_init(${output(type, "input")}); ${n}_init(${output(type, "result")});` : `${n} input = 0${type === "unit" ? "" : ", result = 0"};`;
	return `{
    ${init} ${cValue(type, "input")}
    for (unsigned round = 0; round < 16; ++round) {
      OK(aliases_echo_${type}(${address(type, "input")}, ${type === "unit" ? "" : `${output(type, "result")}, `}&error));
      ${type === "unit" ? "" : `CHECK(${cEqual(type, "input", "result")});`}
      ${aggregate(type) ? `${n}_clear(${output(type, "result")}); ${n}_clear(${output(type, "result")});` : ""}
    }
    ${aggregate(type) ? `${n}_clear(${output(type, "input")});` : ""}
  }`;
};
const cConsumer = () => `#include "aliases.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
static unsigned checks;
#define CHECK(value) do { ++checks; assert(value); } while (0)
#define OK(call) CHECK((call) == ALIASES_STATUS_OK)
${entries.map(([name, type]) => `_Static_assert(_Generic((${cName(name)}*)0, ${integer(type) ? "mpz_t" : type === "unit" ? "uint8_t" : type === "string" ? "aliases_string" : type === "bytes" ? "aliases_bytes" : type === "char" ? "uint32_t" : type === "usize" ? "uint64_t" : type === "isize" ? "int64_t" : type === "bool" ? "bool" : type === "float32" ? "float" : type === "float64" ? "double" : `${type}_t`}*: 1, default: 0), "${name}");`).join("\n")}
int main(void) {
  aliases_error error = {0}; const uint8_t bytes[] = {0, 255, 1};
  ${entries.map(([name, type]) => cScalar(name, type)).join("\n  ")}
  aliases_count_t count = 0; aliases_other_count_t next = 0;
  OK(aliases_make(&count, &error)); CHECK(count == 41);
  OK(aliases_increment(count, &next, &error)); CHECK(next == 42);
  aliases_atext_t label; aliases_atext_t_init(&label); OK(aliases_label(&label, &error)); CHECK(label.length == 9); aliases_atext_t_clear(&label);
  aliases_scalars_view_t fields, copied; aliases_scalars_view_t_init(&fields); aliases_scalars_view_t_init(&copied);
  ${entries.map(([, type]) => cValue(type, `fields.v_${type}`, true)).join("\n  ")}
  bool matches = false; OK(aliases_inspect(&fields, &matches, &error)); CHECK(matches);
  OK(aliases_echo_scalars(&fields, &copied, &error));
  ${entries.map(([, type]) => `CHECK(${cEqual(type, `fields.v_${type}`, `copied.v_${type}`)});`).join("\n  ")}
  CHECK(copied.v_string.data != fields.v_string.data); CHECK(copied.v_bytes.data != fields.v_bytes.data);
  ${entries.filter(([, type]) => type !== "unit").map(([, type]) => `{
    ${integer(type) ? `mpz_set_ui(fields.v_${type}, 0);` : aggregate(type) ? `fields.v_${type}.length = 0;` : `fields.v_${type} = 0;`}
    OK(aliases_inspect(&fields, &matches, &error)); CHECK(!matches);
    ${cValue(type, `fields.v_${type}`, true)}
  }`).join("\n  ")}
  aliases_scalars_view_t_clear(&copied); aliases_scalars_view_t_clear(&copied); aliases_scalars_view_t_clear(&fields);
  aliases_count_t values[] = {1, 2, 3}; aliases_list_uint32_span row[] = {{values, 3, NULL, NULL}, {0}};
  aliases_rows_t rows = {row, 2, NULL, NULL}, reversed; aliases_rows_t_init(&reversed);
  OK(aliases_reverse_rows(&rows, &reversed, &error)); CHECK(reversed.length == 2); CHECK(reversed.data[0].data[0] == 3); CHECK(reversed.data[1].length == 0);
  CHECK(reversed.data != rows.data); CHECK(reversed.data[0].data != values); aliases_rows_t_clear(&reversed);
  aliases_maybe_t maybe, maybe_out; aliases_maybe_t_init(&maybe); aliases_maybe_t_init(&maybe_out);
  for (unsigned state = 0; state < 3; ++state) {
    maybe.has_value = state != 0; maybe.value.has_value = state == 2;
    OK(aliases_echo_maybe(&maybe, &maybe_out, &error)); CHECK(maybe_out.has_value == maybe.has_value);
    if (state) CHECK(maybe_out.value.has_value == maybe.value.has_value);
    aliases_maybe_t_clear(&maybe_out);
  }
  maybe.value.has_value = 2; CHECK(aliases_echo_maybe(&maybe, &maybe_out, &error) == ALIASES_STATUS_INVALID_ARGUMENT);
  aliases_maybe_t_clear(&maybe); aliases_maybe_t_clear(&maybe_out);
  aliases_outcome_t sum, sum_out; aliases_outcome_t_init(&sum); aliases_outcome_t_init(&sum_out);
  sum.ok.fst = 7; sum.ok.snd = (aliases_abytes_t){bytes, 3, NULL, NULL}; sum.error = (aliases_atext_t){"no", 2, NULL, NULL};
  for (unsigned branch = 0; branch < 2; ++branch) {
    sum.is_ok = branch; OK(aliases_echo_outcome(&sum, &sum_out, &error)); CHECK(sum_out.is_ok == branch);
    if (branch) { CHECK(sum_out.ok.fst == 7); CHECK(sum_out.ok.snd.length == 3); }
    else CHECK(sum_out.error.length == 2);
    aliases_outcome_t_clear(&sum_out);
  }
  aliases_packet_view_t packet, packet_out; aliases_packet_view_t_init(&packet); aliases_packet_view_t_init(&packet_out);
  packet.count = 41; packet.text = (aliases_atext_t){"packet", 6, NULL, NULL}; packet.rows = rows; packet.outcome = sum;
  OK(aliases_change_packet(&packet, &packet_out, &error)); CHECK(packet_out.count == 42); CHECK(packet.count == 41); CHECK(packet_out.text.data != packet.text.data);
  aliases_packet_view_t_clear(&packet_out);
  aliases_packet_view_t pair[] = {packet, packet}; pair[1].count = 99;
  aliases_packets_t packets = {pair, 2, NULL, NULL}, packets_out; aliases_packets_t_init(&packets_out);
  OK(aliases_reverse_packets(&packets, &packets_out, &error)); CHECK(packets_out.length == 2); CHECK(packets_out.data[0].count == 99); CHECK(packets_out.data[1].count == 41);
  CHECK(packets_out.data != pair); aliases_packets_t_clear(&packets_out); aliases_packets_t_clear(&packets_out);
  aliases_packet_view_t_clear(&packet); aliases_outcome_t_clear(&sum); aliases_outcome_t_clear(&sum_out);
  aliases_abytes_t input = {bytes, 3, NULL, NULL}; OK(aliases_duplicate(&input, &sum_out, &error)); CHECK(sum_out.is_ok); CHECK(sum_out.ok.snd.length == 6); CHECK(!memcmp(sum_out.ok.snd.data + 3, bytes, 3)); aliases_outcome_t_clear(&sum_out);
  aliases_achar_t character = 0; CHECK(aliases_echo_char(0xd800, &character, &error) == ALIASES_STATUS_INVALID_ARGUMENT);
  CHECK(aliases_echo_unit(1, &error) == ALIASES_STATUS_INVALID_ARGUMENT);
  aliases_anat_t size; aliases_anat_t_init(size); mpz_set_si(size, -1); CHECK(aliases_produce(size, &input, &error) == ALIASES_STATUS_INVALID_ARGUMENT);
  for (unsigned round = 0; round < 4; ++round) {
    mpz_set_ui(size, 16u * 1024u * 1024u + 1u); CHECK(aliases_produce(size, &input, &error) == ALIASES_STATUS_INVALID_ARGUMENT);
    CHECK(input.data == bytes && input.length == 3); OK(aliases_make(&count, &error)); CHECK(count == 41);
  }
  mpz_set_ui(size, 3); OK(aliases_produce(size, &input, &error)); CHECK(input.length == 3 && input.data[0] == 7);
  aliases_abytes_t_clear(&input); aliases_anat_t_clear(size);
  aliases_af64_t floating = 0; OK(aliases_echo_float64(-0.0, &floating, &error)); CHECK(signbit(floating));
  OK(aliases_echo_float64(NAN, &floating, &error)); CHECK(isnan(floating)); OK(aliases_echo_float64(INFINITY, &floating, &error)); CHECK(isinf(floating));
  printf("alias-ok:%u\\n", checks);
}
`;

const cppType = type => ({ unit: "std::monostate", char: "char32_t", usize: "uint64_t", isize: "int64_t", bool: "bool", nat: "api::Nat", int: "api::Int", string: "std::string", bytes: "std::vector<uint8_t>", float32: "float", float64: "double" })[type] ?? `${type}_t`;
const cppValue = (type, field = false) => integer(type) ? `${type === "int" ? "-" : ""}((api::${type === "nat" ? "Nat" : "Int"}(1) << 5120) + ${type === "nat" ? 19 : 31})`
	: type === "unit" ? "std::monostate{}" : type === "string" ? 'std::string("A\\0\\xf0\\x9f\\x8c\\xb1", 6)' : type === "bytes" ? "std::vector<uint8_t>{0, 255, 1}" : literal(type, field);
const cppConsumer = () => `#include "aliases.hpp"
#include <cassert>
#include <cmath>
#include <cstdio>
#include <type_traits>
namespace api = lean_bridge::aliases;
static unsigned checks;
#define CHECK(value) do { ++checks; assert(value); } while (0)
template<class F> void invalid(F call) { bool failed = false; try { call(); } catch(const api::Error& error) { failed = error.status == ALIASES_STATUS_INVALID_ARGUMENT; } CHECK(failed); }
${entries.map(([name, type]) => `static_assert(std::is_same_v<api::${name}, ${cppType(type)}>);`).join("\n")}
int main() {
  ${entries.map(([name, type]) => `{ api::${name} value = ${cppValue(type)};
    for (unsigned round = 0; round < 16; ++round) { ${type === "unit" ? "api::echo_unit(value);" : `api::${name} result = api::echo_${type}(value); CHECK(result == value);`} }
  }`).join("\n  ")}
  api::Count count = api::make(); api::OtherCount next = api::increment(count); CHECK(count == 41 && next == 42);
  api::AText text = api::label(); CHECK(text.size() == 9);
  api::ScalarsView fields{${entries.map(([, type]) => cppValue(type, true)).join(", ")}};
  CHECK(api::inspect(fields)); api::ScalarsView copied = api::echo_scalars(fields);
  ${entries.map(([, type]) => `CHECK(copied.v_${type} == fields.v_${type});`).join("\n  ")}
  ${entries.filter(([, type]) => type !== "unit").map(([name, type]) => `{ auto changed = fields; changed.v_${type} = api::${name}{}; CHECK(!api::inspect(changed)); }`).join("\n  ")}
  copied.v_string[0] = 'X'; copied.v_bytes[0] = 7; copied.v_nat += 1; CHECK(api::inspect(fields));
  api::Rows rows{{1, 2, 3}, {}}; api::Rows reversed = api::reverse_rows(rows);
  CHECK((reversed == api::Rows{{3, 2, 1}, {}})); reversed[0][0] = 7; CHECK(rows[0][0] == 1);
  for (unsigned state = 0; state < 3; ++state) {
    api::Maybe value; if (state) value.emplace(); if (state == 2) value->emplace();
    api::Maybe result = api::echo_maybe(value); CHECK(result == value);
  }
  using Pair = std::pair<api::Count, api::ABytes>;
  api::Outcome ok = api::Ok<Pair>{{7, {0, 255, 1}}}, error = api::Err<api::AText>{"no"};
  CHECK(api::echo_outcome(ok) == ok); CHECK(api::echo_outcome(error) == error);
  api::PacketView packet{count, "packet", rows, std::nullopt, ok};
  api::PacketView changed = api::change_packet(packet); CHECK(changed.count == 42 && packet.count == 41);
  changed.text[0] = 'X'; changed.rows[0][0] = 8; CHECK(packet.text == "packet" && packet.rows[0][0] == 1);
  api::Packets packets{packet, packet}; packets[1].count = 99; api::Packets swapped = api::reverse_packets(packets);
  CHECK(swapped.size() == 2 && swapped[0].count == 99 && swapped[1].count == 41);
  swapped[0].text[0] = 'X'; CHECK(packets[1].text == "packet");
  const auto doubled = api::duplicate({0, 255, 1}); CHECK((std::get<api::Ok<Pair>>(doubled).value.second == api::ABytes{0, 255, 1, 0, 255, 1}));
  invalid([] { (void)api::echo_char(0xd800); }); invalid([] { (void)api::echo_nat(-1); });
  invalid([] { (void)api::echo_string(std::string("\\xff", 1)); });
  for (unsigned round = 0; round < 4; ++round) {
    invalid([] { (void)api::produce(16u * 1024u * 1024u + 1u); }); CHECK(api::make() == 41);
    invalid([] { (void)api::echo_bytes(api::ABytes(16u * 1024u * 1024u + 1u)); }); CHECK(api::make() == 41);
  }
  CHECK((api::produce(3) == api::ABytes{7, 7, 7}));
  CHECK(std::signbit(api::echo_float64(-0.0))); CHECK(std::isnan(api::echo_float64(NAN))); CHECK(std::isinf(api::echo_float64(INFINITY)));
  CHECK(std::signbit(api::echo_float32(-0.0f))); CHECK(std::isnan(api::echo_float32(NAN)));
  std::printf("alias-ok:%u\\n", checks);
}
`;

/**
 * Compile consumers from independent semantic expectations, never generated ABI layouts.
 *
 * @param profile - Public C/GMP or C++ package profile.
 */
export const nativeAliasConsumer = profile => profile === "c" ? cConsumer() : cppConsumer();
