import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { CapsuleContractError, resolveLockedGraph } from "./contract.mjs";

export const sha256 = contents =>
  createHash("sha256").update(contents).digest("hex");

export const readLockedGraph = async ({ lockPath, profile, roots }) => {
  const absoluteLockPath = resolve(lockPath);
  const base = dirname(absoluteLockPath);
  const lock = JSON.parse(await readFile(absoluteLockPath, "utf8"));
  const capsules = [];
  const capsuleDigests = new Map();

  for (const library of lock.libraries ?? []) {
    const contents = await readFile(resolve(base, library.capsule.path));
    const capsule = JSON.parse(contents.toString("utf8"));
    capsules.push(capsule);
    capsuleDigests.set(library.id, sha256(contents));
    if (library.bindingIr) {
      const bindingContents = await readFile(resolve(base, library.bindingIr.path));
      const actualRaw = sha256(bindingContents);
      if (actualRaw !== library.bindingIr.sha256) {
        throw new CapsuleContractError(
          "binding-ir-integrity-mismatch",
          `Binding IR integrity mismatch for ${library.id}`,
          {
            package: library.id,
            path: library.bindingIr.path,
            expected: library.bindingIr.sha256,
            actual: actualRaw,
          },
        );
      }
      const actualSemantic = hashBindingIr(parseBindingIr(bindingContents.toString("utf8")));
      if (actualSemantic !== library.bindingIr.semanticSha256) {
        throw new CapsuleContractError(
          "binding-ir-semantic-mismatch",
          `Binding IR semantic identity mismatch for ${library.id}`,
          {
            package: library.id,
            path: library.bindingIr.path,
            expected: library.bindingIr.semanticSha256,
            actual: actualSemantic,
          },
        );
      }
    }
  }

  return resolveLockedGraph({ lock, capsules, capsuleDigests, profile, roots });
};

const canonicalValue = value => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalValue(value[key])]),
    );
  }
  return value;
};

export const canonicalJson = value => `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
