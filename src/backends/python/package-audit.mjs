import { hashBindingIr } from "../../binding-ir/canonical.mjs";

/**
 * Reports Python package audit failures with stable machine-readable codes and structured diagnostic context.
 */
export class PythonPackageAuditError extends Error
{
	/**
   * Initializes the error used to report Python package audit failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PythonPackageAuditError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new PythonPackageAuditError(code, message, details);
};

/**
 * Checks python package and returns structured evidence instead of relying on prose diagnostics in the generated native-language binding pipeline.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param files - Generated file map or inventory checked for required paths, content, and public-surface constraints.
 */
export const auditPythonPackage = (ir, files) => {
	let manifest;
	try
	{
		manifest = JSON.parse(files["binding-manifest.json"]);
	} catch
	{
		fail("invalid-manifest", "the generated Python binding manifest is missing or invalid");
	}
	if(manifest.bindingIrSha256 !== hashBindingIr(ir))
	{
		fail("binding-ir-drift", "the generated Python package names the wrong Binding IR hash", {
			expected: hashBindingIr(ir)
			, actual: manifest.bindingIrSha256
		});
	}
	for(const path of manifest.files ?? [])
	{
		if(typeof files[path] !== "string")
		{
			fail("missing-file", `the generated Python package is missing ${path}`, { path });
		}
	}
	const source = files[manifest.publicModule];
	const stub = files[manifest.typeStub];
	if(typeof source !== "string" || typeof stub !== "string")
	{
		fail("missing-public-surface", "the generated Python package lacks source or stubs");
	}
	if(/\b(?:ccall|cwrap|WebAssembly|_bridge_)\b/i.test(`${source}\n${stub}`))
	{
		fail("private-abi-leak", "the Python package exposes private bridge machinery");
	}
	if(/^\s*(?:def|class)\s+(?:invoke|dispatch|handle|token)\b/im.test(source))
	{
		fail("generic-dispatch", "the Python package exposes a dispatcher or identity token");
	}
	if(/\bAny\b|\b(?:handle|token)\s*:/i.test(stub))
	{
		fail("untyped-public-api", "the Python stub exposes Any or a raw identity value");
	}
	const allMatch = source.match(/__all__ = \(([^]*?)\)\n/);
	const exported = allMatch
		? [...allMatch[1].matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map(match => match[1])
		: [];
	if(JSON.stringify(exported) !== JSON.stringify(manifest.exports))
	{
		fail("public-export-drift", "Python __all__ differs from the binding manifest", {
			expected: manifest.exports
			, actual: exported
		});
	}
	return Object.freeze({
		bindingIrSha256: manifest.bindingIrSha256
		, exports: Object.freeze(exported)
		, capabilityGaps: Object.freeze(structuredClone(manifest.capabilityGaps ?? []))
	});
};
