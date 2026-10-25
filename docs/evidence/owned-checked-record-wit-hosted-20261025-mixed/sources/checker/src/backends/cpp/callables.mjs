/**
 * Typed synchronous C++ callbacks and move-only, thread-bound Lean closures.
 *
 * @file
 */
import { copiedCppType, cppCopiedNamespace } from "./copied-values.mjs";

/**
 * Resolve an admitted copied value or callback.
 *
 * @param surface - Admitted C ABI surface.
 * @param ref - Canonical type reference.
 */
export const cppSite = (surface, ref) => surface.callbacks.get(ref.id) ?? surface.copy(ref);
/**
 * Identify a result with no C output slot.
 *
 * @param copy - Admitted type description.
 */
export const cppUnit = copy => copy.scalarName === "unit";
/**
 * Identify a typed callable rather than a copied value.
 *
 * @param copy - Admitted type description.
 */
export const cppCallable = copy => Boolean(copy.type?.callable);
const returned = (surface, copy) => cppUnit(copy) ? "void" : copiedCppType(copy, cppCopiedNamespace(surface));
const signature = (surface, callback) => `${returned(surface, surface.copy(callback.type.callable.result.type))}(${callback.type.callable.parameters.map(site => copiedCppType(surface.copy(site.type), cppCopiedNamespace(surface))).join(", ")})`;
/**
 * Spell a public copied or owned-callable result.
 *
 * @param surface - Admitted C ABI surface.
 * @param copy - Admitted result description.
 */
export const cppResult = (surface, copy) => cppCallable(copy) ? `LeanClosure<${signature(surface, copy)}>` : returned(surface, copy);

/**
 * Generate the shared ownership and exception boundary without public C pointers.
 *
 * @param surface - Admitted C ABI surface.
 */
export const cppCallablePublic = surface => surface.callbacks.size ? `
namespace detail {
inline const std::shared_ptr<const char>& thread_identity() {
  static thread_local const auto identity = std::make_shared<const char>();
  return identity;
}
struct Lease {
  void* pointer = nullptr;
  void (*dispose)(void**);
  const pid_t process = ::getpid();
  const std::shared_ptr<const char> thread = thread_identity();
  size_t active = 0;
  bool closed = false;
  explicit Lease(void (*release)(void**)) : dispose(release) {}
  ~Lease() { if (process == ::getpid()) release(); }
  void release() noexcept { if (pointer) dispose(&pointer); }
  void require_thread() const {
    if (process != ::getpid()) invalid("Start a fresh process after fork to use Lean");
    if (thread != thread_identity()) invalid("Lean closure belongs to another thread");
  }
  void close() { require_thread(); closed = true; if (!active) release(); }
};
struct ActiveCall {
  std::shared_ptr<Lease> lease;
  explicit ActiveCall(std::shared_ptr<Lease> value) : lease(std::move(value)) {
    if (!lease) invalid("Lean closure is closed");
    lease->require_thread();
    if (lease->closed || !lease->pointer) invalid("Lean closure is closed");
    ++lease->active;
  }
  ~ActiveCall() { if (--lease->active == 0 && lease->closed) lease->release(); }
  ActiveCall(const ActiveCall&) = delete;
  ActiveCall& operator=(const ActiveCall&) = delete;
};
struct CallbackState {
  std::exception_ptr failure;
  void finish() const { if (failure) std::rethrow_exception(failure); }
};
struct ClosureFactory;
}
template<class Signature> class LeanClosure;
template<class Result, class... Args> class LeanClosure<Result(Args...)> final {
  std::shared_ptr<detail::Lease> lease_;
  Result (*invoke_)(detail::Lease&, Args...);
  LeanClosure(std::shared_ptr<detail::Lease> lease, Result (*invoke)(detail::Lease&, Args...)) noexcept
    : lease_(std::move(lease)), invoke_(invoke) {}
  friend struct detail::ClosureFactory;
public:
  LeanClosure(const LeanClosure&) = delete;
  LeanClosure& operator=(const LeanClosure&) = delete;
  LeanClosure(LeanClosure&&) noexcept = default;
  LeanClosure& operator=(LeanClosure&&) noexcept = default;
  Result call(Args... args) const {
    detail::ActiveCall active(lease_);
    return invoke_(*active.lease, std::move(args)...);
  }
  Result operator()(Args... args) const { return call(std::move(args)...); }
  void close() const { if (lease_) lease_->close(); }
  bool is_closed() const noexcept { return !lease_ || lease_->closed; }
};
namespace detail {
struct ClosureFactory {
  template<class Signature, class Invoke> static LeanClosure<Signature> make(std::shared_ptr<Lease> lease, Invoke invoke) noexcept {
    return LeanClosure<Signature>(std::move(lease), invoke);
  }
};
}
` : "";

