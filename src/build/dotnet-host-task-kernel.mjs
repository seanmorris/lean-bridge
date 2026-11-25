/** @file Compile the owner-scoped CLR worker ABI beside the checked CLR member provider. */
import { dotnetWorkerKinds } from "../backends/dotnet/host-members.mjs";
import { sha256 } from "../capsule/node.mjs";
import { wordHostTaskKernel } from "./word-host-task-kernel.mjs";
export { stageWordHostTasks as stageDotnetHostTasks } from "./word-host-task-kernel.mjs";

/**
 * Generate both sides from the verified CLR import source and real compiler evidence.
 *
 * @param options - Reconciled entries, captured host imports and verified Lean runtime.
 */
export const dotnetHostTaskKernel = async options => {
	const {checked,ir,name,modules,runtimeIdentity}=options;
	const selection=checked.evidence.selection;
	if(selection.dotnetTaskObjects!==true || selection.hostModule!=="LeanBridge.Host.Dotnet") throw new TypeError("Missing CLR worker object evidence");
	const entries=checked.entries.filter(e=>e.delivery), dotnetHostKinds=dotnetWorkerKinds(ir);
	return wordHostTaskKernel({name: "clr-"+sha256(name),modules,entries,runtimeIdentity,adapter: {dotnetDelivery: true,dotnetHostKinds},layout: {dotnetHostKinds}});
};
