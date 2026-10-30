using LeanBridge.HostNullDemo;
using System;

var checks = 0;
void Check(bool condition, string message)
{
    ++checks;
    if (!condition) throw new Exception(message);
}

Check(Api.Echo(null) is null, "direct null");
Check(Api.Echo(42u) == 42u, "direct value");
Check(Api.NullableOption(null) is null, "nullable Option null");
Check(Api.NullableOption(Option<uint>.None) is { IsNone: true }, "nullable Option none");
Check(Api.NullableOption(Option<uint>.Some(42u)) is { IsSome: true, Value: 42u }, "nullable Option some");
Check(Api.OptionalNullable(Option<uint?>.None).IsNone, "optional nullable none");
Check(Api.OptionalNullable(Option<uint?>.Some(null)) is { IsSome: true, Value: null }, "optional nullable null");
Check(Api.OptionalNullable(Option<uint?>.Some(42u)) is { IsSome: true, Value: 42u }, "optional nullable value");

var packet = new Packet(null, Option<uint>.None, Option<uint?>.Some(null));
var echoed = Api.EchoPacket(packet);
Check(echoed.Direct is null, "record direct null");
Check(echoed.NullableOption is { IsNone: true }, "record nullable Option");
Check(echoed.OptionalNullable is { IsSome: true, Value: null }, "record optional nullable");
Check(echoed == packet, "record equality");

var callbackCalls = 0;
Check(Api.CallHost(null, value => {
    ++callbackCalls;
    Check(value is null, "callback null parameter");
    return Option<uint>.None;
}) is { IsNone: true }, "callback tagged result");
Check(Api.CallHost(42u, value => {
    ++callbackCalls;
    Check(value == 42u, "callback value parameter");
    return null;
}) is null, "callback null result");
Check(callbackCalls == 2, "callback count");

var closure = Api.MakeClosure(Option<uint>.Some(77u));
Check(!closure.IsClosed, "closure initially open");
Check(closure.Invoke(null) is { IsSome: true, Value: 77u }, "closure null parameter");
Check(closure.Invoke(2u) is { IsSome: true, Value: 77u }, "closure value parameter");
closure.Dispose();
Check(closure.IsClosed, "closure closed");
var rejected = false;
try { _ = closure.Invoke(null); }
catch (InvalidOperationException) { rejected = true; }
Check(rejected, "closed closure rejected");

Console.WriteLine($"host-null-dotnet:{checks}");
