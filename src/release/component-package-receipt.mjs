import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${label} fields are not closed`);
};

const hash = (value, label) => {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new TypeError(`${label} must be a SHA-256 identity`);
};

export const validateComponentPackageReceipt = receipt => {
  exactKeys(receipt, [
    "schemaVersion", "kind", "component", "source", "bindingIrSha256", "provenanceSha256",
    "componentBundleSha256", "componentIdentitySha256", "componentArtifactSha256",
    "runtimeRequirementSha256", "runtime", "package", "policies", "verificationCommand",
  ], "component package receipt");
  if (receipt.schemaVersion !== 1 || receipt.kind !== "lean-bridge-component-package-receipt") throw new TypeError("component package receipt version or kind is unsupported");
  exactKeys(receipt.component, ["id", "name", "version"], "receipt component");
  exactKeys(receipt.source, ["treeSha256"], "receipt source");
  exactKeys(receipt.runtime, ["package", "archive", "sha256"], "receipt runtime");
  exactKeys(receipt.package, ["package", "archive", "sha256"], "receipt package");
  exactKeys(receipt.policies, ["componentCompiledOnce", "runtimeShared", "runtimeBinaryInComponent", "nativeCallablesOnly"], "receipt policies");
  if (receipt.component.id !== `${receipt.component.name}@${receipt.component.version}`) throw new TypeError("receipt component identity is inconsistent");
  for (const key of [
    "bindingIrSha256", "provenanceSha256", "componentBundleSha256", "componentIdentitySha256",
    "componentArtifactSha256", "runtimeRequirementSha256",
  ]) hash(receipt[key], key);
  hash(receipt.source.treeSha256, "source.treeSha256");
  hash(receipt.runtime.sha256, "runtime.sha256");
  hash(receipt.package.sha256, "package.sha256");
  for (const item of [receipt.runtime, receipt.package]) {
    if (typeof item.package !== "string" || item.package === "" || typeof item.archive !== "string" || item.archive === "" || item.archive.includes("/") || item.archive.includes("..")) {
      throw new TypeError("receipt package coordinates or archive path are invalid");
    }
  }
  if (receipt.package.package !== receipt.component.id) throw new TypeError("receipt package does not name the component");
  if (receipt.policies.componentCompiledOnce !== true || receipt.policies.runtimeShared !== true || receipt.policies.runtimeBinaryInComponent !== false || receipt.policies.nativeCallablesOnly !== true) {
    throw new TypeError("receipt does not preserve component package policies");
  }
  if (typeof receipt.verificationCommand !== "string" || receipt.verificationCommand === "") throw new TypeError("receipt verification command is required");
  return true;
};

export const verifyComponentPackageReceipt = async ({ receiptPath, artifactRoot = null }) => {
  const path = resolve(receiptPath);
  const source = await readFile(path, "utf8");
  const receipt = JSON.parse(source);
  validateComponentPackageReceipt(receipt);
  if (source !== canonicalJson(receipt)) throw new TypeError("component package receipt is not canonical JSON");
  const root = resolve(artifactRoot ?? dirname(path));
  for (const item of [receipt.runtime, receipt.package]) {
    const actual = sha256(await readFile(join(root, item.archive)));
    if (actual !== item.sha256) throw new TypeError(`package archive differs from the receipt: ${item.archive}`);
  }
  return Object.freeze({
    verified: true,
    component: receipt.component.id,
    receiptSha256: sha256(source),
    componentIdentitySha256: receipt.componentIdentitySha256,
    runtime: receipt.runtime.package,
    package: receipt.package.package,
  });
};
