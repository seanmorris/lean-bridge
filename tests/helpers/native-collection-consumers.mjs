/**
 * Independent C/C++ callers for every primitive, nested Array and copied record.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { arrayPrimitives } from "./array-fixture.mjs";

const members = ["unit", "flag", "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64", "natural", "integer", "f32", "f64", "text", "bytes", "char_", "usize", "isize"];
const cppType = type => ({ unit: "std::monostate", char: "char32_t"
	, usize: "uint64_t", isize: "int64_t", bool: "bool"
	, string: "std::string", bytes: "std::vector<uint8_t>"
	, nat: "api::Nat", int: "api::Int"
	, float32: "float", float64: "double" })[type] ?? `${type}_t`;
const cType = type => ["nat", "int"].includes(type) ? "mpz_t" : ["string", "bytes"].includes(type) ? `collections_${type}`
	: ({ unit: "uint8_t", char: "uint32_t", usize: "uint64_t", isize: "int64_t", bool: "bool", float32: "float", float64: "double" })[type] ?? `${type}_t`;
const values = (type, cpp) => {
	if(type === "unit") return cpp ? "{}, {}, {}" : "0, 0, 0";
	if(type === "bool") return "false, true, false, true";
	if(type === "char") return "0, 0xd7ff, 0xe000, 0x1f331, 0x10ffff";
	if(type === "float32") return "0.0f, -0.0f, 0x1p-149f, -0x1p-149f, 1.25f, 0x1.fffffep127f, INFINITY, -INFINITY, NAN";
	if(type === "float64") return "0.0, -0.0, 0x1p-1074, -0x1p-1074, 1.25, 0x1.fffffffffffffp1023, INFINITY, -INFINITY, NAN";
	if(type === "string") return cpp ? 'std::string{}, std::string("\\0",1), std::string("\\xef\\xbb\\xbfLean",7), std::string("🌱\\0",5), std::string("e\\xcc\\x81",3)'
		: '{"",0,NULL,NULL}, {"\\0",1,NULL,NULL}, {"\\xef\\xbb\\xbfLean",7,NULL,NULL}, {"🌱\\0",5,NULL,NULL}, {"e\\xcc\\x81",3,NULL,NULL}';
	if(type === "bytes") return cpp ? "{}, {0,255,1}, {255,0,128}, {0}" : "{NULL,0,NULL,NULL}, {bytes,3,NULL,NULL}, {other_bytes,3,NULL,NULL}, {bytes,1,NULL,NULL}";
	if(type === "nat") return "api::Nat(0), api::Nat(1), (api::Nat(1)<<5120)+19, api::Nat(1)<<200, (api::Nat(1)<<5120)+19";
	if(type === "int") return "-((api::Int(1)<<5120)+19), api::Int(0), (api::Int(1)<<5120)+19, api::Int(-1), api::Int(1)";
	const fixed = type === "usize" ? "uint64" : type === "isize" ? "int64" : type;
	return fixed.startsWith("uint") ? `0, 1, ${fixed.toUpperCase()}_MAX, ${fixed.toUpperCase()}_MAX-1, 1`
		: `${fixed.toUpperCase()}_MIN, -1, 0, 1, ${fixed.toUpperCase()}_MAX`;
};
const cEqual = (type, a, b) => ["nat", "int"].includes(type) ? `!mpz_cmp(${a},${b})`
	: ["string", "bytes"].includes(type) ? `${a}.length == ${b}.length && (!${a}.length || !memcmp(${a}.data,${b}.data,${a}.length))`
		: ["float32", "float64"].includes(type) ? `same_number(${a},${b})` : `${a} == ${b}`;
const cCases = () => arrayPrimitives.map(([, type]) => {
	const integer = ["nat", "int"].includes(type), span = `collections_array_${type}_span`, matrix = `collections_array_array_${type}_span`;
	const init = integer ? `mpz_t items[5]; for (unsigned i=0;i<5;++i) mpz_init(items[i]);
    ${type === "nat" ? "mpz_set_ui(items[1],1); mpz_setbit(items[2],5120); mpz_add_ui(items[2],items[2],19); mpz_setbit(items[3],200); mpz_set(items[4],items[2]);"
		: "mpz_setbit(items[0],5120); mpz_add_ui(items[0],items[0],19); mpz_neg(items[0],items[0]); mpz_neg(items[2],items[0]); mpz_set_si(items[3],-1); mpz_set_ui(items[4],1);"}`
		: `${cType(type)} items[] = {${values(type, false)}};`;
	return `{
    ${init}
    const size_t length=sizeof(items)/sizeof(items[0]);
    ${span} rows[]={{items,length,NULL,NULL},{NULL,0,NULL,NULL},{items,1,NULL,NULL},{items,length,NULL,NULL}};
    ${matrix} input={rows,4,NULL,NULL}, output; ${matrix}_init(&output);
    for (unsigned round=0;round<128;++round) {
      CALL(collections_array_reverse_${type}(&input,&output,&error)); CHECK(output.length==4 && output.data!=rows);
      for (size_t row=0;row<4;++row) {
        const ${span} a=output.data[row], b=rows[3-row]; CHECK(a.length==b.length);
        if (a.length) CHECK(a.data!=b.data);
        for (size_t i=0;i<a.length;++i) CHECK(${cEqual(type, "a.data[i]", "b.data[b.length-1-i]")});
      }
      ${matrix}_clear(&output); ${matrix}_clear(&output);
    }
    input.length=0; CALL(collections_array_reverse_${type}(&input,&output,&error)); CHECK(!output.length);
    input.data=NULL; input.length=1; INVALID(collections_array_reverse_${type}(&input,&output,&error)); CHECK(!output.length);
    input.data=rows; input.length=SIZE_MAX; INVALID(collections_array_reverse_${type}(&input,&output,&error)); CHECK(!output.length);
    input.length=4; rows[2].data=NULL; rows[2].length=1; INVALID(collections_array_reverse_${type}(&input,&output,&error)); CHECK(!output.length);
    rows[2].data=items; rows[2].length=SIZE_MAX; INVALID(collections_array_reverse_${type}(&input,&output,&error)); CHECK(!output.length);
    rows[2].length=1; CALL(collections_array_reverse_${type}(&input,&output,&error)); CHECK(output.length==4);
    ${matrix}_clear(&output);
    ${integer ? "for (unsigned i=0;i<5;++i) mpz_clear(items[i]);" : ""}
  }`;
}).join("\n");
const cppCases = () => arrayPrimitives.map(([, type]) => `{
    using T=${cppType(type)}; const std::vector<T> values{${values(type, true)}};
    const std::vector<std::vector<T>> input{values,{},std::vector<T>{values[0]},values};
    for (unsigned round=0;round<128;++round) {
      const auto output=call([&] { return api::array_reverse_${type}(input); }); CHECK(output.size()==input.size());
      for (size_t row=0;row<output.size();++row) {
        const auto& expected=input[input.size()-1-row]; CHECK(output[row].size()==expected.size());
        for (size_t i=0;i<expected.size();++i) CHECK(same<T>(output[row][i],expected[expected.size()-1-i]));
      }
    }
    CHECK(call([] { return api::array_reverse_${type}({}); }).empty());
  }`).join("\n");
const deepCases = profile => profile === "c" ? `uint32_t leaf=77;
  ${Array.from({ length: 24 }, (_, i) => `collections_${"array_".repeat(i + 1)}uint32_span deep${i + 1}={${i ? `&deep${i}` : "&leaf"},1,NULL,NULL};`).join("\n  ")}
  collections_${"array_".repeat(24)}uint32_span out; collections_${"array_".repeat(24)}uint32_span_init(&out);
  CALL(collections_deep(&deep24,&out,&error));
  ${Array.from({ length: 24 }, (_, i) => `CHECK(out${".data[0]".repeat(i)}.length==1);`).join("\n  ")}
  CHECK(out${".data[0]".repeat(24)}==77); collections_${"array_".repeat(24)}uint32_span_clear(&out);
  ${Array.from({ length: 24 }, (_, i) => `deep${i + 1}.length=0; CALL(collections_deep(&deep24,&out,&error)); CHECK(out${".data[0]".repeat(23 - i)}.length==0); collections_${"array_".repeat(24)}uint32_span_clear(&out); deep${i + 1}.length=1;`).join("\n  ")}
  deep1.data=NULL; INVALID(collections_deep(&deep24,&out,&error)); CHECK(!out.length);
  deep1.data=&leaf; CALL(collections_deep(&deep24,&out,&error)); collections_${"array_".repeat(24)}uint32_span_clear(&out);`
	: `using Deep0=uint32_t;
  ${Array.from({ length: 24 }, (_, i) => `using Deep${i + 1}=std::vector<Deep${i}>;`).join("\n  ")}
  Deep24 deep; ${Array.from({ length: 24 }, (_, i) => `deep${"[0]".repeat(i)}.resize(1);`).join(" ")}
  deep${"[0]".repeat(24)}=77; CHECK(call([&] { return api::deep(deep); })==deep);
  ${Array.from({ length: 24 }, (_, i) => `{ auto empty=deep; empty${"[0]".repeat(i)}.clear(); CHECK(call([&] { return api::deep(empty); })==empty); }`).join("\n  ")}`;
const cppChecks = () => arrayPrimitives.map(([, type], i) => `std::vector<${cppType(type)}> check${i}{p.${members[i]}};`).join("\n  ")
	+ `\n  CHECK(call([&] { return api::array_check_elements(${arrayPrimitives.map((_, i) => `check${i}`).join(",")}); }));`;
const cChecks = () => arrayPrimitives.map(([, type], i) => `collections_array_${type}_span check${i}={&p.${members[i]},1,NULL,NULL};`).join("\n  ")
	+ `\n  bool accepted=false; CALL(collections_array_check_elements(${arrayPrimitives.map((_, i) => `&check${i}`).join(",")},&accepted,&error)); CHECK(accepted);`;

/** Independent scalar checks also initialize the fixture's lazy Lean constants. */
export const nativeCollectionElementChecks = () => cChecks();

/**
 * Emit source from independent expectations, never from compiled type metadata.
 *
 * @param profile - C or C++ public package.
 */
export const nativeCollectionConsumer = async profile => (await readFile(`tests/fixtures/collection-consumers/${profile}.${profile === "c" ? "c" : "cpp"}`, "utf8"))
	.replace("/* array cases */", profile === "c" ? cCases() : cppCases())
	.replace("/* deep cases */", deepCases(profile))
	.replace("/* independent Lean element checks */", profile === "c" ? cChecks() : cppChecks());
