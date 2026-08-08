export const createAlphaDescriptor = ({ id, buildHash, sideModule }) => Object.freeze({
  id,
  buildHash,
  dependencies: Object.freeze([]),
  sideModule,
  bindings: Object.freeze([
    Object.freeze({
      kind: "class",
      name: "Box",
      initialize: "_bridge_lean_runtime_init",
      constructor: "_bridge_lean_alpha_make",
      dispose: "_bridge_lean_release",
      methods: Object.freeze([
        Object.freeze({
          name: "read",
          symbol: "_bridge_lean_alpha_read",
        }),
      ]),
    }),
  ]),
});

export const alpha = createAlphaDescriptor({
  id: "poc/lean-alpha@0.0.0",
  buildHash: "lean-link-spike-alpha",
  sideModule: new URL(
    "../../build/lean-link-spike/lazy/alpha.so.wasm",
    import.meta.url,
  ),
});