/**
 * Generate each admitted signature's exception-contained C trampoline and lease invoker.
 *
 * @param surface - Admitted C ABI surface.
 */
export const cppCallableHelpers = surface => [...surface.callbacks.values()].map((callback, index) => {
	const p = surface.prefix, m = p.toUpperCase(), native = `${p}_owned_${callback.field}`;
	const parameters = callback.type.callable.parameters.map(site => surface.copy(site.type));
	const result = surface.copy(callback.type.callable.result.type), host = returned(surface, result);
	const type = copy => copiedCppType(copy, cppCopiedNamespace(surface));
	const inputs = parameters.map((copy, i) => `${copy.name}${copy.aggregate ? " const*" : ""} arg${i}`);
	const converted = parameters.map((copy, i) => `from${copy.index}(${copy.aggregate ? "*" : ""}arg${i})`).join(", ");
	const publicInputs = parameters.map((copy, i) => `${type(copy)} arg${i}`);
	const body = [`  ${p}_error error{}; size_t budget = 16u * 1024u * 1024u;`];
	for(const [i, copy] of parameters.entries()) body.push(`  check${copy.index}(arg${i}, budget);`);
	const args = parameters.map((copy, i) => { body.push(`  View${copy.index} input${i}(arg${i});`); return `${copy.aggregate ? "&" : ""}input${i}.value`; });
	if(!cppUnit(result))
{
		body.push(`  ${result.name} output{};`);
		if(result.aggregate) body.push(`  Owned<${result.name}, ${result.name}_clear> owner(&output);`);
		args.push("&output");
}
	body.push(`  check(${native}_call(static_cast<${native}*>(lease.pointer), ${[...args, "&error"].join(", ")}), error);`);
	if(!cppUnit(result)) body.push(`  return from${result.index}(output);`);
	return `
template<class Function> concept Accepts${index} = std::invocable<Function&, ${parameters.map(type).join(", ")}>
  && std::same_as<std::invoke_result_t<Function&, ${parameters.map(type).join(", ")}>, ${host}>;
template<class Function> struct Callback${index} {
  Function& function;
  CallbackState& state;
${result.aggregate ? `  struct Result { ${host} data; View${result.index} view; explicit Result(${host} value) : data(std::move(value)), view(data) {} };
  std::vector<std::unique_ptr<Result>> results;` : ""}
  Callback${index}(Function& value, CallbackState& scope) : function(value), state(scope) {}
  static ${p}_status invoke(void* context, ${[...inputs, ...cppUnit(result) ? [] : [`${result.name}* output`], `${p}_error* error`].join(", ")}) noexcept {
    auto& self = *static_cast<Callback${index}*>(context);
    (void)error;
    if (self.state.failure) return ${m}_STATUS_DECLARED_ERROR;
    try {
      ${cppUnit(result) ? `std::invoke(self.function, ${converted});` : `${host} value = std::invoke(self.function, ${converted});
      size_t budget = 16u * 1024u * 1024u; check${result.index}(value, budget);
      ${result.aggregate ? `auto owned = std::make_unique<Result>(std::move(value));
      self.results.push_back(std::move(owned));
      *output = self.results.back()->view.value;` : `View${result.index} view(value); *output = view.value;`}`}
      return ${m}_STATUS_OK;
    } catch (...) {
      if (!self.state.failure) self.state.failure = std::current_exception();
      return ${m}_STATUS_DECLARED_ERROR;
    }
  }
};
inline void dispose${index}(void** pointer) noexcept {
  auto* value = static_cast<${native}*>(*pointer);
  ${native}_dispose(&value); *pointer = value;
}
inline ${host} invoke${index}(Lease& lease, ${publicInputs.join(", ")}) {
${body.join("\n")}
}
`;
}).join("\n");

/**
 * Construct a public lease after the C result has passed status checks.
 *
 * @param surface - Admitted C ABI surface.
 * @param callback - Returned callable description.
 */
export const cppClosureReturn = (surface, callback) => `detail::ClosureFactory::make<${signature(surface, callback)}>(std::move(_lb_lease), detail::invoke${callback.cppIndex})`;
