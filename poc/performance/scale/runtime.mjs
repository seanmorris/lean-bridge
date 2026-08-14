/**
 * Provides the performance scale runtime proof-of-concept module.
 *
 * @file
 */

const UINT32_MAX = 0xffff_ffff;

const nanoseconds = milliseconds => Math.round(milliseconds * 1_000_000);

const timed = async operation => {
	const started = performance.now();
	const value = await operation();
	return { value, durationNs: nanoseconds(performance.now() - started) };
};

const timedSync = operation => {
	const started = performance.now();
	const value = operation();
	return { value, durationNs: nanoseconds(performance.now() - started) };
};

const aliasesFor = id => {
	const withoutVersion = id.slice(0, id.lastIndexOf("@"));
	return [id, withoutVersion, withoutVersion.split("/").at(-1)];
};

const assertUint32 = (value, operation) => {
	if(!Number.isInteger(value) || value < 0 || value > UINT32_MAX)
	{
		throw new TypeError(`${operation} requires a uint32 value`);
	}
	return value >>> 0;
};

const projectComponent = (runtime, descriptor) => Object.freeze({
	ping:
		/**
     * Invokes the scale fixture operation and rejects its reserved failure sentinel.
     *
     * @param value - Unsigned 32-bit payload passed through the scale fixture's native ping operation.
     */
		function(value) {
			const input = assertUint32(value, `${descriptor.name}.ping`);
			const result = runtime.module._bridge_scale_call(descriptor.ordinal, input) >>> 0;
			if(result === UINT32_MAX)
			{
				throw new Error(`${descriptor.name}.ping failed in the Lean runtime`);
			}
			return result;
		}
});

/**
 * Resolves scale graph while rejecting missing, ambiguous, or incompatible inputs for the performance reference runtime.
 *
 * @param descriptors - Reviewed library descriptors used to resolve dependency order and construct the projected loader.
 * @param requested - Requested library roots or workload identity resolved against the available catalog.
 */
export const resolveScaleGraph = (descriptors, requested) => {
	const byId = new Map(descriptors.map(descriptor => [descriptor.id, descriptor]));
	const aliases = new Map();
	for(const descriptor of descriptors)
	{
		for(const alias of aliasesFor(descriptor.id)) aliases.set(alias, descriptor);
	}
	const root = typeof requested === "string" ? aliases.get(requested) : requested;
	if(!root || !byId.has(root.id)) throw new Error(`unknown scaling library ${String(requested)}`);
	const ordered = [];
	const visited = new Set();
	const visit = descriptor => {
		if(visited.has(descriptor.id)) return;
		for(const dependencyId of descriptor.dependencies)
		{
			const dependency = byId.get(dependencyId);
			if(!dependency) throw new Error(`${descriptor.id} has unknown dependency ${dependencyId}`);
			visit(dependency);
		}
		visited.add(descriptor.id);
		ordered.push(descriptor);
	};
	visit(root);
	return Object.freeze(ordered);
};

/**
 * Builds an instrumented scaling loader that resolves dependencies, deduplicates loads, and records registration and load events.
 *
 * @param module - Initialized runtime module that supplies private native exports.
 * @param descriptors - Reviewed library descriptors used to resolve dependency order and construct the projected loader.
 * @param options - Prelinked descriptor identities that should skip dynamic side-module loading.
 */
export const createScaleLibraryLoader = (module, descriptors, options = {}) => {
	const byId = new Map(descriptors.map(descriptor => [descriptor.id, descriptor]));
	const aliases = new Map();
	for(const descriptor of descriptors)
	{
		for(const alias of aliasesFor(descriptor.id)) aliases.set(alias, descriptor);
	}
	const prelinked = new Set(options.prelinked ?? []);
	const loaded = new Map();
	const pending = new Map();
	const events = [];
	const runtime = { module };

	const load = async requested => {
		const descriptor = typeof requested === "string" ? aliases.get(requested) : requested;
		if(!descriptor || !byId.has(descriptor.id))
		{
			throw new Error(`unknown scaling library ${String(requested)}`);
		}
		if(loaded.has(descriptor.id)) return loaded.get(descriptor.id);
		if(pending.has(descriptor.id)) return pending.get(descriptor.id);
		const operation = (async () => {
      for(const dependencyId of descriptor.dependencies) await load(dependencyId);
      const registrationBefore = module._bridge_scale_registration_runs() >>> 0;
      const memoryBefore = module.HEAPU32.buffer.byteLength;
      let dynamicLoadAndRegistrationNs = null;
      if(!prelinked.has(descriptor.id))
{
        const dynamicLoad = await timed(() => module.loadDynamicLibrary(descriptor.artifact, {
          global: true
          , loadAsync: true
          , nodelete: true
        }));
        dynamicLoadAndRegistrationNs = dynamicLoad.durationNs;
}
      const registrationAfter = module._bridge_scale_registration_runs() >>> 0;
      const runtimeInitialization = timedSync(() => module._bridge_scale_runtime_init() >>> 0);
      if(!runtimeInitialization.value) throw new Error("the shared Lean runtime failed to initialize");
      const libraryInitialization = timedSync(
        () => module._bridge_scale_component_init(descriptor.ordinal) >>> 0,
      );
      if(!libraryInitialization.value)
{
        throw new Error(`${descriptor.name} failed to initialize in the shared Lean runtime`);
}
      const api = projectComponent(runtime, descriptor);
      loaded.set(descriptor.id, api);
      events.push(Object.freeze({
        id: descriptor.id
        , ordinal: descriptor.ordinal
        , prelinked: prelinked.has(descriptor.id)
        , dynamicLoadAndRegistrationNs
        , registrationDelta: registrationAfter - registrationBefore
        , runtimeInitializationNs: runtimeInitialization.durationNs
        , libraryInitializationNs: libraryInitialization.durationNs
        , wasmMemoryBeforeBytes: memoryBefore
        , wasmMemoryAfterBytes: module.HEAPU32.buffer.byteLength
      }));
      return api;
		})();
		pending.set(descriptor.id, operation);
		try
		{
			return await operation;
		} finally
		{
			pending.delete(descriptor.id);
		}
	};

	return Object.freeze({
		load
		, resolve: requested => resolveScaleGraph(descriptors, requested)
		, measurements: () => Object.freeze([...events])
		, diagnostics: () => Object.freeze({
			runtimeState: module._bridge_scale_runtime_state() >>> 0
			, runtimeInitializations: module._bridge_scale_runtime_init_runs() >>> 0
			, registrations: module._bridge_scale_registration_runs() >>> 0
			, libraryInitializations: module._bridge_scale_library_init_runs() >>> 0
			, rejectedCalls: module._bridge_scale_rejected_calls() >>> 0
			, loadedLibraries: loaded.size
		})
		, shutdown: () => Boolean(module._bridge_scale_runtime_shutdown() >>> 0)
	});
};
