const isWeakTarget = value =>
	(typeof value === "object" && value !== null) || typeof value === "function";

const nativeWeakReference = target => new WeakRef(target);

const nativeFinalizationRegistry = callback =>
	typeof FinalizationRegistry === "function"
		? new FinalizationRegistry(callback)
		: undefined;

/**
 * Associates arbitrary keys with weakly held values and removes entries after their values are collected.
 */
export class WeakValueMap
{
	/**
   * Initializes weak-reference and finalization hooks, allowing deterministic substitutes in tests.
   *
   * @param root0 - Named initialization options and dependency overrides for the new instance.
   * @param root0.createWeakReference - Factory used to create weak references, replaceable for deterministic tests.
   * @param root0.createFinalizationRegistry - Factory used to create finalization registries, replaceable for deterministic tests.
   */
	constructor({
		createWeakReference = nativeWeakReference
		, createFinalizationRegistry = nativeFinalizationRegistry
	} = {}) {
		if(typeof createWeakReference !== "function")
		{
			throw new TypeError("createWeakReference must be a function");
		}
		if(typeof createFinalizationRegistry !== "function")
		{
			throw new TypeError("createFinalizationRegistry must be a function");
		}
		this.createWeakReference = createWeakReference;
		this.createFinalizationRegistry = createFinalizationRegistry;
		this.map = new Map();
		this.registry = this.createRegistry();
	}

	/**
   * Creates a finalization registry that ignores stale callbacks from replaced registry generations.
   */
	createRegistry()
	{
		let registry;
		registry = this.createFinalizationRegistry(holding => {
      if(this.registry !== registry) return;
      const entry = this.map.get(holding.key);
      if(!entry || entry.reference !== holding.reference) return;
      if(entry.reference.deref() !== undefined) return;
      this.map.delete(holding.key);
		});
		return registry;
	}

	/**
   * Returns the number of currently live entries without exposing their internal representation.
   */
	get size()
	{
		this.prune();
		return this.map.size;
	}

	/**
   * Clears all tracked entries and resets auxiliary lifecycle state without retaining stale handles.
   */
	clear()
	{
		this.registry = this.createRegistry();
		this.map.clear();
	}

	/**
   * Removes the entry for a key and unregisters any lifecycle token associated with it.
   *
   * @param key - Lookup key whose live value is being queried or updated.
   */
	delete(key)
	{
		const entry = this.map.get(key);
		if(!entry) return false;
		this.registry?.unregister(entry.unregisterToken);
		return this.map.delete(key);
	}

	/**
   * Returns the live value for a key and removes the entry when collection has already occurred.
   *
   * @param key - Lookup key whose live value is being queried or updated.
   */
	get(key)
	{
		const entry = this.map.get(key);
		if(!entry) return undefined;
		const value = entry.reference.deref();
		if(value === undefined)
		{
			this.delete(key);
			return undefined;
		}
		return value;
	}

	/**
   * Reports whether a key still resolves to a live value without extending that value’s lifetime.
   *
   * @param key - Lookup key whose live value is being queried or updated.
   */
	has(key)
	{
		return this.get(key) !== undefined;
	}

	/**
   * Associates a key with a weakly held value and replaces any prior lifecycle registration.
   *
   * @param key - Lookup key whose live value is being queried or updated.
   * @param value - Object retained weakly until collection or explicit replacement removes the association.
   */
	set(key, value)
	{
		if(!isWeakTarget(value))
		{
			throw new TypeError("WeakValueMap values must be objects or functions");
		}
		this.delete(key);
		const reference = this.createWeakReference(value);
		const unregisterToken = {};
		this.map.set(key, { reference, unregisterToken });
		this.registry?.register(
			value,
			Object.freeze({ key, reference }),
			unregisterToken,
		);
		return this;
	}

	/**
   * Visits every entry so values already collected by the host are removed promptly.
   */
	prune()
	{
		for(const key of this.map.keys()) this.get(key);
	}

	/**
   * Yields live key-value pairs while discarding entries whose weak values were collected.
   */
	*entries()
	{
		for(const [key, entry] of this.map)
		{
			const value = entry.reference.deref();
			if(value === undefined)
			{
				this.delete(key);
				continue;
			}
			yield [key, value];
		}
	}

	/**
   * Returns the live-entry iterator so the weak map supports ordinary key-value iteration.
   */
	[Symbol.iterator]()
	{
		return this.entries();
	}

	/**
   * Yields keys for live entries in the same order as the underlying registry.
   */
	*keys()
	{
		for(const [key] of this) yield key;
	}

	/**
   * Yields live values without exposing internal weak-reference records.
   */
	*values()
	{
		for(const [, value] of this) yield value;
	}

	/**
   * Invokes a callback for every live entry using Map-compatible argument ordering.
   *
   * @param callback - Callback invoked for each relevant lifecycle event or result.
   * @param thisArg - Receiver supplied when invoking the callback.
   */
	forEach(callback, thisArg)
	{
		if(typeof callback !== "function")
		{
			throw new TypeError("callback must be a function");
		}
		for(const [key, value] of this)
		{
			callback.call(thisArg, value, key, this);
		}
	}
}

Object.defineProperty(WeakValueMap, Symbol.species, { value: WeakValueMap });
