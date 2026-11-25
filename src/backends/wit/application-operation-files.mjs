/** @file Stage the matched WIT definition, Wasm facade and native linker as one build input. */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../capsule/node.mjs";
import { witApplicationOperations } from "./application-operations.mjs";
import { witOperationFacade } from "./application-operation-facade.mjs";
import { witOperationHost } from "./application-operation-host.mjs";

/**
 * Emit all sides from the same checked operation list, before computing the
 * component fingerprint. Never select only the operations used by a demo.
 *
 * @param options - Original IR, checked synchronous exports and package coordinates.
 */
export const witOperationFiles=async options=>{
	const operations=witApplicationOperations(options);
	const scratch=await readFile(new URL("./application-operation-scratch.wat",import.meta.url),"utf8");
	const {publicName,nativeName,nativeType,methods}=operations;
	return {
		"operations.wit": operations.wit
		, "api.wit": operations.publicWit
		, "operations.wat": witOperationFacade(operations,scratch)
		, "application-operations.h": witOperationHost({...options,operations})
		, "operations-layout.json": canonicalJson({schemaVersion: 1,publicName,nativeName,nativeType,methods: methods.map(m=>({name: m.name,declaration: m.entry.declaration,effect: m.entry.effect}))})
	};
};
