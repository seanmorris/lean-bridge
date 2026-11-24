/** @file Emit the synchronous entry for the verified CLR host package. */
import { emitWordHostExports } from "../native/word-host-exports.mjs";
import { generateDotnetNativeMembers } from "./host-native-members.mjs";

/**
 * Bind the checked CLR member and export tables.
 *
 * @param o - Reconciled CLR export declarations and component identity.
 */
export const generateDotnetHostExports = async o => emitWordHostExports(o, await generateDotnetNativeMembers(o.ir), "dotnet");
