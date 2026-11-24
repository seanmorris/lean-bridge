using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using State = System.Tuple<System.Collections.Generic.Dictionary<ulong,object>,System.Collections.Generic.Dictionary<ulong,System.WeakReference<object>>,System.Runtime.CompilerServices.StrongBox<ulong>>;

namespace LeanBridge.GeneratedHost;

// Only BCL types cross AssemblyLoadContext boundaries. Tokens are never recycled
// and are not GCHandle addresses. No application Equals/GetHashCode is invoked.
internal static class HostRefs {
    private const string Key="lean-bridge.dotnet.private-host-references.v1";
    private static State Shared() {
        var domain=AppDomain.CurrentDomain;
        lock(domain) {
            if(domain.GetData(Key) is State old) return old;
            if(domain.GetData(Key)!=null) throw new InvalidOperationException("Incompatible CLR host reference table");
            var value=new State(new(),new(),new StrongBox<ulong>(0)); domain.SetData(Key,value); return value;
        }
    }
    private static readonly State state=Shared();
    internal static int Count => state.Item1.Count + state.Item2.Count;
    internal static ulong Add(object v,bool weak=false) {
        ArgumentNullException.ThrowIfNull(v);
        ulong id=checked(++state.Item3.Value);
        if(weak) state.Item2.Add(id,new WeakReference<object>(v)); else state.Item1.Add(id,v);
        return id;
    }
    internal static object? Read(ulong id) {
        if(state.Item1.TryGetValue(id,out var v)) return v;
        if(state.Item2.TryGetValue(id,out var weak)) return weak.TryGetTarget(out var target)?target:null;
        throw new InvalidOperationException("Stale internal CLR reference");
    }
    internal static void Drop(ulong id) {
        if(id!=0 && !state.Item1.Remove(id) && !state.Item2.Remove(id)) throw new InvalidOperationException("Internal CLR reference already released");
    }
}
