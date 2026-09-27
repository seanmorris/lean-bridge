/**
 * Typed C++ calls and call-scoped host callbacks over explicit C result owners.
 * Exceptions never cross a C trampoline; resource borrows expire on its return.
 *
 * @file
 */
import { generateOwnedCppConversions } from "./owned-conversions.mjs";
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

/**
 * Generate ordinary exports, callable resource operations and host adapters.
 * Prepared-package admission still requires authenticated packaging and installed
 * consumer evidence; this generator alone does not enable a target.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 */
export const generateOwnedCppCallables = ir => {
	const conversions = generateOwnedCppConversions(ir), { c } = conversions;
	const p = c.prefix, m = p.toUpperCase(), nodes = new Map(conversions.types.map(node => [node.id, node]));
	const unit = node => node.kind === "primitive" && node.name === "unit";
	const resultType = node => unit(node) ? "void" : node.hostName;
	const callbacks = [], calls = [], operations = [], exports = [];
	for(const callback of c.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result), i = node.index;
		const params = callback.parameters.slice(1).map(id => nodes.get(id));
		const automatic = ownedCallbackRecovery(c.native.model, node, id => id) !== null;
		const copy = [...c.retains, ...c.copies].find(item => item.id === result.id);
		callbacks.push(`template<class F> concept OwnedCallback${i} = std::same_as<std::remove_cvref_t<F>, ${node.hostName}> || (`
			, `  ${automatic ? "true" : "owned_has_recovery<std::remove_cvref_t<F>>"}`
			, `  && owned_recovery_matches<std::remove_cvref_t<F>, ${result.hostName}>`
			, `  && requires(F& function${params.map((param, index) => `, const ${param.hostName}& a${index}`).join("")}) {`
			, `    { std::invoke(owned_function(function)${params.map((_, index) => `, a${index}`).join("")}) } -> std::same_as<${resultType(result)}>;`
			, "  });"
			, `template<class F> requires OwnedCallback${i}<F> struct OwnedCallbackView${i} {`
			, "  F& function; OwnedCall& call;"
			, `  std::unique_ptr<OwnedView${result.index}> recovery;`
			, `  ${node.cName}_host value{};`
			, `  static ${p}_status invoke(void *context, ${p}_session *session${params.map((param, index) => `, ${param.cName}${param.leaf ? "" : " const *"} a${index}`).join("")}, ${result.cName} *out, ${p}_result **owner) noexcept {`
			, `    auto& self = *static_cast<OwnedCallbackView${i} *>(context);`
			, `    if (self.call.error) return ${m}_CALLBACK_FAILED;`
			, "    try {"
			, `      if (self.call.state->require() != session || !out || !owner || *owner) throw Error(${m}_INVALID_ARGUMENT);`
			, "      BorrowFrame frame(self.call.state); OwnedOutput borrowed(self.call.state, frame.lease);"
			, ...params.map((param, index) => `      auto argument${index} = owned_from${param.index}(${param.leaf ? `a${index}` : `owned_read(a${index})`}, 0, self.call.budget, borrowed);`)
			, `      ${unit(result) ? "" : "auto reply = "}std::invoke(owned_function(self.function)${params.map((_, index) => `, std::as_const(argument${index})`).join("")});`
			, ...unit(result) ? ["      const std::monostate reply{};"] : []
			, `      owned_check${result.index}(reply, 0, self.call.budget, self.call.state);`
			, `      OwnedView${result.index} view(reply, self.call.state);`
			, `      ${result.cName} converted{}; NativeOwner retained;`
			, `      checked(${copy.cName}(self.call.state->require(), ${result.leaf ? "" : "&"}view.value, &converted, &retained.value));`
			, "      *out = converted; *owner = std::exchange(retained.value, nullptr);"
			, `      return ${m}_OK;`
			, "    } catch (...) {"
			, "      if (!self.call.error) self.call.error = std::current_exception();"
			, `      return ${m}_CALLBACK_FAILED;`, "    }", "  }"
			, `  OwnedCallbackView${i}(F& input, OwnedCall& scope) : function(input), call(scope) {`
			, `    if constexpr (std::same_as<std::remove_cvref_t<F>, ${node.hostName}>) {`
			, `      value.closure = ResourceAccess::get<${node.cName}>(input, scope.state);`
			, "    } else {"
			, "      value.call = &invoke; value.context = this;"
			, "      if constexpr (owned_has_recovery<std::remove_cvref_t<F>>) {"
			, `        recovery = std::make_unique<OwnedView${result.index}>(input.recovery, scope.state);`
			, "        value.recovery = &recovery->value;", "      }", "    }", "  }"
			, `  OwnedCallbackView${i}(const OwnedCallbackView${i}&) = delete;`
			, `  OwnedCallbackView${i}& operator=(const OwnedCallbackView${i}&) = delete;`, "};"
			, `template<class F> requires OwnedCallback${i}<F> inline void owned_check_callback${i}(F& input, OwnedCall& call) {`
			, `  if constexpr (std::same_as<std::remove_cvref_t<F>, ${node.hostName}>) owned_check${i}(input, 0, call.budget, call.state);`
			, "  else {"
			, `    call.budget.enter(0); call.budget.native(1, sizeof(${node.cName}_host));`
			, `    call.budget.storage(1, sizeof(OwnedCallbackView${i}<F>));`
			, "    if constexpr (owned_has_recovery<std::remove_cvref_t<F>>)"
			, `      owned_check${result.index}(input.recovery, 0, call.budget, call.state);`, "  }", "}");
	}
	const all = [...c.functions, ...c.callbacks, ...c.retains];
	const signature = (item, offset = 0, qualified = "") => {
		const params = item.parameters.map(id => nodes.get(id));
		const host = params.map((_, index) => index >= offset && c.hostArgument(item, index));
		const templates = host.flatMap((yes, index) => yes ? [index] : []);
		return { params, host
			, prefix: templates.length ? [`template<${templates.map(index => `class F${index}`).join(", ")}>`
				, `requires (${templates.map(index => `${qualified}OwnedCallback${params[index].index}<F${index}>`).join(" && ")})`] : []
			, parameters: params.slice(offset).map((node, index) => `${host[index + offset] ? `F${index + offset}&&` : `const ${node.hostName}&`} a${index + offset}`).join(", ")
			, arguments: params.slice(offset).map((_, index) => host[index + offset] ? `std::forward<F${index + offset}>(a${index + offset})` : `a${index + offset}`).join(", ") };
	};
	all.forEach((item, index) => {
		const result = nodes.get(item.result), sig = signature(item);
		calls.push(...sig.prefix, `inline ${resultType(result)} owned_invoke${index}(${sig.parameters}) {`
			, "  OwnedCall call(current_state());"
			, ...sig.params.map((param, i) => `  ${sig.host[i] ? `owned_check_callback${param.index}(a${i}, call);` : `owned_check${param.index}(a${i}, 0, call.budget, call.state);`}`)
			, ...sig.params.map((param, i) => `  ${sig.host[i] ? `OwnedCallbackView${param.index}<std::remove_reference_t<F${i}>> view${i}(a${i}, call);` : `OwnedView${param.index} view${i}(a${i}, call.state);`}`)
			, `  ${result.cName} returned{}; OwnedOutput output(call.state);`
			, `  const auto status = ${item.cName}(call.state->require()${sig.params.map((param, i) => `, ${sig.host[i] || !param.leaf ? "&" : ""}view${i}.value`).join("")}, &returned, &output.owner.value);`
			, "  if (call.error) std::rethrow_exception(call.error);", "  checked(status);"
			, `  ${unit(result) ? "(void)" : "return "}owned_from${result.index}(returned, 0, call.budget, output);`, "}");
		if(c.functions.includes(item))
		{
			const pub = signature(item, 0, "detail::").prefix;
			exports.push(...pub, `inline ${resultType(result)} ${item.cName.slice(p.length + 1)}(${sig.parameters}) {`
				, `  return detail::owned_invoke${index}(${sig.arguments});`, "}");
		}
	});
	for(const node of nodes.values()) if(node.identity)
	{
		const retained = all.findIndex(item => item.retain && item.id === node.id);
		operations.push(`template<> struct ResourceOps<${node.identityTag}> {`
			, `  static ${node.hostName} retain(const ${node.hostName}& self) { return owned_invoke${retained}(self); }`);
		const index = all.findIndex(item => c.callbacks.includes(item) && item.id === node.id);
		if(index !== -1)
		{
			const sig = signature(all[index], 1), result = nodes.get(all[index].result);
			operations.push(...sig.prefix.map(line => `  ${line}`)
				, `  static ${resultType(result)} call(const ${node.hostName}& self${sig.parameters ? `, ${sig.parameters}` : ""}) {`
				, `    return owned_invoke${index}(self${sig.arguments ? `, ${sig.arguments}` : ""});`, "  }");
		}
		operations.push("};");
	}
	const header = ["#pragma once", `#include "${p}-conversions.hpp"`
		, "#include <concepts>", "#include <exception>", "#include <functional>"
		, `namespace lean_bridge::${p} {`, "namespace detail {"
		, "struct OwnedCall {"
		, "  std::shared_ptr<State> state; OwnedBudget budget; std::exception_ptr error;"
		, "  explicit OwnedCall(std::shared_ptr<State> value) : state(std::move(value)) {}"
		, "  ~OwnedCall() { state->drain(); }", "};"
		, "template<class F, class R> struct RecoveredCallback { F function; R recovery; };"
		, "template<class F> constexpr bool owned_has_recovery = false;"
		, "template<class F, class R> constexpr bool owned_has_recovery<RecoveredCallback<F, R>> = true;"
		, "template<class F, class Expected> constexpr bool owned_recovery_matches = true;"
		, "template<class F, class R, class Expected> constexpr bool owned_recovery_matches<RecoveredCallback<F, R>, Expected> = std::same_as<R, Expected>;"
		, "template<class F> inline F& owned_function(F& function) { return function; }"
		, "template<class F, class R> inline F& owned_function(RecoveredCallback<F, R>& function) { return function.function; }"
		, "template<class F, class R> inline const F& owned_function(const RecoveredCallback<F, R>& function) { return function.function; }"
		, ...callbacks, ...calls, ...operations, "}"
		, "// Recovery supplies a typed failure-path value for Lean cleanup, never a successful host result."
		, "template<class F, class R> inline auto with_recovery(F&& function, R&& recovery) {"
		, "  return detail::RecoveredCallback<std::decay_t<F>, std::decay_t<R>>{std::forward<F>(function), std::forward<R>(recovery)};"
		, "}"
		, ...exports, "}", ""].join("\n");
	return { ...conversions, conversionsHeader: conversions.header, header };
};
