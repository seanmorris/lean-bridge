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

export const createBetaDescriptor = ({
  id,
  buildHash,
  sideModule,
  alpha: alphaDependency,
}) => Object.freeze({
  id,
  buildHash,
  dependencies: Object.freeze([alphaDependency]),
  sideModule,
  bindings: Object.freeze([]),
});

export const beta = createBetaDescriptor({
  id: "poc/lean-beta@0.0.0",
  buildHash: "lean-link-spike-beta",
  sideModule: new URL(
    "../../build/lean-link-spike/lazy/beta.so.wasm",
    import.meta.url,
  ),
  alpha,
});

export const createGammaDescriptor = ({
  id,
  buildHash,
  sideModule,
  beta: betaDependency,
}) => Object.freeze({
  id,
  buildHash,
  dependencies: Object.freeze([betaDependency]),
  sideModule,
  bindings: Object.freeze([]),
});

export const gamma = createGammaDescriptor({
  id: "poc/lean-gamma@0.0.0",
  buildHash: "lean-link-spike-gamma",
  sideModule: new URL(
    "../../build/lean-link-spike/lazy/gamma.so.wasm",
    import.meta.url,
  ),
  beta,
});
