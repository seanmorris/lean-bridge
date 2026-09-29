/**
 * C++ move transactions over the public C input-owner handoff.
 *
 * @file
 */

/**
 * Observe the C adapter's exact move point without exposing a host callback.
 * Only the creating thread reads the C-owned slot; foreign observers use the
 * published atomic outcome. The snapshot owner also guards preparation failures.
 *
 * @param p - Validated public C prefix.
 */
export const ownedCppTransferSignal = p => `struct InputMoveSignal {
  NativeOwner owner;
  const pid_t process = ::getpid();
  const std::thread::id thread = std::this_thread::get_id();
  std::atomic<bool> completed{false};
  bool armed = false;
  bool consumed() const noexcept {
    if (process == ::getpid() && thread == std::this_thread::get_id())
      return armed && !owner.value;
    return completed.load();
  }
  ${p}_result **slot() noexcept { return &owner.value; }
};`;

/**
 * Retain each submitted lease until its copied C input owner has been consumed
 * or rejected. Shared aliases move together; independent retains stay separate.
 * Validation and allocation finish before any lease is armed for consumption.
 *
 * @param p - Validated public C prefix.
 */
const transferSupport = p => `struct OwnedInputTransfers {
  struct Entry { std::shared_ptr<Lease> lease; size_t group; };
  std::shared_ptr<State> state;
  OwnedBudget budget;
  std::vector<std::shared_ptr<InputMoveSignal>> groups;
  std::unordered_map<Lease *, Entry> leases;
  bool finished = false;
  OwnedInputTransfers(std::shared_ptr<State> input, size_t count) : state(std::move(input)) {
    budget.storage(count, sizeof(InputMoveSignal) + sizeof(std::shared_ptr<InputMoveSignal>));
    groups.reserve(count);
    for (size_t i = 0; i < count; ++i) groups.push_back(std::make_shared<InputMoveSignal>());
  }
  OwnedInputTransfers(const OwnedInputTransfers&) = delete;
  OwnedInputTransfers& operator=(const OwnedInputTransfers&) = delete;
  ~OwnedInputTransfers() { finish(); }
  void add(std::shared_ptr<Lease> lease, size_t group) {
    lease->require_transfer();
    if (lease->state() != state || group >= groups.size()) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
    const auto prior = leases.find(lease.get());
    if (prior != leases.end()) {
      if (prior->second.group != group) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
      return;
    }
    budget.storage(1, sizeof(Entry) + 4 * sizeof(void *));
    auto *identity = lease.get(); leases.emplace(identity, Entry{std::move(lease), group});
  }
  ${p}_result **owner(size_t index) { return groups.at(index)->slot(); }
  void arm() {
    for (const auto& group : groups)
      if (!group->owner.value) throw Error(${p.toUpperCase()}_INVALID_ARGUMENT);
    for (const auto& [identity, entry] : leases) { (void)identity; entry.lease->require_transfer(); }
    for (const auto& [identity, entry] : leases) { (void)identity; entry.lease->begin_transfer(groups[entry.group]); }
    for (const auto& group : groups) group->armed = true;
  }
  void finish() noexcept {
    if (finished) return;
    finished = true;
    for (const auto& group : groups) group->completed.store(group->consumed());
    for (const auto& [identity, entry] : leases) {
      (void)identity; entry.lease->finish_transfer(groups[entry.group]);
    }
  }
};`;

/**
 * Collect actual resource leaves, including boxes and host-assembled graphs.
 * A complete conversion check precedes this bounded traversal. Two transferred
 * arguments cannot consume aliases of the same lease in one call.
 *
 * @param conversions - Generated C++ types and authenticated C signatures.
 */
export const ownedCppInputTransfers = conversions => {
	const { c, types } = conversions, nodes = new Map(types.map(node => [node.id, node]));
	const owned = new Set(types.filter(node => node.identity).map(node => node.id));
	let changed = true;
	while(changed)
	{
		changed = false;
		for(const node of types)
		{
			const contains = owned.has(node.element) || [...node.fields, ...node.cases.flatMap(branch => branch.fields)].some(field => owned.has(field.type));
			if(!owned.has(node.id) && contains)
			{
				owned.add(node.id); changed = true;
			}
		}
	}
	const declarations = [], definitions = [];
	for(const node of types)
	{
		const signature = `inline void owned_move_leases${node.index}(const ${node.hostName}& source, size_t depth, OwnedInputTransfers& moves, size_t group)`;
		declarations.push(signature + ";");
		const body = ["(void)source; (void)depth; (void)moves; (void)group;"];
		const field = (item, source) => owned.has(item.type)
			? [`owned_move_leases${nodes.get(item.type).index}(${item.boxed ? `*(${source})` : source}, depth + 1, moves, group);`] : [];
		if(owned.has(node.id))
		{
			body.push("moves.budget.enter(depth);");
			if(node.identity) body.push("moves.add(ResourceAccess::lease(source, moves.state), group);");
			else if(node.element) body.push(`for (const auto& item : source) owned_move_leases${nodes.get(node.element).index}(item, depth + 1, moves, group);`);
			else if(node.kind === "option") body.push("if (source) {", ...field(node.fields[0], "*source"), "}");
			else if(node.kind === "result") body.push("if (source.index() == 0) {", ...field(node.fields[0], "std::get<0>(source).value")
				, "} else {", ...field(node.fields[1], "std::get<1>(source).value"), "}");
			else if(node.kind === "variant") node.cases.forEach((branch, index) => body.push(
				`${index ? "else " : ""}if (source.value.index() == ${index}) {`
				, ...branch.fields.flatMap(item => field(item, `std::get<${index}>(source.value).${item.name}`)), "}"
			));
			else body.push(...node.fields.flatMap((item, index) => field(item, `source.${node.kind === "tuple" ? ["first", "second"][index] : item.name}`)));
		}
		definitions.push(`${signature} {\n${body.map(line => `  ${line}`).join("\n")}\n}`);
	}
	return [transferSupport(c.prefix), ...declarations, ...definitions].join("\n");
};
