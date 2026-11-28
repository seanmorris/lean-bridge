using System;
using System.IO;
using System.Numerics;
using System.Text;
using System.Threading;
using J = LeanBridge.Journal.Api;
using C = LeanBridge.Clock.Api;
using LeanBridge.Journal;
using Nested = LeanBridge.Journal.Result<string, LeanBridge.Journal.Result<System.Numerics.BigInteger, byte[]>>;

static class Program
{
    static void Check(bool b, [System.Runtime.CompilerServices.CallerLineNumber] int line = 0)
    { if (!b) throw new Exception("Assertion failed at line " + line); }
    static T Throws<T>(Action f) where T : Exception
    {
        try { f(); }
        catch (T e) { return e; }
        throw new Exception("Expected " + typeof(T));
    }
    static void Main(string[] args)
    {
        // Negative controls invoke a public method in a fresh installed process.
        if (args[0] == "corrupt")
        {
            var e = Throws<InvalidOperationException>(() => J.Count());
            Check(e.Message.Contains("differs from the compiled package"));
            Console.WriteLine("tampered native library rejected"); return;
        }
        bool peerFirst = args[0] == "peer-first";
        if (peerFirst) Check(C.Read() == 71);
        Exception? threadFailure = null;
        var thread = new Thread(() => { try { J.Bump(9); } catch (Exception e) { threadFailure = e; } });
        thread.Start(); thread.Join();
        Check(threadFailure is WrongContextException);
        var cold = Audit.Read();
        Check(cold[3] == (peerFirst ? 1U : 0U));
        // Rejected arguments must not run the Lean body or write the target.
        File.WriteAllText("state", "original");
        Throws<ArgumentNullException>(() => J.Store("state", null!));
        Throws<EncoderFallbackException>(() => J.Store("state", "\ud800"));
        Throws<ArgumentOutOfRangeException>(() => J.Store("state", new string('x', 16 * 1024 * 1024)));
        Throws<ArgumentOutOfRangeException>(() => J.RtNat(-1)); Throws<ArgumentNullException>(() => J.RtBytes(null!));
        Check(File.ReadAllText("state") == "original" && Audit.Read()[3] == cold[3]);
        Check(J.Count() == 0 && J.Bump(2) == 2 && J.Bump(3) == 5);
        if (!peerFirst) Check(C.Read() == 71);
        var warm = Audit.Read(); Check(warm[1] == 2 && warm[2] == 1 && warm[3] == 2 && warm[5] == 0);
        string text = "µ\0λ🌿"; J.Store("state", text); Check(J.Read("state") == text);
        var io = Throws<LeanIOException>(() => J.Read("missing-file"));
        Check(io.Declaration == "Journal.read" && io.Message.Contains("missing-file") && J.Count() == 5);
        Check(J.Echo(12) == 12);
        var normal = J.Choose(false, false, text); Check(normal.IsError && normal.Error == 37);
        var thrown = Throws<DeclaredError<Result<string, uint>>>(() => J.Choose(true, false, text));
        Check(thrown.Declaration == "Journal.choose" && thrown.Payload == normal);
        Check(J.Choose(false, true, text).Value == text);
        J.RtUnit(default); Check(J.RtBool(true) && !J.RtBool(false));
        Check(J.RtUint8(byte.MaxValue) == byte.MaxValue && J.RtInt8(sbyte.MinValue) == sbyte.MinValue);
        Check(J.RtUint16(ushort.MaxValue) == ushort.MaxValue && J.RtInt16(short.MinValue) == short.MinValue);
        Check(J.RtUint32(uint.MaxValue) == uint.MaxValue && J.RtInt32(int.MinValue) == int.MinValue);
        Check(J.RtUint64(ulong.MaxValue) == ulong.MaxValue && J.RtInt64(long.MinValue) == long.MinValue);
        Check(J.RtUsize(nuint.MaxValue) == nuint.MaxValue && J.RtIsize(nint.MinValue) == nint.MinValue);
        Check(J.RtChar(new Rune(0x1F33F)).Value == 0x1F33F && J.RtString(text) == text && J.RtString("") == "");
        Check(float.IsNaN(J.RtFloat32(float.NaN)) && J.RtFloat32(-0.5f) == -0.5f);
        Check(double.IsNegativeInfinity(1 / J.RtFloat64(-0.0)) && J.RtFloat64(1.25) == 1.25);
        byte[] bytes = [0, 1, 128, 255]; var cloned = J.RtBytes(bytes);
        Check(cloned.AsSpan().SequenceEqual(bytes) && !ReferenceEquals(bytes, cloned)); cloned[0] = 99;
        Check(bytes[0] == 0 && J.RtBytes([]).Length == 0);
        var wide = (BigInteger.One << 4097) + 17;
        Check(J.RtNat(wide) == wide && J.RtNat(0) == 0 && J.RtInt(-wide) == -wide && J.RtInt(0) == 0);
        for (byte tag = 0; tag < 3; ++tag)
        {
            var value = J.Nested(false, tag, -wide, text, bytes);
            var e = Throws<DeclaredError<Nested>>(() => J.Nested(true, tag, -wide, text, bytes));
            Check(e.Declaration == "RubyIO.nested" && e.Payload == value);
            if (tag == 0) Check(value.Value == text);
            else if (tag == 1) Check(value.Error.Value == -wide);
            else Check(value.Error.Error.AsSpan().SequenceEqual(bytes));
        }
        Check(J.Count() == 5 && J.Read("state") == text && Audit.Read()[5] == 0);
        Audit.Retire();
        Throws<RuntimeUnavailableException>(() => J.Store("state", "must not run"));
        Throws<LeanBridge.Clock.RuntimeUnavailableException>(() => C.Read());
        var end = Audit.Read();
        Check(File.ReadAllText("state") == text && end[1] == 3 && end[2] == 1 && end[3] == 2 && end[5] == 0);
        Console.WriteLine(args[0] + ": 19 scalars, nested EIO/Except, IO order, validation, retirement; 1 runtime, 2 components, 0 live identities");
    }
}
