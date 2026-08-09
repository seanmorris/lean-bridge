const isWeakTarget = value =>
  (typeof value === "object" && value !== null) || typeof value === "function";

const nativeWeakReference = target => new WeakRef(target);

const nativeFinalizationRegistry = callback =>
  typeof FinalizationRegistry === "function"
    ? new FinalizationRegistry(callback)
    : undefined;

export class WeakValueMap {
  constructor({
    createWeakReference = nativeWeakReference,
    createFinalizationRegistry = nativeFinalizationRegistry,
  } = {}) {
    if (typeof createWeakReference !== "function") {
      throw new TypeError("createWeakReference must be a function");
    }
    if (typeof createFinalizationRegistry !== "function") {
      throw new TypeError("createFinalizationRegistry must be a function");
    }
    this.createWeakReference = createWeakReference;
    this.createFinalizationRegistry = createFinalizationRegistry;
    this.map = new Map();
    this.registry = this.createRegistry();
  }

  createRegistry() {
    let registry;
    registry = this.createFinalizationRegistry(holding => {
      if (this.registry !== registry) return;
      const entry = this.map.get(holding.key);
      if (!entry || entry.reference !== holding.reference) return;
      if (entry.reference.deref() !== undefined) return;
      this.map.delete(holding.key);
    });
    return registry;
  }

  get size() {
    this.prune();
    return this.map.size;
  }

  clear() {
    this.registry = this.createRegistry();
    this.map.clear();
  }

  delete(key) {
    const entry = this.map.get(key);
    if (!entry) return false;
    this.registry?.unregister(entry.unregisterToken);
    return this.map.delete(key);
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    const value = entry.reference.deref();
    if (value === undefined) {
      this.delete(key);
      return undefined;
    }
    return value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  set(key, value) {
    if (!isWeakTarget(value)) {
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

  prune() {
    for (const key of this.map.keys()) this.get(key);
  }

  *entries() {
    for (const [key, entry] of this.map) {
      const value = entry.reference.deref();
      if (value === undefined) {
        this.delete(key);
        continue;
      }
      yield [key, value];
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  *keys() {
    for (const [key] of this) yield key;
  }

  *values() {
    for (const [, value] of this) yield value;
  }

  forEach(callback, thisArg) {
    if (typeof callback !== "function") {
      throw new TypeError("callback must be a function");
    }
    for (const [key, value] of this) {
      callback.call(thisArg, value, key, this);
    }
  }
}

Object.defineProperty(WeakValueMap, Symbol.species, { value: WeakValueMap });
