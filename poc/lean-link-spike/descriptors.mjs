import alphaCapsule from "./capsules/alpha.json" with { type: "json" };
import betaCapsule from "./capsules/beta.json" with { type: "json" };
import gammaCapsule from "./capsules/gamma.json" with { type: "json" };
import alphaBindingIr from "./bindings/alpha.binding-ir.json" with { type: "json" };
import alphaProjection from "./bindings/alpha.javascript-projection.json" with { type: "json" };
import graphLock from "./graph-lock.json" with { type: "json" };
import { alphaPrivateAbi } from "./private-abi.mjs";

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
  assertBindingIdentity(capsule.id, alphaProjection.bindingIrSha256);
  return Object.freeze({
    id: capsule.id,
    buildHash,
    capsule,
    integrity: sideArtifact(capsule, target).sha256,
    dependencies: Object.freeze([]),
    sideModule,
    bindingIr: alphaBindingIr,
    bindingIrSha256: alphaProjection.bindingIrSha256,
    privateAbi: alphaPrivateAbi,
    bindings: alphaProjection.bindings,
  });
};

export const alpha = createAlphaDescriptor({
  sideModule: new URL(
    "../../build/lean-link-spike/lazy/alpha.so.wasm",
    import.meta.url,
  ),
});

export const alphaBrowser = createAlphaDescriptor({
  sideModule: new URL(
    "../../build/lean-link-spike/browser/alpha.so.wasm",
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
