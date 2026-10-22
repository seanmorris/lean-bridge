/**
 * Nominal Java owners also expose JavaBean properties to Kotlin consumers.
 *
 * @file
 */
const reserved = new Set("get share retain close isClosed equals hashCode toString getClass clone finalize notify notifyAll wait sameIdentity invoke asCallback callFromHost".split(" "));
const quoted = name => name.split(".").map(part => `\`${part}\``).join(".");

/**
 * Preserve Kotlin's primitive arrays, callback interfaces and original owners.
 *
 * @param model - Generated value and call families.
 * @param fn - Callable declaration.
 * @param index - Original lowered parameter index.
 */
export const ownedJvmKotlinParameterType = (model, fn, index) => {
	const id = fn.parameters[index], node = model.types.find(node => node.id === id);
	return model.c.hostArgument?.(fn, index) && !fn.nativeCallbacks?.includes(index) ? quoted(model.kotlin.namespace + "." + node.delegateType)
		: model.wholeOwners && (fn.anchor === index || fn.transfers?.includes(index))
			? `${quoted(model.namespace)}.Value<${model.kotlin.publicTypes[id]}>` : model.kotlin.publicTypes[id];
};

/**
 * Give nominal whole results their owner class, including closure results.
 *
 * @param model - Generated value and call families.
 * @param fn - Callable declaration.
 * @param property - Keep a Unit-valued property as the explicit Unit singleton.
 */
export const ownedJvmKotlinReturnType = (model, fn, property = false) => {
	const node = model.types.find(node => node.id === fn.result);
	if(node.name === "unit" && !property) return "kotlin.Unit";
	return model.wholeOwners && node.representation !== "copied"
		? node.ownerType ? `${quoted(model.namespace)}.${ownedJvmOwnerName(node, true)}`
			: `${quoted(model.namespace)}.Value<${model.kotlin.publicTypes[fn.result]}>` : model.kotlin.publicTypes[fn.result];
};

/**
 * Select the implementation class for one language family's whole owner.
 *
 * @param node - Nominal resource or owned aggregate.
 * @param kotlin - Use the Kotlin value family.
 */
export const ownedJvmOwnerName = (node, kotlin = false) => node.ownerType
	? `${kotlin ? "_OwnedKotlin" : ""}${node.ownerType}` : null;

/**
 * Emit checked public members over the original bindings and owner slot.
 *
 * @param model - Native call catalog and Java type spellings for both families.
 * @param node - Declared receiver owner.
 * @param kotlin - Select Kotlin values inside the Java implementation class.
 * @param raw - Allow only members that need no receiver owner slot.
 */
export const ownedJvmReceiverMembers = (model, node, kotlin = false, raw = false) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const claimed = new Set([...reserved, node.publicType, node.ownerType]);
	const members = [];
	for(const [index, fn] of (model.exportCalls ?? model.functions).entries())
	{
		if(fn.receiver !== 0 || fn.parameters[0] !== node.id) continue;
		const property = fn.receiverKind === "property";
		const name = property ? "get" + fn.publicName[0].toUpperCase() + fn.publicName.slice(1) : fn.publicName;
		if(!fn.overload)
		{
			if(claimed.has(fn.publicName) || claimed.has(name)) throw new TypeError(`JVM receiver member is reserved or duplicated: ${node.publicType}.${name}`);
			claimed.add(fn.publicName); claimed.add(name);
		}
		if(raw && (fn.anchor === 0 || fn.transfers?.includes(0))) continue;
		const args = fn.parameters.slice(1).map((_, index) => `arg${index + 1}`);
		const receiver = raw || fn.anchor === 0 || fn.transfers?.includes(0) ? "this" : "get()";
		const callName = model.methodName ? model.methodName(fn, kotlin ? "Kotlin" : "Java") : `call${kotlin ? "Kotlin" : "Java"}${index}`;
		const call = `bindings.${callName}(${[receiver, ...args].join(", ")})`;
		const unit = nodes.get(fn.result).name === "unit";
		const result = unit && !property ? "void" : model.returnType(fn, kotlin);
		members.push(`${fn.transfers?.includes(0) ? "    /** Consumes the original receiver owner at the Lean call boundary. */\n" : ""}    public ${result} ${name}(${args.map((name, index) => `${model.parameterType(fn, index + 1, kotlin)} ${name}`).join(", ")}) {
        try { ${unit && !property ? "" : "return "}${call}; }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
`);
	}
	return members.join("");
};

/**
 * Expose safe members on Kotlin raw resource views, without inventing an owner.
 *
 * @param model - Generated calls and Kotlin type spellings.
 * @param node - Declared resource receiver.
 */
export const ownedKotlinReceiverMembers = (model, node) => (model.exportCalls ?? model.functions).flatMap((fn, index) => {
	if(fn.receiver !== 0 || fn.parameters[0] !== node.id || fn.anchor === 0 || fn.transfers?.includes(0)) return [];
	const property = fn.receiverKind === "property";
	const result = ownedJvmKotlinReturnType(model, fn, property);
	const args = fn.parameters.slice(1).map((_, index) => `arg${index + 1}`);
	const callName = model.methodName ? model.methodName(fn, "Kotlin") : `callKotlin${index}`;
	const call = `bindings.${callName}(${["this", ...args].join(", ")})`;
	return [`    ${property ? `val ${quoted(fn.publicName)}: ${result}\n        get()`
		: `fun ${quoted(fn.publicName)}(${args.map((name, index) => `${name}: ${ownedJvmKotlinParameterType(model, fn, index + 1)}`).join(", ")}): ${result}`} = try { ${call}${result === "kotlin.Unit" ? "; kotlin.Unit" : ""} }
        finally { java.lang.ref.Reference.reachabilityFence(this) }
`];
}).join("");

/**
 * Keep Share and Retain covariant without exposing owner constructors.
 *
 * @param model - Generated calls with nominal return types.
 * @param node - Owner type to emit.
 * @param kotlin - Select the Kotlin payload family.
 */
export const ownedJvmReceiverOwner = (model, node, kotlin = false) => {
	const name = ownedJvmOwnerName(node, kotlin), value = model.type(node.id, kotlin);
	if(!name) throw new TypeError("Missing JVM nominal owner name");
	return `package ${model.namespace};

/** A complete ${node.publicType} with its original checked Lean owner. */
public final class ${name} extends Value<${value}> {
    private final _OwnedBindings bindings;
    private final java.util.function.Function<${value}, Value<${value}>> copy;
    private final java.util.function.BiPredicate<Object, Object> comparison;
    ${name}(_OwnedBindings bindings, _OwnedRuntime.Lease lease, ${value} value,
            java.util.function.Function<${value}, Value<${value}>> copy,
            java.util.function.BiPredicate<Object, Object> comparison) {
        super(lease, value, copy, comparison, ${kotlin});
        this.bindings = bindings; this.copy = copy; this.comparison = comparison;
    }
    @Override public ${name} share() {
        try { return new ${name}(bindings, guard.lease, get(), copy, comparison); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
    @Override public ${name} retain() {
        return (${name})super.retain();
    }
${ownedJvmReceiverMembers(model, node, kotlin)}\
}
`;
};
