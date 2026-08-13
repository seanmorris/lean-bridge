const indexStates = new WeakMap();

const UINT32_MAX = 0xffff_ffff;
const supportedDimensions = new Set([2, 4, 8]);

/**
 * Reports performance bridge failures with stable machine-readable codes and structured diagnostic context.
 */
export class PerformanceBridgeError extends Error
{
	/**
   * Initializes the error used to report performance bridge failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param operation - Public bridge operation name included in the structured diagnostic.
   * @param message - Human-readable explanation of the failure.
   */
	constructor(code, operation, message)
	{
		super(message);
		this.name = "PerformanceBridgeError";
		this.code = code;
		this.operation = operation;
	}
}

const fail = (code, operation, message) => {
	throw new PerformanceBridgeError(code, operation, message);
};

const assertDimensions = (dimensions, operation) => {
	if(!supportedDimensions.has(dimensions))
	{
		fail(
			"unsupported-dimension",
			operation,
			`${operation} supports 2, 4, or 8 dimensions`,
		);
	}
	return dimensions;
};

const normalizeCoordinates = (value, dimensions, operation) => {
	if(!Array.isArray(value) && !(value instanceof Int32Array))
	{
		fail("dimension-mismatch", operation, `${operation} requires coordinates`);
	}
	if(value.length !== dimensions)
	{
		fail(
			"dimension-mismatch",
			operation,
			`${operation} requires ${dimensions} coordinates`,
		);
	}
	const result = new Int32Array(dimensions);
	for(let index = 0; index < dimensions; index += 1)
	{
		const coordinate = value[index];
		if(!Number.isInteger(coordinate) || coordinate < -32768 || coordinate > 32767)
		{
			fail(
				"invalid-coordinate",
				operation,
				`${operation} coordinates must be integers from -32768 through 32767`,
			);
		}
		result[index] = coordinate;
	}
	return result;
};

const normalizePoint = (value, dimensions, operation) => {
	if(!value || typeof value !== "object")
	{
		fail("invalid-point", operation, `${operation} requires point objects`);
	}
	if(!Number.isInteger(value.id) || value.id < 0 || value.id > UINT32_MAX)
	{
		fail("invalid-point-id", operation, `${operation} point IDs must be uint32 values`);
	}
	return Object.freeze({
		id: value.id >>> 0
		, coordinates: normalizeCoordinates(value.coordinates, dimensions, operation)
	});
};

const compareCoordinates = (left, right) => {
	for(let index = 0; index < left.length; index += 1)
	{
		if(left[index] < right[index]) return -1;
		if(left[index] > right[index]) return 1;
	}
	return 0;
};

const normalizePoints = (values, dimensions, operation, { sorted = false } = {}) => {
	if(!Array.isArray(values))
	{
		fail("invalid-points", operation, `${operation} requires an array of points`);
	}
	const points = values.map(value => normalizePoint(value, dimensions, operation));
	const ids = new Set();
	for(let index = 0; index < points.length; index += 1)
	{
		const point = points[index];
		if(ids.has(point.id))
		{
			fail("duplicate-point-id", operation, `${operation} point IDs must be unique`);
		}
		ids.add(point.id);
		if(sorted && index > 0)
		{
			const previous = points[index - 1];
			const coordinateOrder = compareCoordinates(previous.coordinates, point.coordinates);
			if(coordinateOrder > 0 || (coordinateOrder === 0 && previous.id > point.id))
			{
				fail(
					"unsorted-points",
					operation,
					`${operation} points must use coordinates-then-ID order`,
				);
			}
		}
	}
	return points;
};

const inferDimensions = (points, query, operation) => {
	const dimensions = query?.length ?? points[0]?.coordinates?.length;
	return assertDimensions(dimensions, operation);
};

const allocate = (module, byteLength) => {
	const pointer = module._malloc(Math.max(byteLength, 4));
	if(!pointer) throw new Error(`could not allocate ${byteLength} Wasm bytes`);
	return pointer;
};

const withAllocations = (module, sizes, operation) => {
	const pointers = [];
	try
	{
		for(const size of sizes) pointers.push(allocate(module, size));
		return operation(pointers);
	} finally
	{
		for(const pointer of pointers.reverse()) module._free(pointer);
	}
};

const writeCoordinates = (module, pointer, coordinates) => {
	module.HEAP32.set(coordinates, pointer >>> 2);
};

