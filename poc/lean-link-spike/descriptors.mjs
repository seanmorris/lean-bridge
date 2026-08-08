import alphaCapsule from "./capsules/alpha.json" with { type: "json" };
import betaCapsule from "./capsules/beta.json" with { type: "json" };
import gammaCapsule from "./capsules/gamma.json" with { type: "json" };
import graphLock from "./graph-lock.json" with { type: "json" };

const contentHash = id => {
  const library = graphLock.libraries.find(candidate => candidate.id === id);
  if (!library) throw new Error(`missing locked capsule ${id}`);
  return library.capsule.sha256;
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
}) => Object.freeze({
  id: capsule.id,
  buildHash,
  capsule,
  integrity: sideArtifact(capsule, target).sha256,
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
