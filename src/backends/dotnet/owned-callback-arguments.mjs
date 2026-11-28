/**
 * Keep native anchored closures distinct from raw-input host delegates.
 *
 * @file
 */

/**
 * Native closures require original whole arguments when invoked directly.
 * Overloads pass those closures to Lean without pretending that their typed
 * Invoke method accepts the borrowed raw values supplied to host delegates.
 *
 * @param c - Checked C callback catalog and argument classification.
 * @param fn - Export or returned-closure invocation.
 */
export const ownedDotnetCallbackArguments = (c, fn) => {
	const positions = fn.parameters.flatMap((id, index) =>
		c.hostArgument?.(fn, index) && c.callbacks.some(callback => callback.id === id && callback.anchor !== undefined) ? [index] : []);
	// Each call needs at least this much generated binding scaffolding. Reject
	// expansion before allocating an exponential list beyond the source budget.
	if(2 ** positions.length * 4096 > 16 * 1024 * 1024)
		throw new TypeError("Owned C# native callback overloads exceed the 16 MiB call binding budget");
	const variants = [fn];
	for(const position of positions)
	{
		const additional = variants.map(value => ({ ...value
			, nativeCallbacks: [...value.nativeCallbacks ?? [], position] }));
		variants.push(...additional);
	}
	return variants;
};

export const ownedDotnetCallbackResult = `/// <summary>A callback reply containing a raw value or a checked whole owner. This view does not take ownership.</summary>
public readonly struct CallbackResult<T>
{
    private readonly T value;
    private readonly Value<T>? owner;
    private readonly bool initialized;
    private CallbackResult(T value) { this.value = value; owner = null; initialized = true; }
    private CallbackResult(Value<T> owner)
    {
        global::System.ArgumentNullException.ThrowIfNull(owner);
        value = default!; this.owner = owner; initialized = true;
    }
    public static implicit operator CallbackResult<T>(T value) => new(value);
    public static implicit operator CallbackResult<T>(Value<T> owner) => new(owner);
    public T Get()
    {
        if (!initialized) throw new global::System.ArgumentException("Callback reply is uninitialized");
        return owner is null ? value : owner.Get();
    }
    internal T Read(Interop.OwnedValueScope scope)
    {
        if (!initialized) throw new global::System.ArgumentException("Callback reply is uninitialized");
        return owner is null ? value : scope.Whole(owner);
    }
}
`;

/**
 * Emit a borrowed record in the native alternate layout, never in the leased result layout.
 *
 * @param node - Input record with CLR field names and its native layout.
 * @param nodes - Catalog of checked field types.
 */
export const dotnetHostFieldWriter = (node,nodes) => {
	const view=node.hostInput;
	const writes=view.fields.map(f => {
		const child=nodes.get(f.type), prop="value."+f.publicName;
		if(f.host) return `raw.${f.rawName} = ${prop}.Lease is {} lease${child.index}_${f.rawName} ? Host${child.index}(lease${child.index}_${f.rawName},scope,frame) : Host${child.index}(${prop}.Callback!,scope,frame);`;
		const encoded=`OwnedConvert.Write${child.index}(${prop},scope,1,${f.pointer?"true":"false"})`;
		return `raw.${f.rawName} = ${f.pointer?`scope.Store(${encoded})`:encoded};`;
	});
	return `    private ${view.raw} Input${node.index}(_V.${view.publicType} value, OwnedValueScope scope, OwnedCallFrame? frame = null)
    {
        global::System.ArgumentNullException.ThrowIfNull(value);
        scope.Enter(value,0,sizeof(${view.raw}),true);
        try
        {
            var raw = default(${view.raw});
${writes.map(line=>"            "+line).join("\n")}
            return raw;
        }
        finally { scope.Leave(value); }
    }`;
};
