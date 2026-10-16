using _V = global::LeanBridge.Mutualcheckedrecords;
namespace LeanBridge.Mutualcheckedrecords.Interop;

[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphRaw0
{
    internal nint Owner;
    internal nint Release;
    internal nint Data;
    internal nuint Length;
}

[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphRaw1
{
    internal nint Owner;
    internal nint Release;
    internal byte Flag;
    internal GraphRaw3 Field0;
}

[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphRaw2
{
    internal nint Owner;
    internal nint Release;
    internal byte Flag;
    internal nint Field0;
}

[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphRaw3
{
    internal nint Owner;
    internal nint Release;
    internal GraphRaw5 Field0;
    internal GraphRaw5 Field1;
    internal nint Field2;
}

[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphCase4_0
{
    internal byte Empty;
}
[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphCase4_1
{
    internal nint Field0;
}
[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Explicit)]
internal struct GraphUnion4
{
    [global::System.Runtime.InteropServices.FieldOffset(0)] internal GraphCase4_0 Case0;
    [global::System.Runtime.InteropServices.FieldOffset(0)] internal GraphCase4_1 Case1;
}
[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphRaw4
{
    internal nint Owner;
    internal nint Release;
    internal uint Kind;
    internal GraphUnion4 Cases;
}

[global::System.Runtime.InteropServices.StructLayout(global::System.Runtime.InteropServices.LayoutKind.Sequential)]
internal struct GraphRaw5
{
    internal nint Owner;
    internal nint Release;
    internal nint Data;
    internal nuint Length;
}

internal sealed class GraphInvalidNative : global::System.Exception
{
    internal GraphInvalidNative(string message, global::System.Exception? inner = null)
        : base(message, inner) { }
}
internal sealed class GraphLimit : global::System.ArgumentException
{
    internal GraphLimit(string message) : base(message) { }
}

internal readonly unsafe struct GraphLifecycle
{
    internal readonly delegate* unmanaged[Cdecl]<uint> Initialize;
    internal readonly delegate* unmanaged[Cdecl]<int> Ready;
    internal readonly delegate* unmanaged[Cdecl]<void> Retire;
    internal GraphLifecycle(delegate* unmanaged[Cdecl]<uint> initialize, delegate* unmanaged[Cdecl]<int> ready, delegate* unmanaged[Cdecl]<void> retire)
    { Initialize = initialize; Ready = ready; Retire = retire; }
    internal void Before() { if (Initialize != null) GraphRuntime.Status(Initialize()); }
    internal void After()
    {
        if (Ready != null && Ready() == 0) throw new LeanBridgeException(5, "Lean runtime is unavailable");
    }
    internal void Poison() { if (Retire != null) Retire(); }
}

internal sealed unsafe class GraphScope : global::System.IDisposable
{
    internal readonly bool CheckOnly;
    internal int Nodes = 262144;
    private nuint nativeRemaining = 16 * 1024 * 1024;
    private nuint storageRemaining = 16 * 1024 * 1024;
    private readonly global::System.Collections.Generic.HashSet<object> hosts = new(global::System.Collections.Generic.ReferenceEqualityComparer.Instance);
    private readonly global::System.Collections.Generic.HashSet<(int, nuint)> outputs = new();
    private readonly global::System.Collections.Generic.List<nint> allocations = new();
    internal GraphScope(bool checkOnly = false)
    {
        if (sizeof(nint) != 8 || !global::System.BitConverter.IsLittleEndian)
            throw new global::System.PlatformNotSupportedException("Native graphs require little-endian 64-bit storage");
        CheckOnly = checkOnly;
    }
    private static void Charge(ref nuint remaining, nuint count, nuint width)
    {
        if (width == 0 || count > remaining / width) throw new GraphLimit("16 MiB copied graph conversion budget exceeded");
        remaining -= count * width;
    }
    internal void Native(nuint count, nuint width = 1) => Charge(ref nativeRemaining, count, width);
    internal void Storage(nuint count, nuint width = 1) => Charge(ref storageRemaining, count, width);
    private void Visit(int depth, int size, bool storage)
    {
        if (depth > 128 || Nodes == 0) throw new GraphLimit("Copied graph depth or node limit exceeded");
        Nodes--;
        if (storage) Native((nuint)size);
    }
    internal void Enter(object? identity, int depth, int size, bool storage)
    {
        Visit(depth, size, storage);
        if (identity != null && !hosts.Add(identity)) throw new global::System.ArgumentException("Cyclic copied input");
    }
    internal void Leave(object? identity) { if (identity != null) hosts.Remove(identity); }
    internal void Enter(int type, nuint pointer, int depth, int size, bool storage)
    {
        Visit(depth, size, storage);
        if (!outputs.Add((type, pointer))) throw new GraphInvalidNative("Cyclic native copied value");
    }
    internal void Leave(int type, nuint pointer) => outputs.Remove((type, pointer));
    internal nint Allocate<T>(nuint count) where T : unmanaged
    {
        Storage(count, (nuint)sizeof(T)); Storage(32);
        if (CheckOnly || count == 0) return 0;
        GraphRuntime.Checkpoint();
        var pointer = (nint)global::System.Runtime.InteropServices.NativeMemory.AllocZeroed(count, (nuint)sizeof(T));
        if (pointer == 0) throw new global::System.OutOfMemoryException();
        try { GraphRuntime.Checkpoint(); allocations.Add(pointer); }
        catch { global::System.Runtime.InteropServices.NativeMemory.Free((void*)pointer); throw; }
        return pointer;
    }
    internal nint Store<T>(T value) where T : unmanaged
    {
        var pointer = Allocate<T>(1);
        if (!CheckOnly) *(T*)pointer = value;
        return pointer;
    }
    public void Dispose()
    {
        foreach (var pointer in allocations) global::System.Runtime.InteropServices.NativeMemory.Free((void*)pointer);
        allocations.Clear(); hosts.Clear(); outputs.Clear();
    }
}

internal static unsafe partial class GraphRuntime
{
    private static readonly global::System.Text.UTF8Encoding Utf8 = new(false, true);
    internal static void Checkpoint() { }
    internal static void Status(uint status) => Status(status, null);
    internal static void Status(uint status, delegate* unmanaged[Cdecl]<byte*> diagnostic)
    {
        switch (status)
        {
            case 0: return;
            case 1:
                if (diagnostic != null)
                {
                    var message = diagnostic();
                    if (message != null)
                    {
                        var length = 0;
                        while (length <= 16 * 1024 && message[length] != 0) length++;
                        if (length > 16 * 1024)
                            throw new GraphInvalidNative("Native refinement diagnostic exceeds 16 KiB");
                        string text;
                        try { text = Utf8.GetString(new global::System.ReadOnlySpan<byte>(message, length)); }
                        catch (global::System.Text.DecoderFallbackException error)
                        {
                            throw new GraphInvalidNative("Native refinement diagnostic is not UTF-8", error);
                        }
                        throw new global::System.ArgumentException(text);
                    }
                }
                throw new global::System.ArgumentException("Invalid native copied input");
            case 2: throw new GraphLimit("Native copied graph limit exceeded");
            case 3: throw new global::System.OutOfMemoryException("Native copied graph allocation failed");
            case 5: throw new LeanBridgeException(5, "Lean runtime is unavailable");
            default: throw new GraphInvalidNative("Invalid native copied result or status");
        }
    }
    internal static T* Checked<T>(nint pointer, nuint count, nuint alignment) where T : unmanaged
    {
        if (count == 0) return null;
        if (pointer == 0 || (nuint)pointer % alignment != 0 || count > (nuint)nint.MaxValue / (nuint)sizeof(T)
            || (nuint)pointer > nuint.MaxValue - count * (nuint)sizeof(T))
            throw new GraphInvalidNative("Missing, misaligned or overflowing native span");
        // The authenticated native adapter supplies readable process memory.
        // These checks cannot make arbitrary foreign pointers safe to read.
        return (T*)pointer;
    }
    internal static void Clear(ref nint owner, ref nint release)
    {
        var savedOwner = owner; var savedRelease = release;
        owner = 0; release = 0;
        if (savedOwner != 0 && savedRelease != 0)
            ((delegate* unmanaged[Cdecl]<nint, void>)savedRelease)(savedOwner);
    }
}

internal static unsafe partial class GraphRuntime
{
    internal static GraphRaw0 Write0(_V.Option<_V.Envelope>[] value, GraphScope scope, int depth = 0, bool storage = true)
    {
        object? identity = value;
        scope.Enter(identity, depth, sizeof(GraphRaw0), storage);
        try
        {
            global::System.ArgumentNullException.ThrowIfNull(value);
            if (value.Length > scope.Nodes) throw new GraphLimit("Copied graph node limit exceeded");
            scope.Native((nuint)value.Length, (nuint)sizeof(GraphRaw1));
            var data = scope.Allocate<GraphRaw1>((nuint)value.Length);
            for (int index = 0; index < value.Length; index++)
            {
                var child = Write1(value[index], scope, depth + 1, false);
                if (!scope.CheckOnly) ((GraphRaw1*)data)[index] = child;
            }
            return new GraphRaw0 { Data = data, Length = (nuint)value.Length };
        }
        finally { scope.Leave(identity); }
    }
    internal static _V.Option<_V.Envelope>[] Read0(GraphRaw0* value, GraphScope scope, int depth = 0, bool storage = true)
    {
        Checked<GraphRaw0>((nint)value, 1, 8);
        scope.Enter(0, (nuint)value, depth, sizeof(GraphRaw0), storage);
        try
        {
            if (value->Length > (nuint)scope.Nodes) throw new GraphLimit("Copied graph node limit exceeded");
            scope.Native(value->Length, (nuint)sizeof(GraphRaw1));
            scope.Storage(value->Length, (nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<_V.Option<_V.Envelope>>()); scope.Storage(32);
            var data = Checked<GraphRaw1>(value->Data, value->Length, 8);
            Checkpoint();
            var result = new _V.Option<_V.Envelope>[checked((int)value->Length)];
            for (int index = 0; index < result.Length; index++) result[index] = Read1(&data[index], scope, depth + 1, false);
            return result;
        }
        finally { scope.Leave(0, (nuint)value); }
    }
    internal static GraphRaw1 Write1(_V.Option<_V.Envelope> value, GraphScope scope, int depth = 0, bool storage = true)
    {
        object? identity = null;
        scope.Enter(identity, depth, sizeof(GraphRaw1), storage);
        try
        {
            var result = default(GraphRaw1);
            if (value.IsNone) return result;
            if (value.IsSome)
            {
                result.Flag = 1;
                result.Field0 = Write3(value.Value, scope, depth + 1, false);
                return result;
            }
            throw new global::System.ArgumentException("Invalid copied branch");
        }
        finally { scope.Leave(identity); }
    }
    internal static _V.Option<_V.Envelope> Read1(GraphRaw1* value, GraphScope scope, int depth = 0, bool storage = true)
    {
        Checked<GraphRaw1>((nint)value, 1, 8);
        scope.Enter(1, (nuint)value, depth, sizeof(GraphRaw1), storage);
        try
        {
            if (value->Flag == 0) return _V.Option<_V.Envelope>.None;
            if (value->Flag == 1)
            {
                scope.Storage((nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<_V.Option<_V.Envelope>>()); Checkpoint();
                return _V.Option<_V.Envelope>.Some(Read3(&value->Field0, scope, depth + 1, false));
            }
            throw new GraphInvalidNative("Invalid native compound flag");
        }
        finally { scope.Leave(1, (nuint)value); }
    }
    internal static GraphRaw2 Write2(_V.Option<_V.Step> value, GraphScope scope, int depth = 0, bool storage = true)
    {
        object? identity = null;
        scope.Enter(identity, depth, sizeof(GraphRaw2), storage);
        try
        {
            var result = default(GraphRaw2);
            if (value.IsNone) return result;
            if (value.IsSome)
            {
                result.Flag = 1;
                result.Field0 = scope.Store(Write4(value.Value, scope, depth + 1, true));
                return result;
            }
            throw new global::System.ArgumentException("Invalid copied branch");
        }
        finally { scope.Leave(identity); }
    }
    internal static _V.Option<_V.Step> Read2(GraphRaw2* value, GraphScope scope, int depth = 0, bool storage = true)
    {
        Checked<GraphRaw2>((nint)value, 1, 8);
        scope.Enter(2, (nuint)value, depth, sizeof(GraphRaw2), storage);
        try
        {
            if (value->Flag == 0) return _V.Option<_V.Step>.None;
            if (value->Flag == 1)
            {
                scope.Storage((nuint)global::System.Runtime.CompilerServices.Unsafe.SizeOf<_V.Option<_V.Step>>()); Checkpoint();
                return _V.Option<_V.Step>.Some(Read4((GraphRaw4*)value->Field0, scope, depth + 1, true));
            }
            throw new GraphInvalidNative("Invalid native compound flag");
        }
        finally { scope.Leave(2, (nuint)value); }
    }
    internal static GraphRaw3 Write3(_V.Envelope value, GraphScope scope, int depth = 0, bool storage = true)
    {
        object? identity = value;
        scope.Enter(identity, depth, sizeof(GraphRaw3), storage);
        try
        {
            global::System.ArgumentNullException.ThrowIfNull(value);
            var result = default(GraphRaw3);
            result.Field0 = Write5(value.Value, scope, depth + 1, false);
            result.Field1 = Write5(value.Mode, scope, depth + 1, false);
            result.Field2 = scope.Store(Write2(value.Next, scope, depth + 1, true));
            return result;
        }
        finally { scope.Leave(identity); }
    }
    internal static _V.Envelope Read3(GraphRaw3* value, GraphScope scope, int depth = 0, bool storage = true)
    {
        Checked<GraphRaw3>((nint)value, 1, 8);
        scope.Enter(3, (nuint)value, depth, sizeof(GraphRaw3), storage);
        try
        {
            scope.Storage(80); Checkpoint();
            return new _V.Envelope(Read5(&value->Field0, scope, depth + 1, false), Read5(&value->Field1, scope, depth + 1, false), Read2((GraphRaw2*)value->Field2, scope, depth + 1, true));
        }
        finally { scope.Leave(3, (nuint)value); }
    }
    internal static GraphRaw4 Write4(_V.Step value, GraphScope scope, int depth = 0, bool storage = true)
    {
        object? identity = value;
        scope.Enter(identity, depth, sizeof(GraphRaw4), storage);
        try
        {
            if (value is _V.StepStop branch0)
            {
                var result = new GraphRaw4 { Kind = 0 };
                return result;
            }
            if (value is _V.StepMore branch1)
            {
                var result = new GraphRaw4 { Kind = 1 };
                result.Cases.Case1.Field0 = scope.Store(Write3(branch1.Packet, scope, depth + 1, true));
                return result;
            }
            throw new global::System.ArgumentException("Expected a named Step constructor");
        }
        finally { scope.Leave(identity); }
    }
    internal static _V.Step Read4(GraphRaw4* value, GraphScope scope, int depth = 0, bool storage = true)
    {
        Checked<GraphRaw4>((nint)value, 1, 8);
        scope.Enter(4, (nuint)value, depth, sizeof(GraphRaw4), storage);
        try
        {
            if (value->Kind == 0)
            {
                scope.Storage(32); Checkpoint();
                return new _V.StepStop();
            }
            if (value->Kind == 1)
            {
                scope.Storage(48); Checkpoint();
                return new _V.StepMore(Read3((GraphRaw3*)value->Cases.Case1.Field0, scope, depth + 1, true));
            }
            throw new GraphInvalidNative("Invalid native Step constructor");
        }
        finally { scope.Leave(4, (nuint)value); }
    }
    internal static GraphRaw5 Write5(global::System.Numerics.BigInteger value, GraphScope scope, int depth = 0, bool storage = true)
    {
        object? identity = null;
        scope.Enter(identity, depth, sizeof(GraphRaw5), storage);
        try
        {
            if (value.Sign < 0) throw new global::System.ArgumentOutOfRangeException(nameof(value), "Nat cannot be negative");
            var magnitude = global::System.Numerics.BigInteger.Abs(value);
            var length = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 3) / 4);
            scope.Native((nuint)length, 4);
            var data = scope.Allocate<uint>((nuint)length);
            if (!scope.CheckOnly && length != 0 && !magnitude.TryWriteBytes(new global::System.Span<byte>((void*)data, checked(length * 4)), out _, isUnsigned: true, isBigEndian: false))
                throw new global::System.InvalidOperationException("BigInteger conversion failed");
            return new GraphRaw5 { Data = data, Length = (nuint)length };
        }
        finally { scope.Leave(identity); }
    }
    internal static global::System.Numerics.BigInteger Read5(GraphRaw5* value, GraphScope scope, int depth = 0, bool storage = true)
    {
        Checked<GraphRaw5>((nint)value, 1, 8);
        scope.Enter(5, (nuint)value, depth, sizeof(GraphRaw5), storage);
        try
        {
            scope.Native(value->Length, 4); scope.Storage(value->Length, 4); scope.Storage(64);
            var digits = Checked<uint>(value->Data, value->Length, 4);
            if (value->Length != 0 && digits[value->Length - 1] == 0) throw new GraphInvalidNative("Noncanonical native magnitude");
            Checkpoint();
            var result = new global::System.Numerics.BigInteger(new global::System.ReadOnlySpan<byte>(digits, checked((int)value->Length * 4)), isUnsigned: true, isBigEndian: false);
            return result;
        }
        finally { scope.Leave(5, (nuint)value); }
    }
    internal static _V.Envelope CallEcho(delegate* unmanaged[Cdecl]<GraphRaw3*, GraphRaw3*, uint> invoke, delegate* unmanaged[Cdecl]<byte*> diagnostic, GraphLifecycle lifecycle, _V.Envelope arg0)
    {
        using (var check = new GraphScope(true))
        {
            Write3(arg0, check);
        }
        using var scope = new GraphScope();
        var output = default(GraphRaw3);
        try
        {
            var input0 = Write3(arg0, scope);
            if (invoke == null) throw new global::System.ArgumentNullException(nameof(invoke));
            lifecycle.Before();
            Status(invoke(&input0, &output), diagnostic);
            var result = Read3(&output, scope);
            Checkpoint(); lifecycle.After();
            return result;
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison();
            throw new LeanBridgeException(4, error.Message, error);
        }
        finally
        {
            Clear(ref output.Owner, ref output.Release);
        }
    }
    internal static _V.Option<_V.Envelope>[] CallEchoGroups(delegate* unmanaged[Cdecl]<GraphRaw0*, GraphRaw0*, uint> invoke, delegate* unmanaged[Cdecl]<byte*> diagnostic, GraphLifecycle lifecycle, _V.Option<_V.Envelope>[] arg0)
    {
        using (var check = new GraphScope(true))
        {
            Write0(arg0, check);
        }
        using var scope = new GraphScope();
        var output = default(GraphRaw0);
        try
        {
            var input0 = Write0(arg0, scope);
            if (invoke == null) throw new global::System.ArgumentNullException(nameof(invoke));
            lifecycle.Before();
            Status(invoke(&input0, &output), diagnostic);
            var result = Read0(&output, scope);
            Checkpoint(); lifecycle.After();
            return result;
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison();
            throw new LeanBridgeException(4, error.Message, error);
        }
        finally
        {
            Clear(ref output.Owner, ref output.Release);
        }
    }
    internal static global::System.Numerics.BigInteger CallFirst(delegate* unmanaged[Cdecl]<GraphRaw3*, GraphRaw5*, uint> invoke, delegate* unmanaged[Cdecl]<byte*> diagnostic, GraphLifecycle lifecycle, _V.Envelope arg0)
    {
        using (var check = new GraphScope(true))
        {
            Write3(arg0, check);
        }
        using var scope = new GraphScope();
        var output = default(GraphRaw5);
        try
        {
            var input0 = Write3(arg0, scope);
            if (invoke == null) throw new global::System.ArgumentNullException(nameof(invoke));
            lifecycle.Before();
            Status(invoke(&input0, &output), diagnostic);
            var result = Read5(&output, scope);
            Checkpoint(); lifecycle.After();
            return result;
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison();
            throw new LeanBridgeException(4, error.Message, error);
        }
        finally
        {
            Clear(ref output.Owner, ref output.Release);
        }
    }
    internal static global::System.Numerics.BigInteger CallGroups(delegate* unmanaged[Cdecl]<GraphRaw0*, GraphRaw5*, uint> invoke, delegate* unmanaged[Cdecl]<byte*> diagnostic, GraphLifecycle lifecycle, _V.Option<_V.Envelope>[] arg0)
    {
        using (var check = new GraphScope(true))
        {
            Write0(arg0, check);
        }
        using var scope = new GraphScope();
        var output = default(GraphRaw5);
        try
        {
            var input0 = Write0(arg0, scope);
            if (invoke == null) throw new global::System.ArgumentNullException(nameof(invoke));
            lifecycle.Before();
            Status(invoke(&input0, &output), diagnostic);
            var result = Read5(&output, scope);
            Checkpoint(); lifecycle.After();
            return result;
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison();
            throw new LeanBridgeException(4, error.Message, error);
        }
        finally
        {
            Clear(ref output.Owner, ref output.Release);
        }
    }
    internal static _V.Envelope CallProduce(delegate* unmanaged[Cdecl]<GraphRaw5*, GraphRaw3*, uint> invoke, delegate* unmanaged[Cdecl]<byte*> diagnostic, GraphLifecycle lifecycle, global::System.Numerics.BigInteger arg0)
    {
        using (var check = new GraphScope(true))
        {
            Write5(arg0, check);
        }
        using var scope = new GraphScope();
        var output = default(GraphRaw3);
        try
        {
            var input0 = Write5(arg0, scope);
            if (invoke == null) throw new global::System.ArgumentNullException(nameof(invoke));
            lifecycle.Before();
            Status(invoke(&input0, &output), diagnostic);
            var result = Read3(&output, scope);
            Checkpoint(); lifecycle.After();
            return result;
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison();
            throw new LeanBridgeException(4, error.Message, error);
        }
        finally
        {
            Clear(ref output.Owner, ref output.Release);
        }
    }
    internal static global::System.Numerics.BigInteger CallSecond(delegate* unmanaged[Cdecl]<GraphRaw3*, GraphRaw5*, uint> invoke, delegate* unmanaged[Cdecl]<byte*> diagnostic, GraphLifecycle lifecycle, _V.Envelope arg0)
    {
        using (var check = new GraphScope(true))
        {
            Write3(arg0, check);
        }
        using var scope = new GraphScope();
        var output = default(GraphRaw5);
        try
        {
            var input0 = Write3(arg0, scope);
            if (invoke == null) throw new global::System.ArgumentNullException(nameof(invoke));
            lifecycle.Before();
            Status(invoke(&input0, &output), diagnostic);
            var result = Read5(&output, scope);
            Checkpoint(); lifecycle.After();
            return result;
        }
        catch (GraphInvalidNative error)
        {
            lifecycle.Poison();
            throw new LeanBridgeException(4, error.Message, error);
        }
        finally
        {
            Clear(ref output.Owner, ref output.Release);
        }
    }
}
