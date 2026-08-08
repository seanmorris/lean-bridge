const identity = descriptor => `${descriptor.id}#${descriptor.buildHash}`;

export const createLibraryLoader = module => {
  const loaded = new Map();
  const loading = new Set();

  const load = async descriptor => {
    const key = identity(descriptor);
    if (loaded.has(key)) return loaded.get(key);
    if (loading.has(key)) throw new Error(`library dependency cycle at ${key}`);

    loading.add(key);
    try {
      for (const dependency of descriptor.dependencies) {
        await load(dependency);
      }

      // Emscripten routes dynamic-library names through the module locator.
      // Passing an absolute path here would be prefixed a second time by the
      // default Node locator. The production descriptor loader will build the
      // same name→URL map used by PHP-Wasm's locateFile pattern.
      const path = decodeURIComponent(
        descriptor.sideModule.pathname.split("/").at(-1),
      );

      const handle = await module.loadDynamicLibrary(path, {
        global: true,
        loadAsync: true,
        nodelete: true,
      });
      loaded.set(key, handle);
      return handle;
    } finally {
      loading.delete(key);
    }
  };

  return Object.freeze({ load, loaded });
};
