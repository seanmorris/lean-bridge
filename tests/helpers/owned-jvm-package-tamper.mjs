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
	const transfers = Boolean(verified.model.ownedGraph.inputTransfers);
	const anchors = Boolean(verified.model.ownedGraph.resultAnchors);
	const receivers = Boolean(verified.model.ownedGraph.receiverExports);
	const callbacks = Boolean(verified.model.ownedGraph.callbackResultAnchors);
	const mutations = [...transfers ? ["adapter-version", "contract-version", "consumption", "aliases", "native-transfers"] : []
		, ...anchors ? ["native-anchors", "owned-version", "original-anchor", "borrow-expiry", "empty-owner", "canonical-equality", "raw-views", "copy-type", ...transfers ? ["whole-inputs"] : []] : []
		, ...receivers ? ["native-receivers", ...["values", "members", "properties", "owners", "consumingReceivers", "exports"].map(field => "receiver-" + field)] : []
		, ...callbacks ? ["callback-adapter-version", "callback-owned-version"
			, "native-callback-results"
			, ...["schemaVersion", "values", "anchor", "parameterNumbering", "expiration"
				, "descendants", "emptyValues", "independentOwnership", "hostArguments"
				, "hostReply", "hostResultHandoff", "nativeInputs", "nativeClosures"]
				.map(field => "callback-" + field)
			, "callback-signatures", "callback-parameter", "callback-result"] : []
		, "lifetime", "source", "guard", "gmp-receipt", "gmp-source", "library"
		, "unrecorded"];
	for(const mutation of mutations)
	{
		const forged = structuredClone(verified.adapter); let path, original;
		if(mutation === "adapter-version") forged.schemaVersion = 1;
		else if(mutation === "contract-version") forged.jvmValues.schemaVersion = 1;
		else if(mutation === "consumption") forged.jvmValues.inputTransfers.consumption = "after-lean-call";
		else if(mutation === "aliases") forged.jvmValues.inputTransfers.aliases = "wrapper-only";
		else if(mutation === "native-transfers") delete forged.ownedValues.inputTransfers;
		else if(mutation === "native-anchors") delete forged.ownedValues.resultAnchors;
		else if(mutation === "native-receivers") delete forged.ownedValues.receiverExports;
		else if(mutation.startsWith("receiver-")) forged.jvmValues.receiverExports[mutation.slice(9)] = "forged";
		else if(mutation === "callback-adapter-version") forged.schemaVersion = 4;
		else if(mutation === "callback-owned-version") forged.ownedValues.schemaVersion = 5;
		else if(mutation === "native-callback-results") delete forged.ownedValues.callbackResultAnchors;
		else if(mutation === "callback-signatures") forged.jvmValues.callbackResultAnchors.signatures.pop();
		else if(mutation === "callback-parameter") forged.jvmValues.callbackResultAnchors.signatures[0].parameter++;
		else if(mutation === "callback-result") forged.jvmValues.callbackResultAnchors.signatures[0].result += ".forged";
		else if(mutation.startsWith("callback-"))
			forged.jvmValues.callbackResultAnchors[mutation.slice(9)] = mutation === "callback-schemaVersion" ? 0 : "forged";
		else if(mutation === "owned-version") forged.ownedValues.schemaVersion = 3;
		else if(mutation === "original-anchor") forged.jvmValues.resultAnchors.anchor = "fresh-snapshot";
		else if(mutation === "borrow-expiry") forged.jvmValues.resultAnchors.expiration = "wrapper-close";
		else if(mutation === "empty-owner") forged.jvmValues.resultAnchors.emptyValues = "no-owner";
		else if(mutation === "canonical-equality") forged.jvmValues.resultAnchors.resourceEquality = "wrapper-identity";
		else if(mutation === "raw-views") forged.jvmValues.resultAnchors.rawViews = "independent-owner";
		else if(mutation === "copy-type") forged.jvmValues.resultAnchors.copyType = "first-matching-overload";
		else if(mutation === "whole-inputs") forged.jvmValues.inputTransfers.arguments = "ordinary-values";
		else if(mutation === "lifetime") forged.jvmValues.guardSha256 = "0".repeat(64);
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
	for(const mutation of ["managed-source", "compiler-options", "managed-lifetime", ...transfers || callbacks ? ["managed-version"] : []])
	{
		const forged = structuredClone(compiled);
		if(mutation === "managed-source")
		{
			const changed = Buffer.concat([original, Buffer.from("\n// altered public API\n")]);
			await saveLakeFile(jvmRoot, api, changed);
			forged.files[api] = { bytes: changed.length, sha256: sha256(changed) };
		} else if(mutation === "compiler-options")
			forged.kotlin.options = forged.kotlin.options.filter(option => option !== "-Xuse-type-table");
		else if(mutation === "managed-version") forged.schemaVersion = 1;
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
