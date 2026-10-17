/**
 * Implements the package audit module in the Rust backend.
 *
 * @file
 */

import { hashBindingIr } from "../../binding-ir/canonical.mjs";

/**
 * Reports Rust package audit failures with stable machine-readable codes and structured diagnostic context.
 */
export class RustPackageAuditError extends Error
{
	/**
   * Initializes the error used to report Rust package audit failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "RustPackageAuditError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new RustPackageAuditError(code, message, details);
};

/**
 * Checks rust package and returns structured evidence instead of relying on prose diagnostics in the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param files - Generated file map or inventory checked for required paths, content, and public-surface constraints.
 */
export const auditRustPackage = (ir, files) => {
	let manifest;
	try
	{
		manifest = JSON.parse(files["binding-manifest.json"]);
	} catch
	{
		fail("invalid-manifest", "the generated Rust binding manifest is missing or invalid");
	}
	if(manifest.bindingIrSha256 !== hashBindingIr(ir))
	{
		fail("binding-ir-drift", "the generated Rust package names the wrong Binding IR hash", {
			expected: hashBindingIr(ir)
			, actual: manifest.bindingIrSha256
		});
	}
	for(const path of manifest.files ?? [])
	{
		if(typeof files[path] !== "string")
		{
			fail("missing-file", `the generated Rust package is missing ${path}`, { path });
		}
	}
	const source = files[manifest.publicModule];
	if(typeof source !== "string") fail("missing-public-module", "the Rust crate has no public module");
	if(/\b(?:ccall|cwrap|WebAssembly|_bridge_)\b/i.test(source))
	{
		fail("private-abi-leak", "the Rust module exposes private bridge machinery");
	}
	if(/pub\s+(?:fn|struct|type|trait)\s+(?:invoke|dispatch|handle|token)\b/i.test(source))
	{
		fail("generic-dispatch", "the Rust public surface exposes a dispatcher or identity token");
	}
	if(!Array.isArray(manifest.capabilityGaps))
	{
		fail("missing-capability-gaps", "the Rust manifest does not declare its capability gaps");
	}
	return Object.freeze({
		bindingIrSha256: manifest.bindingIrSha256
		, exports: Object.freeze([...(manifest.exports ?? [])])
		, capabilityGaps: Object.freeze(structuredClone(manifest.capabilityGaps))
	});
};
