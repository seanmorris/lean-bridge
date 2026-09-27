/**
 * Reject altered generated sources, lifetime metadata and native dependencies.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { packageOwnedMaven } from "../../src/release/owned-maven.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Refresh outer hashes where appropriate so semantic authentication is tested.
 *
 * @param options - Real compiled producer roots and Maven settings.
 * @param verified - Independently authenticated native receipts and types.
 * @param compiled - Original Java/Kotlin compilation inventory.
 */
export const rejectOwnedJvmPackageMutations = async (options, verified, compiled) => {
	const { adapterRoot, jvmRoot } = options;
	const mutations = ["lifetime", "source", "guard", "gmp-receipt", "gmp-source", "library", "unrecorded"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "lifetime") forged.jvmValues.guardSha256 = "0".repeat(64);
		else
		{
			path = ({ source: `src/${verified.prefix}-jvm.c`
				, guard: `src/${verified.prefix}-jvm-thread-exit.cpp`
				, "gmp-receipt": "gmp/share/lean-bridge/gmp.json"
				, "gmp-source": "gmp/share/lean-bridge/sources/gmp-6.3.0.tar.xz"
				, library: `lib/${verified.adapter.library}`
				, unrecorded: "unexpected.txt" })[mutation];
			original = mutation === "unrecorded" ? null : await readFile(join(adapterRoot, path));
			const changed = mutation === "gmp-receipt" ? Buffer.from(canonicalJson({ ...JSON.parse(original), binding: "global-symbols" }))
				: Buffer.concat([original ?? Buffer.alloc(0), Buffer.from("\n/* changed projection */\n")]);
			await saveLakeFile(adapterRoot, path, changed);
			if(!["library", "unrecorded"].includes(mutation)) forged.files[path] = { bytes: changed.length, sha256: sha256(changed) };
		}
		try
		{
			await saveLakeFile(adapterRoot, "native-jvm-adapter.json", canonicalJson(forged));
			await assert.rejects(packageOwnedMaven({ ...options, working: join(options.working, "reject-" + mutation) }));
		} finally
		{
			if(path)
			{
				if(original) await saveLakeFile(adapterRoot, path, original);
				else await rm(join(adapterRoot, path));
			}
			await saveLakeFile(adapterRoot, "native-jvm-adapter.json", canonicalJson(verified.adapter));
		}
	}
	const api = `src/main/java/${verified.projection.namespace.replaceAll(".", "/")}/Api.java`;
	const original = await readFile(join(jvmRoot, api));
	for(const mutation of ["managed-source", "compiler-options", "managed-lifetime"])
	{
		const forged = structuredClone(compiled);
		if(mutation === "managed-source")
		{
			const changed = Buffer.concat([original, Buffer.from("\n// altered public API\n")]);
			await saveLakeFile(jvmRoot, api, changed);
			forged.files[api] = { bytes: changed.length, sha256: sha256(changed) };
		} else if(mutation === "compiler-options")
			forged.kotlin.options = forged.kotlin.options.filter(option => option !== "-Xuse-type-table");
		else forged.ownedValues.guardSha256 = "0".repeat(64);
		try
		{
			await saveLakeFile(jvmRoot, "native-jvm.json", canonicalJson(forged));
			await assert.rejects(packageOwnedMaven({ ...options, working: join(options.working, "reject-" + mutation) }));
		} finally
		{
			await saveLakeFile(jvmRoot, api, original);
			await saveLakeFile(jvmRoot, "native-jvm.json", canonicalJson(compiled));
		}
		mutations.push(mutation);
	}
	return mutations;
};
