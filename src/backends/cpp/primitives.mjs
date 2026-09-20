/**
 * C++20 copied-value wrappers for ordinary compiler-checked Lean functions.
 *
 * @file
 */
import { compilePrimitiveCSurface } from "../c/primitive-surface.mjs";
import { copiedCppType, renderCppCopiedValues } from "./copied-values.mjs";
import { cppCallable, cppCallableHelpers, cppCallablePublic, cppClosureReturn, cppResult, cppSite, cppUnit } from "./callables.mjs";

const wrapper = (surface, fn) => {
	const p = surface.prefix, result = cppSite(surface, fn.declaration.result.type);
	const unit = cppUnit(result), closure = cppCallable(result);
	const parameters = fn.parameters.map((parameter, i) => ({ ...parameter, copy: cppSite(surface, fn.declaration.parameters[i].type), index: i }));
	const callbacks = parameters.filter(({ copy }) => cppCallable(copy));
	const lines = [];
	if(callbacks.length) lines.push(`template<${callbacks.map(({ index }) => `class Function${index}`).join(", ")}>`
		, `requires (${callbacks.map(({ copy, index }) => `detail::Accepts${copy.cppIndex}<Function${index}>`).join(" && ")})`);
	lines.push(`inline ${cppResult(surface, result)} ${fn.field}(${parameters.map(({ name, copy, index }) => `${cppCallable(copy) ? `Function${index}&&` : `${copiedCppType(copy)}${copy.aggregate ? " const&" : ""}`} ${name}`).join(", ")}) {`
		, `  ${p}_error _lb_error{}; size_t _lb_budget = 16u * 1024u * 1024u; (void)_lb_budget;`);
	if(callbacks.length) lines.push("  detail::CallbackState _lb_scope;");
	for(const { name, copy } of parameters) if(!cppCallable(copy)) lines.push(`  detail::check${copy.index}(${name}, _lb_budget);`);
	const args = parameters.map(({ name, copy }, i) => {
		if(cppCallable(copy))
{
			lines.push(`  using _lb_function${i} = std::remove_reference_t<Function${i}>;`
				, `  detail::Callback${copy.cppIndex}<_lb_function${i}> _lb_context${i}(${name}, _lb_scope);`
				, `  ${copy.name} _lb_arg${i}{detail::Callback${copy.cppIndex}<_lb_function${i}>::invoke, &_lb_context${i}};`);
			return `&_lb_arg${i}`;
}
		lines.push(`  detail::View${copy.index} _lb_arg${i}{${name}};`);
		return `${copy.aggregate ? "&" : ""}_lb_arg${i}.value`;
	});
	if(closure)
	{
		const native = `${p}_owned_${result.field}`;
		lines.push(`  auto _lb_lease = std::make_shared<detail::Lease>(detail::dispose${result.cppIndex});`
			, `  ${native}* _lb_result = nullptr;`
			, `  detail::Owned<${native}*, ${native}_dispose> _lb_owner(&_lb_result);`);
		args.push("&_lb_result");
	} else if(!unit)
	{
		lines.push(`  ${result.name} _lb_result{};`);
		if(result.aggregate) lines.push(`  detail::Owned<${result.name}, ${result.name}_clear> _lb_owner{&_lb_result};`);
		args.push("&_lb_result");
	}
	lines.push(`  const auto _lb_status = ${fn.name}(${[...args, "&_lb_error"].join(", ")});`);
	if(callbacks.length) lines.push("  _lb_scope.finish();");
	lines.push("  detail::check(_lb_status, _lb_error);");
	if(closure) lines.push('  if (!_lb_result) detail::invalid("Lean returned an empty closure");'
		, "  _lb_lease->pointer = std::exchange(_lb_result, nullptr);"
		, `  return ${cppClosureReturn(surface, result)};`);
	else if(!unit) lines.push(`  return detail::from${result.index}(_lb_result);`);
	lines.push("}", "");
	return lines.join("\n");
};
/**
 * Compile a generic C++ model through the same C surface admission.
 *
 * @param ir - Canonical Binding IR.
 */
export const compilePrimitiveCppModel = ir => {
	const surface = compilePrimitiveCSurface(ir, { callables: true, compounds: true, lists: true });
	if(surface.copies.some(copy => ["LeanClosure", "Ok", "Err", "Result"].includes(copy.record?.name))) throw new TypeError("C++ record name collides with a generated callable or compound type");
	for(const [index, callback] of [...surface.callbacks.values()].entries()) callback.cppIndex = index;
	return { kind: "copied-primitives", surface };
};

/**
 * Render compiler-free C++ headers without any example-specific declarations.
 *
 * @param root0 - Compiled C++ primitive model.
 * @param root0.surface - Admitted C surface and exact generated names.
 */
export const renderPrimitiveCppPackage = ({ surface }) => {
	const p = surface.prefix;
	const values = renderCppCopiedValues(surface);
	const callbacks = cppCallableHelpers(surface);
	const bigint = surface.copies.some(copy => ["nat", "int"].includes(copy.scalarName));
	const header = `#pragma once
#include "${p}.h"
#include <stdexcept>
#include <memory>
#include <string>
#include <variant>
#include <optional>
#include <vector>
#include <utility>
${surface.callbacks.size ? `#include <concepts>
#include <exception>
#include <functional>
#include <thread>
#include <type_traits>
#include <unistd.h>` : ""}
${bigint ? `#ifndef BOOST_MP_STANDALONE
#define BOOST_MP_STANDALONE
#endif
#include <boost/multiprecision/cpp_int.hpp>` : ""}

namespace lean_bridge::${p} {
${surface.copies.some(copy => copy.compound === "result") ? `template<class T> struct Ok { T value; friend bool operator==(const Ok&, const Ok&) = default; };
template<class E> struct Err { E value; friend bool operator==(const Err&, const Err&) = default; };
template<class T, class E> using Result = std::variant<Ok<T>, Err<E>>;` : ""}
${bigint ? "using Nat = boost::multiprecision::cpp_int;\nusing Int = boost::multiprecision::cpp_int;" : ""}
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
${cppCallablePublic(surface)}
${callbacks ? `namespace detail {\n${callbacks}\n}` : ""}
${surface.functions.map(fn => wrapper(surface, fn)).join("\n")}}
`;
	const files = { [`include/${p}.hpp`]: header
		, [`src/${p}.cpp`]: `#include "${p}.hpp"\n`
		, "README.md": `# ${surface.ir.component.name} C++ API\n\nC++20 wrappers over the compiled C API. Returned copied values own their memory. Nat and Int use Boost.Multiprecision cpp_int; negative Nat inputs are rejected. Prepared archives include pinned Boost 1.90.0 standalone headers. Synchronous callbacks accept typed C++ functions; returned LeanClosure values are move-only and release automatically.\n` };
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, component: surface.component, bindingIrSha256: surface.bindingIrSha256
		, generator: { id: "lean-wasm/cpp", version: 3 }, languageStandard: "C++20"
		, publicHeader: `include/${p}.hpp`, implementation: `src/${p}.cpp`
		, exports: surface.functions.map(fn => fn.field), capabilityGaps: []
		, files: [...Object.keys(files), "binding-manifest.json"] }, null, 2)}\n`;
	return Object.freeze(files);
};
