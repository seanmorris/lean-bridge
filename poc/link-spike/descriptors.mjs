export const alpha = Object.freeze({
  id: "poc/alpha@0.0.0",
  buildHash: "link-spike-alpha",
  dependencies: [],
  sideModule: new URL("../../build/link-spike/lazy/alpha.so.wasm", import.meta.url),
  bindings: Object.freeze([
    Object.freeze({
      kind: "function",
      name: "add",
      symbol: "_bridge_call_alpha",
    }),
  ]),
});

export const beta = Object.freeze({
  id: "poc/beta@0.0.0",
  buildHash: "link-spike-beta",
  dependencies: [alpha],
  sideModule: new URL("../../build/link-spike/lazy/beta.so.wasm", import.meta.url),
  bindings: Object.freeze([
    Object.freeze({
      kind: "function",
      name: "chain",
      symbol: "_bridge_call_beta",
    }),
  ]),
});
