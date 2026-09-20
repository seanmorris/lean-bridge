/**
 * Installed NuGet callback compiler rejections and source-free execution.
 *
 * @file
 */
import { checkInstalledDotnetValues } from "./dotnet-copied-install.mjs";

const rejectedSources = {
	"callback-result": 'Api.CallNat(System.Numerics.BigInteger.One, value => 1.5);'
	, "callback-width": 'Api.CallUint32(1, (uint value) => -1);'
	, "async-result": 'Api.CallUint32(1, async value => { await System.Threading.Tasks.Task.Yield(); return value; });'
	, "unit-result": 'Api.CallUnit(default, new System.Func<Unit, Unit>(value => value));'
	, "closure-signature": 'LeanClosure<System.Func<uint, uint>> value = Api.MakeString("x");'
	, "closure-argument": 'Api.MakeNat(1).Invoke("x", System.Numerics.BigInteger.Zero);'
	, "closure-constructor": 'new LeanClosure<System.Func<bool, uint, uint>>();'
};
const expectedDiagnostics = {
	"callback-result": ["CS0266", "CS1662"]
	, "callback-width": ["CS0031", "CS1662", "CS0221"]
	, "async-result": ["CS4010"], "unit-result": ["CS1503"]
	, "closure-signature": ["CS0029"], "closure-argument": ["CS1503"]
	, "closure-constructor": ["CS1729"]
};
/**
 * Validate the prepared callable package without rebuilding its producer.
 *
 * @param options - Completed installed .NET callable fixture.
 */
export const checkInstalledDotnetCallables = options => checkInstalledDotnetValues({ ...options
	, fixture: { namespace: "LeanBridge.Callables", success: "callable-dotnet-ok", rejectedSources, expectedDiagnostics } });
