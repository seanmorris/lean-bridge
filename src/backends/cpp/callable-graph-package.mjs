/**
 * Typed C++ callbacks and move-only closures over finite native copied graphs.
 * Host exceptions never unwind through a Lean frame.
 *
 * @file
 */
import { compileCallableGraphPackageModel } from "../c/callable-graph-model.mjs";
import { generateCopiedGraphPackage } from "../c/graph-package.mjs";
import { generateCopiedCppGraphConversions } from "./copied-graph-conversions.mjs";

/**
 * Generate idiomatic C++ values, synchronous callbacks and owned closure calls.
 *
 * @param ir - Compiler-authenticated graph/callable exports.
 */
export const generateCallableCppGraphPackage = ir => {
	const model = compileCallableGraphPackageModel(ir, ["cpp"]), p = model.prefix, m = p.toUpperCase();
	const copied = generateCopiedCppGraphConversions(model.payloads.ir);
	const nodes = new Map(copied.layout.nodes.map((node, index) => [node.id, { ...node, index, host: copied.types.find(type => type.id === node.id) }]));
	const copy = ref => nodes.get(model.payloads.copy(ref).id);
	const unit = node => node.ref?.name === "unit";
	const type = node => nodes.get(node.id).host.name;
	const resultType = node => unit(node) ? "void" : type(node);
	const signature = callback => `${resultType(copy(callback.result))}(${callback.parameters.map(ref => type(copy(ref))).join(", ")})`;
	const publicResult = node => node.kind === "callback" ? `LeanClosure<${signature(node)}>` : resultType(node);
	const files = { ...generateCopiedGraphPackage(model.payloads.ir, ["cpp"]).files };
	const support = `
class Error final : public std::runtime_error {
public:
  ${p}_status status; ${p}_error_code code;
  Error(${p}_status status, const ${p}_error& error)
    : std::runtime_error(error.message ? std::string(error.message, error.message_length) : "Lean call failed"), status(status), code(error.code) {}
};
namespace detail {
[[noreturn]] inline void callable_fail(uint32_t status) {
  if (status == 4) ${p}_graph_retire();
  ${p}_error error{}; auto code = ${p}_graph_finish(status, &error);
  if (status == 6) { code = ${m}_STATUS_DECLARED_ERROR; error = {${m}_ERROR_UNEXPECTED, "Host callback failed", 20}; }
  throw Error(code, error);
}
inline const std::shared_ptr<const char>& callable_thread() {
  static thread_local const auto value = std::make_shared<const char>(); return value;
}
struct GraphLease {
  uint64_t token = 0;
  void (*dispose)(uint64_t);
  const pid_t process = ::getpid();
  const std::shared_ptr<const char> thread = callable_thread();
  bool closed = false;
  explicit GraphLease(void (*release)(uint64_t)) : dispose(release) {}
  ~GraphLease() { if (process == ::getpid() && token) dispose(token); }
  void require() const {
    if (process != ::getpid() || thread != callable_thread() || closed || !token) callable_fail(1);
  }
  void close() {
    if (process != ::getpid() || thread != callable_thread()) callable_fail(1);
    closed = true; uint64_t previous = std::exchange(token, 0); if (previous) dispose(previous);
  }
};
struct GraphCallbackState {
  GraphBudget budget;
  std::exception_ptr failure;
  void finish(uint32_t status) const {
    if (failure) std::rethrow_exception(failure);
    if (status) callable_fail(status);
    if (!${p}_graph_ready()) callable_fail(5);
  }
};
struct GraphClosureFactory;
}
template<class Signature> class LeanClosure;
template<class Result, class... Args> class LeanClosure<Result(Args...)> final {
  std::shared_ptr<detail::GraphLease> lease_;
  Result (*invoke_)(detail::GraphLease&, const Args&...);
  LeanClosure(std::shared_ptr<detail::GraphLease> lease, Result (*invoke)(detail::GraphLease&, const Args&...)) noexcept
    : lease_(std::move(lease)), invoke_(invoke) {}
  friend struct detail::GraphClosureFactory;
public:
  LeanClosure(const LeanClosure&) = delete;
  LeanClosure& operator=(const LeanClosure&) = delete;
  LeanClosure(LeanClosure&&) noexcept = default;
  LeanClosure& operator=(LeanClosure&&) noexcept = default;
  Result call(const Args&... args) const {
    auto active = lease_; if (!active) detail::callable_fail(1); active->require();
    return invoke_(*active, args...);
  }
  Result operator()(const Args&... args) const { return call(args...); }
  void close() const { if (lease_) lease_->close(); }
  bool is_closed() const noexcept { return !lease_ || lease_->closed; }
};
namespace detail {
struct GraphClosureFactory {
  template<class Signature, class Invoke> static LeanClosure<Signature> make(std::shared_ptr<GraphLease> lease, Invoke invoke) noexcept {
    return LeanClosure<Signature>(std::move(lease), invoke);
  }
};
`;
	const helpers = [];
	for(const callback of model.callbacks.values())
	{
		const params = callback.parameters.map(copy), result = copy(callback.result), k = callback.index;
		const types = params.map(node => `const ${node.host.name}&`);
		const inputs = params.map((node, index) => `const ${node.name} *a${index}`);
		const values = params.map((node, index) => `graph_from${node.index}(graph_read(a${index}), 0, true, true, self.state.budget)`);
		const invokeTypes = ["Function&", ...types].join(", ");
		const invokeValues = ["self.function", ...values].join(", ");
		helpers.push(`template<class Function> concept GraphAccepts${k} = std::invocable<${invokeTypes}>
  && std::same_as<std::invoke_result_t<${invokeTypes}>, ${resultType(result)}>;
template<class Function> struct GraphCallback${k} {
  Function& function; GraphCallbackState& state;
  GraphCallback${k}(Function& input, GraphCallbackState& shared) : function(input), state(shared) {}
${result.aggregate ? `  struct Reply {
    ${result.host.name} data; GraphView${result.index} view;
    explicit Reply(${result.host.name} input) : data(std::move(input)), view(data) {}
    static void release(void *owner) noexcept { delete static_cast<Reply*>(owner); }
  };` : ""}
  static uint32_t invoke(void *context, ${[...inputs, `${result.name} *out`].join(", ")}) noexcept {
    auto& self = *static_cast<GraphCallback${k}*>(context);
    if (self.state.failure) return 6;
    try {
      ${unit(result) ? `std::invoke(${invokeValues}); *out = 0;`
			: `${result.host.name} returned = std::invoke(${invokeValues});
      graph_check${result.index}(returned, 0, true, self.state.budget);
      ${result.aggregate ? `auto owner = std::make_unique<Reply>(std::move(returned));
      *out = owner->view.value; out->_bridge_owner = owner.release(); out->_bridge_release = Reply::release;`
			: `GraphView${result.index} view(returned); *out = view.value;`}`}
      return 0;
    } catch (const GraphConversionError& error) {
      try { callable_fail(error.status); } catch (...) { if (!self.state.failure) self.state.failure = std::current_exception(); }
    } catch (...) { if (!self.state.failure) self.state.failure = std::current_exception(); }
    return 6;
  }
};`);
	}
	const invokeBody = (params, result, native, lease = null) => {
		const body = ["  try {", "    detail::GraphCallbackState state;"];
		const resultCallback = result.kind === "callback";
		if(resultCallback) body.push(`    auto owned = std::make_shared<detail::GraphLease>(detail::${result.dispose});`);
		params.forEach((node, index) => {
			if(node.kind === "callback") body.push(`    detail::GraphCallback${node.index}<std::remove_reference_t<Function${index}>> callback${index}(a${index}, state);`
				, `    detail::${node.name} view${index}{decltype(callback${index})::invoke, &callback${index}};`);
			else
			{
				const n = nodes.get(node.id);
				body.push(`    detail::graph_check${n.index}(a${index}, 0, true, state.budget);`
					, `    detail::GraphView${n.index} view${index}(a${index});`);
			}
		});
		if(!resultCallback)
		{
			body.push(`    ${result.aggregate ? "detail::" : ""}${result.name} out{};`);
			if(result.aggregate) body.push(`    detail::GraphOwned<detail::${result.name}, detail::${result.name}_clear> owner(&out);`);
		}
		const args = [...lease ? ["lease.token"] : []
			, ...params.map((node, index) => `&view${index}${node.kind === "callback" ? "" : ".value"}`)
			, resultCallback ? "&owned->token" : "&out"];
		body.push(`    state.finish(detail::${native}(${args.join(", ")}));`);
		if(resultCallback) body.push(`    return detail::GraphClosureFactory::make<${signature(result)}>(std::move(owned), detail::graph_invoke${result.index});`);
		else if(!unit(result)) body.push(`    auto value = detail::graph_from${nodes.get(result.id).index}(out, 0, true, true, state.budget);`
			, "    state.finish(0);", "    return value;");
		body.push("  } catch (const detail::GraphConversionError& error) { detail::callable_fail(error.status); }", "}");
		return body;
	};
	const invokers = [];
	for(const callback of model.callbacks.values())
	{
		const params = callback.parameters.map(copy), result = copy(callback.result);
		const inputs = ["GraphLease& lease", ...params.map((node, index) => `const ${node.host.name}& a${index}`)].join(", ");
		invokers.push(`inline ${resultType(result)} graph_invoke${callback.index}(${inputs}) {`
			, ...invokeBody(params, result, callback.call, callback));
	}
	const functions = [];
	for(const fn of model.functions)
	{
		const callbacks = fn.parameters.flatMap((node, index) => node.kind === "callback" ? [{ node, index }] : []);
		if(callbacks.length) functions.push(`template<${callbacks.map(({ index }) => `class Function${index}`).join(", ")}>`
			, `requires (${callbacks.map(({ node, index }) => `detail::GraphAccepts${node.index}<std::remove_reference_t<Function${index}>>`).join(" && ")})`);
		functions.push(`inline ${publicResult(fn.result)} ${fn.field}(${fn.parameters.map((node, index) => node.kind === "callback" ? `Function${index}&& a${index}` : `const ${type(node)}& a${index}`).join(", ")}) {`
			, ...invokeBody(fn.parameters, fn.result, fn.native));
	}
	files[`include/${p}.hpp`] = ["#pragma once", `#include "detail/${p}-status.h"`
		, "#include <stdbool.h>", "#include <string.h>"
		, `namespace lean_bridge::${p}::detail {`
		, ...copied.layout.nodes.filter(node => node.aggregate).map(node => `struct ${node.name};`)
		, `#include "detail/${p}-graph.h"`, "}"
		, `#include "detail/${p}-conversions.hpp"`
		, "#include <concepts>", "#include <exception>", "#include <functional>"
		, "#include <unistd.h>", `namespace lean_bridge::${p} {`, support
		, ...helpers, ...invokers, "}", ...functions, "}", ""].join("\n");
	return { ...model, files };
};
