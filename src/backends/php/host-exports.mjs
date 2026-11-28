/** @file Bind native PHP host members and public Lean exports to the same private frame ABI. */
import { emitWordHostExports } from "../native/word-host-exports.mjs";
import { emitWordHostMembers } from "../native/word-host-members.mjs";
import { phpHostMembers } from "./host-members.mjs";

/**
 * Emit a PHP-specific entry namespace over the shared word ABI.
 *
 * @param options - Compiler-reconciled native PHP declarations and component identity.
 */
export const generatePhpHostExports = options => {
	const shape = phpHostMembers(options.ir);
	const model = { ...shape, kinds: shape.kinds.map(k => ({ ...k, strong: k.identity === "strong-canonical" })) };
	return emitWordHostExports(options, emitWordHostMembers(options.ir, model, "php"), "php");
};
