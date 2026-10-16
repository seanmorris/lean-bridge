using _V = global::LeanBridge.Mutualcheckedrecords;
namespace LeanBridge.Mutualcheckedrecords.Interop;
internal static class GraphNative
{
    private static class Assets
    {
    [global::System.Runtime.InteropServices.DllImport("libc", EntryPoint = "getpid", ExactSpelling = true)]
    private static extern int CurrentProcess();
    [global::System.Runtime.InteropServices.DllImport("libdl.so.2", EntryPoint = "dlopen", ExactSpelling = true)]
    private static extern nint Open([global::System.Runtime.InteropServices.MarshalAs(global::System.Runtime.InteropServices.UnmanagedType.LPUTF8Str)] string path, int flags);
    [global::System.Runtime.InteropServices.DllImport("libdl.so.2", EntryPoint = "dlclose", ExactSpelling = true)]
    private static extern int Close(nint handle);
    private const string ProcessKey = "lean-bridge.native-library-v1.dotnet.process";
    // A package first touched in a forked child must retain the origin of a
    // peer's already loaded runtime, rather than adopting the child's PID.
    private static readonly int Process = global::System.OperatingSystem.IsLinux()
        ? global::System.AppDomain.CurrentDomain.GetData(ProcessKey) is int original ? original : CurrentProcess()
        : 0;
    private static nint handle;
    internal static bool IsLoaded { get { EnsureProcess(); return global::System.Threading.Volatile.Read(ref handle) != 0; } }
    internal static void EnsureProcess()
    {
        if (!global::System.OperatingSystem.IsLinux()) throw new global::System.PlatformNotSupportedException("This Lean package requires Linux x86-64 with glibc");
        if (Process != CurrentProcess()) throw new global::System.InvalidOperationException("Lean calls after fork require a fresh process");
    }
    internal static nint Handle
    {
        get
        {
            EnsureProcess();
            var ready = global::System.Threading.Volatile.Read(ref handle);
            if (ready != 0) return ready;
            if (!global::System.OperatingSystem.IsLinux()
                || global::System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture != global::System.Runtime.InteropServices.Architecture.X64
                || !global::System.BitConverter.IsLittleEndian)
                throw new global::System.PlatformNotSupportedException("This Lean package requires Linux x86-64 with glibc");
            const string library = "libmutualcheckedrecords.so";
            var roots = new[] { global::System.IO.Path.Combine(global::System.AppContext.BaseDirectory, "runtimes", "linux-x64", "native"), global::System.AppContext.BaseDirectory };
            var root = global::System.Array.Find(roots, path => global::System.IO.File.Exists(global::System.IO.Path.Combine(path, library)))
                ?? throw new global::System.DllNotFoundException("The installed Lean native assets are missing");
            VerifyDirectory(root);
            if (root == roots[0]) { VerifyDirectory(global::System.IO.Path.GetDirectoryName(root)!); VerifyDirectory(global::System.IO.Path.GetDirectoryName(global::System.IO.Path.GetDirectoryName(root)!)!); }
            var libraries = new global::System.Collections.Generic.Dictionary<string, string>(global::System.StringComparer.Ordinal)
            {
                ["libcomponent_4ca822048b1456593639.so"] = "8b733eede557351ca292348ef05bcba637e1d0c13b884891a247c04892f366dc",
                ["liblean_bridge_native.so"] = "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7",
                ["libleanshared.so"] = "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4",
                ["libmutualcheckedrecords.so"] = "4c627dbbb57e9b78355774bcc2505f33695d5b3629ee9b51245f3a00adb1aee4",
            };
            foreach (var item in libraries) Verify(global::System.IO.Path.Combine(root, item.Key), item.Value);
            var domain = global::System.AppDomain.CurrentDomain;
            lock (domain)
            {
                ready = global::System.Threading.Volatile.Read(ref handle);
                if (ready != 0) return ready;
                var origin = domain.GetData(ProcessKey);
                if (origin is not null && !global::System.Object.Equals(origin, Process))
                    throw new global::System.InvalidOperationException("Lean runtime process origin differs; start a fresh process");
                if (origin is null) domain.SetData(ProcessKey, Process);
                const string key = "lean-bridge.native-library-v1.dotnet";
                var registry = domain.GetData(key) as global::System.Collections.Generic.Dictionary<string, object>;
                if (registry is null)
                {
                    registry = new(global::System.StringComparer.Ordinal);
                    domain.SetData(key, registry);
                }
                const string identity = "137cb2975ffded21021afe95f6e4cd7d33d6c5d9e605a9e0f28fd950136decdf";
                const string policy = "linux-x64-deepbind-v1";
                if (registry.TryGetValue("runtime", out var existing) && !global::System.Object.Equals(existing, identity))
                    throw new global::System.InvalidOperationException("Incompatible Lean runtime identities in one process");
                if (existing is not null && (!registry.TryGetValue("policy", out var oldPolicy) || !global::System.Object.Equals(oldPolicy, policy)))
                    throw new global::System.InvalidOperationException("Incompatible Lean native loading policy");
                if (registry.ContainsKey("failed")) throw new global::System.InvalidOperationException("Lean native loading failed earlier in this process");
                const string component = "component:mutualcheckedrecords@1.0.0";
                const string receipt = "88a4ee54bdcfe14af4e428993cd085d2cee623f7e04740f9b43c4cc8259df2bf";
                if (registry.TryGetValue(component, out var loaded))
                {
                    var entry = (global::System.Tuple<string, nint>)loaded;
                    if (entry.Item1 != receipt) throw new global::System.InvalidOperationException("Conflicting builds of the same Lean component");
                    global::System.Threading.Volatile.Write(ref handle, entry.Item2);
                    return entry.Item2;
                }
                var known = registry.TryGetValue("libraries", out var values)
                    ? (global::System.Collections.Generic.Dictionary<string, global::System.Tuple<string, nint>>)values
                    : new(global::System.StringComparer.Ordinal);
                foreach (var item in libraries)
                {
                    if (known.TryGetValue(item.Key, out var previous))
                    {
                        if (previous.Item1 != item.Value) throw new global::System.InvalidOperationException("Conflicting builds of the same native library: " + item.Key);
                        continue;
                    }
                    // RTLD_NOLOAD checks both soname and installed pathname.
                    foreach (var candidate in new[] { item.Key, global::System.IO.Path.Combine(root, item.Key) })
                    {
                        var prior = Open(candidate, 2 | 4);
                        if (prior == 0) continue;
                        Close(prior);
                        throw new global::System.InvalidOperationException("Unverified native library is already loaded: " + item.Key);
                    }
                }
                try
                {
                    registry["libraries"] = known;
                    foreach (var name in new[] { "libleanshared.so", "liblean_bridge_native.so", "libcomponent_4ca822048b1456593639.so", "libmutualcheckedrecords.so" })
                    {
                        if (known.ContainsKey(name)) continue;
                        // RTLD_NOW | RTLD_GLOBAL | RTLD_DEEPBIND isolates Lean
                        // and private GMP from a host's earlier global symbols.
                        var value = Open(global::System.IO.Path.Combine(root, name), 2 | 256 | 8);
                        if (value == 0) throw new global::System.DllNotFoundException("Cannot load verified Lean native library: " + name);
                        known[name] = global::System.Tuple.Create(libraries[name], value);
                    }
                    ready = known[library].Item2;
                    registry["runtime"] = identity; registry["policy"] = policy;
                    registry["lean"] = known["libleanshared.so"].Item2;
                    registry["broker"] = known["liblean_bridge_native.so"].Item2;
                    registry[component] = global::System.Tuple.Create(receipt, ready);
                    global::System.Threading.Volatile.Write(ref handle, ready);
                    return ready;
                }
                catch { registry["failed"] = true; throw; }
            }
        }
    }
    private static void VerifyDirectory(string path)
    {
        var attributes = global::System.IO.File.GetAttributes(path);
        if ((attributes & global::System.IO.FileAttributes.ReparsePoint) != 0 || (attributes & global::System.IO.FileAttributes.Directory) == 0)
            throw new global::System.InvalidOperationException("Native library directory must be a regular directory");
    }
    private static void Verify(string path, string expected)
    {
        var attributes = global::System.IO.File.GetAttributes(path);
        if ((attributes & (global::System.IO.FileAttributes.ReparsePoint | global::System.IO.FileAttributes.Directory)) != 0)
            throw new global::System.InvalidOperationException("Installed Lean native library must be a regular file: " + global::System.IO.Path.GetFileName(path));
        using var file = global::System.IO.File.OpenRead(path);
        if (!string.Equals(global::System.Convert.ToHexString(global::System.Security.Cryptography.SHA256.HashData(file)), expected, global::System.StringComparison.OrdinalIgnoreCase))
            throw new global::System.InvalidOperationException("Installed Lean native library differs from the compiled package: " + global::System.IO.Path.GetFileName(path));
    }

    }
    private static nint[]? symbols;
    internal static bool IsLoaded => Assets.IsLoaded;
    internal static nint[] Resolve()
    {
        Assets.EnsureProcess();
        var ready = global::System.Threading.Volatile.Read(ref symbols);
        if (ready != null) return ready;
        var handle = Assets.Handle;
        var resolved = new nint[10];
        resolved[0] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_echo_graph");
        resolved[1] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_echo_groups_graph");
        resolved[2] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_first_graph");
        resolved[3] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_groups_graph");
        resolved[4] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_produce_graph");
        resolved[5] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_second_graph");
        resolved[6] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_graph_error");
        resolved[7] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_graph_initialize");
        resolved[8] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_graph_ready");
        resolved[9] = global::System.Runtime.InteropServices.NativeLibrary.GetExport(handle, "mutualcheckedrecords_graph_retire");
        return global::System.Threading.Interlocked.CompareExchange(ref symbols, resolved, null) ?? resolved;
    }
}

