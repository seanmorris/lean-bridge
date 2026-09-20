/**
 * Independent compile-time rejection catalog for installed .NET compounds.
 *
 * @file
 */
import { checkInstalledDotnetValues } from "./dotnet-copied-install.mjs";

const rejectedSources = {
	"option-payload": "Api.OptionUint32(Option<bool>.Some(true));"
	, "option-unit": "Api.OptionUnit(Option<byte>.Some(0));"
	, "result-payload": 'Api.ResultUint32(Result<string, string>.Ok("wrong"));'
	, "bare-payload": "Api.OptionUint32(42);"
	, "nullable-option": "Api.OptionString(null);"
	, "product-arity": "Api.TupleUint32((1u, 2u, 3u));"
	, "product-array": "Api.TupleUint32(new uint[] { 1, 2 });"
	, "nested-option": "Api.Classify(Option<Unit>.Some(default));"
	, "bare-result": "uint value = Api.ResultUint32(Result<uint, uint>.Ok(1));"
	, "fixed-overflow": "Api.OptionUint8(Option<byte>.Some(256));"
	, "mutable-presence": "var value = Option<uint>.None; value.IsSome = true;"
	, "mutable-branch": "var value = Result<uint, uint>.Ok(1); value.IsOk = false;"
};
const expectedDiagnostics = Object.fromEntries(Object.keys(rejectedSources).map(name => [name, [name === "bare-result" ? "CS0029" : name.startsWith("mutable-") ? "CS0200" : "CS1503"]]));

/**
 * Verify only prepared assemblies, diagnostics and runtime-only deployment.
 *
 * @param options - Completed installed .NET compound fixture.
 */
export const checkInstalledDotnetCompounds = options => checkInstalledDotnetValues({ ...options
	, fixture: { namespace: "LeanBridge.Compounds", success: "compound-dotnet-ok", rejectedSources, expectedDiagnostics } });
