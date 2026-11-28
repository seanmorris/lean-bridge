using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading;
using A=LeanBridge.Workshop;
using Binding=LeanBridge.Workshop.Bound<Box>;

public sealed class Box(uint level)
{
    public uint Level { get; set; }=level;
    public Action? Hook;
    public uint Read() { Hook?.Invoke(); return Level; }
    public Box Identity() => this;
}

internal static class Client
{
    static void Check(bool yes,[CallerArgumentExpression("yes")]string expr="") { if(!yes) throw new Exception(expr); }
    static E Reject<E>(Action f) where E:Exception
    {
        try { f(); } catch(E e) { return e; }
        throw new Exception("Expected "+typeof(E).Name);
    }
    static void Collect()
    {
        for(int i=0;i<3;++i) { GC.Collect();GC.WaitForPendingFinalizers();A.Api.DrainHostCloses(); }
        GC.Collect();
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (Binding.ReturnedReader,WeakReference) Keep(Binding owner)
    {
        var x=owner.Make(40);return (owner.Reader(x),new WeakReference(x));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (WeakReference,WeakReference) ForgetFunction(Binding owner)
    {
        var x=owner.Make(7); var f=owner.Reader(x);return (new WeakReference(f),new WeakReference(x));
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (Binding.ReturnedRemember, WeakReference, WeakReference, Action) Orphan()
    {
        Binding? binding=A.Api.BindHosts<Box>(); var x=binding.Make(7);
        return (binding.Remember(x),new WeakReference(x),new WeakReference(binding),()=>binding=null);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void FinishCall(Binding.ReturnedRemember f,WeakReference capture,Action abandon,Box y)
    {
        y.Hook=()=>{abandon();GC.Collect();GC.WaitForPendingFinalizers();A.Api.DrainHostCloses();};
        Check(ReferenceEquals(f.Invoke(y),capture.Target)); y.Hook=null;
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (Binding.ReturnedReader,WeakReference) Fatal(Binding a)
    {
        var x=a.Make(8);var fn=a.Reader(x);
        // An explicitly thrown managed exception exercises the fatal path.
        // This does not exhaust process memory.
        var original=new OutOfMemoryException("intentional member failure");
        x.Hook=()=>throw original;
        Check(ReferenceEquals(Reject<OutOfMemoryException>(()=>fn.Invoke(0)),original));
        return (fn,new WeakReference(x));
    }
    static void Run(string mode)
    {
        using var a=A.Api.BindHosts<Box>(); using var b=A.Api.BindHosts<Box>();
        var (sibling,second)=Keep(b);
        if(mode=="poison")
        {
            var (fn,first)=Fatal(a);
            Reject<A.RuntimeUnavailableException>(()=>sibling.Invoke(2));
            fn.Dispose();fn.Dispose();Collect(); Check(!first.IsAlive && second.IsAlive);
            b.Dispose();Collect(); Check(!second.IsAlive);
            Console.WriteLine("retired CLR runtime: original fatal exception and binding-local cleanup");return;
        }
        var (reader,capture)=Keep(a);var x=a.Make(12);var y=a.Make(19);
        Reject<ArgumentNullException>(()=>a.Reader(null!));
        using var remember=a.Remember(x);
        Check(remember.GetType().GetConstructors().Length==0);
        Check(remember.GetType().GetMethod("Invoke",new[]{typeof(Box)})?.ReturnType==typeof(Box));
        Reject<ArgumentNullException>(()=>remember.Invoke(null!));
        Check(ReferenceEquals(remember.Invoke(y),x) && reader.Invoke(2)==42);
        using(var identity=a.IdentityReader(x)) {
            Check(ReferenceEquals(identity.Invoke(0),x));
            x.Level=25;
            Check(identity.Invoke(1).Level==25);
        }
        var expected=new FormatException("from the application");
        y.Hook=()=>throw expected;
        Check(ReferenceEquals(Reject<FormatException>(()=>a.Remember(y)),expected));
        Check(ReferenceEquals(Reject<FormatException>(()=>remember.Invoke(y)),expected));
        var thread=new Thread(()=>{
            Reject<A.WrongContextException>(()=>reader.Invoke(1));
            Reject<A.WrongContextException>(reader.Dispose);
            Reject<A.WrongContextException>(a.Dispose);
        });thread.Start();thread.Join();
        y.Hook=()=>{
            Check(reader.Invoke(3)==43);remember.Dispose();
            Reject<ObjectDisposedException>(()=>remember.Invoke(y));
            Reject<InvalidOperationException>(a.Dispose);
        };
        Check(ReferenceEquals(remember.Invoke(y),x));y.Hook=null;
        var (unowned,unused)=ForgetFunction(a);Collect();Check(!unowned.IsAlive);Check(!unused.IsAlive);
        var (orphan,held,owner,abandon)=Orphan();
        FinishCall(orphan,held,abandon,y);Collect();Check(!owner.IsAlive && !held.IsAlive);
        Reject<ObjectDisposedException>(()=>orphan.Invoke(y));orphan.Dispose();
        a.Dispose(); Collect(); Check(!capture.IsAlive && second.IsAlive);
        using var replacement=A.Api.BindHosts<Box>();Reject<ObjectDisposedException>(()=>reader.Invoke(1));reader.Dispose();
        Check(sibling.Invoke(2)==42);sibling.Dispose();Collect();Check(!second.IsAlive);
        Console.WriteLine("CLR functions: original object and exception, reentry, stale lease and owner-thread cleanup");
    }
    public static void Main(string[] args)
    {
        Run(args.Length==0?"normal":args[0]);
#if WORKER
        if(args.Length==0) A.LeanRuntime.Run(async ()=>{
            using var a=A.Api.BindHosts<Box>();var x=a.Make(4);
            Check(ReferenceEquals(x,await a.EchoBox(x)));
            using var file=a.FileReader();
            Check(Reject<A.LeanIOException>(()=>file.Invoke("missing-file")).Declaration=="Closures.fileReader");
            foreach(string s in new[]{"one","different"}){File.WriteAllText("input",s);Check(file.Invoke("input")==s);}
            Console.WriteLine("CLR future and file-reading closure passed");
            await WorkerChecks.Exercise(a,x);
        });
#endif
        Collect();
        // Test witness only. The public client never handles a registry entry.
        var refs=AppDomain.CurrentDomain.GetData("lean-bridge.dotnet.private-host-references.v1")
            as Tuple<Dictionary<ulong,object>,Dictionary<ulong,WeakReference<object>>,StrongBox<ulong>>;
        Check(refs!=null && refs.Item1.Count==0 && refs.Item2.Count==0);
    }
}
