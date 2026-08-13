import { hashBindingIr } from "../../binding-ir/canonical.mjs";

/**
 * Reports C package audit failures with stable machine-readable codes and structured diagnostic context.
 */
export class CPackageAuditError extends Error
{
	/**
   * Initializes the error used to report C package audit failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "CPackageAuditError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new CPackageAuditError(code, message, details);
};

/**
 * Checks C package and returns structured evidence instead of relying on prose diagnostics in the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param files - Generated file map or inventory checked for required paths, content, and public-surface constraints.
 */
export const auditCPackage = (ir, files) => {
	const manifestText = files["binding-manifest.json"];
	if(typeof manifestText !== "string")
	{
		fail("missing-manifest", "the generated C package has no binding manifest");
	}
	let manifest;
	try
	{
		manifest = JSON.parse(manifestText);
	} catch
	{
		fail("invalid-manifest", "the generated C binding manifest is not valid JSON");
	}
	if(manifest.bindingIrSha256 !== hashBindingIr(ir))
	{
		fail("binding-ir-drift", "the generated C package names the wrong Binding IR hash", {
			expected: hashBindingIr(ir)
			, actual: manifest.bindingIrSha256
		});
	}
	for(const path of manifest.files ?? [])
	{
		if(typeof files[path] !== "string")
		{
			fail("missing-file", `the generated C package is missing ${path}`, { path });
		}
	}
	const header = files[manifest.publicHeader];
	if(typeof header !== "string")
	{
		fail("missing-public-header", "the generated C package has no public header");
	}
	const forbidden = [
		["generic-dispatch", /\b(?:ccall|cwrap|invoke|dispatch)\b/i]
		, ["private-symbol", /_bridge_|WebAssembly/i]
		, ["raw-handle", /\b(?:uintptr_t|handle|token)\b/i]
	];
	for(const [code, pattern] of forbidden)
	{
		if(pattern.test(header))
		{
			fail(code, `the public C header exposes ${code.replaceAll("-", " ")}`, {
				publicHeader: manifest.publicHeader
			});
		}
	}
	const source = files[manifest.implementation];
	if(/\b(?:ccall|cwrap)\b/i.test(source))
	{
		fail("generic-dispatch", "the generated C implementation contains a generic dispatcher");
	}
	return Object.freeze({
		bindingIrSha256: manifest.bindingIrSha256
		, exports: Object.freeze([...(manifest.exports ?? [])])
		, publicHeader: manifest.publicHeader
	});
};
