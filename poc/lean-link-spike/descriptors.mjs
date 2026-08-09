import alphaCapsule from "./capsules/alpha.json" with { type: "json" };
import betaCapsule from "./capsules/beta.json" with { type: "json" };
import gammaCapsule from "./capsules/gamma.json" with { type: "json" };
import alphaBindingIr from "./bindings/alpha.binding-ir.json" with { type: "json" };
import graphLock from "./graph-lock.json" with { type: "json" };

import { compileJavaScriptProjection } from "../../src/backends/javascript/projection.mjs";

const alphaPrivateAbi = Object.freeze({
  schemaVersion: 1,
  initialize: "_bridge_lean_runtime_init",
  declarations: Object.freeze({
    "lean:Alpha.box": Object.freeze({
      symbol: "_bridge_lean_alpha_make",
      adapter: null,
    }),
    "lean:Alpha.Box.read": Object.freeze({
      symbol: "_bridge_lean_alpha_read",
      adapter: null,
    }),
    "bridge:Alpha.Box.identity": Object.freeze({
      symbol: "_bridge_lean_handle_identity",
      adapter: null,
    }),
    "lean:Alpha.roundTrip": Object.freeze({
      symbol: "_bridge_lean_alpha_round_trip",
      adapter: Object.freeze({
        kind: "value-frame-v1",
        abiVersion: 1,
        maxCopyBytes: 1024 * 1024,
        maxArrayLength: 64 * 1024,
      }),
    }),
    "lean:Alpha.withCallback": Object.freeze({
      symbol: "_bridge_lean_alpha_with_callback",
      adapter: Object.freeze({
        kind: "callback-call-v1",
        abiVersion: 1,
        callbackParameter: "transform",
        maxDepth: 64,
      }),
    }),
  }),
  resources: Object.freeze({
    "lean:Alpha.Box": Object.freeze({
      side: "lean",
      kind: 1,
      dispose: "_bridge_lean_release",
    }),
  }),
});

const contentHash = id => {
  const library = graphLock.libraries.find(candidate => candidate.id === id);
  if (!library) throw new Error(`missing locked capsule ${id}`);
  return library.capsule.sha256;
};

const assertBindingIdentity = (id, semanticSha256) => {
  const library = graphLock.libraries.find(candidate => candidate.id === id);
  if (!library?.bindingIr) throw new Error(`${id} has no locked Binding IR`);
  if (library.bindingIr.semanticSha256 !== semanticSha256) {
    throw new Error(`${id} Binding IR does not match the graph lock`);
  }
};

const assertDependency = (capsule, dependency, index) => {
  const expected = capsule.dependencies[index]?.id;
  if (dependency?.id !== expected) {
    throw new Error(
      `${capsule.id} requires dependency ${expected}; received ${dependency?.id ?? "nothing"}`,
    );
  }
};

const sideArtifact = (capsule, target) => {
  const artifacts = capsule.artifacts.targets.find(
    candidate => candidate.target === target,
  );
  if (!artifacts) throw new Error(`${capsule.id} has no ${target} artifacts`);
  return artifacts.sideModule;
};

export const createAlphaDescriptor = ({
  sideModule,
  capsule = alphaCapsule,
  target = "browser",
  buildHash = contentHash(capsule.id),
}) => {
  const projection = compileJavaScriptProjection(alphaBindingIr, alphaPrivateAbi);
  assertBindingIdentity(capsule.id, projection.bindingIrSha256);
  return Object.freeze({
    id: capsule.id,
    buildHash,
    capsule,
    integrity: sideArtifact(capsule, target).sha256,
    dependencies: Object.freeze([]),
    sideModule,
    bindingIr: alphaBindingIr,
    bindingIrSha256: projection.bindingIrSha256,
    privateAbi: alphaPrivateAbi,
    bindings: projection.bindings,
  });
};

export const alpha = createAlphaDescriptor({
  sideModule: new URL(
    "../../build/lean-link-spike/lazy/alpha.so.wasm",
    import.meta.url,
  ),
});

export const createBetaDescriptor = ({
  sideModule,
  alpha: alphaDependency,
  capsule = betaCapsule,
  target = "browser",
  buildHash = contentHash(capsule.id),
}) => {
  assertDependency(capsule, alphaDependency, 0);
  return Object.freeze({
    id: capsule.id,
    buildHash,
    capsule,
    integrity: sideArtifact(capsule, target).sha256,
    dependencies: Object.freeze([alphaDependency]),
    sideModule,
    bindings: Object.freeze([]),
  });
};

export const beta = createBetaDescriptor({
  sideModule: new URL(
    "../../build/lean-link-spike/lazy/beta.so.wasm",
    import.meta.url,
  ),
  alpha,
});

export const createGammaDescriptor = ({
  sideModule,
  beta: betaDependency,
  capsule = gammaCapsule,
  target = "browser",
  buildHash = contentHash(capsule.id),
}) => {
  assertDependency(capsule, betaDependency, 0);
  return Object.freeze({
    id: capsule.id,
    buildHash,
    capsule,
    integrity: sideArtifact(capsule, target).sha256,
    dependencies: Object.freeze([betaDependency]),
    sideModule,
    bindings: Object.freeze([]),
  });
};

export const gamma = createGammaDescriptor({
  sideModule: new URL(
    "../../build/lean-link-spike/lazy/gamma.so.wasm",
    import.meta.url,
  ),
  beta,
});
