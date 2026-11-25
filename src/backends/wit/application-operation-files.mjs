/** @file Stage the matched WIT definition, Wasm facade and native linker as one build input. */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../capsule/node.mjs";
import { witApplicationOperations } from "./application-operations.mjs";
import { witOperationFacade } from "./application-operation-facade.mjs";
import { witTurnMembers } from "./application-turn-members.mjs";
import { witTurnSyncGraph } from "./application-turn-sync-graph.mjs";
import { witTurnSyncHost } from "./application-turn-sync-host.mjs";
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
	const sync=options.turn?witTurnSyncGraph(operations,scratch):null;
	const {publicName,nativeName,nativeType,methods}=operations;
	return {
		"operations.wit": operations.wit
		, ...options.turn?{"turn-members.wat": witTurnMembers(options.descriptor,scratch),"application-turn-sync-host.h": witTurnSyncHost({...options,operations}),"turn-native.wat": sync.wat,"turn-sync-ports.wat": sync.ports}:{}
		, "api.wit": operations.publicWit
		, "operations.wat": witOperationFacade(operations,scratch)
		, "application-operations.h": witOperationHost({...options,operations})
		, "operations-layout.json": canonicalJson({schemaVersion: 1,publicName,nativeName,nativeType,methods: methods.filter(m=>!m.role || m.role==="make").map(m=>({name: m.name,declaration: m.entry.declaration,effect: m.entry.effect}))})
	};
};
