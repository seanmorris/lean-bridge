/**
 * Independently specified compiler rejections for installed .NET Lists.
 *
 * @file
 */
import { checkInstalledDotnetValues } from "./dotnet-copied-install.mjs";

const rejectedSources = {
	"element-type": "Api.ReverseUint32(new bool[] { true });"
	, "unit-element": "Api.ReverseUnit(new byte[] { 0 });"
	, "scalar-container": "Api.ReverseUint32(1u);"
	, "wrong-nesting": "Api.Mix(new uint[] { 1 });"
	, "option-presence": "Api.Nest(new Result<Unit[], string>[] { Result<Unit[], string>.Ok(new Unit[1]) });"
	, "product-arity": "Api.Swap(Result<(System.Numerics.BigInteger[], uint[], uint[]), string[]>.Ok((new System.Numerics.BigInteger[0], new uint[0], new uint[0])));"
	, "enumerable-container": "Api.ReverseUint32(new System.Collections.Generic.List<uint> { 1 });"
	, "scalar-result": "uint value = Api.ReverseUint32(new uint[] { 1 });"
	, "wrong-record-field": "var value = default(Packet)!; _ = value with { Sequences = new uint[] { 1 } };"
	, "fixed-overflow": "Api.ReverseUint8(new byte[] { 256 });"
	, "platform-overflow": "Api.ReverseUsize(new ulong[] { 18446744073709551616UL });"
	, "nullable-option": "Api.Nest(null);"
};
const codes = { "scalar-result": "CS0029", "wrong-record-field": "CS0029", "fixed-overflow": "CS0031", "platform-overflow": "CS1021" };
const expectedDiagnostics = Object.fromEntries(Object.keys(rejectedSources).map(name => [name, [codes[name] ?? "CS1503"]]));

/**
 * Check prepared assemblies, expected diagnostics and SDK-free deployments.
 *
 * @param options - Completed installed .NET List fixture.
 */
export const checkInstalledDotnetLists = options => checkInstalledDotnetValues({ ...options
	, fixture: { namespace: "LeanBridge.Lists", success: "list-dotnet-ok", rejectedSources, expectedDiagnostics } });