const writePoints = (module, idsPointer, coordinatesPointer, points, dimensions) => {
	const ids = new Uint32Array(points.length);
	const coordinates = new Int32Array(points.length * dimensions);
	for(let index = 0; index < points.length; index += 1)
	{
		ids[index] = points[index].id;
		coordinates.set(points[index].coordinates, index * dimensions);
	}
	module.HEAPU32.set(ids, idsPointer >>> 2);
	module.HEAP32.set(coordinates, coordinatesPointer >>> 2);
};

const combineUint64 = (low, high) =>
	BigInt(low >>> 0) | (BigInt(high >>> 0) << 32n);

const assertRange = (minimum, maximum, dimensions, operation) => {
	const normalizedMinimum = normalizeCoordinates(minimum, dimensions, operation);
	const normalizedMaximum = normalizeCoordinates(maximum, dimensions, operation);
	for(let index = 0; index < dimensions; index += 1)
	{
		if(normalizedMinimum[index] > normalizedMaximum[index])
		{
			fail("invalid-range", operation, `${operation} minimum exceeds maximum`);
		}
	}
	return [normalizedMinimum, normalizedMaximum];
};

const requireIndex = (value, runtime, operation) => {
	const resource = indexStates.get(value);
	if(!resource)
	{
		fail("invalid-resource", operation, `${operation} requires a SpatialIndex`);
	}
	if(resource.runtime !== runtime)
	{
		fail(
			"cross-runtime-resource",
			operation,
			`${operation} requires an index from the same runtime`,
		);
	}
	if(resource.disposed)
	{
		fail("disposed-resource", operation, `${operation} cannot use a disposed index`);
	}
	return resource;
};

const projectLowerBound = runtime => (values, queryValue) => {
	const operation = "lowerBound";
	const dimensions = inferDimensions(values, queryValue, operation);
	const points = normalizePoints(values, dimensions, operation, { sorted: true });
	const query = normalizeCoordinates(queryValue, dimensions, operation);
	return withAllocations(
		runtime.module,
		[points.length * 4, points.length * dimensions * 4, dimensions * 4],
		([idsPointer, coordinatesPointer, queryPointer]) => {
      writePoints(runtime.module, idsPointer, coordinatesPointer, points, dimensions);
      writeCoordinates(runtime.module, queryPointer, query);
      const result = runtime.module._bridge_perf_lower_bound(
        idsPointer,
        coordinatesPointer,
        points.length,
        dimensions,
        queryPointer,
      ) >>> 0;
      if(result === UINT32_MAX)
{
        fail("runtime-call-failed", operation, `${operation} failed in the shared runtime`);
}
      return result;
		},
	);
};

