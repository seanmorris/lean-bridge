/**
 * C++20 copied-value wrappers for ordinary compiler-checked Lean functions.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";

const dynamic = name => ["string", "bytes", "nat", "int"].includes(name);
const cppType = name => ({ unit: "std::monostate", string: "std::string", bytes: "std::vector<uint8_t>", nat: "Nat", int: "Int", bool: "bool", float32: "float", float64: "double" }[name] ?? `${name}_t`);
const wrapper = (p, fn) => {
	const { declaration, parameters } = fn, result = declaration.result.type.name;
	const lines = [`inline ${result === "unit" ? "void" : cppType(result)} ${fn.field}(${parameters.map((parameter, i) => {
		const type = declaration.parameters[i].type.name;
		return `${dynamic(type) ? `const ${cppType(type)}&` : cppType(type)} ${parameter.name}`;
	}).join(", ")}) {`
	, `  ${p}_error lb_error{};`];
	const args = parameters.map((parameter, i) => {
		const type = declaration.parameters[i].type.name, name = parameter.name;
		if(type === "unit")
		{ lines.push(`  (void)${name};`); return "0"; }
		if(!dynamic(type)) return name;
		const data = ["nat", "int"].includes(type) ? `${name}.limbs` : name;
		lines.push(`  ${parameter.type} lb_arg${i}{${data}.data(), ${data}.size(), nullptr, nullptr${type === "int" ? `, ${name}.negative` : ""}};`);
		return `&lb_arg${i}`;
	});
	if(result !== "unit")
	{
		lines.push(`  ${fn.resultType} lb_result{};`);
		if(dynamic(result)) lines.push(`  detail::Owned<${fn.resultType}, ${fn.resultType}_clear> lb_owner{&lb_result};`);
		args.push("&lb_result");
	}
	lines.push(`  detail::check(${fn.name}(${[...args, "&lb_error"].join(", ")}), lb_error);`);
	if(result === "string") lines.push('  return lb_result.length ? std::string(lb_result.data, lb_result.length) : std::string{};');
	else if(result === "bytes") lines.push('  return lb_result.length ? std::vector<uint8_t>(lb_result.data, lb_result.data + lb_result.length) : std::vector<uint8_t>{};');
	else if(result === "nat" || result === "int") lines.push(`  return ${cppType(result)}{${result === "int" ? "lb_result.negative, " : ""}lb_result.length ? std::vector<uint32_t>(lb_result.data, lb_result.data + lb_result.length) : std::vector<uint32_t>{}};`);
	else if(result !== "unit") lines.push("  return lb_result;");
	lines.push("}", "");
	return lines.join("\n");
};

/**
 * Compile a generic C++ model through the same C surface admission.
 *
 * @param ir - Canonical Binding IR.
 */
export const compilePrimitiveCppModel = ir => ({ kind: "copied-primitives", surface: compilePrimitiveCSurface(ir) });

/**
 * Render compiler-free C++ headers without any example-specific declarations.
 *
 * @param root0 - Compiled C++ primitive model.
 * @param root0.surface - Admitted C surface and exact generated names.
 */
export const renderPrimitiveCppPackage = ({ surface }) => {
	const p = surface.prefix;
	const header = `#pragma once
#include "${p}.h"
#include <stdexcept>
#include <string>
#include <variant>
#include <vector>

namespace lean_bridge::${p} {
struct Nat { std::vector<uint32_t> limbs; };
struct Int { bool negative; std::vector<uint32_t> limbs; };
class Error final : public std::runtime_error {
public:
  ${p}_status status;
  ${p}_error_code code;
  Error(${p}_status value, const ${p}_error& error)
    : std::runtime_error(error.message ? std::string(error.message, error.message_length) : "Lean call failed"), status(value), code(error.code) {}
};
namespace detail {
inline void check(${p}_status status, const ${p}_error& error) {
  if (status != ${p.toUpperCase()}_STATUS_OK) throw Error(status, error);
}
template<class T, void (*Clear)(T*)> struct Owned {
  T* value;
  ~Owned() { Clear(value); }
  Owned(const Owned&) = delete;
  Owned& operator=(const Owned&) = delete;
  explicit Owned(T* input) : value(input) {}
};
}
${surface.functions.map(fn => wrapper(p, fn)).join("\n")}}
`;
	const files = { [`include/${p}.hpp`]: header
		, [`src/${p}.cpp`]: `#include "${p}.hpp"\n`
		, "README.md": `# ${surface.ir.component.name} C++ API\n\nC++20 wrappers over the compiled C API. Returned copied values own their memory. Nat and Int use little-endian uint32 limbs; an empty vector represents zero.\n` };
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, component: surface.component, bindingIrSha256: surface.bindingIrSha256
		, generator: { id: "lean-wasm/cpp", version: 2 }, languageStandard: "C++20"
		, publicHeader: `include/${p}.hpp`, implementation: `src/${p}.cpp`
		, exports: surface.functions.map(fn => fn.field), capabilityGaps: []
		, files: [...Object.keys(files), "binding-manifest.json"] }, null, 2)}\n`;
	return Object.freeze(files);
};
