/**
 * C++20 copied-value wrappers for ordinary compiler-checked Lean functions.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";
import { copiedCppType, renderCppCopiedValues } from "./copied-values.mjs";

const wrapper = (surface, fn) => {
	const p = surface.prefix, result = surface.copy(fn.declaration.result.type);
	const unit = result.ref.kind === "primitive" && result.ref.name === "unit";
	const parameters = fn.parameters.map((parameter, i) => ({ ...parameter, copy: surface.copy(fn.declaration.parameters[i].type) }));
	const lines = [`inline ${unit ? "void" : copiedCppType(result)} ${fn.field}(${parameters.map(({ name, copy }) => `${copiedCppType(copy)}${copy.aggregate ? " const&" : ""} ${name}`).join(", ")}) {`
		, `  ${p}_error lb_error{}; size_t budget = 16u * 1024u * 1024u; (void)budget;`];
	for(const { name, copy } of parameters) lines.push(`  detail::check${copy.index}(${name}, budget);`);
	const args = parameters.map(({ name, copy }, i) => {
		lines.push(`  detail::View${copy.index} lb_arg${i}{${name}};`);
		return `${copy.aggregate ? "&" : ""}lb_arg${i}.value`;
	});
	if(!unit)
	{
		lines.push(`  ${result.name} lb_result{};`);
		if(result.aggregate) lines.push(`  detail::Owned<${result.name}, ${result.name}_clear> lb_owner{&lb_result};`);
		args.push("&lb_result");
	}
	lines.push(`  detail::check(${fn.name}(${[...args, "&lb_error"].join(", ")}), lb_error);`);
	if(!unit) lines.push(`  return detail::from${result.index}(lb_result);`);
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
	const values = renderCppCopiedValues(surface);
	const header = `#pragma once
#include "${p}.h"
#include <stdexcept>
#include <memory>
#include <string>
#include <variant>
#include <vector>

namespace lean_bridge::${p} {
struct Nat { std::vector<uint32_t> limbs; };
struct Int { bool negative; std::vector<uint32_t> limbs; };
${values.records}
class Error final : public std::runtime_error {
public:
  ${p}_status status;
  ${p}_error_code code;
  Error(${p}_status value, const ${p}_error& error)
    : std::runtime_error(error.message ? std::string(error.message, error.message_length) : "Lean call failed"), status(value), code(error.code) {}
};
namespace detail {
${values.helpers}
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
${surface.functions.map(fn => wrapper(surface, fn)).join("\n")}}
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
