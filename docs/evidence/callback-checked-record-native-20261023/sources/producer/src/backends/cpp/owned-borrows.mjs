/**
 * Whole-result C++ ownership for parameter-anchored borrowed values.
 *
 * @file
 */

/**
 * Keep an original result owner even when a container has no identity leaves.
 * Copies share that owner; retain explicitly creates independent ownership.
 * Borrowed results hold their own storage, never a strong reference to an anchor.
 *
 * @param p - Validated public C prefix.
 * @param options - Optional named receiver members.
 * @param options.receiverExports - Expose checked methods on the whole owner.
 */
export const ownedCppAnchoredValues = (p, { receiverExports = false } = {}) => `namespace detail {
struct ValueAccess;
template<class T> struct ValueOps;
}
template<class T> class Value${receiverExports ? " : public detail::ReceiverMembers<Value<T>>" : ""} {
  struct Storage {
    std::shared_ptr<detail::Lease> lease; T value;
    Storage(std::shared_ptr<detail::Lease> input, T&& source)
      : lease(std::move(input)), value(std::move(source)) {}
  };
  std::shared_ptr<const Storage> storage_;
  Value(std::shared_ptr<detail::Lease> lease, T&& value)
    : storage_(std::make_shared<Storage>(std::move(lease), std::move(value))) {}
  friend struct detail::ValueAccess;
public:
  Value() noexcept = default;
  Value(const Value&) noexcept = default;
  Value& operator=(const Value&) noexcept = default;
  Value(Value&&) noexcept = default;
  Value& operator=(Value&&) noexcept = default;
  void close() noexcept { storage_.reset(); }
  bool is_closed() const noexcept { return !storage_ || storage_->lease->closed(); }
  const T& get() const {
    if (!storage_) throw Error(${p.toUpperCase()}_CLOSED);
    storage_->lease->require(); return storage_->value;
  }
  const T *operator->() const { return &get(); }
  const T& operator*() const { return get(); }
  operator const T&() const { return get(); }
  Value retain() const { return detail::ValueOps<T>::copy(get()); }
  template<class... Args> decltype(auto) operator()(Args&&... args) const
    requires requires(const T& value) { value(std::forward<Args>(args)...); } {
    return get()(std::forward<Args>(args)...);
  }
  friend bool operator==(const Value& a, const Value& b) { return a.get() == b.get(); }
};
namespace detail {
struct ValueAccess {
  template<class T> static Value<T> make(std::shared_ptr<Lease> lease, T&& value) {
    if (!lease) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
    lease->require(); return Value<T>(std::move(lease), std::move(value));
  }
  template<class T> static const std::shared_ptr<Lease>& lease(const Value<T>& value, const std::shared_ptr<State>& state) {
    (void)value.get();
    if (value.storage_->lease->state() != state) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
    return value.storage_->lease;
  }
};
}
template<class T> inline Value<T> copy_value(const T& source) { return detail::ValueOps<T>::copy(source); }
template<class T> inline Value<T> copy_value(const Value<T>& source) { return source.retain(); }
`;

/**
 * Deferred member lookup keeps source-named methods on their nominal owners.
 * Properties are zero-argument const methods; consuming receivers require an
 * rvalue. The specialization checks the remaining arguments and callback types.
 *
 * @param c - Validated receiver-first public C signatures.
 */
