/**
 * Independent typed downcalls for testing converters before package bindings.
 *
 * @file
 */

/**
 * Exercise the actual C ABI, including copied results and shared owner leases.
 * Host upcalls and authenticated loading have their own integration stages.
 *
 * @param model - Generated JVM declarations, layouts and converters.
 */
export const ownedJvmConversionCalls = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const all = [
		...model.functions.map(fn => ({ ...fn, method: fn.publicName }))
		, ...model.c.retains.map(fn => ({ ...fn, method: `retain${nodes.get(fn.id).index}`, handle: true }))
		, ...model.c.copies.map(fn => ({ ...fn, method: `copy${nodes.get(fn.id).index}` }))
		, ...model.c.callbacks.map(fn => ({ ...fn, method: `invoke${nodes.get(fn.id).index}`, handle: true }))
	];
	const supported = fn => !fn.parameters.some((_, index) => model.c.hostArgument(fn, index));
	const methods = all.filter(supported).map(fn => {
		const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		const signature = parameters.map((node, i) => `${fn.handle && i === 0 ? "_OwnedRuntime.Handle" : node.publicType} arg${i}`).join(", ");
		const write = (node, i, scope) => fn.handle && i === 0
			? `MemorySegment.ofAddress(${scope}.root(arg0))` : `_OwnedConvert.write(${node.index}, arg${i}, ${scope})`;
		const layouts = ["ADDRESS", ...parameters.map(node => node.leaf ? node.valueLayout ?? `_OwnedLayouts.${node.layoutName}` : "ADDRESS"), "ADDRESS", "ADDRESS"];
		const arguments_ = ["MemorySegment.ofAddress(state.require())"
			, ...parameters.map((node, i) =>
				fn.handle && i === 0 || node.aggregate ? `input${i}` : `input${i}.get(${node.valueLayout}, 0)`)
			, "output", "owner.output()"];
		return `    static ${result.publicType} ${fn.method}(${signature}) {
        var state = runtime.current();
        try (var check = new _OwnedConvert.Scope(state, true, null, null)) {
${parameters.map((node, i) => `            ${write(node, i, "check")};`).join("\n")}
        }
        try (var inputs = new _OwnedConvert.Scope(state, false, null, null);
             var owner = new _OwnedRuntime.Result(state);
             var outputs = new _OwnedConvert.Scope(state, false, OwnedConversionProbe::factory, owner::adopt)) {
${parameters.map((node, i) => `            var input${i} = ${write(node, i, "inputs")};`).join("\n")}
            var output = outputs.allocate(${result.size}, ${result.alignment});
            var call = Linker.nativeLinker().downcallHandle(symbols.find("${fn.cName}").orElseThrow(),
                FunctionDescriptor.of(JAVA_INT, ${layouts.join(", ")}));
            _OwnedRuntime.check((int)call.invokeWithArguments(${arguments_.join(", ")}));
            var result = (${result.publicType})_OwnedConvert.read(${result.index}, output, outputs);
            _OwnedConvert.checkpoint(); outputs.complete(); owner.complete();
            return result;
        } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }`;
	});
	const factory = model.types.filter(node => node.identity).map(node => {
		const callback = model.callbacks.find(fn => fn.id === node.id);
		const invoke = callback ? supported(callback)
			? `, (${callback.invokeParameters.map((_, i) => `arg${i}`).join(", ")}) -> invoke${node.index}(handle${callback.invokeParameters.map((_, i) => `, arg${i}`).join("")})`
			: `, (${callback.invokeParameters.map((_, i) => `arg${i}`).join(", ")}) -> { throw new UnsupportedOperationException("Host upcalls are outside this converter probe"); }` : "";
		return `            case ${node.index} -> new ${node.publicType}(handle, OwnedConversionProbe::retain${node.index}${invoke});`;
	});
	return { methods: methods.join("\n")
		, factory: `    private static Object factory(int id, _OwnedRuntime.Handle handle) {
        return switch (id) {
${factory.join("\n")}
            default -> throw new IllegalArgumentException("Unknown identity type");
        };
	    }` };
};

/**
 * Bind the independent Java fixture to compiler-derived nominal signatures.
 *
 * @param model - Generated JVM conversion catalog.
 * @param template - Common lifetime, malformed-input and fault-injection probe.
 * @param exercise - Scalar or resource-composition expectations.
 */
export const ownedJvmConversionProbeSource = (model, template, exercise) => {
	const calls = ownedJvmConversionCalls(model);
	return template.replace("/* METHODS */", calls.methods).replace("/* FACTORY */", calls.factory)
		.replace("/* EXERCISE */", exercise).replace("/* TYPE IDS */", model.types.map(node =>
			`        types.put(${JSON.stringify(node.name ?? node.id)}, ${node.index});`).join("\n"));
};