const projectSpatialIndex = runtime => {
	const module = runtime.module;

	/**
   * Exposes spatial-index operations through copied value frames in the performance reference runtime.
   */
	return class SpatialIndex {
		/**
     * Initializes a spatial index after validating dimensions and copying every input point.
     *
     * @param dimensionsValue - Positive spatial dimensionality enforced for every indexed point and query.
     * @param pointValues - Initial coordinate vectors copied into the spatial index.
     */
		constructor(dimensionsValue, pointValues) {
			const operation = "SpatialIndex";
			const dimensions = assertDimensions(dimensionsValue, operation);
			const points = normalizePoints(pointValues, dimensions, operation);
			const token = withAllocations(
				module,
				[points.length * 4, points.length * dimensions * 4],
				([idsPointer, coordinatesPointer]) => {
          writePoints(module, idsPointer, coordinatesPointer, points, dimensions);
          return module._bridge_perf_index_build(
            idsPointer,
            coordinatesPointer,
            points.length,
            dimensions,
          ) >>> 0;
				},
			);
			if(token === 0)
			{
				fail("index-build-failed", operation, `${operation} rejected the point set`);
			}
			const resource = {
				runtime
				, token
				, dimensions
				, disposed: false
				, finalizerToken: {}
			};
			indexStates.set(this, resource);
			runtime.finalizer?.register(this, token, resource.finalizerToken);
		}

		/**
     * Returns disposed derived from current spatial index state without exposing mutable internals.
     */
		get disposed() {
			const resource = indexStates.get(this);
			return !resource || resource.disposed;
		}

		/**
     * Returns the number of currently live entries without exposing their internal representation.
     */
		get size() {
			const operation = "SpatialIndex.size";
			const resource = requireIndex(this, runtime, operation);
			const result = module._bridge_perf_index_size(resource.token) >>> 0;
			if(result === UINT32_MAX)
			{
				fail("runtime-call-failed", operation, `${operation} failed in the shared runtime`);
			}
			return result;
		}

		/**
     * Returns the closest indexed point using deterministic distance and tie-breaking rules.
     *
     * @param queryValue - Coordinate vector used to find the nearest indexed point.
     */
		nearest(queryValue) {
			const operation = "SpatialIndex.nearest";
			const resource = requireIndex(this, runtime, operation);
			const query = normalizeCoordinates(queryValue, resource.dimensions, operation);
			return withAllocations(
				module,
				[resource.dimensions * 4, 4, resource.dimensions * 4, 4, 4],
				([queryPointer, idPointer, coordinatesPointer, lowPointer, highPointer]) => {
          writeCoordinates(module, queryPointer, query);
          const status = module._bridge_perf_index_nearest(
            resource.token,
            queryPointer,
            resource.dimensions,
            idPointer,
            coordinatesPointer,
            resource.dimensions,
            lowPointer,
            highPointer,
          ) >>> 0;
          if(status !== 0)
{
            fail(
              status === 4 ? "empty-index" : "runtime-call-failed",
              operation,
              `${operation} failed with status ${status}`,
            );
}
          const offset = coordinatesPointer >>> 2;
          const coordinates = new Int32Array(
            module.HEAP32.slice(offset, offset + resource.dimensions),
          );
          return Object.freeze({
            pointId: module.HEAPU32[idPointer >>> 2] >>> 0
            , coordinates
            , squaredDistance: combineUint64(
              module.HEAPU32[lowPointer >>> 2],
              module.HEAPU32[highPointer >>> 2],
            )
          });
				},
			);
		}

		/**
     * Returns copied points inside the requested bounds in deterministic order.
     *
     * @param minimumValue - Inclusive lower coordinate bound for the spatial range query.
     * @param maximumValue - Inclusive upper coordinate bound for the spatial range query.
     */
		range(minimumValue, maximumValue) {
			const operation = "SpatialIndex.range";
			const resource = requireIndex(this, runtime, operation);
			const [minimum, maximum] = assertRange(
				minimumValue,
				maximumValue,
				resource.dimensions,
				operation,
			);
			const capacity = this.size;
			return withAllocations(
				module,
				[resource.dimensions * 4, resource.dimensions * 4, capacity * 4],
				([minimumPointer, maximumPointer, idsPointer]) => {
          writeCoordinates(module, minimumPointer, minimum);
          writeCoordinates(module, maximumPointer, maximum);
          const length = module._bridge_perf_index_range(
            resource.token,
            minimumPointer,
            maximumPointer,
            resource.dimensions,
            idsPointer,
            capacity,
          ) >>> 0;
          if(length === UINT32_MAX)
{
            fail("runtime-call-failed", operation, `${operation} failed in the shared runtime`);
}
          const offset = idsPointer >>> 2;
          return new Uint32Array(module.HEAPU32.slice(offset, offset + length));
				},
			);
		}

		/**
     * Adds a copied point after validating its dimensions and numeric coordinates.
     *
     * @param pointValue - Coordinate vector copied into the spatial index.
     */
		insert(pointValue) {
			const operation = "SpatialIndex.insert";
			const resource = requireIndex(this, runtime, operation);
			const point = normalizePoint(pointValue, resource.dimensions, operation);
			return withAllocations(module, [resource.dimensions * 4], ([coordinatesPointer]) => {
        writeCoordinates(module, coordinatesPointer, point.coordinates);
        const size = module._bridge_perf_index_insert(
          resource.token,
          point.id,
          coordinatesPointer,
          resource.dimensions,
        ) >>> 0;
        if(size === UINT32_MAX)
{
          fail("duplicate-point-id", operation, `${operation} rejected the point`);
}
        return size;
			});
		}

		/**
     * Releases the native resource exactly once and makes subsequent operations fail closed.
     */
		dispose() {
			const resource = indexStates.get(this);
			if(!resource || resource.disposed) return false;
			const remaining = module._bridge_perf_index_release(resource.token) >>> 0;
			if(remaining === UINT32_MAX)
			{
				fail("stale-resource", "SpatialIndex.dispose", "the runtime rejected the index");
			}
			resource.disposed = true;
			runtime.finalizer?.unregister(resource.finalizerToken);
			return true;
		}
	};
};

