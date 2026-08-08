import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { resolveLockedGraph } from "./contract.mjs";

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
