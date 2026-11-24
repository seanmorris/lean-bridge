/** @file Emit the synchronous entry for the verified CLR host package. */
import { emitWordHostExports } from "../native/word-host-exports.mjs";
import { generateDotnetNativeMembers } from "./host-native-members.mjs";
import { dotnetWorkerKinds } from "./host-members.mjs";

/**
 * Bind the checked CLR member and export tables.
 *
 * @param o - Reconciled CLR export declarations and component identity.
 */
export const generateDotnetHostExports = async o => {
	const model=await generateDotnetNativeMembers(o.ir);
	if(o.dotnetTaskLeases===true) model.workerKeys=dotnetWorkerKinds(o.ir).map(k=>k.hash);
	return emitWordHostExports(o,model,"dotnet");
};