export const ownedCppReceiverMembers = c => {
	const reserved = new Set(["close", "is_closed", "get", "retain"]);
	const lines = ["namespace detail {", "template<class Self> struct ReceiverOps;"
		, "template<class Self> struct ReceiverMembers {"];
	for(const item of c.functions.filter(item => item.receiver === 0))
	{
		const name = item.cName.slice(c.prefix.length + 1), moving = item.transfers?.includes(0);
		if(reserved.has(name)) throw new TypeError(`Owned C++ receiver member is reserved: ${name}`);
		const type = moving ? "Self&&" : "const Self&";
		const self = moving ? "std::move(self)" : "self";
		lines.push(`  template<class... Args> decltype(auto) ${name}(Args&&... args) ${moving ? "&&" : "const &"}`
			, `    requires requires(${type} self) { ReceiverOps<Self>::${name}(${self}, std::forward<Args>(args)...); } {`
			, `    auto${moving ? "&&" : "&"} self = static_cast<${type}>(*this);`
			, `    return ReceiverOps<Self>::${name}(${self}, std::forward<Args>(args)...);`, "  }");
	}
	lines.push("};", "}", ""); return lines.join("\n");
};

/**
 * Copy through the checked C retain/copy operation, including empty constructors.
 * Transparent Array/List aliases share a C++ type and therefore one copy overload.
 *
 * @param conversions - Checked C++ projection and public C signatures.
 */
export const ownedCppValueCopies = conversions => {
	const { c, types } = conversions, seen = new Set(), lines = [];
	for(const node of types) if(node.representation !== "copied" && !seen.has(node.canonicalHostName))
	{
		seen.add(node.canonicalHostName);
		const copy = [...c.copies ?? [], ...c.retains].find(item => item.id === node.id);
		if(!copy) throw new TypeError("Owned C++ retention requires authenticated copy support");
		lines.push(`template<> struct ValueOps<${node.hostName}> {`
			, `  static Value<${node.hostName}> copy(const ${node.hostName}& source) {`
			, "    auto state = current_state(); OwnedBudget budget;"
			, `    owned_check${node.index}(source, 0, budget, state);`
			, `    OwnedView${node.index} view(source, state);`
			, `    ${node.cName} returned{}; OwnedOutput output(state);`
			, `    checked(${copy.cName}(state->require(), ${node.leaf ? "" : "&"}view.value, &returned, &output.owner.value));`
			, `    auto converted = owned_from${node.index}(returned, 0, budget, output);`
			, "    return ValueAccess::make(output.hold(), std::move(converted));"
			, "  }", "};");
	}
	return lines.join("\n");
};

/**
 * Move original result owners, not synthetic retained copies. This lets the
 * native owner tree reject anchor/ancestor transfers and expire all descendants
 * at the same handoff observed by reentrant callbacks.
 *
 * @param p - Validated public C prefix.
 */
export const ownedCppAnchoredTransfers = p => `struct OwnedInputTransfers {
  struct Entry { std::shared_ptr<Lease> lease; std::shared_ptr<InputMoveSignal> signal; };
  std::shared_ptr<State> state;
  std::vector<Entry> entries;
  bool armed = false, finished = false;
  OwnedInputTransfers(std::shared_ptr<State> input, size_t count) : state(std::move(input)), entries(count) {}
  OwnedInputTransfers(const OwnedInputTransfers&) = delete;
  OwnedInputTransfers& operator=(const OwnedInputTransfers&) = delete;
  ~OwnedInputTransfers() { finish(); }
  void add(std::shared_ptr<Lease> lease, size_t group) {
    lease->require_transfer();
    if (lease->state() != state || group >= entries.size()) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
    for (const auto& entry : entries) if (entry.lease == lease) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
    entries.at(group) = Entry{std::move(lease), std::make_shared<InputMoveSignal>()};
  }
  ${p}_result **owner(size_t group) { return entries.at(group).signal->slot(); }
  void arm() {
    for (const auto& entry : entries) {
      if (!entry.lease) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
      entry.lease->require_transfer();
    }
    for (const auto& entry : entries) { entry.lease->begin_transfer(entry.signal); entry.signal->armed = true; }
    armed = true;
  }
  void finish() noexcept {
    if (finished || !armed) return;
    finished = true;
    for (const auto& entry : entries) entry.signal->completed.store(entry.signal->consumed());
    for (const auto& entry : entries) entry.lease->finish_transfer(entry.signal);
  }
};`;