internal static unsafe class GraphCalls
{
    internal static _V.Envelope Call0(_V.Envelope arg0)
    {
        // Invalid cold inputs must not load native libraries. Once loaded, the
        // converter's normal validation remains before scratch and Lean calls.
        if (!GraphNative.IsLoaded)
        {
            using var check = new GraphScope(true);
            GraphRuntime.Write3(arg0, check);
        }
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle((delegate* unmanaged[Cdecl]<uint>)symbols[7], (delegate* unmanaged[Cdecl]<int>)symbols[8], (delegate* unmanaged[Cdecl]<void>)symbols[9]);
        return GraphRuntime.CallEcho((delegate* unmanaged[Cdecl]<GraphRaw3*, GraphRaw3*, uint>)symbols[0], (delegate* unmanaged[Cdecl]<byte*>)symbols[6], lifecycle, arg0);
    }
    internal static _V.Option<_V.Envelope>[] Call1(_V.Option<_V.Envelope>[] arg0)
    {
        // Invalid cold inputs must not load native libraries. Once loaded, the
        // converter's normal validation remains before scratch and Lean calls.
        if (!GraphNative.IsLoaded)
        {
            using var check = new GraphScope(true);
            GraphRuntime.Write0(arg0, check);
        }
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle((delegate* unmanaged[Cdecl]<uint>)symbols[7], (delegate* unmanaged[Cdecl]<int>)symbols[8], (delegate* unmanaged[Cdecl]<void>)symbols[9]);
        return GraphRuntime.CallEchoGroups((delegate* unmanaged[Cdecl]<GraphRaw0*, GraphRaw0*, uint>)symbols[1], (delegate* unmanaged[Cdecl]<byte*>)symbols[6], lifecycle, arg0);
    }
    internal static global::System.Numerics.BigInteger Call2(_V.Envelope arg0)
    {
        // Invalid cold inputs must not load native libraries. Once loaded, the
        // converter's normal validation remains before scratch and Lean calls.
        if (!GraphNative.IsLoaded)
        {
            using var check = new GraphScope(true);
            GraphRuntime.Write3(arg0, check);
        }
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle((delegate* unmanaged[Cdecl]<uint>)symbols[7], (delegate* unmanaged[Cdecl]<int>)symbols[8], (delegate* unmanaged[Cdecl]<void>)symbols[9]);
        return GraphRuntime.CallFirst((delegate* unmanaged[Cdecl]<GraphRaw3*, GraphRaw5*, uint>)symbols[2], (delegate* unmanaged[Cdecl]<byte*>)symbols[6], lifecycle, arg0);
    }
    internal static global::System.Numerics.BigInteger Call3(_V.Option<_V.Envelope>[] arg0)
    {
        // Invalid cold inputs must not load native libraries. Once loaded, the
        // converter's normal validation remains before scratch and Lean calls.
        if (!GraphNative.IsLoaded)
        {
            using var check = new GraphScope(true);
            GraphRuntime.Write0(arg0, check);
        }
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle((delegate* unmanaged[Cdecl]<uint>)symbols[7], (delegate* unmanaged[Cdecl]<int>)symbols[8], (delegate* unmanaged[Cdecl]<void>)symbols[9]);
        return GraphRuntime.CallGroups((delegate* unmanaged[Cdecl]<GraphRaw0*, GraphRaw5*, uint>)symbols[3], (delegate* unmanaged[Cdecl]<byte*>)symbols[6], lifecycle, arg0);
    }
    internal static _V.Envelope Call4(global::System.Numerics.BigInteger arg0)
    {
        // Invalid cold inputs must not load native libraries. Once loaded, the
        // converter's normal validation remains before scratch and Lean calls.
        if (!GraphNative.IsLoaded)
        {
            using var check = new GraphScope(true);
            GraphRuntime.Write5(arg0, check);
        }
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle((delegate* unmanaged[Cdecl]<uint>)symbols[7], (delegate* unmanaged[Cdecl]<int>)symbols[8], (delegate* unmanaged[Cdecl]<void>)symbols[9]);
        return GraphRuntime.CallProduce((delegate* unmanaged[Cdecl]<GraphRaw5*, GraphRaw3*, uint>)symbols[4], (delegate* unmanaged[Cdecl]<byte*>)symbols[6], lifecycle, arg0);
    }
    internal static global::System.Numerics.BigInteger Call5(_V.Envelope arg0)
    {
        // Invalid cold inputs must not load native libraries. Once loaded, the
        // converter's normal validation remains before scratch and Lean calls.
        if (!GraphNative.IsLoaded)
        {
            using var check = new GraphScope(true);
            GraphRuntime.Write3(arg0, check);
        }
        var symbols = GraphNative.Resolve();
        var lifecycle = new GraphLifecycle((delegate* unmanaged[Cdecl]<uint>)symbols[7], (delegate* unmanaged[Cdecl]<int>)symbols[8], (delegate* unmanaged[Cdecl]<void>)symbols[9]);
        return GraphRuntime.CallSecond((delegate* unmanaged[Cdecl]<GraphRaw3*, GraphRaw5*, uint>)symbols[5], (delegate* unmanaged[Cdecl]<byte*>)symbols[6], lifecycle, arg0);
    }
}
