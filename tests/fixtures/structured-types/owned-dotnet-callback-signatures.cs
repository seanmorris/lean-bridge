using System;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;

internal static class Program
{
    private static int checks, calls;
    internal static void Allocation() { }
    private static void Check(bool value, string message)
    { if (!value) throw new Exception(message); ++checks; }
    private static void Reject<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T) { ++checks; return; }
        throw new Exception("Expected " + typeof(T).Name);
    }
    private static T Seen<T>(T value) { ++calls; return value; }
    private static Bundle Bundle(Ticket ticket) => new(ticket, default, Array.Empty<Ticket>(), Array.Empty<Ticket>(), new Payload(-1, new byte[] { 0, 255 }));
    private static void Close(Bundle value)
    { value.Primary.Dispose(); if (value.Spare.IsSome) value.Spare.Value.Dispose(); foreach (var ticket in value.Peers) ticket.Dispose(); foreach (var ticket in value.History) ticket.Dispose(); }
    private static void Primitives()
    {
        Api.ViaUnit(_ => { ++calls; }, default); Check(calls == 1, "Unit callback actually invoked");
        Check(Api.ViaBool(value => Seen(!value), false), "Bool callback");
        Check(Api.ViaChar(value => Seen(value), new Rune(0x1f331)).Value == 0x1f331, "Char callback");
        var huge = (BigInteger.One << 257) + 1;
        Check(Api.ViaNat(value => Seen(value + 1), huge) == huge + 1, "Nat callback");
        Check(Api.ViaInt(value => Seen(value - 1), -huge) == -huge - 1, "Int callback");
        Check(Api.ViaU8(Seen, byte.MaxValue) == byte.MaxValue, "UInt8 callback");
        Check(Api.ViaU16(Seen, ushort.MaxValue) == ushort.MaxValue, "UInt16 callback");
        Check(Api.ViaU32(Seen, uint.MaxValue) == uint.MaxValue, "UInt32 callback");
        Check(Api.ViaU64(Seen, ulong.MaxValue) == ulong.MaxValue, "UInt64 callback");
        Check(Api.ViaI8(Seen, sbyte.MinValue) == sbyte.MinValue, "Int8 callback");
        Check(Api.ViaI16(Seen, short.MinValue) == short.MinValue, "Int16 callback");
        Check(Api.ViaI32(Seen, int.MinValue) == int.MinValue, "Int32 callback");
        Check(Api.ViaI64(Seen, long.MinValue) == long.MinValue, "Int64 callback");
        Check(Api.ViaUsize(Seen, ulong.MaxValue) == ulong.MaxValue, "USize callback");
        Check(Api.ViaIsize(Seen, long.MinValue) == long.MinValue, "ISize callback");
        Check(BitConverter.SingleToUInt32Bits(Api.ViaF32(Seen, BitConverter.UInt32BitsToSingle(0x7fc12345))) == 0x7fc12345, "Float32 NaN payload callback");
        Check(BitConverter.DoubleToUInt64Bits(Api.ViaF64(Seen, BitConverter.UInt64BitsToDouble(0x7ff8123456789abc))) == 0x7ff8123456789abc, "Float64 NaN payload callback");
        Check(Api.ViaString(Seen, "A\0🌱") == "A\0🌱", "String callback");
        var bytes = new byte[] { 0, 255, 1 };
        var copy = Api.ViaBytes(Seen, bytes);
        Check(copy.AsSpan().SequenceEqual(bytes) && !ReferenceEquals(copy, bytes), "ByteArray callback");
        Check(calls == 19, "all nineteen scalar callbacks executed");
        Reject<ArgumentOutOfRangeException>(() => Api.ViaNat(_ => -1, 0));
        Reject<EncoderFallbackException>(() => Api.ViaString(_ => "\ud800", ""));
        Reject<ArgumentNullException>(() => Api.ViaBytes(_ => null!, Array.Empty<byte>()));
        bool asyncRan = false;
        ViaUnitArgument0ClosureCallback asynchronous = async _ => { asyncRan = true; await Task.Yield(); };
        Reject<ArgumentException>(() => Api.ViaUnit(asynchronous, default));
        Reject<ArgumentException>(() => Api.ViaUnit(OwnedCallbacks.WithRecovery(asynchronous, default), default));
        ViaUnitArgument0ClosureCallback multicast = _ => { asyncRan = true; };
        multicast += OwnedCallbacks.WithRecovery(asynchronous, default);
        Reject<ArgumentException>(() => Api.ViaUnit(multicast, default));
        Check(!asyncRan, "async and preceding multicast entries rejected before execution");
        ViaUnitArgument0ClosureCallback nested = _ => { };
        for (int i = 0; i < 34; i++) nested = OwnedCallbacks.WithRecovery(nested, default);
        Reject<ArgumentException>(() => Api.ViaUnit(nested, default));
        Api.ViaUnit(_ => { ++calls; }, default); Check(calls == 20, "callback runtime remains usable");
    }
    private static void HigherOrder()
    {
        using var ticket = Api.NewTicket(17, "higher");
        var bundle = Bundle(ticket);
        CallbackRecordArgument1Closure? escaped = null, retained = null;
        var result = Api.WithFunction(bundle, (function, value) => {
            escaped = function; retained = function.Retain();
            var temporary = function.Invoke(value);
            Check(Api.Serial(temporary.Primary) == 17, "borrowed native closure invocation");
            Close(temporary); return value;
        });
        Check(escaped!.IsClosed && !retained!.IsClosed, "borrowed higher-order argument expires");
        Check(Api.Serial(result.Primary) == 17, "higher-order result"); Close(result);
        Reject<LeanBridgeException>(() => escaped.Invoke(bundle));
        result = retained!.Invoke(bundle); Check(Api.Serial(result.Primary) == 17, "retained argument callable after frame"); Close(result);
        result = Api.CallbackRecord(bundle, retained.AsCallback); Close(result);
        var original = new Exception("higher-order exception");
        try { Api.WithFunction(bundle, (function, value) => { escaped = function; throw original; }); throw new Exception("failure swallowed"); }
        catch (Exception error) { Check(ReferenceEquals(original, error) && escaped!.IsClosed, "higher-order failure expiry"); }
        Exception? wrongThread = null;
        var thread = new Thread(() => { try { retained.Invoke(bundle); } catch (Exception error) { wrongThread = error; } });
        thread.Start(); thread.Join();
        Check(wrongThread is LeanBridgeException { Status: 5 }, "higher-order closure thread affinity");
        retained.Dispose();
        var recovery = OwnedCallbacks.WithRecovery((Unit _) => ticket, ticket);
        using var made = Api.Factory(recovery); Check(Api.Serial(made) == 17, "typed identity recovery");
    }
    private static unsafe void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        Primitives(); HigherOrder();
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        OwnedLoader.Bindings.Runtime.Current.Dispose();
        var live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        var identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        Check(live() == 0 && identities() == 0, "all signature probe owners released");
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { checks, calls, primitives = 19, live = (ulong)live(), identities = (ulong)identities() }));
    }
}
