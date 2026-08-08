export const alpha = Object.freeze({
  id: "poc/alpha@0.0.0",
  buildHash: "link-spike-alpha",
  dependencies: [],
  sideModule: new URL("../../build/link-spike/lazy/alpha.so.wasm", import.meta.url),
});

export const beta = Object.freeze({
  id: "poc/beta@0.0.0",
  buildHash: "link-spike-beta",
  dependencies: [alpha],
  sideModule: new URL("../../build/link-spike/lazy/beta.so.wasm", import.meta.url),
});
