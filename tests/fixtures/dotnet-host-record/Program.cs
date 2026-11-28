using System;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using A = LeanBridge.Workshop;
using Pair = LeanBridge.Workshop.Pair<Meter>;
using Owner = LeanBridge.Workshop.Bound<Meter>;

public sealed class Meter(uint level) {
    public uint Level { get; set; } = level;
    public int Reads { get; private set; }
    public Exception? Fault;
    public uint Read() { ++Reads; if (Fault != null) throw Fault; return Level; }
    public Meter Identity() => this;
}

static class Client {
    static void Check(bool ok, [CallerArgumentExpression("ok")] string expression = "") {
        if (!ok) throw new Exception(expression);
    }
    static E Reject<E>(Action action) where E : Exception {
        try { action(); } catch (E expected) { return expected; }
        throw new Exception("Expected " + typeof(E).Name);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (Pair, WeakReference) Outside(Owner owner) {
        var meter = new Meter(11); return (owner.CreatePair(meter), new WeakReference(meter));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (Owner.ReturnedChoose, WeakReference, WeakReference) Capture(Owner owner) {
        var left = new Meter(2); var right = new Meter(9);
        using var input = new Pair(left, new byte[] { 1 }, 0, right);
        return (owner.Choose(input), new WeakReference(left), new WeakReference(right));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void VerifyCaptures(Owner.ReturnedChoose choose, WeakReference left, WeakReference right) {
        Check(left.IsAlive && right.IsAlive);
        Check(ReferenceEquals(choose.Invoke(true), left.Target) && ReferenceEquals(choose.Invoke(false), right.Target));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void VerifyOutside(Pair p, WeakReference meter) {
        Check(meter.IsAlive && ReferenceEquals(p.Lead, meter.Target) && ReferenceEquals(p.Spare, p.Lead));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static WeakReference Overflow(Owner owner) {
        var only = new Meter(8); var weak = new WeakReference(only);
        var bytes = new byte[8*1024*1024+1];
        var error = Reject<ArgumentOutOfRangeException>(()=>owner.DuplicateSample(only,bytes));
        Check(error.Message.Contains("copy budget exceeded",StringComparison.Ordinal));
        return weak;
    }
    static void Collect() { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); }
    public static void Main() {
        using var owner = A.Api.BindHosts<Meter>();
        var a = new Meter(4); var b = new Meter(10);
        var bytes = new byte[] { 3, 7 }; var number = BigInteger.One << 130;
        using var input = new Pair(a, bytes, number, b); bytes[0] = 99;
        using var result = owner.Flip(input);
        Check(ReferenceEquals(result.Lead,b) && ReferenceEquals(result.Spare,a) && result.Sequence == number+1);
        Check(result.Sample.SequenceEqual(new byte[] { 3, 7, 4 }));
        result.Sample[0]=88; Check(result.Sample[0]==3 && input.Sample[0]==3);
        Check(owner.SumRead(input,result)==8);
        var reads=a.Reads;
        using var closed=owner.CreatePair(b); closed.Dispose();
        Reject<ObjectDisposedException>(()=>owner.SumRead(input,closed)); Check(a.Reads==reads);
        Reject<ArgumentOutOfRangeException>(()=>{ using var bad=new Pair(b, bytes, -1, a); owner.SumRead(input,bad); });
        Check(a.Reads==reads);
        a.Fault=new ApplicationException("meter failed");
        Check(ReferenceEquals(Reject<ApplicationException>(()=>owner.Flip(input)),a.Fault));
        a.Fault=null; Check(owner.SumRead(input,result)==8);
        var partiallyExported=Overflow(owner); Collect(); Check(!partiallyExported.IsAlive);
        using var reading=owner.DuplicateSample(b,bytes);
        Check(ReferenceEquals(reading.SourceMeter,b) && reading.Held.SequenceEqual(bytes));
        bytes[0]=36; var held=reading.Held; held[0]=123;
        Check(reading.SpareBytes[0]==99 && reading.Held[0]==99);
        using var constructed=new A.Reading<Meter>(held: bytes, source_meter: b, spare_bytes: held);
        Check(constructed.Held[0]==36 && constructed.SpareBytes[0]==123);
        var (fn,left,right)=Capture(owner); Collect(); VerifyCaptures(fn,left,right);
        fn.Dispose(); fn.Dispose(); Collect(); Check(!left.IsAlive && !right.IsAlive);
        var (panel,weak)=Outside(owner); owner.Dispose(); Collect(); VerifyOutside(panel,weak);
        panel.Dispose(); panel.Dispose(); Collect(); Check(!weak.IsAlive);
        Console.WriteLine("CLR pair: original meters, isolated byte arrays, exact BigInteger, two-record prevalidation, partial native output, captured fields and last release");
    }
}
