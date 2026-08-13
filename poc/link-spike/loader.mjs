import { PendingOperationRegistry } from "../../src/runtime/pending-operations.mjs";
import { CallbackRegistry } from "../../src/runtime/callbacks.mjs";
import { WeakValueMap } from "../../src/runtime/weak-value-map.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";

const identity = descriptor => `${descriptor.id}#${descriptor.buildHash}`;

const frameErrorCodes = Object.freeze([
	"ok"
	, "abi-version-mismatch"
	, "frame-size-mismatch"
	, "runtime-not-ready"
	, "invalid-bool"
	, "copy-limit-exceeded"
	, "pointer-out-of-range"
	, "output-capacity-exceeded"
	, "internal-frame-error"
]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const runtimeContexts = new WeakMap();
const wrapperStates = new WeakMap();
const nativeClosureStates = new WeakMap();
let nextRuntimeIdentity = 1;

/**
 * Reports Lean bridge failures with stable machine-readable codes and structured diagnostic context.
 */
export class LeanBridgeError extends Error
{
	/**
   * Initializes the error used to report Lean bridge failures, preserving its code, message, and diagnostic context.
   *
   * @param message - Human-readable explanation of the failure.
   * @param root0 - Named initialization options and dependency overrides for the new instance.
   * @param root0.code - Stable machine-readable code that identifies the failure category.
   * @param root0.library - Validated library descriptor whose native symbols and projected bindings initialize this context.
   * @param root0.operation - Projected operation name attached to the structured bridge error.
   * @param root0.details - Structured diagnostic fields associated with the failure.
   */
	constructor(message, { code, library, operation, details = {} })
	{
		super(message);
		this.name = "LeanBridgeError";
		this.code = code;
		this.library = library;
		this.operation = operation;
		this.details = Object.freeze({ ...details });
	}
}

const bytesFrom = value =>
	value instanceof Uint8Array
		? value
		: new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

const readArtifact = async url => {
	if(url.protocol === "file:")
	{
		const nodeFileSystem = `node:${"fs/promises"}`;
		const { readFile } = await import(nodeFileSystem);
		return bytesFrom(await readFile(url));
	}
	const response = await fetch(url);
	if(!response.ok)
	{
		throw new Error(`failed to read ${url}: HTTP ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
};

const sha256 = async bytes => {
	const result = await globalThis.crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(result)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
};

const verifyIntegrity = async (descriptor, read) => {
	if(!descriptor.integrity) return;
	const actual = await sha256(await read(descriptor.sideModule));
	if(actual !== descriptor.integrity)
	{
		throw new Error(
			`library artifact integrity mismatch for ${descriptor.id}: expected ${descriptor.integrity}, received ${actual}; restore the locked artifact or review and relock the package`,
		);
	}
};

const resolvePrivateFunction = (module, descriptor, symbol) => {
	const implementation = module[symbol];
	if(typeof implementation !== "function")
	{
		throw new Error(`missing private ABI symbol ${symbol} for ${descriptor.id}`);
	}
	return implementation;
};

const assertPublicName = name => {
	if(name.startsWith("_"))
	{
		throw new Error(`public binding names cannot start with _: ${name}`);
	}
};

const bridgeError = (descriptor, binding, code, message, details) =>
	new LeanBridgeError(message, {
		code
		, library: descriptor.id
		, operation: binding.name
		, details
	});

const classIdentity = (descriptor, typeId) => `${identity(descriptor)}:${typeId}`;
const closureIdentity = (typeId, token) => `${typeId}:${token}`;

const decodeHandleToken = token => ({
	side: token >>> 31
	, kind: (token >>> 24) & 0x7f
	, generation: (token >>> 12) & 0x0fff
	, slot: token & 0x0fff
});

const encodeHostToken = (slot, generation, kind) =>
	(
		0x8000_0000
    | ((kind & 0x7f) << 24)
    | ((generation & 0x0fff) << 12)
    | (slot + 1)
	) >>> 0;

/**
 * Coordinates loaded libraries, callback boundaries, host values, resources, and native closures for one Lean runtime.
 */
class RuntimeRegistry
{
	/**
   * Initializes runtime-wide library, resource, callback, and closure registries.
   *
   * @param module - Initialized runtime module that supplies private native exports.
   * @param options - Capacity limits, lifecycle observers, and weak-reference or finalizer factories for the runtime registries.
   */
	constructor(module, options)
	{
		this.module = module;
		this.runtimeId = nextRuntimeIdentity;
		nextRuntimeIdentity += 1;
		this.epoch = 1;
		this.state = "open";
		this.initializations = new Map();
		this.entries = new Map();
		this.closureEntries = new Map();
		this.classes = new Map();
		this.hostSlots = [];
		this.hostObjectTokens = new WeakMap();
		this.pendingOperations = new PendingOperationRegistry({
			capacity: options.pendingOperationCapacity ?? 1024
			, onTransition: options.onPendingTransition
		});
		this.callbacks = new CallbackRegistry({
			capacity: options.callbackCapacity ?? 1024
			, handleKind: options.callbackHandleKind ?? 0x7f
			, onFrame: options.onCallbackFrame
		});
		this.callbackBoundaries = [];
		this.nextCallbackBoundaryId = 1;
		Object.defineProperty(this.module, "__leanBridgePendingResolveU32", {
			configurable: true
			, enumerable: false
			, value: (token, value) => this.pendingOperations.resolve(token, value)
		});
		for(const [name, convert] of [
			["__leanBridgePendingResolveIteratorU32", value => value >>> 0]
			, ["__leanBridgePendingResolveIteratorI32", value => value | 0]
			, ["__leanBridgePendingResolveIteratorF64", value => Number(value)]
		]) {
			Object.defineProperty(this.module, name, {
				configurable: true
				, enumerable: false
				, value: (token, state, value) =>
					this.pendingOperations.resolve(
						token,
						Object.freeze({ state: state >>> 0, value: convert(value) }),
					)
			});
		}
		Object.defineProperty(this.module, "__leanBridgeInvokeCallbackU32", {
			configurable: true
			, enumerable: false
			, value: (token, value) => {
				try
				{
					const result = this.callbacks.invokeRetained(token >>> 0, [value >>> 0]);
					if(
						result
            && typeof result.then === "function"
					) {
						throw new TypeError("a synchronous callback returned a Promise");
					}
					if(!Number.isInteger(result) || result < 0 || result > 0xffff_ffff)
					{
						throw new TypeError("callback result must be an unsigned 32-bit integer");
					}
					return result >>> 0;
				} catch(error)
				{
					this.recordCallbackBoundaryError(error);
					return 0;
				}
			}
		});
		Object.defineProperty(this.module, "__leanBridgeCallbackFailed", {
			configurable: true
			, enumerable: false
			, value: () => (this.callbackBoundaries.at(-1)?.error ? 1 : 0)
		});
		this.pendingFinalizations = [];
		this.pendingClosureFinalizations = [];
		this.createWeakReference
      = options.createWeakReference ?? (target => new WeakRef(target));
		this.counters = {
			wrappersCreated: 0
			, canonicalHits: 0
			, borrows: 0
			, activeBorrows: 0
			, leasesAcquired: 0
			, leasesReleased: 0
			, finalized: 0
			, rejected: 0
			, hostValuesCreated: 0
			, hostCanonicalHits: 0
			, hostBorrows: 0
			, hostActiveBorrows: 0
			, hostLeasesAcquired: 0
			, hostLeasesReleased: 0
			, hostRejected: 0
			, closuresCreated: 0
			, closureCanonicalHits: 0
			, closureCalls: 0
			, closureLeasesAcquired: 0
			, closureLeasesReleased: 0
			, closuresFinalized: 0
		};
		const createFinalizationRegistry = options.createFinalizationRegistry ?? (callback => typeof FinalizationRegistry === "function" ? new FinalizationRegistry(callback) : undefined);
		const createClosureFinalizationRegistry = options.createClosureFinalizationRegistry ?? (callback => typeof FinalizationRegistry === "function" ? new FinalizationRegistry(callback) : undefined);
		const createClosureCacheFinalizationRegistry = options.createClosureCacheFinalizationRegistry ?? (callback => typeof FinalizationRegistry === "function" ? new FinalizationRegistry(callback) : undefined);
		this.finalizer = createFinalizationRegistry(holding => {
      this.pendingFinalizations.push(holding);
		});
		this.closureCache = new WeakValueMap({
			createWeakReference: this.createWeakReference
			, createFinalizationRegistry: createClosureCacheFinalizationRegistry
		});
		this.closureFinalizer = createClosureFinalizationRegistry(holding => {
      this.pendingClosureFinalizations.push(holding);
		});
	}

	/**
   * Raises or records a structured failure with stable code and diagnostic details.
   *
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	reject(descriptor, binding, code, message, details = {})
	{
		this.counters.rejected += 1;
		throw bridgeError(descriptor, binding, code, message, {
			runtimeId: this.runtimeId
			, epoch: this.epoch,
			...details
		});
	}

	/**
   * Verifies that a library binding is initialized and not poisoned before native dispatch.
   *
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   */
	beforeCall(descriptor, binding)
	{
		this.drainFinalizers();
		this.drainClosureFinalizers();
		if(this.state !== "open")
		{
			this.reject(
				descriptor,
				binding,
				this.state === "poisoned" ? "runtime-poisoned" : "runtime-shut-down",
				this.state === "poisoned"
					? `the Lean runtime for ${descriptor.id} rejected work after an unexpected failure`
					: `the Lean runtime for ${descriptor.id} has been shut down`,
			);
		}
		this.callbacks.beforeNativeCall();
	}

	/**
   * Initializes one library binding exactly once and records any terminal initialization failure.
   *
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param legacySymbol - Optional legacy initialization symbol used only when the descriptor declares compatibility.
   */
	initialize(descriptor, binding, legacySymbol = null)
	{
		const plan = binding.initialization;
		if(plan)
		{
			const bindingIrSha256
        = descriptor.bindingIrSha256
        ?? (descriptor.bindingIr ? hashBindingIr(descriptor.bindingIr) : null);
			if(
				plan.kind !== "initialization-v1"
        || plan.abiVersion !== 1
        || plan.bindingIrSha256 !== bindingIrSha256
        || plan.trigger !== "first-call"
        || plan.scope !== "component-runtime"
        || plan.success !== "nonzero"
        || plan.failure !== "terminal"
        || plan.retry !== "never"
        || (plan.symbol !== null
          && (typeof plan.symbol !== "string" || plan.symbol.length === 0))
        || plan.required !== (typeof plan.symbol === "string")
			) {
				this.reject(
					descriptor,
					binding,
					"unsupported-initialization-plan",
					`${binding.name} has an initialization plan the runtime cannot preserve`,
				);
			}
		}
		const symbol = plan?.symbol ?? legacySymbol;
		if(!symbol) return;
		const key = `${descriptor.buildHash ?? descriptor.id}:${symbol}`;
		const state = this.initializations.get(key);
		if(state === "ready") return;
		if(state === "failed")
		{
			this.reject(
				descriptor,
				binding,
				"runtime-not-ready",
				`initialization already failed for ${descriptor.id}`,
				{ retry: "never" },
			);
		}
		if(state === "initializing")
		{
			this.reject(
				descriptor,
				binding,
				"initialization-reentry",
				`initialization re-entered for ${descriptor.id}`,
			);
		}
		this.initializations.set(key, "initializing");
		try
		{
			const initialize = resolvePrivateFunction(this.module, descriptor, symbol);
			if(!initialize())
			{
				this.initializations.set(key, "failed");
				this.reject(
					descriptor,
					binding,
					"runtime-not-ready",
					`failed to initialize the Lean runtime for ${descriptor.id}`,
					{ retry: plan?.retry ?? "native-policy" },
				);
			}
			this.initializations.set(key, "ready");
		} catch(error)
		{
			this.initializations.set(key, "failed");
			throw error;
		}
	}

	/**
   * Marks a library binding unusable after a native invariant fails.
   *
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	poison(descriptor, binding, message, details = {})
	{
		this.state = "poisoned";
		this.reject(descriptor, binding, "unexpected-native-failure", message, details);
	}

	/**
   * Starts a callback boundary that captures the first host-side callback failure.
   */
	beginCallbackBoundary()
	{
		const boundary = {
			id: this.nextCallbackBoundaryId
			, error: undefined
		};
		this.nextCallbackBoundaryId += 1;
		this.callbackBoundaries.push(boundary);
		return boundary;
	}

	/**
   * Records the first callback failure without masking an earlier boundary error.
   *
   * @param error - Error or rejection value to normalize and propagate.
   */
	recordCallbackBoundaryError(error)
	{
		const boundary = this.callbackBoundaries.at(-1);
		if(!boundary)
		{
			this.state = "poisoned";
			throw error;
		}
		boundary.error ??= error;
	}

	/**
   * Closes a callback boundary and rethrows any error captured during native execution.
   *
   * @param boundary - Active callback boundary frame whose nesting and failure state must be finalized.
   */
	endCallbackBoundary(boundary)
	{
		const current = this.callbackBoundaries.pop();
		if(current !== boundary)
		{
			this.state = "poisoned";
			throw new LeanBridgeError("callback boundary frames did not unwind in order", {
				code: "callback-boundary-corruption"
				, library: "bridge/callback-runtime"
				, operation: "callback"
				, details: { expected: boundary.id, actual: current?.id ?? null }
			});
		}
		return boundary.error;
	}

	/**
   * Validates a generation-safe resource token before any native resource operation.
   *
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param token - Generation-safe handle identifying the live native entry.
   */
	validateToken(descriptor, binding, token)
	{
		if(!Number.isInteger(token) || token === 0)
		{
			this.reject(
				descriptor,
				binding,
				"invalid-handle-token",
				`${binding.name} returned an invalid resource token`,
			);
		}
		const decoded = decodeHandleToken(token >>> 0);
		const handle = binding.lifecycle?.handle;
		const expectedSide = handle?.side === "lean" ? 0 : undefined;
		if(
			expectedSide === undefined
      || decoded.side !== expectedSide
      || decoded.kind !== handle?.kind
      || decoded.slot === 0
      || decoded.generation === 0
		) {
			this.reject(
				descriptor,
				binding,
				"invalid-handle-token",
				`${binding.name} returned a token with the wrong side or nominal kind`,
				{
					expectedSide: handle?.side
					, expectedKind: handle?.kind
				},
			);
		}
		return token >>> 0;
	}

	/**
   * Registers one projected resource class for a library while preventing duplicate identities.
   *
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param projectedClass - Generated JavaScript resource class registered for canonical identity lookup.
   */
	registerClass(descriptor, binding, projectedClass)
	{
		this.classes.set(classIdentity(descriptor, binding.typeId), {
			descriptor
			, binding
			, projectedClass
		});
	}

	/**
   * Raises a structured host-value error without exposing private registry state.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	rejectHost(code, message, details = {})
	{
		this.counters.hostRejected += 1;
		throw new LeanBridgeError(message, {
			code
			, library: "bridge/host-registry"
			, operation: "hostValue"
			, details: {
				runtimeId: this.runtimeId
				, epoch: this.epoch,
				...details
			}
		});
	}

	/**
   * Accepts only the closed host-value kinds supported by the private ABI.
   *
   * @param kind - Closed discriminator selecting the supported semantic kind.
   */
	validateHostKind(kind)
	{
		if(!Number.isInteger(kind) || kind < 1 || kind > 0x7f)
		{
			this.rejectHost(
				"invalid-handle-kind",
				"host value kind must be an integer from 1 through 127",
				{ kind },
			);
		}
	}

	/**
   * Resolves a host-value token after validating its generation and expected kind.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param expectedKind - Handle-kind discriminator required for the resolved host entry.
   */
	resolveHostEntry(token, expectedKind)
	{
		this.validateHostKind(expectedKind);
		if(!Number.isInteger(token) || token === 0)
		{
			this.rejectHost("invalid-handle-token", "host value token is invalid");
		}
		const normalized = token >>> 0;
		const decoded = decodeHandleToken(normalized);
		if(
			decoded.side !== 1
      || decoded.kind !== expectedKind
      || decoded.slot === 0
      || decoded.generation === 0
		) {
			this.rejectHost(
				"wrong-handle-kind",
				"host value token has the wrong side or nominal kind",
				{ expectedKind },
			);
		}
		const entry = this.hostSlots[decoded.slot - 1];
		if(
			!entry?.value
      || entry.retired
      || entry.kind !== expectedKind
      || entry.generation !== decoded.generation
      || entry.leases === 0
		) {
			this.rejectHost(
				"stale-handle-token",
				"host value token is stale or belongs to another runtime",
				{ expectedKind },
			);
		}
		return { entry, normalized, slot: decoded.slot - 1 };
	}

	/**
   * Returns the canonical generation-safe handle for a host object and value kind.
   *
   * @param value - Host object to register or resolve through the generation-safe handle table.
   * @param kind - Closed discriminator selecting the supported semantic kind.
   */
	internHostValue(value, kind)
	{
		if(this.state !== "open")
		{
			this.rejectHost("runtime-shut-down", "cannot retain a host value after shutdown");
		}
		this.validateHostKind(kind);
		if(
			(typeof value !== "object" || value === null)
      && typeof value !== "function"
		) {
			this.rejectHost(
				"invalid-host-value",
				"retained host values must have object identity",
			);
		}
		let tokensByKind = this.hostObjectTokens.get(value);
		const existingToken = tokensByKind?.get(kind);
		if(existingToken !== undefined)
		{
			const { entry } = this.resolveHostEntry(existingToken, kind);
			entry.leases += 1;
			this.counters.hostCanonicalHits += 1;
			this.counters.hostLeasesAcquired += 1;
			return existingToken;
		}

		let slot = this.hostSlots.findIndex(entry => !entry.value && !entry.retired);
		if(slot < 0)
		{
			if(this.hostSlots.length >= 0x0fff)
			{
				this.rejectHost("registry-capacity", "host value registry is full");
			}
			slot = this.hostSlots.length;
			this.hostSlots.push({
				value: undefined
				, generation: 1
				, kind: 0
				, leases: 0
				, retired: false
			});
		}
		const entry = this.hostSlots[slot];
		if(entry.generation === 0) entry.generation = 1;
		entry.value = value;
		entry.kind = kind;
		entry.leases = 1;
		const token = encodeHostToken(slot, entry.generation, kind);
		if(!tokensByKind)
		{
			tokensByKind = new Map();
			this.hostObjectTokens.set(value, tokensByKind);
		}
		tokensByKind.set(kind, token);
		this.counters.hostValuesCreated += 1;
		this.counters.hostLeasesAcquired += 1;
		return token;
	}

	/**
   * Borrows a host value for one operation without transferring or extending ownership.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param kind - Closed discriminator selecting the supported semantic kind.
   * @param operation - Callback that receives the borrowed host value while its handle remains validated.
   */
	borrowHostValue(token, kind, operation)
	{
		const { entry } = this.resolveHostEntry(token, kind);
		this.counters.hostBorrows += 1;
		this.counters.hostActiveBorrows += 1;
		try
		{
			return operation(entry.value);
		} finally
		{
			this.counters.hostActiveBorrows -= 1;
		}
	}

	/**
   * Releases a host-value handle after validating its generation and kind.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param kind - Closed discriminator selecting the supported semantic kind.
   */
	releaseHostValue(token, kind)
	{
		const { entry } = this.resolveHostEntry(token, kind);
		entry.leases -= 1;
		this.counters.hostLeasesReleased += 1;
		if(entry.leases !== 0) return entry.leases;
		const tokensByKind = this.hostObjectTokens.get(entry.value);
		tokensByKind?.delete(kind);
		if(tokensByKind?.size === 0) this.hostObjectTokens.delete(entry.value);
		entry.value = undefined;
		entry.kind = 0;
		if(entry.generation === 0x0fff)
		{
			entry.retired = true;
		} else
		{
			entry.generation += 1;
		}
		return 0;
	}

	/**
   * Drops all host-value handles and replaces the finalization generation.
   */
	clearHostValues()
	{
		for(const entry of this.hostSlots)
		{
			if(!entry.value || entry.leases === 0) continue;
			const tokensByKind = this.hostObjectTokens.get(entry.value);
			tokensByKind?.delete(entry.kind);
			if(tokensByKind?.size === 0) this.hostObjectTokens.delete(entry.value);
			this.counters.hostLeasesReleased += entry.leases;
			entry.value = undefined;
			entry.kind = 0;
			entry.leases = 0;
		}
	}

	/**
   * Validates a native closure token and its fixed adapter identity.
   *
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param token - Generation-safe handle identifying the live native entry.
   * @param adapter - Boundary adapter that validates identities and translates calls between projected and native representations.
   */
	validateClosureToken(descriptor, binding, token, adapter)
	{
		if(!Number.isInteger(token) || token === 0)
		{
			this.reject(
				descriptor,
				binding,
				"invalid-callback-token",
				`${binding.name} returned an invalid Lean closure token`,
			);
		}
		const normalized = token >>> 0;
		const decoded = decodeHandleToken(normalized);
		if(
			adapter.handle?.side !== "lean"
      || decoded.side !== 0
      || decoded.kind !== adapter.handle.kind
      || decoded.slot === 0
      || decoded.generation === 0
		) {
			this.reject(
				descriptor,
				binding,
				"invalid-callback-token",
				`${binding.name} returned a closure token with the wrong side or nominal kind`,
				{ expectedSide: adapter.handle?.side, expectedKind: adapter.handle?.kind },
			);
		}
		return normalized;
	}

	/**
   * Resolves the native closure entry attached to a projected wrapper.
   *
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   */
	requireNativeClosure(wrapper, descriptor, binding)
	{
		const state = nativeClosureStates.get(wrapper);
		if(!state)
		{
			this.reject(
				descriptor,
				binding,
				"invalid-callback",
				`${binding.name} requires a generated Lean closure`,
			);
		}
		if(state.context !== this)
		{
			this.reject(
				descriptor,
				binding,
				"cross-runtime-handle",
				`${binding.name} belongs to a different Lean runtime`,
			);
		}
		if(state.disposed)
		{
			this.reject(
				descriptor,
				binding,
				"callback-disposed",
				`${binding.name} has been disposed`,
			);
		}
		if(state.epoch !== this.epoch || this.state !== "open")
		{
			this.reject(
				descriptor,
				binding,
				"runtime-epoch-expired",
				`${binding.name} belongs to an expired runtime epoch`,
			);
		}
		return state;
	}

	/**
   * Creates or reuses the canonical JavaScript wrapper for a native Lean closure.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param adapter - Boundary adapter that validates identities and translates calls between projected and native representations.
   * @param call - Native invocation function called by the projected closure after token validation.
   * @param release - Native release function invoked when the projected closure or resource is disposed.
   */
	liftNativeClosure(token, descriptor, binding, adapter, call, release)
	{
		const normalized = this.validateClosureToken(
			descriptor,
			binding,
			token,
			adapter,
		);
		const key = closureIdentity(adapter.signature.typeId, normalized);
		const existing = this.closureCache.get(key);
		if(existing)
		{
			this.counters.closureCanonicalHits += 1;
			return existing;
		}
		if(this.closureEntries.has(key))
		{
			this.reject(
				descriptor,
				binding,
				"duplicate-owned-callback",
				`${binding.name} returned a Lean closure identity whose previous owner awaits cleanup`,
			);
		}

		let wrapper;
		wrapper = (...args) => this.invokeNativeClosure(wrapper, args);
		const state = {
			context: this
			, epoch: this.epoch
			, key
			, token: normalized
			, descriptor
			, binding
			, adapter
			, call
			, release
			, disposed: false
			, active: 0
			, calls: 0
		};
		nativeClosureStates.set(wrapper, state);
		this.closureEntries.set(key, {
			key
			, token: normalized
			, epoch: this.epoch
			, descriptor
			, binding
			, adapter
			, release
		});
		this.closureCache.set(key, wrapper);
		this.closureFinalizer?.register(
			wrapper,
			Object.freeze({
				key
				, token: normalized
				, epoch: this.epoch
				, descriptor
				, binding
				, adapter
				, release
			}),
			wrapper,
		);
		Object.defineProperties(wrapper, {
			dispose: {
				value: () => this.disposeNativeClosure(wrapper)
			}
			, disposed: {
				get: () => nativeClosureStates.get(wrapper)?.disposed ?? true
			}
		});
		if(Symbol.dispose)
		{
			Object.defineProperty(wrapper, Symbol.dispose, {
				value: wrapper.dispose
			});
		}
		this.counters.closuresCreated += 1;
		this.counters.closureLeasesAcquired += 1;
		return wrapper;
	}

	/**
   * Invokes a projected native closure through its fixed adapter and callback boundary.
   *
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param args - Arguments forwarded through the validated adapter.
   */
	invokeNativeClosure(wrapper, args)
	{
		const preliminary = nativeClosureStates.get(wrapper);
		const descriptor = preliminary?.descriptor ?? {
			id: "bridge/native-closure"
			, buildHash: "unknown"
		};
		const binding = preliminary?.binding ?? { name: "callback" };
		this.beforeCall(descriptor, binding);
		const state = this.requireNativeClosure(wrapper, descriptor, binding);
		const { signature } = state.adapter;
		if(args.length !== signature.parameters.length)
		{
			throw bridgeError(
				descriptor,
				binding,
				"invalid-argument-count",
				`${binding.name} closure expects ${signature.parameters.length} arguments`,
				{ expected: signature.parameters.length, actual: args.length },
			);
		}
		const typeMap = bindingIrTypeMap(descriptor);
		for(let index = 0; index < args.length; index += 1)
		{
			validateCopiedValue(
				descriptor,
				binding,
				signature.parameters[index].type,
				args[index],
				signature.parameters[index].name,
				typeMap,
			);
		}
		if(signature.invocation === "once" && state.calls > 0)
		{
			throw bridgeError(
				descriptor,
				binding,
				"callback-already-invoked",
				`${binding.name} returned a once-only closure that has already run`,
			);
		}
		state.calls += 1;
		state.active += 1;
		this.counters.closureCalls += 1;
		let result;
		try
		{
			result = this.callbacks.invokeNative(
				state.token,
				signature,
				(...values) => state.call(state.token, ...values),
				args,
			);
		} finally
		{
			state.active -= 1;
		}
		validateCopiedValue(
			descriptor,
			binding,
			signature.result.type,
			result,
			"result",
			typeMap,
		);
		return result;
	}

	/**
   * Releases a native closure once and removes every reverse identity mapping.
   *
   * @param entry - Resolved registry entry whose lifecycle is being updated.
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param reason - Human-readable reason for cancellation or disposal.
   */
	releaseNativeClosure(entry, wrapper, reason)
	{
		const current = this.closureEntries.get(entry.key);
		if(
			!current
      || current.token !== entry.token
      || current.epoch !== entry.epoch
		) {
			if(reason === "finalizer") return false;
			this.reject(
				entry.descriptor,
				entry.binding,
				"stale-callback-token",
				`${entry.binding.name} cleanup rejected an expired Lean closure lease`,
				{ cleanup: reason },
			);
		}
		this.closureEntries.delete(entry.key);
		if(wrapper)
		{
			const state = nativeClosureStates.get(wrapper);
			if(state) state.disposed = true;
			this.closureFinalizer?.unregister(wrapper);
		}
		this.closureCache.delete(entry.key);
		const remaining = entry.release(entry.token) >>> 0;
		if(remaining === 0xffff_ffff)
		{
			this.reject(
				entry.descriptor,
				entry.binding,
				"stale-callback-token",
				`${entry.binding.name} cleanup rejected a stale Lean closure token`,
				{ cleanup: reason },
			);
		}
		this.counters.closureLeasesReleased += 1;
		if(reason === "finalizer") this.counters.closuresFinalized += 1;
		return true;
	}

	/**
   * Explicitly disposes the native closure represented by a projected wrapper.
   *
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   */
	disposeNativeClosure(wrapper)
	{
		const state = nativeClosureStates.get(wrapper);
		if(state?.context === this && state.disposed) return false;
		const descriptor = state?.descriptor ?? {
			id: "bridge/native-closure"
			, buildHash: "unknown"
		};
		const binding = state?.binding ?? { name: "callback" };
		const live = this.requireNativeClosure(wrapper, descriptor, binding);
		if(live.active > 0 && live.adapter.signature.selfDisposal === "reject")
		{
			this.reject(
				descriptor,
				binding,
				"callback-active",
				`${binding.name} cannot be disposed while it is running`,
			);
		}
		this.releaseNativeClosure(live, wrapper, "dispose");
		return true;
	}

	/**
   * Processes queued native-closure finalizers before the next observable operation.
   */
	drainClosureFinalizers()
	{
		while(this.pendingClosureFinalizations.length > 0)
		{
			const holding = this.pendingClosureFinalizations.shift();
			if(holding.epoch !== this.epoch || this.state !== "open") continue;
			const current = this.closureEntries.get(holding.key);
			if(
				!current
        || current.token !== holding.token
        || current.epoch !== holding.epoch
			) {
				continue;
			}
			if(this.closureCache.get(holding.key) !== undefined) continue;
			this.releaseNativeClosure(current, undefined, "finalizer");
		}
	}

	/**
   * Attaches a validated native token to its canonical projected resource wrapper.
   *
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param token - Generation-safe handle identifying the live native entry.
   * @param release - Native release function invoked when the projected closure or resource is disposed.
   */
	attach(wrapper, descriptor, binding, token, release)
	{
		const normalized = this.validateToken(descriptor, binding, token);
		const bindingKey = classIdentity(descriptor, binding.typeId);
		const entryKey = `${bindingKey}:${normalized}`;
		const existing = this.entries.get(entryKey)?.reference.deref();
		if(existing)
		{
			this.reject(
				descriptor,
				binding,
				"duplicate-owned-handle",
				`${binding.name} returned a resource token that already has a live owner`,
			);
		}
		const state = {
			context: this
			, epoch: this.epoch
			, bindingKey
			, entryKey
			, token: normalized
			, descriptor
			, binding
			, release
			, disposed: false
		};
		wrapperStates.set(wrapper, state);
		this.entries.set(entryKey, {
			reference: this.createWeakReference(wrapper)
			, token: normalized
			, epoch: this.epoch
			, bindingKey
			, descriptor
			, binding
			, release
		});
		if(binding.lifecycle.disposal.fallback === "queued-finalizer")
		{
			this.finalizer?.register(
				wrapper,
				{
					entryKey
					, token: normalized
					, epoch: this.epoch
					, bindingKey
					, descriptor
					, binding
					, release
				},
				wrapper,
			);
		}
		this.counters.wrappersCreated += 1;
		this.counters.leasesAcquired += 1;
	}

	/**
   * Validates that a projected method receiver is live and belongs to the expected library.
   *
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   */
	requireReceiver(wrapper, descriptor, binding)
	{
		const state = wrapperStates.get(wrapper);
		if(!state)
		{
			this.reject(
				descriptor,
				binding,
				"invalid-receiver",
				`${binding.name} requires a generated ${binding.name} instance`,
			);
		}
		if(state.context !== this)
		{
			this.reject(
				descriptor,
				binding,
				"cross-runtime-handle",
				`${binding.name} belongs to a different Lean runtime`,
			);
		}
		if(state.bindingKey !== classIdentity(descriptor, binding.typeId))
		{
			this.reject(
				descriptor,
				binding,
				"wrong-handle-kind",
				`${binding.name} received a different nominal resource type`,
			);
		}
		if(state.disposed)
		{
			this.reject(
				descriptor,
				binding,
				"resource-disposed",
				`${binding.name} has been disposed`,
			);
		}
		if(state.epoch !== this.epoch || this.state !== "open")
		{
			this.reject(
				descriptor,
				binding,
				"runtime-epoch-expired",
				`${binding.name} belongs to an expired runtime epoch`,
			);
		}
		return state;
	}

	/**
   * Converts a native resource token into the canonical projected JavaScript instance.
   *
   * @param token - Generation-safe handle identifying the live native entry.
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param method - Validated projected method definition being invoked.
   * @param result - Candidate result whose closed shape and outcome semantics are validated.
   */
	liftResource(token, descriptor, method, result)
	{
		const target = this.classes.get(classIdentity(descriptor, result.typeId));
		if(!target)
		{
			this.reject(
				descriptor,
				method,
				"unknown-resource-type",
				`${method.name} returned unknown resource type ${result.typeId}`,
			);
		}
		const normalized = this.validateToken(
			descriptor,
			target.binding,
			token,
		);
		const entryKey = `${classIdentity(descriptor, result.typeId)}:${normalized}`;
		const wrapper = this.entries.get(entryKey)?.reference.deref();
		if(!wrapper)
		{
			this.reject(
				descriptor,
				method,
				result.ownership === "borrow"
					? "unrooted-borrow"
					: "missing-retained-owner",
				`${method.name} returned a resource without a live canonical owner`,
				{ ownership: result.ownership, resource: result.typeId },
			);
		}
		this.counters.canonicalHits += 1;
		return wrapper;
	}

	/**
   * Invokes a validated callback through the nested frame and cleanup rules of the runtime.
   *
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   * @param method - Validated projected method definition being invoked.
   * @param args - Arguments forwarded through the validated adapter.
   */
	invoke(wrapper, descriptor, binding, method, args)
	{
		this.beforeCall(descriptor, method);
		const state = this.requireReceiver(wrapper, descriptor, binding);
		const parameters = method.call.parameters;
		if(parameters && args.length !== parameters.length)
		{
			this.reject(
				descriptor,
				method,
				"invalid-argument-count",
				`${method.name} expects ${parameters.length} arguments`,
				{ expected: parameters.length, actual: args.length },
			);
		}
		const typeMap = bindingIrTypeMap(descriptor);
		for(let index = 0; parameters && index < args.length; index += 1)
		{
			validateCopiedValue(
				descriptor,
				method,
				parameters[index].type,
				args[index],
				parameters[index].name,
				typeMap,
			);
		}
		this.counters.borrows += 1;
		this.counters.activeBorrows += 1;
		try
		{
			const result = method.implementation(state.token, ...args);
			if(method.call.result?.transport === "handle")
			{
				return this.liftResource(result, descriptor, method, method.call.result);
			}
			if(method.call.result?.type)
			{
				validateCopiedValue(
					descriptor,
					method,
					method.call.result.type,
					result,
					"result",
					typeMap,
				);
			}
			return result;
		} finally
		{
			this.counters.activeBorrows -= 1;
		}
	}

	/**
   * Releases one projected resource entry and clears its identity mappings.
   *
   * @param entry - Resolved registry entry whose lifecycle is being updated.
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param reason - Human-readable reason for cancellation or disposal.
   */
	releaseEntry(entry, wrapper, reason)
	{
		this.entries.delete(entry.entryKey ?? `${entry.bindingKey}:${entry.token}`);
		if(wrapper)
		{
			const state = wrapperStates.get(wrapper);
			if(state) state.disposed = true;
			this.finalizer?.unregister(wrapper);
		}
		const remaining = entry.release(entry.token) >>> 0;
		if(remaining === 0xffff_ffff)
		{
			this.reject(
				entry.descriptor,
				entry.binding,
				"stale-handle-token",
				`${entry.binding.name} cleanup rejected a stale resource token`,
				{ cleanup: reason },
			);
		}
		this.counters.leasesReleased += 1;
		if(reason === "finalizer") this.counters.finalized += 1;
	}

	/**
   * Releases the native resource exactly once and makes subsequent operations fail closed.
   *
   * @param wrapper - Canonical JavaScript wrapper associated with the native identity.
   * @param descriptor - Validated library descriptor that defines native symbols and semantics.
   * @param binding - Resolved private binding record for the selected library.
   */
	dispose(wrapper, descriptor, binding)
	{
		const state = wrapperStates.get(wrapper);
		if(state?.context === this && state.disposed) return false;
		const live = this.requireReceiver(wrapper, descriptor, binding);
		this.releaseEntry(
			{
				...live,
				entryKey: live.entryKey
			},
			wrapper,
			"dispose",
		);
		return true;
	}

	/**
   * Processes queued resource finalizers before the next observable operation.
   */
	drainFinalizers()
	{
		while(this.pendingFinalizations.length > 0)
		{
			const holding = this.pendingFinalizations.shift();
			if(holding.epoch !== this.epoch || this.state !== "open") continue;
			const entry = this.entries.get(holding.entryKey);
			if(!entry || entry.reference.deref() !== undefined) continue;
			this.releaseEntry({ ...holding }, undefined, "finalizer");
		}
	}

	/**
   * Returns an immutable diagnostic view of current state without exposing mutable registry internals.
   */
	snapshot()
	{
		this.drainFinalizers();
		this.drainClosureFinalizers();
		return Object.freeze({
			runtimeId: this.runtimeId
			, epoch: this.epoch
			, state: this.state
			, resources: Object.freeze({
				live: this.entries.size
				, wrappersCreated: this.counters.wrappersCreated
				, canonicalHits: this.counters.canonicalHits
				, rejected: this.counters.rejected
			})
			, borrows: Object.freeze({
				total: this.counters.borrows
				, active: this.counters.activeBorrows
			})
			, leases: Object.freeze({
				acquired: this.counters.leasesAcquired
				, released: this.counters.leasesReleased
				, finalized: this.counters.finalized
			})
			, hostValues: Object.freeze({
				live: this.hostSlots.filter(entry => entry.value && entry.leases > 0)
          .length
				, created: this.counters.hostValuesCreated
				, canonicalHits: this.counters.hostCanonicalHits
				, rejected: this.counters.hostRejected
				, borrows: this.counters.hostBorrows
				, activeBorrows: this.counters.hostActiveBorrows
				, leasesAcquired: this.counters.hostLeasesAcquired
				, leasesReleased: this.counters.hostLeasesReleased
			})
			, nativeClosures: Object.freeze({
				live: this.closureEntries.size
				, created: this.counters.closuresCreated
				, canonicalHits: this.counters.closureCanonicalHits
				, calls: this.counters.closureCalls
				, leasesAcquired: this.counters.closureLeasesAcquired
				, leasesReleased: this.counters.closureLeasesReleased
				, finalized: this.counters.closuresFinalized
			})
			, pendingFinalizations: this.pendingFinalizations.length
			, pendingClosureFinalizations: this.pendingClosureFinalizations.length
			, pendingOperations: this.pendingOperations.snapshot()
			, callbacks: this.callbacks.snapshot()
			, initializations: Object.freeze(
				Object.fromEntries([...this.initializations].sort(([left], [right]) => left.localeCompare(right))),
			)
		});
	}

	/**
   * Rejects or releases every live entry and leaves the registry closed to further work.
   */
	shutdown()
	{
		if(this.state === "closed") return true;
		this.drainFinalizers();
		this.drainClosureFinalizers();
		this.pendingOperations.shutdown();
		for(const [key, entry] of [...this.closureEntries])
		{
			const wrapper = this.closureCache.get(key);
			this.releaseNativeClosure(entry, wrapper, "shutdown");
		}
		this.closureCache.clear();
		this.callbacks.shutdown();
		for(const [entryKey, entry] of [...this.entries])
		{
			const wrapper = entry.reference.deref();
			this.releaseEntry({ ...entry, entryKey }, wrapper, "shutdown");
		}
		this.clearHostValues();
		const shutdown = this.module._bridge_lean_runtime_shutdown;
		if(typeof shutdown !== "function" || !shutdown())
		{
			throw new Error("the Lean runtime rejected bridge shutdown");
		}
		this.state = "closed";
		this.epoch += 1;
		return true;
	}
}

const getRuntimeContext = (module, options = {}) => {
	let context = runtimeContexts.get(module);
	if(!context)
	{
		context = new RuntimeRegistry(module, options);
		runtimeContexts.set(module, context);
	}
	return context;
};

// Internal POC probes. Generated consumer packages do not export these hooks.
export const __bridgeTest = Object.freeze({
	internHostValue: (module, value, kind) =>
		getRuntimeContext(module).internHostValue(value, kind)
	, borrowHostValue: (module, token, kind, operation) =>
		getRuntimeContext(module).borrowHostValue(token, kind, operation)
	, releaseHostValue: (module, token, kind) =>
		getRuntimeContext(module).releaseHostValue(token, kind)
	, beginPendingOperation: (module, plan, options) =>
		getRuntimeContext(module).pendingOperations.begin(plan, options)
	, resolvePendingOperation: (module, token, value) =>
		getRuntimeContext(module).pendingOperations.resolve(token, value)
	, rejectPendingOperation: (module, token, error) =>
		getRuntimeContext(module).pendingOperations.reject(token, error)
	, cancelPendingOperation: (module, token, reason) =>
		getRuntimeContext(module).pendingOperations.cancel(token, reason)
	, diagnostics: module => getRuntimeContext(module).snapshot()
});

const initializeBinding = (module, descriptor, binding) => {
	getRuntimeContext(module).initialize(descriptor, binding, binding.initialize ?? null);
};

const validateUInt32 = (descriptor, binding, field, value) => {
	if(!Number.isInteger(value) || value < 0 || value > 0xffff_ffff)
	{
		throw bridgeError(
			descriptor,
			binding,
			"invalid-argument",
			`${binding.name}.${field} must be an unsigned 32-bit integer`,
			{ field, expected: "uint32" },
		);
	}
	return value;
};

const bindingIrTypeMap = descriptor =>
	new Map((descriptor.bindingIr?.types ?? []).map(type => [type.id, type]));

const invalidCopiedValue = (descriptor, binding, field, expected) => {
	throw bridgeError(
		descriptor,
		binding,
		"invalid-argument",
		`${binding.name}.${field} must be ${expected}`,
		{ field, expected },
	);
};

const validateCopiedValue = (
	descriptor,
	binding,
	typeRef,
	value,
	field,
	typeMap,
) => {
	if(typeRef.kind === "primitive")
	{
		if(typeRef.name === "unit")
		{
			if(value !== undefined) invalidCopiedValue(descriptor, binding, field, "undefined");
		} else if(typeRef.name === "bool")
		{
			if(typeof value !== "boolean") invalidCopiedValue(descriptor, binding, field, "boolean");
		} else if(typeRef.name === "uint32")
		{
			validateUInt32(descriptor, binding, field, value);
		} else if(new Set(["uint8", "uint16"]).has(typeRef.name))
		{
			const maximum = typeRef.name === "uint8" ? 0xff : 0xffff;
			if(!Number.isInteger(value) || value < 0 || value > maximum)
			{
				invalidCopiedValue(descriptor, binding, field, typeRef.name);
			}
		} else if(new Set(["int8", "int16", "int32"]).has(typeRef.name))
		{
			const bits = Number(typeRef.name.slice(3));
			const minimum = -(2 ** (bits - 1));
			const maximum = 2 ** (bits - 1) - 1;
			if(!Number.isInteger(value) || value < minimum || value > maximum)
			{
				invalidCopiedValue(descriptor, binding, field, typeRef.name);
			}
		} else if(new Set(["uint64", "int64", "nat", "int"]).has(typeRef.name))
		{
			if(typeof value !== "bigint" || (typeRef.name === "nat" && value < 0n))
			{
				invalidCopiedValue(descriptor, binding, field, typeRef.name === "nat" ? "non-negative bigint" : "bigint");
			}
		} else if(new Set(["float32", "float64"]).has(typeRef.name))
		{
			if(typeof value !== "number" || !Number.isFinite(value))
			{
				invalidCopiedValue(descriptor, binding, field, "finite number");
			}
		} else if(typeRef.name === "string")
		{
			if(typeof value !== "string") invalidCopiedValue(descriptor, binding, field, "string");
		} else if(typeRef.name === "bytes")
		{
			if(!(value instanceof Uint8Array))
			{
				invalidCopiedValue(descriptor, binding, field, "Uint8Array");
			}
		} else
		{
			invalidCopiedValue(descriptor, binding, field, typeRef.name);
		}
		return value;
	}

	if(typeRef.kind === "named")
	{
		const type = typeMap.get(typeRef.id);
		if(type?.kind !== "record" || type.representation !== "copied")
		{
			invalidCopiedValue(descriptor, binding, field, `copied ${typeRef.id}`);
		}
		if(typeof value !== "object" || value === null || Array.isArray(value))
		{
			invalidCopiedValue(descriptor, binding, field, type.name);
		}
		const expectedFields = new Set(type.fields.map(item => item.name));
		const unknown = Object.keys(value).filter(name => !expectedFields.has(name));
		const missing = type.fields.filter(item => !(item.name in value)).map(item => item.name);
		if(unknown.length > 0 || missing.length > 0)
		{
			throw bridgeError(
				descriptor,
				binding,
				"invalid-argument",
				`${binding.name}.${field} does not match record ${type.name}`,
				{ field, expected: type.name, missing, unknown },
			);
		}
		for(const recordField of type.fields)
		{
			validateCopiedValue(
				descriptor,
				binding,
				recordField.type,
				value[recordField.name],
				field === "value" ? recordField.name : `${field}.${recordField.name}`,
				typeMap,
			);
		}
		return value;
	}

	if(typeRef.kind === "apply" && typeRef.constructor === "array")
	{
		if(!Array.isArray(value) && !(value instanceof Uint32Array))
		{
			invalidCopiedValue(descriptor, binding, field, "array");
		}
		for(let index = 0; index < value.length; index += 1)
		{
			validateCopiedValue(
				descriptor,
				binding,
				typeRef.arguments[0],
				value[index],
				`${field}[${index}]`,
				typeMap,
			);
		}
		return value;
	}

	invalidCopiedValue(descriptor, binding, field, "a supported copied value");
};

const semanticDeclaration = (descriptor, binding) => {
	if(!binding.declarationId || !descriptor.bindingIr) return undefined;
	const declaration = descriptor.bindingIr.declarations.find(
		item => item.id === binding.declarationId,
	);
	if(!declaration)
	{
		throw bridgeError(
			descriptor,
			binding,
			"missing-binding-contract",
			`${binding.name} has no matching Binding IR declaration`,
			{ declaration: binding.declarationId },
		);
	}
	return declaration;
};

const validateValueFrameInput = (descriptor, binding, adapter, value) => {
	const declaration = semanticDeclaration(descriptor, binding);
	if(declaration)
	{
		if(declaration.parameters.length !== 1)
		{
			throw bridgeError(
				descriptor,
				binding,
				"unsupported-adapter",
				`${binding.name} value frame requires one semantic parameter`,
				{ actual: declaration.parameters.length },
			);
		}
		validateCopiedValue(
			descriptor,
			binding,
			declaration.parameters[0].type,
			value,
			"value",
			bindingIrTypeMap(descriptor),
		);
	} else if(typeof value !== "object" || value === null || Array.isArray(value))
	{
		invalidCopiedValue(descriptor, binding, "value", "record");
	}

	const buffers = new Map();
	for(const field of adapter.fields)
	{
		if(field.transport !== "buffer") continue;
		const source = value[field.name];
		const encoded = field.codec === "utf8" ? textEncoder.encode(source) : source;
		const length = field.codec === "array" ? source.length : encoded.byteLength;
		if(length > field.maximumLength)
		{
			throw bridgeError(
				descriptor,
				binding,
				"copy-limit-exceeded",
				`${binding.name}.${field.name} exceeds the declared copied-value limit`,
				{ field: field.name, length, maximumLength: field.maximumLength },
			);
		}
		buffers.set(field.name, {
			source: encoded
			, length
			, byteLength: length * field.elementBytes
		});
	}
	return buffers;
};

const assertValueFrameAdapter = (descriptor, binding, adapter) => {
	if(
		adapter.abiVersion !== 1
    || !Number.isSafeInteger(adapter.byteSize)
    || adapter.byteSize < 16
    || adapter.byteSize % 4 !== 0
    || !adapter.header
    || !Array.isArray(adapter.fields)
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-adapter",
			`${binding.name} requests an unsupported value-frame layout`,
			{
				abiVersion: adapter.abiVersion
				, byteSize: adapter.byteSize
			},
		);
	}
};

const writeFrameScalar = (view, pointer, field, value) => {
	if(field.scalar === "bool")
	{
		view.setUint32(pointer + field.offset, value ? 1 : 0, true);
	} else if(field.scalar === "uint32")
	{
		view.setUint32(pointer + field.offset, value, true);
	} else
	{
		throw new Error(`unsupported generated frame scalar ${field.scalar}`);
	}
};

const readFrameScalar = (view, pointer, field) => {
	const value = view.getUint32(pointer + field.offset, true);
	if(field.scalar === "bool") return value !== 0;
	if(field.scalar === "uint32") return value;
	throw new Error(`unsupported generated frame scalar ${field.scalar}`);
};

const readEnvelopeScalar = (view, pointer, value) => {
	if(value.codec === "unit") return undefined;
	const offset = pointer + value.offset;
	if(value.codec === "bool") return view.getUint32(offset, true) !== 0;
	if(value.codec === "uint32") return view.getUint32(offset, true);
	if(value.codec === "int32") return view.getInt32(offset, true);
	if(value.codec === "float32") return view.getFloat32(offset, true);
	if(value.codec === "float64") return view.getFloat64(offset, true);
	throw new Error(`unsupported generated error scalar ${value.codec}`);
};

const projectValueFrameFunction = (
	module,
	descriptor,
	binding,
	implementation,
	context,
) => {
	const adapter = binding.adapter;
	assertValueFrameAdapter(descriptor, binding, adapter);
	const allocate = resolvePrivateFunction(module, descriptor, "_malloc");
	const free = resolvePrivateFunction(module, descriptor, "_free");

	return value => {
		context.beforeCall(descriptor, binding);
		const copiedBuffers = validateValueFrameInput(
			descriptor,
			binding,
			adapter,
			value,
		);
		initializeBinding(module, descriptor, binding);
		const allocations = [];
		const reserve = byteLength => {
			const pointer = allocate(Math.max(1, byteLength));
			if(!pointer)
			{
				throw bridgeError(
					descriptor,
					binding,
					"allocation-failed",
					`${binding.name} could not allocate ${byteLength} boundary bytes`,
					{ byteLength },
				);
			}
			allocations.push(pointer);
			return pointer;
		};

		try
		{
			const allocatedBuffers = new Map();
			for(const field of adapter.fields)
			{
				if(field.transport !== "buffer") continue;
				const copied = copiedBuffers.get(field.name);
				allocatedBuffers.set(field.name, {
					...copied,
					pointer: reserve(copied.byteLength)
				});
			}
			const framePointer = reserve(adapter.byteSize);

			let heapBytes = new Uint8Array(module.HEAP8.buffer);
			let heapView = new DataView(module.HEAP8.buffer);
			for(const field of adapter.fields)
			{
				if(field.transport !== "buffer") continue;
				const buffer = allocatedBuffers.get(field.name);
				if(field.codec === "array")
				{
					for(let index = 0; index < buffer.length; index += 1)
					{
						heapView.setUint32(
							buffer.pointer + index * field.elementBytes,
							buffer.source[index],
							true,
						);
					}
				} else
				{
					heapBytes.set(buffer.source, buffer.pointer);
				}
			}

			heapView.setUint32(
				framePointer + adapter.header.abiVersion,
				adapter.abiVersion,
				true,
			);
			heapView.setUint32(
				framePointer + adapter.header.byteSize,
				adapter.byteSize,
				true,
			);
			heapView.setUint32(framePointer + adapter.header.status, 0, true);
			heapView.setUint32(framePointer + adapter.header.detail, 0, true);
			for(const field of adapter.fields)
			{
				if(field.transport === "scalar")
				{
					writeFrameScalar(heapView, framePointer, field, value[field.name]);
					continue;
				}
				const buffer = allocatedBuffers.get(field.name);
				heapView.setUint32(framePointer + field.pointerOffset, buffer.pointer, true);
				heapView.setUint32(framePointer + field.lengthOffset, buffer.length, true);
				heapView.setUint32(framePointer + field.capacityOffset, buffer.length, true);
			}

			const status = implementation(framePointer) >>> 0;
			heapView = new DataView(module.HEAP8.buffer);
			const frameStatus = heapView.getUint32(
				framePointer + adapter.header.status,
				true,
			);
			const detail = heapView.getUint32(
				framePointer + adapter.header.detail,
				true,
			);
			if(status !== 0)
			{
				const code = frameErrorCodes[status] ?? "unknown-frame-error";
				throw bridgeError(
					descriptor,
					binding,
					code,
					`${binding.name} failed at the typed Lean boundary: ${code}`,
					{ status, frameStatus, detail },
				);
			}
			if(frameStatus !== 0)
			{
				throw bridgeError(
					descriptor,
					binding,
					"inconsistent-frame-status",
					`${binding.name} returned inconsistent frame status`,
					{ status, frameStatus, detail },
				);
			}

			heapBytes = new Uint8Array(module.HEAP8.buffer);
			heapView = new DataView(module.HEAP8.buffer);
			const result = {};
			for(const field of adapter.fields)
			{
				if(field.transport === "scalar")
				{
					result[field.name] = readFrameScalar(heapView, framePointer, field);
					continue;
				}
				const buffer = allocatedBuffers.get(field.name);
				const length = heapView.getUint32(framePointer + field.lengthOffset, true);
				if(length > buffer.length || length > field.maximumLength)
				{
					throw bridgeError(
						descriptor,
						binding,
						"output-capacity-exceeded",
						`${binding.name}.${field.name} returned an invalid length`,
						{ field: field.name, length, capacity: buffer.length },
					);
				}
				if(field.codec === "utf8")
				{
					result[field.name] = textDecoder.decode(
						heapBytes.slice(buffer.pointer, buffer.pointer + length),
					);
				} else if(field.codec === "bytes")
				{
					result[field.name] = heapBytes.slice(buffer.pointer, buffer.pointer + length);
				} else if(field.codec === "array")
				{
					const values = [];
					for(let index = 0; index < length; index += 1)
					{
						values.push(
							heapView.getUint32(buffer.pointer + index * field.elementBytes, true),
						);
					}
					result[field.name] = Object.freeze(values);
				}
			}
			const declaration = semanticDeclaration(descriptor, binding);
			if(declaration)
			{
				validateCopiedValue(
					descriptor,
					binding,
					declaration.result.type,
					result,
					"result",
					bindingIrTypeMap(descriptor),
				);
			}
			return Object.freeze(result);
		} finally
		{
			for(const pointer of allocations.reverse()) free(pointer);
		}
	};
};

const projectErrorEnvelopeFunction = (
	module,
	descriptor,
	binding,
	implementation,
	context,
) => {
	const plan = binding.adapter;
	const declaration = semanticDeclaration(descriptor, binding);
	if(
		plan.kind !== "error-envelope-v1"
    || plan.abiVersion !== 1
    || !Number.isSafeInteger(plan.byteSize)
    || plan.byteSize < 16
    || !plan.header
    || !plan.outcomes
    || !plan.result
    || !Array.isArray(plan.errors)
    || !declaration
    || declaration.kind !== "function"
    || declaration.resultMode !== "value"
    || declaration.failure.mode !== "declared"
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-adapter",
			`${binding.name} has an unsupported error envelope plan`,
			{ abiVersion: plan.abiVersion },
		);
	}
	const allocate = resolvePrivateFunction(module, descriptor, "_malloc");
	const free = resolvePrivateFunction(module, descriptor, "_free");

	return (...args) => {
		context.beforeCall(descriptor, binding);
		if(args.length !== declaration.parameters.length)
		{
			throw bridgeError(
				descriptor,
				binding,
				"invalid-argument-count",
				`${binding.name} expects ${declaration.parameters.length} arguments`,
				{ expected: declaration.parameters.length, actual: args.length },
			);
		}
		const typeMap = bindingIrTypeMap(descriptor);
		for(let index = 0; index < args.length; index += 1)
		{
			validateCopiedValue(
				descriptor,
				binding,
				declaration.parameters[index].type,
				args[index],
				declaration.parameters[index].name,
				typeMap,
			);
		}
		initializeBinding(module, descriptor, binding);
		const pointer = allocate(plan.byteSize);
		if(!pointer)
		{
			throw bridgeError(
				descriptor,
				binding,
				"allocation-failed",
				`${binding.name} could not allocate its error envelope`,
				{ byteSize: plan.byteSize },
			);
		}

		try
		{
			let bytes = new Uint8Array(module.HEAP8.buffer, pointer, plan.byteSize);
			bytes.fill(0);
			let view = new DataView(module.HEAP8.buffer);
			view.setUint32(pointer + plan.header.abiVersion, plan.abiVersion, true);
			view.setUint32(pointer + plan.header.byteSize, plan.byteSize, true);
			const status = implementation(pointer, ...args) >>> 0;
			view = new DataView(module.HEAP8.buffer);
			const actualVersion = view.getUint32(pointer + plan.header.abiVersion, true);
			const actualBytes = view.getUint32(pointer + plan.header.byteSize, true);
			const outcome = view.getUint32(pointer + plan.header.outcome, true);
			const errorTag = view.getUint32(pointer + plan.header.errorTag, true);
			if(status !== 0 || actualVersion !== plan.abiVersion || actualBytes !== plan.byteSize)
			{
				context.poison(
					descriptor,
					binding,
					`${binding.name} returned a corrupt error envelope`,
					{ status, actualVersion, actualBytes, outcome, errorTag },
				);
			}
			if(outcome === plan.outcomes.ok)
			{
				const result = readEnvelopeScalar(view, pointer, plan.result);
				validateCopiedValue(
					descriptor,
					binding,
					declaration.result.type,
					result,
					"result",
					typeMap,
				);
				return result;
			}
			if(outcome === plan.outcomes.declared)
			{
				const declared = plan.errors.find(error => error.tag === errorTag);
				if(!declared)
				{
					context.poison(
						descriptor,
						binding,
						`${binding.name} returned an unknown declared error tag`,
						{ outcome, errorTag },
					);
				}
				const payload = declared.payload === null ? undefined : readEnvelopeScalar(view, pointer, declared.payload);
				if(declared.payload !== null)
				{
					validateCopiedValue(
						descriptor,
						binding,
						declared.payload.type,
						payload,
						`${declared.name}.payload`,
						typeMap,
					);
				}
				throw bridgeError(
					descriptor,
					binding,
					"declared-error",
					`${binding.name} reported ${declared.name}`,
					{
						errorId: declared.id
						, errorName: declared.name
						, category: declared.category
						, payload
					},
				);
			}
			if(plan.unexpected === "trap")
			{
				throw bridgeError(
					descriptor,
					binding,
					"unexpected-native-failure",
					`${binding.name} reported an unexpected native failure`,
					{ outcome, errorTag, policy: plan.unexpected },
				);
			}
			context.poison(
				descriptor,
				binding,
				`${binding.name} reported an unexpected native failure`,
				{ outcome, errorTag, policy: plan.unexpected },
			);
		} finally
		{
			free(pointer);
		}
	};
};

const projectIteratorFunction = (
	module,
	descriptor,
	binding,
	implementation,
	context,
) => {
	const plan = binding.adapter;
	const declaration = semanticDeclaration(descriptor, binding);
	if(
		plan.kind !== "iterator-v1"
    || plan.abiVersion !== 1
    || plan.delivery !== "iterator"
    || plan.cursor?.handle?.side !== "lean"
    || !Number.isInteger(plan.cursor.handle.kind)
    || plan.cursor.ownership !== "lease"
    || plan.cursor.lifetime?.scope !== "explicit"
    || plan.cursor.disposal?.hostProtocol !== "return"
    || plan.cursor.disposal?.fallback !== "queued-finalizer"
    || plan.step?.header === undefined
    || plan.step?.states === undefined
    || !declaration
    || declaration.resultMode !== "iterator"
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-adapter",
			`${binding.name} has an unsupported iterator plan`,
			{ abiVersion: plan.abiVersion },
		);
	}
	const nextNative = resolvePrivateFunction(module, descriptor, plan.step.symbol);
	const release = resolvePrivateFunction(
		module,
		descriptor,
		plan.cursor.disposal.symbol,
	);
	const allocate = resolvePrivateFunction(module, descriptor, "_malloc");
	const free = resolvePrivateFunction(module, descriptor, "_free");
	const cursorBinding = Object.freeze({
		name: `${binding.name}Iterator`
		, typeId: plan.cursor.typeId
		, lifecycle: Object.freeze({
			handle: plan.cursor.handle
			, disposal: plan.cursor.disposal
		})
	});

	return (...args) => {
		context.beforeCall(descriptor, binding);
		validatePendingArguments(descriptor, binding, declaration, args);
		initializeBinding(module, descriptor, binding);
		const token = implementation(...args);
		let closed = false;
		let iterator;
		const close = () => {
			if(closed) return false;
			closed = true;
			return context.dispose(iterator, descriptor, cursorBinding);
		};

		/**
     * Adapts private Lean iterator operations to the synchronous JavaScript iterator protocol.
     */
		class ProjectedIterator
		{
			/**
       * Advances the projected iterator and translates its native result into JavaScript iterator form.
       */
			next()
			{
				if(closed) return Object.freeze({ done: true, value: undefined });
				context.beforeCall(descriptor, binding);
				const state = context.requireReceiver(iterator, descriptor, cursorBinding);
				const pointer = allocate(plan.step.byteSize);
				if(!pointer)
				{
					throw bridgeError(
						descriptor,
						binding,
						"allocation-failed",
						`${binding.name} could not allocate its iterator step`,
						{ byteSize: plan.step.byteSize },
					);
				}
				try
				{
					const bytes = new Uint8Array(
						module.HEAP8.buffer,
						pointer,
						plan.step.byteSize,
					);
					bytes.fill(0);
					let view = new DataView(module.HEAP8.buffer);
					view.setUint32(
						pointer + plan.step.header.abiVersion,
						plan.abiVersion,
						true,
					);
					view.setUint32(
						pointer + plan.step.header.byteSize,
						plan.step.byteSize,
						true,
					);
					const status = nextNative(state.token, pointer) >>> 0;
					view = new DataView(module.HEAP8.buffer);
					const actualVersion = view.getUint32(
						pointer + plan.step.header.abiVersion,
						true,
					);
					const actualBytes = view.getUint32(
						pointer + plan.step.header.byteSize,
						true,
					);
					const stepState = view.getUint32(pointer + plan.step.header.state, true);
					const detail = view.getUint32(pointer + plan.step.header.detail, true);
					if(
						status !== 0
            || actualVersion !== plan.abiVersion
            || actualBytes !== plan.step.byteSize
					) {
						close();
						if(declaration.failure.unexpected === "poison-runtime")
						{
							context.poison(
								descriptor,
								binding,
								`${binding.name} returned a corrupt iterator step`,
								{ status, actualVersion, actualBytes, stepState, detail },
							);
						}
						throw bridgeError(
							descriptor,
							binding,
							"unexpected-native-failure",
							`${binding.name} returned a corrupt iterator step`,
							{ status, actualVersion, actualBytes, stepState, detail },
						);
					}
					if(stepState === plan.step.states.done)
					{
						close();
						return Object.freeze({ done: true, value: undefined });
					}
					if(stepState !== plan.step.states.value)
					{
						close();
						context.poison(
							descriptor,
							binding,
							`${binding.name} returned an unknown iterator state`,
							{ stepState, detail },
						);
					}
					const value = readEnvelopeScalar(view, pointer, plan.step.value);
					validateCopiedValue(
						descriptor,
						binding,
						declaration.result.type,
						value,
						"item",
						bindingIrTypeMap(descriptor),
					);
					return Object.freeze({ done: false, value });
				} finally
				{
					free(pointer);
				}
			}

			/**
       * Closes the projected iterator early and returns a completed iterator result.
       */
			return()
			{
				close();
				return Object.freeze({ done: true, value: undefined });
			}

			/**
       * Propagates an iterator failure through native cancellation before rethrowing it.
       *
       * @param error - Error or rejection value to normalize and propagate.
       */
			throw(error)
			{
				close();
				throw error;
			}

			/**
       * Returns this cursor as its own synchronous iterator, preserving one native cursor and disposal path.
       */
			[Symbol.iterator]()
			{
				return this;
			}
		}

		iterator = Object.freeze(new ProjectedIterator());
		context.attach(iterator, descriptor, cursorBinding, token, release);
		return iterator;
	};
};

const projectAsyncIteratorFunction = (
	module,
	descriptor,
	binding,
	implementation,
	context,
) => {
	const plan = binding.adapter;
	const declaration = semanticDeclaration(descriptor, binding);
	if(
		plan.kind !== "async-iterator-v1"
    || plan.abiVersion !== 1
    || plan.delivery !== "async-iterator"
    || plan.cursor?.handle?.side !== "lean"
    || !Number.isInteger(plan.cursor.handle.kind)
    || plan.cursor.ownership !== "lease"
    || plan.cursor.lifetime?.scope !== "explicit"
    || plan.cursor.disposal?.hostProtocol !== "return"
    || plan.cursor.disposal?.fallback !== "queued-finalizer"
    || plan.step?.pending?.kind !== "pending-operation-v1"
    || plan.step.pending.abiVersion !== 1
    || plan.step.pending.settlement?.cardinality !== "exactly-once"
    || typeof module[plan.step.resolver] !== "function"
    || !declaration
    || declaration.resultMode !== "async-iterator"
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-adapter",
			`${binding.name} has an unsupported async iterator plan`,
			{ abiVersion: plan.abiVersion },
		);
	}
	const nextNative = resolvePrivateFunction(module, descriptor, plan.step.symbol);
	const cancelNative = resolvePrivateFunction(
		module,
		descriptor,
		plan.step.cancelSymbol,
	);
	const release = resolvePrivateFunction(
		module,
		descriptor,
		plan.cursor.disposal.symbol,
	);
	const cursorBinding = Object.freeze({
		name: `${binding.name}AsyncIterator`
		, typeId: plan.cursor.typeId
		, lifecycle: Object.freeze({
			handle: plan.cursor.handle
			, disposal: plan.cursor.disposal
		})
	});

	return (...args) => {
		context.beforeCall(descriptor, binding);
		validatePendingArguments(descriptor, binding, declaration, args);
		initializeBinding(module, descriptor, binding);
		const token = implementation(...args);
		let closed = false;
		let released = false;
		let activePending;
		let chain = Promise.resolve();
		let iterator;
		const releaseCursor = () => {
			if(released) return false;
			released = true;
			return context.dispose(iterator, descriptor, cursorBinding);
		};
		const done = () => Object.freeze({ done: true, value: undefined });

		const pull = async () => {
			if(closed) return done();
			context.beforeCall(descriptor, binding);
			const state = context.requireReceiver(iterator, descriptor, cursorBinding);
			const pending = context.pendingOperations.begin(plan.step.pending, {
				cancel:
					/**
           * Cancels a pending operation through its registered hook and deterministic cleanup path.
           *
           * @param pendingToken - Generation-safe pending-operation handle used to advance or cancel asynchronous work.
           */
					function(pendingToken) {
						const accepted = cancelNative(pendingToken, state.token);
						if(accepted !== 1 && accepted !== true)
						{
							throw bridgeError(
								descriptor,
								binding,
								"iterator-cancel-rejected",
								`${binding.name} did not accept iterator cancellation`,
								{ pendingToken, accepted },
							);
						}
					}
			});
			activePending = pending;
			try
			{
				const accepted = nextNative(pending.token, state.token);
				if(accepted !== 1 && accepted !== true)
				{
					context.pendingOperations.reject(
						pending.token,
						bridgeError(
							descriptor,
							binding,
							"iterator-start-rejected",
							`${binding.name} did not accept an async pull`,
							{ pendingToken: pending.token, accepted },
						),
					);
				}
				const step = await pending.promise;
				if(
					step === null
          || typeof step !== "object"
          || !Number.isInteger(step.state)
				) {
					closed = true;
					releaseCursor();
					context.poison(
						descriptor,
						binding,
						`${binding.name} returned an invalid async iterator step`,
						{ step },
					);
				}
				if(step.state === plan.step.states.done)
				{
					closed = true;
					releaseCursor();
					return done();
				}
				if(step.state !== plan.step.states.value)
				{
					closed = true;
					releaseCursor();
					context.poison(
						descriptor,
						binding,
						`${binding.name} returned an unknown async iterator state`,
						{ state: step.state },
					);
				}
				validateCopiedValue(
					descriptor,
					binding,
					declaration.result.type,
					step.value,
					"item",
					bindingIrTypeMap(descriptor),
				);
				return Object.freeze({ done: false, value: step.value });
			} finally
			{
				if(activePending === pending) activePending = undefined;
			}
		};

		/**
     * Adapts private Lean iterator operations to the asynchronous JavaScript iterator protocol with cancellation.
     */
		class ProjectedAsyncIterator
		{
			/**
       * Advances the projected iterator and translates its native result into JavaScript iterator form.
       */
			next()
			{
				const operation = chain.then(pull);
				chain = operation.catch(() => undefined);
				return operation;
			}

			/**
       * Closes the projected iterator early and returns a completed iterator result.
       */
			async return()
			{
				if(closed) return done();
				closed = true;
				if(activePending)
				{
					context.pendingOperations.cancel(
						activePending.token,
						"async iteration returned before the pull settled",
					);
				}
				await chain;
				releaseCursor();
				return done();
			}

			/**
       * Propagates an iterator failure through native cancellation before rethrowing it.
       *
       * @param error - Error or rejection value to normalize and propagate.
       */
			async throw(error)
			{
				await this.return();
				throw error;
			}

			/**
       * Returns this cursor as its own asynchronous iterator, preserving serialized native advancement and cancellation.
       */
			[Symbol.asyncIterator]()
			{
				return this;
			}
		}

		iterator = Object.freeze(new ProjectedAsyncIterator());
		context.attach(iterator, descriptor, cursorBinding, token, release);
		return iterator;
	};
};

const validatePendingArguments = (descriptor, binding, declaration, args) => {
	const required = declaration.parameters.filter(parameter => !parameter.optional).length;
	if(args.length < required || args.length > declaration.parameters.length)
	{
		throw bridgeError(
			descriptor,
			binding,
			"invalid-argument-count",
			`${binding.name} expects from ${required} through ${declaration.parameters.length} arguments`,
			{ required, maximum: declaration.parameters.length, actual: args.length },
		);
	}
	const typeMap = bindingIrTypeMap(descriptor);
	for(let index = 0; index < args.length; index += 1)
	{
		const parameter = declaration.parameters[index];
		validateCopiedValue(
			descriptor,
			binding,
			parameter.type,
			args[index],
			parameter.name,
			typeMap,
		);
	}
};

const projectPendingFunction = (
	module,
	descriptor,
	binding,
	implementation,
	context,
) => {
	const plan = binding.adapter;
	if(
		plan.abiVersion !== 1
    || plan.delivery !== "promise"
    || plan.settlement?.cardinality !== "exactly-once"
    || plan.execution?.suspension !== "stackless"
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-adapter",
			`${binding.name} has an unsupported pending-operation plan`,
			{ abiVersion: plan.abiVersion },
		);
	}
	const declaration = semanticDeclaration(descriptor, binding);
	if(!declaration || declaration.resultMode !== "promise")
	{
		throw bridgeError(
			descriptor,
			binding,
			"missing-binding-contract",
			`${binding.name} has no Promise declaration for its pending adapter`,
		);
	}
	const cancel = resolvePrivateFunction(
		module,
		descriptor,
		plan.cancelSymbol,
	);

	return async (...args) => {
		context.beforeCall(descriptor, binding);
		validatePendingArguments(descriptor, binding, declaration, args);
		initializeBinding(module, descriptor, binding);
		const pending = context.pendingOperations.begin(plan, {
			cancel:
				/**
         * Cancels a pending operation through its registered hook and deterministic cleanup path.
         *
         * @param token - Generation-safe handle identifying the live native entry.
         */
				function(token) {
					const accepted = cancel(token);
					if(accepted !== 1 && accepted !== true)
					{
						throw bridgeError(
							descriptor,
							binding,
							"pending-cancel-rejected",
							`${binding.name} did not accept cancellation`,
							{ token, accepted },
						);
					}
				}
		});
		try
		{
			const accepted = implementation(pending.token, ...args);
			if(accepted !== 1 && accepted !== true)
			{
				context.pendingOperations.reject(
					pending.token,
					bridgeError(
						descriptor,
						binding,
						"pending-start-rejected",
						`${binding.name} did not accept the pending operation`,
						{ token: pending.token, accepted },
					),
				);
			}
		} catch(error)
		{
			try
			{
				context.pendingOperations.reject(pending.token, error);
			} catch(settlementError)
			{
				if(settlementError.code !== "stale-pending-operation") throw settlementError;
			}
		}
		return pending.promise.then(result => {
      validateCopiedValue(
        descriptor,
        binding,
        declaration.result.type,
        result,
        "result",
        bindingIrTypeMap(descriptor),
      );
      return result;
		});
	};
};

const projectCallbackFunction = (
	module,
	descriptor,
	binding,
	implementation,
	context,
) => {
	const adapter = binding.adapter;
	const declaration = semanticDeclaration(descriptor, binding);
	if(
		adapter.abiVersion !== 1
    || adapter.signature?.kind !== "callback-signature-v1"
    || adapter.signature.abiVersion !== 1
    || !declaration
    || declaration.resultMode !== "value"
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-adapter",
			`${binding.name} has an unsupported callback adapter`,
			{ abiVersion: adapter.abiVersion },
		);
	}
	const callbackParameter = declaration.parameters[adapter.callbackIndex];
	if(
		callbackParameter?.name !== adapter.callbackParameter
    || callbackParameter.type.kind !== "named"
    || callbackParameter.type.id !== adapter.signature.typeId
	) {
		throw bridgeError(
			descriptor,
			binding,
			"missing-binding-contract",
			`${binding.name} callback adapter does not match its semantic parameter`,
		);
	}

	return (...args) => {
		context.beforeCall(descriptor, binding);
		if(args.length !== declaration.parameters.length)
		{
			throw bridgeError(
				descriptor,
				binding,
				"invalid-argument-count",
				`${binding.name} expects ${declaration.parameters.length} arguments`,
				{ expected: declaration.parameters.length, actual: args.length },
			);
		}
		const typeMap = bindingIrTypeMap(descriptor);
		for(let index = 0; index < args.length; index += 1)
		{
			const parameter = declaration.parameters[index];
			if(index === adapter.callbackIndex)
			{
				if(typeof args[index] !== "function")
				{
					invalidCopiedValue(descriptor, binding, parameter.name, "function");
				}
			} else
			{
				validateCopiedValue(
					descriptor,
					binding,
					parameter.type,
					args[index],
					parameter.name,
					typeMap,
				);
			}
		}
		initializeBinding(module, descriptor, binding);
		const callback = args[adapter.callbackIndex];
		const token = context.callbacks.retain(callback, adapter.signature);
		const boundary = context.beginCallbackBoundary();
		let result;
		let failure;
		try
		{
			const nativeArguments = [...args];
			nativeArguments[adapter.callbackIndex] = token;
			result = implementation(...nativeArguments);
		} catch(error)
		{
			failure = error;
		} finally
		{
			const callbackFailure = context.endCallbackBoundary(boundary);
			failure ??= callbackFailure;
			try
			{
				context.callbacks.release(token, adapter.signature);
			} catch(error)
			{
				failure ??= error;
			}
		}
		if(failure) throw failure;
		validateCopiedValue(
			descriptor,
			binding,
			declaration.result.type,
			result,
			"result",
			typeMap,
		);
		return result;
	};
};

const projectCallbackResultFunction = (
	module,
	descriptor,
	binding,
	implementation,
	context,
) => {
	const adapter = binding.adapter;
	const declaration = semanticDeclaration(descriptor, binding);
	if(
		adapter.abiVersion !== 1
    || adapter.signature?.kind !== "callback-signature-v1"
    || adapter.signature.abiVersion !== 1
    || adapter.handle?.side !== "lean"
    || !Number.isInteger(adapter.handle.kind)
    || typeof adapter.callSymbol !== "string"
    || adapter.disposal?.explicit !== true
    || adapter.disposal.fallback !== "queued-finalizer"
    || typeof adapter.disposal.symbol !== "string"
    || !declaration
    || declaration.resultMode !== "value"
    || declaration.result.ownership !== "lease"
    || declaration.result.lifetime?.scope !== "explicit"
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-adapter",
			`${binding.name} has an unsupported Lean closure result adapter`,
			{ abiVersion: adapter.abiVersion },
		);
	}
	const call = resolvePrivateFunction(
		module,
		descriptor,
		adapter.callSymbol,
	);
	const release = resolvePrivateFunction(
		module,
		descriptor,
		adapter.disposal.symbol,
	);

	return (...args) => {
		context.beforeCall(descriptor, binding);
		if(args.length !== declaration.parameters.length)
		{
			throw bridgeError(
				descriptor,
				binding,
				"invalid-argument-count",
				`${binding.name} expects ${declaration.parameters.length} arguments`,
				{ expected: declaration.parameters.length, actual: args.length },
			);
		}
		const typeMap = bindingIrTypeMap(descriptor);
		for(let index = 0; index < args.length; index += 1)
		{
			validateCopiedValue(
				descriptor,
				binding,
				declaration.parameters[index].type,
				args[index],
				declaration.parameters[index].name,
				typeMap,
			);
		}
		initializeBinding(module, descriptor, binding);
		const token = implementation(...args);
		return context.liftNativeClosure(
			token,
			descriptor,
			binding,
			adapter,
			call,
			release,
		);
	};
};

const matchesGenericGuard = (guard, value) => {
	if(guard === "bytes") return value instanceof Uint8Array;
	return typeof value === guard;
};

const genericGuardForType = type => {
	if(type?.kind !== "primitive") return undefined;
	if(type.name === "bool") return "boolean";
	if(type.name === "string") return "string";
	if(type.name === "bytes") return "bytes";
	if(new Set(["uint64", "int64", "nat", "int"]).has(type.name)) return "bigint";
	if(
		new Set([
			"uint8"
			, "uint16"
			, "uint32"
			, "int8"
			, "int16"
			, "int32"
			, "float32"
			, "float64"
		]).has(type.name)
	) {
		return "number";
	}
	return undefined;
};

const projectGenericFunction = (module, descriptor, binding, context) => {
	const adapter = binding.adapter;
	if(
		adapter.abiVersion !== 1
    || adapter.declarationId !== binding.declarationId
    || !Array.isArray(adapter.branches)
    || adapter.branches.length === 0
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-generic-plan",
			`${binding.name} has a generic plan the runtime cannot preserve`,
		);
	}
	const guards = new Set();
	const branches = adapter.branches.map(branch => {
    if(
      genericGuardForType(branch.type) !== branch.guard
      || guards.has(branch.guard)
      || typeof branch.id !== "string"
      || branch.id.length === 0
    ) {
      throw bridgeError(
        descriptor,
        binding,
        "invalid-generic-plan",
        `${binding.name} has an invalid or ambiguous generic branch`,
        { specialization: branch.id, guard: branch.guard },
      );
    }
    guards.add(branch.guard);
    return {
      ...branch,
      implementation: resolvePrivateFunction(module, descriptor, branch.symbol)
    };
	});
	const typeMap = bindingIrTypeMap(descriptor);
	return (...args) => {
		context.beforeCall(descriptor, binding);
		if(args.length !== 1)
		{
			throw bridgeError(
				descriptor,
				binding,
				"invalid-argument-count",
				`${binding.name} expects 1 argument`,
				{ expected: 1, actual: args.length },
			);
		}
		const branch = branches.find(item => matchesGenericGuard(item.guard, args[0]));
		if(!branch)
		{
			throw bridgeError(
				descriptor,
				binding,
				"unsupported-generic-value",
				`${binding.name} does not support this value type`,
				{ accepted: branches.map(item => item.id) },
			);
		}
		validateCopiedValue(descriptor, binding, branch.type, args[0], adapter.parameter, typeMap);
		initializeBinding(module, descriptor, binding);
		const result = branch.implementation(args[0]);
		validateCopiedValue(descriptor, binding, branch.type, result, "result", typeMap);
		return result;
	};
};

const projectFunction = (module, descriptor, binding, context) => {
	if(binding.adapter?.kind === "generic-specialization-v1")
	{
		return projectGenericFunction(module, descriptor, binding, context);
	}
	const implementation = resolvePrivateFunction(
		module,
		descriptor,
		binding.symbol,
	);
	if(!binding.adapter)
	{
		return (...args) => {
			context.beforeCall(descriptor, binding);
			const declaration = descriptor.bindingIr?.declarations.find(
				item => item.id === binding.declarationId,
			);
			if(declaration && args.length !== declaration.parameters.length)
			{
				throw bridgeError(
					descriptor,
					binding,
					"invalid-argument-count",
					`${binding.name} expects ${declaration.parameters.length} arguments`,
					{ expected: declaration.parameters.length, actual: args.length },
				);
			}
			const typeMap = bindingIrTypeMap(descriptor);
			for(let index = 0; declaration && index < args.length; index += 1)
			{
				validateCopiedValue(
					descriptor,
					binding,
					declaration.parameters[index].type,
					args[index],
					declaration.parameters[index].name,
					typeMap,
				);
			}
			initializeBinding(module, descriptor, binding);
			const result = implementation(...args);
			if(declaration)
			{
				validateCopiedValue(
					descriptor,
					binding,
					declaration.result.type,
					result,
					"result",
					typeMap,
				);
			}
			return result;
		};
	}
	if(binding.adapter.kind === "value-frame-v1")
	{
		return projectValueFrameFunction(
			module,
			descriptor,
			binding,
			implementation,
			context,
		);
	}
	if(binding.adapter.kind === "pending-operation-v1")
	{
		return projectPendingFunction(
			module,
			descriptor,
			binding,
			implementation,
			context,
		);
	}
	if(binding.adapter.kind === "callback-call-v1")
	{
		return projectCallbackFunction(
			module,
			descriptor,
			binding,
			implementation,
			context,
		);
	}
	if(binding.adapter.kind === "callback-result-v1")
	{
		return projectCallbackResultFunction(
			module,
			descriptor,
			binding,
			implementation,
			context,
		);
	}
	if(binding.adapter.kind === "error-envelope-v1")
	{
		return projectErrorEnvelopeFunction(
			module,
			descriptor,
			binding,
			implementation,
			context,
		);
	}
	if(binding.adapter.kind === "iterator-v1")
	{
		return projectIteratorFunction(
			module,
			descriptor,
			binding,
			implementation,
			context,
		);
	}
	if(binding.adapter.kind === "async-iterator-v1")
	{
		return projectAsyncIteratorFunction(
			module,
			descriptor,
			binding,
			implementation,
			context,
		);
	}
	throw bridgeError(
		descriptor,
		binding,
		"unsupported-adapter",
		`unsupported binding adapter ${binding.adapter.kind}`,
		{ kind: binding.adapter.kind },
	);
};

const assertResourceLifecycle = (descriptor, binding) => {
	const lifecycle = binding.lifecycle;
	if(
		lifecycle?.kind !== "resource-lifecycle-v1"
    || lifecycle.abiVersion !== 1
    || lifecycle.typeId !== binding.typeId
    || lifecycle.handle?.side !== "lean"
    || !Number.isInteger(lifecycle.handle?.kind)
    || lifecycle.handle.kind < 1
    || lifecycle.handle.kind > 0x7f
    || lifecycle.identity?.projection !== "canonical-wrapper"
    || lifecycle.identity?.cache !== "weak-per-runtime-token"
    || lifecycle.disposal?.explicit !== true
    || typeof lifecycle.disposal?.symbol !== "string"
    || lifecycle.constructor?.result?.typeId !== binding.typeId
    || lifecycle.constructor.result.ownership !== "lease"
    || lifecycle.constructor.result.lifetime?.scope !== "explicit"
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-resource-lifecycle",
			`${binding.name} has resource lifecycle metadata the runtime cannot preserve`,
			{ typeId: binding.typeId },
		);
	}
	for(const method of [...(binding.methods ?? []), ...(binding.properties ?? [])])
	{
		if(
			method.call?.declarationId !== method.declarationId
      || method.call?.symbol !== method.symbol
      || method.call?.receiver?.typeId !== binding.typeId
      || method.call.receiver.ownership !== "borrow"
      || method.call.receiver.lifetime?.scope !== "call"
		) {
			throw bridgeError(
				descriptor,
				method,
				"unsupported-resource-lifecycle",
				`${method.name} has call lifecycle metadata the runtime cannot preserve`,
				{ declaration: method.declarationId },
			);
		}
	}
	return lifecycle;
};

const projectClass = (module, descriptor, binding, context) => {
	const bindingKey = classIdentity(descriptor, binding.typeId);
	const cached = context.classes.get(bindingKey)?.projectedClass;
	if(cached) return cached;
	const lifecycle = assertResourceLifecycle(descriptor, binding);
	const construct = resolvePrivateFunction(
		module,
		descriptor,
		lifecycle.constructor.symbol,
	);
	const dispose = resolvePrivateFunction(
		module,
		descriptor,
		lifecycle.disposal.symbol,
	);
	const methods = (binding.methods ?? []).map(method => {
    assertPublicName(method.name);
    return {
      ...method,
      implementation: resolvePrivateFunction(module, descriptor, method.symbol)
    };
	});
	const properties = (binding.properties ?? []).map(property => {
    assertPublicName(property.name);
    return {
      ...property,
      implementation: resolvePrivateFunction(
        module,
        descriptor,
        property.symbol,
      )
    };
	});

	/**
   * Wraps an identity-bearing Lean resource and enforces its receiver and disposal rules.
   */
	class ProjectedResource
	{
		/**
     * Initializes a projected resource around a validated identity-bearing token.
     *
     * @param {...any} args - Arguments forwarded through the validated adapter.
     */
		constructor(...args)
		{
			context.beforeCall(descriptor, binding);
			context.initialize(descriptor, binding, lifecycle.initialize ?? null);
			const handle = construct(...args);
			if(!handle) throw new Error(`failed to construct ${binding.name}`);
			context.attach(this, descriptor, binding, handle, dispose);
		}

		/**
     * Releases the native resource exactly once and makes subsequent operations fail closed.
     */
		dispose()
		{
			return context.dispose(this, descriptor, binding);
		}
	}

	Object.defineProperty(ProjectedResource, "name", { value: binding.name });
	for(const method of methods)
	{
		Object.defineProperty(ProjectedResource.prototype, method.name, {
			value:
				/**
         * Forwards a generated resource-method call through lifecycle validation and the native invocation adapter.
         *
         * @param {...any} args - Arguments forwarded through the validated adapter.
         */
				function(...args) {
					return context.invoke(this, descriptor, binding, method, args);
				}
		});
	}
	const propertyDescriptors = new Map();
	for(const property of properties)
	{
		const current = propertyDescriptors.get(property.name) ?? {
			configurable: false
			, enumerable: true
		};
		if(property.role === "getter")
		{
			if(current.get)
			{
				throw new Error(`duplicate getter ${binding.name}.${property.name}`);
			}
			/**
       * Reads a projected resource property through the same token validation and native invocation path as methods.
       */
			current.get = function getProjectedProperty() {
				return context.invoke(this, descriptor, binding, property, []);
			};
		} else if(property.role === "setter")
		{
			if(current.set)
			{
				throw new Error(`duplicate setter ${binding.name}.${property.name}`);
			}
			/**
       * Writes a projected resource property through token validation and the generated native setter binding.
       *
       * @param value - JavaScript property value encoded for the generated native setter.
       */
			current.set = function setProjectedProperty(value) {
				context.invoke(this, descriptor, binding, property, [value]);
			};
		} else
		{
			throw new Error(`unsupported property role ${property.role}`);
		}
		propertyDescriptors.set(property.name, current);
	}
	for(const [name, property] of propertyDescriptors)
	{
		Object.defineProperty(ProjectedResource.prototype, name, property);
	}
	if(Symbol.dispose)
	{
		Object.defineProperty(ProjectedResource.prototype, Symbol.dispose, {
			value: ProjectedResource.prototype.dispose
		});
	}

	context.registerClass(descriptor, binding, ProjectedResource);
	return ProjectedResource;
};

const projectOverload = (module, descriptor, binding, context) => {
	if(
		binding.dispatch?.kind !== "overload-v1"
    || binding.dispatch.abiVersion !== 1
    || binding.dispatch.strategy !== "arity"
    || binding.dispatch.name !== binding.name
    || !Array.isArray(binding.dispatch.branches)
    || !Array.isArray(binding.branches)
    || binding.dispatch.branches.length !== binding.branches.length
	) {
		throw bridgeError(
			descriptor,
			binding,
			"unsupported-overload-plan",
			`${binding.name} has an overload plan the runtime cannot preserve`,
		);
	}
	const declarations = new Map(
		binding.branches.map(branch => [branch.declarationId, branch]),
	);
	const byArity = new Map();
	for(const branch of binding.dispatch.branches)
	{
		const declaration = declarations.get(branch.declarationId);
		if(
			!declaration
      || declaration.kind !== "function"
      || declaration.name !== binding.name
      || !Number.isSafeInteger(branch.arity)
      || branch.arity < 0
      || byArity.has(branch.arity)
		) {
			throw bridgeError(
				descriptor,
				binding,
				"invalid-overload-plan",
				`${binding.name} has an invalid or ambiguous overload branch`,
				{ declaration: branch.declarationId, arity: branch.arity },
			);
		}
		byArity.set(
			branch.arity,
			projectFunction(module, descriptor, declaration, context),
		);
		declarations.delete(branch.declarationId);
	}
	if(declarations.size > 0)
	{
		throw bridgeError(
			descriptor,
			binding,
			"invalid-overload-plan",
			`${binding.name} has an unplanned overload branch`,
			{ declarations: [...declarations.keys()] },
		);
	}
	const accepted = [...byArity.keys()].sort((left, right) => left - right);
	return (...args) => {
		const implementation = byArity.get(args.length);
		if(!implementation)
		{
			throw bridgeError(
				descriptor,
				binding,
				"invalid-argument-count",
				`${binding.name} expects ${accepted.join(" or ")} arguments`,
				{ accepted, actual: args.length },
			);
		}
		return implementation(...args);
	};
};

const projectBindings = (module, descriptor, context) => {
	const api = Object.create(null);

	for(const binding of descriptor.bindings ?? [])
	{
		assertPublicName(binding.name);

		if(binding.kind === "function")
		{
			Object.defineProperty(api, binding.name, {
				enumerable: true
				, value: projectFunction(module, descriptor, binding, context)
			});
		} else if(binding.kind === "class")
		{
			Object.defineProperty(api, binding.name, {
				enumerable: true
				, value: projectClass(module, descriptor, binding, context)
			});
		} else if(binding.kind === "overload")
		{
			Object.defineProperty(api, binding.name, {
				enumerable: true
				, value: projectOverload(module, descriptor, binding, context)
			});
		} else
		{
			throw new Error(
				`unsupported binding kind ${binding.kind} in ${descriptor.id}`,
			);
		}
	}

	return Object.freeze(api);
};

/**
 * Projects one validated descriptor onto its initialized module using the runtime-wide identity and lifecycle registries.
 *
 * @param module - Initialized runtime module that supplies private native exports.
 * @param descriptor - Validated library descriptor that defines native symbols and semantics.
 * @param options - Runtime registry overrides used while projecting the module and descriptor.
 */
export const createLibrarySurface = (module, descriptor, options = {}) =>
	projectBindings(module, descriptor, getRuntimeContext(module, options));

const libraryAliases = descriptor => {
	const versionIndex = descriptor.id.lastIndexOf("@");
	const unversioned = versionIndex > 0
		? descriptor.id.slice(0, versionIndex)
		: descriptor.id;
	return new Set([descriptor.id, unversioned, unversioned.split("/").at(-1)]);
};

const createLibraryCatalog = roots => {
	const descriptors = new Map();
	const aliases = new Map();
	const visit = descriptor => {
		if(!descriptor || typeof descriptor.id !== "string" || !Array.isArray(descriptor.dependencies))
		{
			throw new TypeError("library catalog entries must be resolved descriptors");
		}
		const key = identity(descriptor);
		if(descriptors.has(key)) return;
		descriptors.set(key, descriptor);
		for(const alias of libraryAliases(descriptor))
		{
			const existing = aliases.get(alias);
			if(existing && existing !== descriptor)
			{
				throw new Error(`library alias ${alias} identifies more than one descriptor`);
			}
			aliases.set(alias, descriptor);
		}
		descriptor.dependencies.forEach(visit);
	};
	roots.forEach(visit);
	return Object.freeze({
		resolve:
			/**
       * Resolves a validated handle or request while rejecting stale and incompatible identities.
       *
       * @param requested - Requested library roots or workload identity resolved against the available catalog.
       */
			function(requested) {
				if(typeof requested !== "string") return requested;
				const descriptor = aliases.get(requested);
				if(!descriptor)
				{
					throw new Error(`unknown library ${requested}; add it to the loader catalog`);
				}
				return descriptor;
			}
	});
};

/**
 * Builds a dependency-aware loader that deduplicates concurrent loads, initializes each library once, and exposes shutdown diagnostics.
 *
 * @param module - Initialized runtime module that supplies private native exports.
 * @param options - Library catalog, prelinked identities, artifact reader, capacities, and lifecycle-hook overrides.
 */
export const createLibraryLoader = (module, options = {}) => {
	const context = getRuntimeContext(module, options);
	const loaded = new Map();
	const pending = new Map();
	const read = options.readArtifact ?? readArtifact;
	const catalog = createLibraryCatalog(options.libraries ?? []);
	const prelinked = new Set((options.prelinked ?? []).map(identity));

	const load = async (requested, ancestry = []) => {
		const descriptor = catalog.resolve(requested);
		const key = identity(descriptor);
		if(loaded.has(key)) return loaded.get(key);
		if(ancestry.includes(key))
		{
			throw new Error(`library dependency cycle at ${key}`);
		}
		if(pending.has(key)) return pending.get(key);

		const operation = (async () => {
      const dependencyAncestry = [...ancestry, key];
      for(const dependency of descriptor.dependencies)
{
        await load(dependency, dependencyAncestry);
}

      // Emscripten routes dynamic-library names through the module locator.
      // Passing an absolute path here would be prefixed a second time by the
      // default Node locator. The production descriptor loader will build the
      // same name→URL map used by PHP-Wasm's locateFile pattern.
      if(!prelinked.has(key))
{
        const path = decodeURIComponent(
          descriptor.sideModule.pathname.split("/").at(-1),
        );

        await verifyIntegrity(descriptor, read);
        await module.loadDynamicLibrary(path, {
          global: true
          , loadAsync: true
          , nodelete: true
        });
}
      const api = projectBindings(module, descriptor, context);
      loaded.set(key, api);
      return api;
		})();

		pending.set(key, operation);
		try
		{
			return await operation;
		} finally
		{
			pending.delete(key);
		}
	};

	return Object.freeze({
		load
		, loaded
		, diagnostics: () => context.snapshot()
		, shutdown: () => context.shutdown()
	});
};
