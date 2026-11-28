using System;
using System.Collections.Generic;
using System.Numerics;
using System.Text;

namespace LeanBridge.GeneratedIO;

internal static unsafe partial class Wire
{
    private const int Limit = 16 * 1024 * 1024;
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private static Exception Failure(int code) => code switch
    {
        5 => new ArgumentException("Invalid Lean argument"),
        9 => new WrongContextException(),
        10 => new RuntimeUnavailableException(),
        11 => new OutOfMemoryException(),
        12 => new ArgumentOutOfRangeException(null, "Lean copy budget exceeded"),
        _ => new InvalidOperationException("Unexpected Lean status: " + code)
    };
    private static bool TagWord(ulong tag) => tag switch
    {
        0 => false, 1 => true, _ => throw new InvalidOperationException("Invalid native discriminant")
    };
    private static bool Tag(byte tag) => TagWord(tag);
    // Every input is a copy, never an alias of a caller's mutable array.
    // The pinned buffers stay rooted through the finally that disposes each call.
    private sealed class Frame : IDisposable
    {
        private readonly List<byte[]> buffers = new();
        private int remaining = Limit;
        private byte[] Allocate(int bytes, ulong* slot)
        {
            if (bytes > remaining) throw new ArgumentOutOfRangeException(null, "Lean copy budget exceeded");
            remaining -= bytes;
            var b = GC.AllocateArray<byte>(bytes, pinned: true);
            buffers.Add(b);
            fixed (byte* data = b) slot[0] = (ulong)data;
            return b;
        }
        internal void Copy(string text, ulong* slot)
        {
            ArgumentNullException.ThrowIfNull(text);
            if (text.Length > remaining) throw new ArgumentOutOfRangeException(nameof(text), "Lean copy budget exceeded");
            int n = Utf8.GetByteCount(text);
            Utf8.GetBytes(text.AsSpan(), Allocate(n, slot)); slot[1] = (ulong)n;
        }
        internal void Copy(byte[] value, ulong* slot)
        {
            ArgumentNullException.ThrowIfNull(value);
            value.AsSpan().CopyTo(Allocate(value.Length, slot)); slot[1] = (ulong)value.Length;
        }
        internal void Number(BigInteger value, bool natural, ulong* slot)
        {
            if (natural && value.Sign < 0) throw new ArgumentOutOfRangeException(nameof(value), "Lean Nat cannot be negative");
            if (value.IsZero) return;
            var magnitude = BigInteger.Abs(value); int n = magnitude.GetByteCount(isUnsigned: true);
            if (n > remaining) throw new ArgumentOutOfRangeException(nameof(value), "Lean copy budget exceeded");
            int words = (n + 7) / 8;
            var b = Allocate(words * 8, slot);
            if (!magnitude.TryWriteBytes(b, out _, isUnsigned: true)) throw new InvalidOperationException("Cannot copy integer");
            slot[1] = (ulong)words; slot[2] = value.Sign < 0 ? 1UL : 0UL;
        }
        public void Dispose() { GC.KeepAlive(buffers); }
    }
    // Copy the active owned payload before the native output frame is cleared,
    // including when validation or a managed allocation throws.
    private static ReadOnlySpan<byte> Buffer(ulong* o, ulong owner)
    {
        ulong width = owner == 2 ? 8UL : 1UL;
        if (o[3] != owner || o[1] > (ulong)Limit / width || (o[1] != 0 && o[0] == 0))
            throw new InvalidOperationException("Invalid owned Lean output");
        return new ReadOnlySpan<byte>((void*)o[0], (int)(o[1] * width));
    }
    private static BigInteger Integer(ulong* o, bool natural)
    {
        var value = new BigInteger(Buffer(o, 2), isUnsigned: true);
        if (o[2] > 1 || (o[2] != 0 && (natural || value.IsZero))) throw new InvalidOperationException("Invalid Lean integer sign");
        return o[2] == 0 ? value : -value;
    }
}
