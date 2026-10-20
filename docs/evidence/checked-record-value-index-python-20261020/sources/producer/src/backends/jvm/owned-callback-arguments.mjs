/**
 * Keep native anchored closures distinct from raw-input host callbacks.
 *
 * @file
 */

/**
 * Native closures need original whole arguments when invoked directly. Each
 * generated overload records which callback positions carry a native closure
 * instead of a host callback interface.
 *
 * @param c - Checked C callback catalog and argument classification.
 * @param fn - Export or returned-closure invocation.
 */
export const ownedJvmCallbackArguments = (c, fn) => {
	const positions = fn.parameters.flatMap((id, index) =>
		c.hostArgument?.(fn, index) && c.callbacks.some(callback => callback.id === id && callback.anchor !== undefined) ? [index] : []);
	if(2 ** positions.length * 4096 > 16 * 1024 * 1024)
		throw new TypeError("Owned JVM native callback overloads exceed the 16 MiB call binding budget");
	const variants = [fn];
	for(const position of positions)
	{
		const additional = variants.map(value => ({ ...value
			, nativeCallbacks: [...value.nativeCallbacks ?? [], position] }));
		variants.push(...additional);
	}
	return variants;
};

export const ownedJvmCallbackResult = `/** A callback reply containing a raw value or a checked whole owner. This view does not take ownership. */
public final class CallbackResult<T> {
    private final T value;
    private final Value<T> owner;
    private CallbackResult(T value, Value<T> owner) { this.value = value; this.owner = owner; }
    public static <T> CallbackResult<T> value(T value) {
        return new CallbackResult<>(java.util.Objects.requireNonNull(value), null);
    }
    public static <T> CallbackResult<T> owner(Value<T> owner) {
        return new CallbackResult<>(null, java.util.Objects.requireNonNull(owner));
    }
    public T get() { return owner == null ? value : owner.get(); }
    T read(_OwnedConvert.Scope scope) { return owner == null ? value : scope.whole(owner); }
}
`;
