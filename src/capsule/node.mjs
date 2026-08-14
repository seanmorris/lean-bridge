/**
 * Implements the Node module in the capsule subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { hashBindingIr, parseBindingIr } from "../binding-ir/canonical.mjs";
import { CapsuleContractError, resolveLockedGraph } from "./contract.mjs";

/**
 * Computes the stable SHA-256 identity for supplied bytes so the deterministic capsule resolver can detect byte drift.
 *
 * @param contents - Bytes or text whose SHA-256 identity is calculated.
 */
export const sha256 = contents =>
	createHash("sha256").update(contents).digest("hex");

/**
 * Loads locked graph, verifies its structure and identity, and returns it to the deterministic capsule resolver.
 *
 * @param root0 - Named inputs and dependency overrides used to read locked graph.
 * @param root0.lockPath - Filesystem path to the lock.
 * @param root0.profile - Named runtime, graph, transport, or measurement profile selecting the closed behavior to execute.
 * @param root0.roots - Root capsule identifiers from which locked dependency traversal begins.
 */
export const readLockedGraph = async ({ lockPath, profile, roots }) => {
	const absoluteLockPath = resolve(lockPath);
	const base = dirname(absoluteLockPath);
	const lock = JSON.parse(await readFile(absoluteLockPath, "utf8"));
	const capsules = [];
	const capsuleDigests = new Map();

	for(const library of lock.libraries ?? [])
	{
		const contents = await readFile(resolve(base, library.capsule.path));
		const capsule = JSON.parse(contents.toString("utf8"));
		capsules.push(capsule);
		capsuleDigests.set(library.id, sha256(contents));
		if(library.bindingIr)
		{
			const bindingContents = await readFile(resolve(base, library.bindingIr.path));
			const actualRaw = sha256(bindingContents);
			if(actualRaw !== library.bindingIr.sha256)
			{
				throw new CapsuleContractError(
					"binding-ir-integrity-mismatch",
					`Binding IR integrity mismatch for ${library.id}`,
					{
						package: library.id
						, path: library.bindingIr.path
						, expected: library.bindingIr.sha256
						, actual: actualRaw
					},
				);
			}
			const actualSemantic = hashBindingIr(parseBindingIr(bindingContents.toString("utf8")));
			if(actualSemantic !== library.bindingIr.semanticSha256)
			{
				throw new CapsuleContractError(
					"binding-ir-semantic-mismatch",
					`Binding IR semantic identity mismatch for ${library.id}`,
					{
						package: library.id
						, path: library.bindingIr.path
						, expected: library.bindingIr.semanticSha256
						, actual: actualSemantic
					},
				);
			}
		}
	}

	return resolveLockedGraph({ lock, capsules, capsuleDigests, profile, roots });
};

const canonicalValue = value => {
	if(Array.isArray(value)) return value.map(canonicalValue);
	if(value !== null && typeof value === "object")
	{
		return Object.fromEntries(
			Object.keys(value)
        .sort()
        .map(key => [key, canonicalValue(value[key])]),
		);
	}
	return value;
};

/**
 * Serializes canonical as deterministic, newline-terminated JSON for the deterministic capsule resolver.
 *
 * @param value - JSON-compatible capsule data normalized before deterministic serialization.
 */
export const canonicalJson = value => `${JSON.stringify(canonicalValue(value), null, 2)}\n`;
