export const createDeterministicFinalizerControls = () => {
  const references = [];
  let callback;
  let holding;

  return Object.freeze({
    loaderOptions: Object.freeze({
      createWeakReference(target) {
        let current = target;
        const reference = {
          deref: () => current,
          clear: () => { current = undefined; },
        };
        references.push(reference);
        return reference;
      },
      createFinalizationRegistry(finalize) {
        callback = finalize;
        return {
          register(_target, value) { holding = value; },
          unregister() { holding = undefined; return true; },
        };
      },
    }),
    queueLastResource() {
      if (!callback || !holding || references.length === 0) {
        throw new Error("deterministic finalizer controls have no registered resource");
      }
      references.at(-1).clear();
      callback(holding);
    },
    nativeLiveResources(module) {
      const diagnostic = module._bridge_lean_live_handles;
      if (typeof diagnostic !== "function") {
        throw new Error("the lifecycle fixture requires the private live-handle diagnostic");
      }
      return diagnostic();
    },
  });
};
