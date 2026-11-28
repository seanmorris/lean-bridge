// Test-only observer. Program.cs calls the installed package's ordinary public API.
using System;
using System.Runtime.InteropServices;

internal static unsafe class Audit
{
    [DllImport("libdl.so.2", EntryPoint = "dlsym")]
    private static extern nint Symbol(nint handle, string name);
    private static nint Required(string name)
    {
        nint address = Symbol(0, name);
        return address == 0 ? throw new InvalidOperationException("Missing broker observer: " + name) : address;
    }
    internal static uint[] Read()
    {
        ulong* output = stackalloc ulong[5];
        ((delegate* unmanaged[Cdecl]<void*, void>)Required("lean_bridge_native_snapshot_read"))(output);
        var counts = new ReadOnlySpan<uint>(output, 6).ToArray();
        if (counts[0] != 1) throw new Exception("Unexpected runtime snapshot ABI");
        return counts;
    }
    internal static void Retire() => ((delegate* unmanaged[Cdecl]<void>)Required("lean_bridge_native_runtime_retire"))();
}