const projectRangeChecksum = runtime => (index, minimumValue, maximumValue) => {
	const operation = "rangeChecksum";
	const resource = requireIndex(index, runtime, operation);
	const [minimum, maximum] = assertRange(
		minimumValue,
		maximumValue,
		resource.dimensions,
		operation,
	);
	const capacity = index.size;
	return withAllocations(
		runtime.module,
		[resource.dimensions * 4, resource.dimensions * 4, capacity * 4, 4, 4],
		([minimumPointer, maximumPointer, idsPointer, lowPointer, highPointer]) => {
      writeCoordinates(runtime.module, minimumPointer, minimum);
      writeCoordinates(runtime.module, maximumPointer, maximum);
      const length = runtime.module._bridge_perf_consumer_range_checksum(
        resource.token,
        minimumPointer,
        maximumPointer,
        resource.dimensions,
        idsPointer,
        capacity,
        lowPointer,
        highPointer,
      ) >>> 0;
      if(length === UINT32_MAX)
{
        fail("runtime-call-failed", operation, `${operation} failed in the shared runtime`);
}
      const offset = idsPointer >>> 2;
      return Object.freeze({
        pointIds: new Uint32Array(runtime.module.HEAPU32.slice(offset, offset + length))
        , checksum: combineUint64(
          runtime.module.HEAPU32[lowPointer >>> 2],
          runtime.module.HEAPU32[highPointer >>> 2],
        )
      });
		},
	);
};

const adapters = Object.freeze({
	"point-lower-bound": projectLowerBound
	, "spatial-index": projectSpatialIndex
	, "range-checksum": projectRangeChecksum
});

const aliasesFor = id => {
	const withoutVersion = id.slice(0, id.lastIndexOf("@"));
	return [id, withoutVersion, withoutVersion.split("/").at(-1)];
};

const projectComponent = (runtime, descriptor) => {
	const api = Object.create(null);
	for(const binding of descriptor.bindings)
	{
		if(binding.name.startsWith("_") || !adapters[binding.adapter])
		{
			throw new Error(`invalid public binding ${binding.name} in ${descriptor.id}`);
		}
		Object.defineProperty(api, binding.name, {
			enumerable: true
			, value: adapters[binding.adapter](runtime)
		});
	}
	return Object.freeze(api);
};

/**
 * Builds the performance fixture loader, preserving descriptor aliases, dependency order, one-time registration, and resource finalization.
 *
 * @param module - Initialized runtime module that supplies private native exports.
 * @param descriptors - Reviewed library descriptors used to resolve dependency order and construct the projected loader.
 * @param options - Prelinked descriptor identities that should skip dynamic side-module loading.
 */
export const createPerformanceLibraryLoader = (module, descriptors, options = {}) => {
	const byId = new Map(descriptors.map(descriptor => [descriptor.id, descriptor]));
	const aliases = new Map();
	for(const descriptor of descriptors)
	{
		for(const alias of aliasesFor(descriptor.id)) aliases.set(alias, descriptor);
	}
	const runtime = {
		module
		, finalizer: typeof FinalizationRegistry === "function"
			? new FinalizationRegistry(token => {
				if((module._bridge_perf_runtime_state() >>> 0) === 1)
				{
					module._bridge_perf_index_release(token);
				}
			})
			: undefined
	};
	const loaded = new Map();
	const pending = new Map();
	const prelinked = new Set(options.prelinked ?? []);

	const load = async requested => {
		const descriptor = typeof requested === "string" ? aliases.get(requested) : requested;
		if(!descriptor || !byId.has(descriptor.id))
		{
			throw new Error(`unknown performance library ${String(requested)}`);
		}
		if(loaded.has(descriptor.id)) return loaded.get(descriptor.id);
		if(pending.has(descriptor.id)) return pending.get(descriptor.id);
		const operation = (async () => {
      for(const dependency of descriptor.dependencies) await load(dependency);
      if(!prelinked.has(descriptor.id))
{
        await module.loadDynamicLibrary(descriptor.artifact, {
          global: true
          , loadAsync: true
          , nodelete: true
        });
}
      if(descriptor.runtimeRoot && !(module._bridge_perf_runtime_init() >>> 0))
{
        throw new Error("the shared Lean runtime failed to initialize");
}
      const api = projectComponent(runtime, descriptor);
      loaded.set(descriptor.id, api);
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
		, loaded
		, diagnostics: () => Object.freeze({
			runtimeState: module._bridge_perf_runtime_state() >>> 0
			, runtimeInitializations: module._bridge_perf_runtime_init_runs() >>> 0
			, libraryInitializations: module._bridge_perf_library_init_runs() >>> 0
			, liveResources: module._bridge_perf_live_handles() >>> 0
			, rejectedHandles: module._bridge_perf_rejected_handles() >>> 0
		})
		, shutdown: () => Boolean(module._bridge_perf_runtime_shutdown() >>> 0)
	});
};
