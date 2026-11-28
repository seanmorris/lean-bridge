/** @file Emit native CLR members using their verified dispatch table. */
import { emitWordHostMembers, wordHostCarrier } from "../native/word-host-members.mjs";
import { generateDotnetHostMembers } from "./host-members.mjs";

/** Preserve the native CLR generator's carrier API. */
export const dotnetHostCarrier = wordHostCarrier;

/**
 * Produce the exact C signatures used by the CLR component.
 *
 * @param ir - Checked CLR members and their ownership contracts.
 */
export const generateDotnetNativeMembers = async ir => emitWordHostMembers(ir, await generateDotnetHostMembers(ir), "dotnet");
