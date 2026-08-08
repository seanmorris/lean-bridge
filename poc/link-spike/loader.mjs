const identity = descriptor => `${descriptor.id}#${descriptor.buildHash}`;

const resolvePrivateFunction = (module, descriptor, symbol) => {
  const implementation = module[symbol];
  if (typeof implementation !== "function") {
    throw new Error(`missing private ABI symbol ${symbol} for ${descriptor.id}`);
  }
  return implementation;
};

const assertPublicName = name => {
  if (name.startsWith("_")) {
    throw new Error(`public binding names cannot start with _: ${name}`);
  }
};

const projectClass = (module, descriptor, binding) => {
  const construct = resolvePrivateFunction(
    module,
    descriptor,
    binding.constructor,
  );
  const initialize = binding.initialize
    ? resolvePrivateFunction(module, descriptor, binding.initialize)
    : undefined;
  const dispose = resolvePrivateFunction(module, descriptor, binding.dispose);
  const methods = (binding.methods ?? []).map(method => {
    assertPublicName(method.name);
    return {
      ...method,
      implementation: resolvePrivateFunction(module, descriptor, method.symbol),
    };
  });
  const handles = new WeakMap();

  class ProjectedResource {
    constructor(...args) {
      if (initialize && !initialize()) {
        throw new Error(`failed to initialize runtime for ${descriptor.id}`);
      }
      const handle = construct(...args);
      if (!handle) throw new Error(`failed to construct ${binding.name}`);
      handles.set(this, handle);
    }

    dispose() {
      const handle = handles.get(this);
      if (handle === undefined) return;
      handles.delete(this);
      dispose(handle);
    }
  }

  Object.defineProperty(ProjectedResource, "name", { value: binding.name });
  for (const method of methods) {
    Object.defineProperty(ProjectedResource.prototype, method.name, {
      value(...args) {
        const handle = handles.get(this);
        if (handle === undefined) {
          throw new Error(`${binding.name} has been disposed`);
        }
        return method.implementation(handle, ...args);
      },
    });
  }
  if (Symbol.dispose) {
    Object.defineProperty(ProjectedResource.prototype, Symbol.dispose, {
      value: ProjectedResource.prototype.dispose,
    });
  }

  return ProjectedResource;
};

const projectBindings = (module, descriptor) => {
  const api = Object.create(null);

  for (const binding of descriptor.bindings ?? []) {
    assertPublicName(binding.name);

    if (binding.kind === "function") {
      const implementation = resolvePrivateFunction(
        module,
        descriptor,
        binding.symbol,
      );
      Object.defineProperty(api, binding.name, {
        enumerable: true,
        value: (...args) => implementation(...args),
      });
    } else if (binding.kind === "class") {
      Object.defineProperty(api, binding.name, {
        enumerable: true,
        value: projectClass(module, descriptor, binding),
      });
    } else {
      throw new Error(
        `unsupported binding kind ${binding.kind} in ${descriptor.id}`,
      );
    }
  }

  return Object.freeze(api);
};

export const createLibrarySurface = (module, descriptor) =>
  projectBindings(module, descriptor);

export const createLibraryLoader = module => {
  const loaded = new Map();
  const pending = new Map();

  const load = async (descriptor, ancestry = []) => {
    const key = identity(descriptor);
    if (loaded.has(key)) return loaded.get(key);
    if (ancestry.includes(key)) {
      throw new Error(`library dependency cycle at ${key}`);
    }
    if (pending.has(key)) return pending.get(key);

    const operation = (async () => {
      const dependencyAncestry = [...ancestry, key];
      for (const dependency of descriptor.dependencies) {
        await load(dependency, dependencyAncestry);
      }

      // Emscripten routes dynamic-library names through the module locator.
      // Passing an absolute path here would be prefixed a second time by the
      // default Node locator. The production descriptor loader will build the
      // same name→URL map used by PHP-Wasm's locateFile pattern.
      const path = decodeURIComponent(
        descriptor.sideModule.pathname.split("/").at(-1),
      );

      await module.loadDynamicLibrary(path, {
        global: true,
        loadAsync: true,
        nodelete: true,
      });
      const api = createLibrarySurface(module, descriptor);
      loaded.set(key, api);
      return api;
    })();

    pending.set(key, operation);
    try {
      return await operation;
    } finally {
      pending.delete(key);
    }
  };

  return Object.freeze({ load, loaded });
};
