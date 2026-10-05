/**
 * Independent C/C++ List value, ownership and failure expectations.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { listPrimitives } from "./list-fixture.mjs";

const hostType = type => ({ unit: "std::monostate", char: "char32_t", usize: "uint64_t", isize: "int64_t", bool: "bool", string: "std::string", bytes: "std::vector<uint8_t>", nat: "api::Nat", int: "api::Int", float32: "float", float64: "double" })[type] ?? `${type}_t`;
const literal = type => ({ unit: "{}", bool: "true", char: "0x10ffff", usize: "UINT64_MAX", isize: "INT64_MIN", nat: "(api::Nat(1) << 96)", int: "-(api::Int(1) << 96)", string: 'std::string("a\\0\\xce\\xbb", 4)', bytes: "std::vector<uint8_t>{0, 255}", float32: "-0.0f", float64: "-0.0" })[type] ?? (/^uint/.test(type) ? `UINT${type.slice(4)}_MAX` : `INT${type.slice(3)}_MIN`);
const cType = type => ["nat", "int"].includes(type) ? "mpz_t" : ["string", "bytes"].includes(type) ? `lists_${type}` : ({ unit: "uint8_t", char: "uint32_t", usize: "uint64_t", isize: "int64_t", bool: "bool", float32: "float", float64: "double" })[type] ?? `${type}_t`;
const cValue = (type, target) => {
	if(["nat", "int"].includes(type)) return `mpz_set_ui(${target}, 1); mpz_mul_2exp(${target}, ${target}, 96); ${type === "int" ? `mpz_neg(${target}, ${target});` : ""}`;
	if(["string", "bytes"].includes(type)) return `${target} = (lists_${type}){${type === "string" ? '"a\\0\\xce\\xbb", 4' : 'bytes, 2'}, NULL, NULL};`;
	return `${target} = ${type === "unit" ? "0" : literal(type)};`;
};
const cEqual = (type, a, b) => ["nat", "int"].includes(type) ? `!mpz_cmp(${a}, ${b})` : ["bytes", "string"].includes(type)
	? `${a}.length == ${b}.length && (!${a}.length || !memcmp(${a}.data, ${b}.data, ${a}.length))`
	: ["float32", "float64"].includes(type) ? `same(${a}, ${b})` : `${a} == ${b}`;
const cCases = () => listPrimitives.map(type => {
	const span = `lists_list_${type}_span`, integer = ["nat", "int"].includes(type);
	return `{
    ${cType(type)} items[3] = {0}; ${integer ? "for (unsigned i = 0; i < 3; ++i) mpz_init(items[i]);" : ""}
    ${cValue(type, "items[0]")}
    ${span} input = {items, 3, NULL, NULL}, output; ${span}_init(&output);
    for (unsigned round = 0; round < 8; ++round) {
      CHECK(lists_reverse_${type}(&input, &output, &error) == LISTS_STATUS_OK);
      CHECK(output.length == input.length && output.data != input.data);
      for (unsigned i = 0; i < 3; ++i) CHECK(${cEqual(type, "items[2-i]", "output.data[i]")});
      ${span}_clear(&output); ${span}_clear(&output);
    }
    input.length = 0; CHECK(lists_reverse_${type}(&input, &output, &error) == LISTS_STATUS_OK); CHECK(!output.length); ${span}_clear(&output);
    input.data = NULL; input.length = 1; CHECK(lists_reverse_${type}(&input, &output, &error) == LISTS_STATUS_INVALID_ARGUMENT);
    input.data = items; input.length = SIZE_MAX; CHECK(lists_reverse_${type}(&input, &output, &error) == LISTS_STATUS_INVALID_ARGUMENT);
    ${integer ? "for (unsigned i = 0; i < 3; ++i) mpz_clear(items[i]);" : ""}
  }`;
}).join("\n");
const cppCases = () => listPrimitives.map(type => `{
    using T = ${hostType(type)}; std::vector<T> input{${literal(type)}, T{}, T{}};
    for (unsigned round = 0; round < 8; ++round) {
      auto output = api::reverse_${type}(input); CHECK(output.size() == input.size());
      for (unsigned i = 0; i < 3; ++i) CHECK(same<T>(input[2-i], output[i]));
      CHECK(api::reverse_${type}({}).empty());
    }
  }`).join("\n");
const deepCases = profile => profile === "c"
	? `uint32_t leaf = 77;
  ${Array.from({ length: 24 }, (_, i) => `lists_${"list_".repeat(i + 1)}uint32_span deep${i + 1} = {${i ? `&deep${i}` : "&leaf"}, 1, NULL, NULL};`).join("\n  ")}
  lists_${"list_".repeat(24)}uint32_span deepCopy; lists_${"list_".repeat(24)}uint32_span_init(&deepCopy);
  CHECK(lists_deep(&deep24, &deepCopy, &error) == LISTS_STATUS_OK);
  ${Array.from({ length: 24 }, (_, i) => `CHECK(deepCopy${".data[0]".repeat(i)}.length == 1);`).join("\n  ")}
  CHECK(deepCopy${".data[0]".repeat(24)} == 77); lists_${"list_".repeat(24)}uint32_span_clear(&deepCopy);`
	: `using Deep0 = uint32_t;
  ${Array.from({ length: 24 }, (_, i) => `using Deep${i + 1} = std::vector<Deep${i}>;`).join("\n  ")}
  Deep24 deep; ${Array.from({ length: 24 }, (_, i) => `deep${"[0]".repeat(i)}.resize(1);`).join(" ")}
  deep${"[0]".repeat(24)} = 77; CHECK(api::deep(deep) == deep); CHECK(api::deep({}).empty());`;

/**
 * Render an installed consumer without consulting generated metadata or names.
 *
 * @param profile - C or C++ host profile.
 */
export const nativeListConsumer = async profile => (await readFile(`tests/fixtures/list-consumers/${profile}.${profile === "c" ? "c" : "cpp"}`, "utf8"))
	.replace("/* scalar cases */", profile === "c" ? cCases() : cppCases()).replace("/* deep cases */", deepCases(profile));
