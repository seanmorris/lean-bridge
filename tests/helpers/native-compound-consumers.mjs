/**
 * Independent C/C++ expectations for copied compounds and their public types.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { compoundPrimitives } from "./compound-fixture.mjs";

const hostType = type => ({ unit: "std::monostate", char: "char32_t", usize: "uint64_t", isize: "int64_t", bool: "bool", string: "std::string", bytes: "std::vector<uint8_t>", nat: "api::Nat", int: "api::Int", float32: "float", float64: "double" })[type] ?? `${type}_t`;
const literal = type => ({ unit: "{}", bool: "true", char: "0x10ffff", usize: "UINT64_MAX", isize: "INT64_MIN", nat: "(api::Nat(1) << 96)", int: "-(api::Int(1) << 96)", string: 'std::string("a\\0\\xce\\xbb", 4)', bytes: "std::vector<uint8_t>{0, 255}", float32: "-0.0f", float64: "-0.0" })[type] ?? (/^uint/.test(type) ? `UINT${type.slice(4)}_MAX` : `INT${type.slice(3)}_MIN`);
const cValue = (type, target) => {
	if(["nat", "int"].includes(type)) return `mpz_set_ui(${target}, 1); mpz_mul_2exp(${target}, ${target}, 96); ${type === "int" ? `mpz_neg(${target}, ${target});` : ""}`;
	if(["string", "bytes"].includes(type)) return `${target} = (compounds_${type}){${type === "string" ? '"a\\0\\xce\\xbb", 4' : 'bytes, 2'}, NULL, NULL};`;
	return `${target} = ${type === "unit" ? "0" : literal(type)};`;
};
const cEqual = (type, a, b) => ["nat", "int"].includes(type) ? `!mpz_cmp(${a}, ${b})` : ["bytes", "string"].includes(type)
	? `${a}.length == ${b}.length && (!${a}.length || !memcmp(${a}.data, ${b}.data, ${a}.length))`
	: ["float32", "float64"].includes(type) ? `same(${a}, ${b})` : `${a} == ${b}`;

const cCases = () => compoundPrimitives.map(type => {
	const o = `compounds_option_${type}_value`, r = `compounds_result_${type}_${type}_value`, p = `compounds_tuple_${type}_${type}_value`;
	return `{
    ${o} input, output; ${o}_init(&input); ${o}_init(&output);
    for (unsigned state = 0; state < 2; ++state) {
      input.has_value = state; ${cValue(type, "input.value")}
      for (unsigned round = 0; round < 4; ++round) {
        CHECK(compounds_option_${type}(&input, &output, &error) == COMPOUNDS_STATUS_OK);
        CHECK(output.has_value == state);
        if (state) CHECK(${cEqual(type, "input.value", "output.value")});
        ${o}_clear(&output); ${o}_clear(&output);
      }
    }
    input.has_value = 2; CHECK(compounds_option_${type}(&input, &output, &error) == COMPOUNDS_STATUS_INVALID_ARGUMENT);
    input.has_value = 0; CHECK(compounds_option_${type}(&input, &output, &error) == COMPOUNDS_STATUS_OK);
    ${o}_clear(&output); ${o}_clear(&input);
    ${r} sum, flipped; ${r}_init(&sum); ${r}_init(&flipped);
    ${cValue(type, "sum.ok")} ${cValue(type, "sum.error")}
    for (unsigned state = 0; state < 2; ++state) {
      sum.is_ok = state;
      for (unsigned round = 0; round < 4; ++round) {
        CHECK(compounds_result_${type}(&sum, &flipped, &error) == COMPOUNDS_STATUS_OK);
        CHECK(flipped.is_ok == !state);
        if (state) CHECK(${cEqual(type, "sum.ok", "flipped.error")});
        else CHECK(${cEqual(type, "sum.error", "flipped.ok")});
        ${r}_clear(&flipped);
      }
    }
    sum.is_ok = 7; CHECK(compounds_result_${type}(&sum, &flipped, &error) == COMPOUNDS_STATUS_INVALID_ARGUMENT);
    ${r}_clear(&sum); ${r}_clear(&flipped);
    ${p} pair, swapped; ${p}_init(&pair); ${p}_init(&swapped); ${cValue(type, "pair.fst")}
    for (unsigned round = 0; round < 4; ++round) {
      CHECK(compounds_tuple_${type}(&pair, &swapped, &error) == COMPOUNDS_STATUS_OK);
      CHECK(${cEqual(type, "pair.fst", "swapped.snd")}); CHECK(${cEqual(type, "pair.snd", "swapped.fst")});
      ${p}_clear(&swapped);
    }
    ${p}_clear(&pair);
  }`;
}).join("\n");
const cppCases = () => compoundPrimitives.map(type => `{
    using T = ${hostType(type)}; T value = ${literal(type)};
    for (unsigned round = 0; round < 4; ++round) {
      CHECK(!api::option_${type}(std::nullopt));
      auto copied = api::option_${type}(std::optional<T>{value}); CHECK(copied.has_value()); CHECK(same(*copied, value));
      auto error = api::result_${type}(api::Ok<T>{value}); CHECK(std::holds_alternative<api::Err<T>>(error)); CHECK(same(std::get<api::Err<T>>(error).value, value));
      auto ok = api::result_${type}(api::Err<T>{value}); CHECK(std::holds_alternative<api::Ok<T>>(ok)); CHECK(same(std::get<api::Ok<T>>(ok).value, value));
      auto pair = api::tuple_${type}({value, T{}}); CHECK(same(pair.first, T{})); CHECK(same(pair.second, value));
    }
  }`).join("\n");

const deepCases = profile => {
	if(profile === "c")
	{
		const type = `compounds_${"option_".repeat(24)}result_tuple_uint32_unit_string_value`, inner = `deep.${"value.".repeat(24)}`;
		return `${type} deep, copy; ${type}_init(&deep); ${type}_init(&copy);
  ${Array.from({ length: 24 }, (_, i) => `deep.${"value.".repeat(i)}has_value = 1;`).join("\n  ")}
  ${inner}is_ok = 1; ${inner}ok.fst = 77;
  CHECK(compounds_deep(&deep, &copy, &error) == COMPOUNDS_STATUS_OK);
  ${Array.from({ length: 24 }, (_, i) => `CHECK(copy.${"value.".repeat(i)}has_value);`).join("\n  ")}
  CHECK(copy.${"value.".repeat(24)}ok.fst == 77); ${type}_clear(&copy); ${type}_clear(&deep);`;
	}
	return `using Deep0 = api::Result<std::pair<uint32_t, std::monostate>, std::string>;
  ${Array.from({ length: 24 }, (_, i) => `using Deep${i + 1} = std::optional<Deep${i}>;`).join("\n  ")}
  Deep24 deep;
  ${Array.from({ length: 24 }, (_, i) => `(${"*".repeat(i)}deep).emplace();`).join("\n  ")}
  std::get<api::Ok<std::pair<uint32_t, std::monostate>>>(${"*".repeat(24)}deep).value.first = 77;
  auto copy = api::deep(deep); CHECK(copy == deep); CHECK(!api::deep(std::nullopt));`;
};

/**
 * Render scalar matrices alongside hand-written mixed-value and failure cases.
 *
 * @param profile - Explicit C or C++ consumer.
 */
export const nativeCompoundConsumer = async profile => (await readFile(`tests/fixtures/compound-consumers/${profile}.${profile === "c" ? "c" : "cpp"}`, "utf8"))
	.replace("/* scalar cases */", profile === "c" ? cCases() : cppCases()).replace("/* deep cases */", deepCases(profile));
