/** @file Check both interfaces in the installed world's direct-function contract. */
import assert from "node:assert/strict";

/**
 * Follow the callback resource from visit-quote to the borrowed scalar closure
 * it receives. The native import and public API must agree on each signature.
 *
 * @param source - Installed (or freshly compiled) WIT source.
 */
export const assertDirectWitWorld=source=>{
	const lines=source.split("\n").map(s=>s.trim());
	const requirePair=signature=>assert.equal(lines.filter(s=>s===signature).length,2,signature);
	const visit=lines.find(l=>l.startsWith("visit-quote: "));
	const outer=/^visit-quote: func\(arg0: u32, arg1: borrow<(identity-[a-z0-9-]+)>, arg2: u32\) -> u32;$/u.exec(visit);
	assert.ok(outer,"visit-quote must borrow its visitor");requirePair(visit);
	const prefix="invoke-"+outer[1]+": func(self: borrow<"+outer[1]+">, arg0: ";
	const call=lines.find(l=>l.startsWith(prefix));
	const inner=/^borrow<(identity-[a-z0-9-]+)>, arg1: u32\) -> u32;$/u.exec(call?.slice(prefix.length));
	assert.ok(inner,"the visitor must borrow a function directly");requirePair(call);
	assert.notEqual(inner[1],outer[1]);
	requirePair("invoke-"+inner[1]+": func(self: borrow<"+inner[1]+">, arg0: u32) -> u32;");
};
