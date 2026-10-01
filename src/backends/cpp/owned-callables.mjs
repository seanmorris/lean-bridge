/**
 * Typed C++ calls and call-scoped host callbacks over explicit C result owners.
 * Exceptions never cross a C trampoline; resource borrows expire on its return.
 *
 * @file
 */
import { generateOwnedCppConversions } from "./owned-conversions.mjs";
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";
import { ownedCppInputTransfers } from "./owned-transfers.mjs";
import { ownedCppAnchoredTransfers, ownedCppValueCopies } from "./owned-borrows.mjs";

/**
 * Generate ordinary exports, callable resource operations and host adapters.
 * Prepared-package admission still requires authenticated packaging and installed
 * consumer evidence; this generator alone does not enable a target.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Consumer capabilities implemented by the caller.
 * @param options.transferredInputs - Enable explicit rvalue input consumption.
 * @param options.anchoredResults - Preserve original owners for returned borrows.
 * @param options.receiverExports - Expose checked nominal methods and properties.
 * @param options.hostCallbacks - The compiled adapter provides callbacks and copies.
 */
export const generateOwnedCppCallables = (ir, { transferredInputs = false, anchoredResults = false, receiverExports = false, hostCallbacks = true } = {}) => {
	const conversions = generateOwnedCppConversions(ir, { transferredInputs, anchoredResults, receiverExports, hostCallbacks }), { c } = conversions;
	const transfers = c.functions.some(item => item.transfers?.length);
	const anchors = c.functions.some(item => item.anchor !== undefined);
	const receivers = c.functions.some(item => item.receiver === 0), wholeOwners = anchors || receivers;
	const p = c.prefix, m = p.toUpperCase(), nodes = new Map(conversions.types.map(node => [node.id, node]));
	const unit = node => node.kind === "primitive" && node.name === "unit";
	const resultType = node => unit(node) ? "void" : node.hostName;
	const wrappedResult = item => wholeOwners && !item.retain && nodes.get(item.result).representation !== "copied";
	const callResult = item => wrappedResult(item) ? `Value<${nodes.get(item.result).hostName}>` : resultType(nodes.get(item.result));
	const callbacks = [], calls = [], operations = [], exports = [];
	if(hostCallbacks) for(const callback of c.callbacks)
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
		const wrapped = params.map((_, index) => wholeOwners && (item.anchor === index || item.transfers?.includes(index)));
		const descriptors = params.map((_, index) => index >= offset && Boolean(c.hostArgument?.(item, index)));
		const host = descriptors.map((yes, index) => yes && !wrapped[index]);
		const templates = host.flatMap((yes, index) => yes ? [index] : []);
		return { params, host, wrapped, descriptors
			, prefix: templates.length ? [`template<${templates.map(index => `class F${index}`).join(", ")}>`
				, `requires (${templates.map(index => `${qualified}OwnedCallback${params[index].index}<F${index}>`).join(" && ")})`] : []
			, parameters: params.slice(offset).map((node, index) => {
				const hostType = wrapped[index + offset] ? `Value<${node.hostName}>` : node.hostName;
				return `${host[index + offset] ? `F${index + offset}&&` : item.transfers?.includes(index + offset) ? `${hostType}&&` : `const ${hostType}&`} a${index + offset}`;
			}).join(", ")
			, arguments: params.slice(offset).map((_, index) => host[index + offset] ? `std::forward<F${index + offset}>(a${index + offset})` : item.transfers?.includes(index + offset) ? `std::move(a${index + offset})` : `a${index + offset}`).join(", ") };
	};
	all.forEach((item, index) => {
		const result = nodes.get(item.result), sig = signature(item);
		const moving = item.transfers ?? [];
		const argument = i => `a${i}${sig.wrapped[i] ? ".get()" : ""}`;
		const prepare = moving.length ? [`  OwnedInputTransfers moves(call.state, ${moving.length});`
			, ...moving.map((parameter, group) => wholeOwners
				? `  moves.add(ValueAccess::lease(a${parameter}, call.state), ${group});`
				: `  owned_move_leases${sig.params[parameter].index}(a${parameter}, 0, moves, ${group});`)
			, ...wholeOwners ? [] : moving.flatMap((parameter, group) => {
				const node = sig.params[parameter], copy = [...c.retains, ...c.copies].find(candidate => candidate.id === node.id);
				return [`  ${node.cName} moved${parameter}{};`
					, `  checked(${copy.cName}(call.state->require(), ${node.leaf ? "" : "&"}view${parameter}.value, &moved${parameter}, moves.owner(${group})));`];
			})
			, "  auto *session = call.state->require();", "  moves.arm();"] : [];
		calls.push(...sig.prefix, `inline ${callResult(item)} owned_invoke${index}(${sig.parameters}) {`
			, "  OwnedCall call(current_state());"
			, ...sig.params.map((param, i) => `  ${sig.descriptors[i] ? `owned_check_callback${param.index}(${argument(i)}, call);` : `owned_check${param.index}(${argument(i)}, 0, call.budget, call.state);`}`)
			, ...sig.params.map((param, i) => `  ${sig.descriptors[i] ? `OwnedCallbackView${param.index}<${sig.wrapped[i] ? `const ${param.hostName}` : `std::remove_reference_t<F${i}>`}> view${i}(${argument(i)}, call);` : `OwnedView${param.index} view${i}(${argument(i)}, call.state);`}`)
			, `  ${result.cName} returned{}; OwnedOutput output(call.state);`
			, ...item.anchor !== undefined ? [`  auto *anchor = ValueAccess::lease(a${item.anchor}, call.state)->owner(call.state);`, "  output.anchored_result = true;"] : []
			, ...prepare
			, `  const auto status = ${item.cName}(${moving.length ? "session" : "call.state->require()"}${sig.params.map((param, i) => moving.includes(i)
				? `, ${param.leaf ? "" : "&"}${wholeOwners ? `view${i}.value` : `moved${i}`}, moves.owner(${moving.indexOf(i)})`
				: `, ${sig.descriptors[i] || !param.leaf ? "&" : ""}view${i}.value${item.anchor === i ? ", anchor" : ""}`).join("")}, &returned, &output.owner.value);`
			, ...moving.length ? ["  moves.finish();"] : []
			, "  if (call.error) std::rethrow_exception(call.error);", "  checked(status);"
			, ...wrappedResult(item) ? [`  auto converted = owned_from${result.index}(returned, 0, call.budget, output);`
				, "  return ValueAccess::make(output.hold(), std::move(converted));"]
				: [`  ${unit(result) ? "(void)" : "return "}owned_from${result.index}(returned, 0, call.budget, output);`], "}");
		if(c.functions.includes(item))
		{
			const pub = signature(item, 0, "detail::").prefix;
			exports.push(...pub, `inline ${callResult(item)} ${item.cName.slice(p.length + 1)}(${sig.parameters}) {`
				, `  return detail::owned_invoke${index}(${sig.arguments});`, "}");
		}
	});
	for(const node of nodes.values()) if(node.identity)
	{
		const retained = all.findIndex(item => item.retain && item.id === node.id);
		operations.push(`template<> struct ResourceOps<${node.identityTag}> {`
			, `  static ${node.hostName} retain(const ${node.hostName}& self) { return owned_invoke${retained}(self); }`);
		if(anchors) operations.push(`  static bool equal(const ${node.hostName}& a, const ${node.hostName}& b) {`
			, "    auto state = current_state(); bool result = false;"
			, `    const auto left = ResourceAccess::get<${node.cName}>(a, state), right = ResourceAccess::get<${node.cName}>(b, state);`
			, `    checked(${node.cName}_equal(state->require(), left, right, &result)); return result;`, "  }");
		const index = all.findIndex(item => c.callbacks.includes(item) && item.id === node.id);
		if(index !== -1)
		{
			const sig = signature(all[index], 1);
			operations.push(...sig.prefix.map(line => `  ${line}`)
				, `  static ${callResult(all[index])} call(const ${node.hostName}& self${sig.parameters ? `, ${sig.parameters}` : ""}) {`
				, `    return owned_invoke${index}(self${sig.arguments ? `, ${sig.arguments}` : ""});`, "  }");
		}
		operations.push("};");
	}
	const receiverGroups = new Map();
	for(const item of c.functions.filter(item => item.receiver === 0))
	{
		const sig = signature(item, 1), node = sig.params[0];
		const name = item.cName.slice(p.length + 1), moving = item.transfers?.includes(0);
		const owners = [{ type: `Value<${node.hostName}>`, wrapped: true }];
		if(node.identity && !sig.wrapped[0]) owners.push({ type: node.hostName, wrapped: false });
		for(const owner of owners)
		{
			const methods = receiverGroups.get(owner.type) ?? [];
			const argument = moving ? "std::move(self)" : owner.wrapped && !sig.wrapped[0] ? "self.get()" : "self";
			methods.push(...sig.prefix.map(line => "  " + line)
				, `  static ${callResult(item)} ${name}(${moving ? `${owner.type}&&` : `const ${owner.type}&`} self${sig.parameters ? ", " + sig.parameters : ""}) {`
				, `    return owned_invoke${all.indexOf(item)}(${argument}${sig.arguments ? ", " + sig.arguments : ""});`, "  }");
			receiverGroups.set(owner.type, methods);
		}
	}
	const receiverOperations = [...receiverGroups].flatMap(([type, methods]) => [
		`template<> struct ReceiverOps<${type}> {`, ...methods, "};"
	]);
	const header = ["#pragma once", `#include "${p}-conversions.hpp"`
		, "#include <concepts>", "#include <exception>", "#include <functional>"
		, ...transfers ? ["#include <unordered_map>"] : []
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
		, ...transfers ? [wholeOwners ? ownedCppAnchoredTransfers(p) : ownedCppInputTransfers(conversions)] : []
		, ...callbacks, ...calls, ...operations
		, ...wholeOwners ? [ownedCppValueCopies(conversions)] : []
		, ...receiverOperations, "}"
		, "// Recovery supplies a typed failure-path value for Lean cleanup, never a successful host result."
		, "template<class F, class R> inline auto with_recovery(F&& function, R&& recovery) {"
		, "  return detail::RecoveredCallback<std::decay_t<F>, std::decay_t<R>>{std::forward<F>(function), std::forward<R>(recovery)};"
		, "}"
		, ...exports, "}", ""].join("\n");
	return { ...conversions, conversionsHeader: conversions.header, header };
};
