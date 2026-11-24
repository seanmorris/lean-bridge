/** @file Authenticate native PHP and Zend member identities from an import contract. */
import {sha256Text} from "../../binding-ir/sha256.mjs";
import {staticHostMembers} from "../native/static-host-members.mjs";

/**
 * Resolve PHP method names case-insensitively and property names exactly.
 *
 * @param ir - Original, captured PHP import contract.
 */
export const phpHostMembers=ir=>staticHostMembers(ir,"php");

/**
 * Bind the PHP selector rules and extern symbols to the threaded heap. Zend
 * and ordinary JavaScript classes can coexist there without aliasing kinds.
 *
 * @param ir - The author's checked PHP import contract.
 */
export const phpWasmHostMembers=ir=>{
	const {kinds,members}=phpHostMembers(ir);
	return {zend: true,members,kinds: kinds.map(k=>({name: k.name,policy: k.identity,key: sha256Text("php-wasm-zend-v1:"+k.key)}))};
};
