using System;
using System.Reflection;
using A = LeanBridge.Workshop;
using B = LeanBridge.WorkshopPeer;

public class Meter {
    public Meter(uint n) { Level=n; }
    private uint level;
    public Action? OnGet,OnSet;
    public uint Level { get { OnGet?.Invoke(); return level; } set { OnSet?.Invoke(); level=value; } }
    public Func<uint>? Hook;
    public uint Read() => Hook?.Invoke() ?? Level;
    public Meter Identity() => this;
    public override bool Equals(object? v) => v is Meter;
    public override int GetHashCode() => throw new Exception("compared by hash");
}
public sealed class Other { public Other(uint n) { Level=n; } public uint Level {get;set;} public uint Read()=>Level; public Other Identity()=>this; }
internal static class Installed {
    static void Check(bool ok,[System.Runtime.CompilerServices.CallerArgumentExpression("ok")]string expr="") { if(!ok) throw new Exception(expr); }
    static E Fails<E>(Action f) where E:Exception {
        try { f(); } catch(E e) { return e; } throw new Exception("expected "+typeof(E));
    }
    public static void Main(string[] args) {
        if(args[0]=="tampered") {
            var error=Fails<InvalidOperationException>(()=>A.Api.BindHosts<Meter>());
            Check(error.Message.Contains("differs from the compiled package")); Console.WriteLine("tampered domain refused"); return;
        }
        A.Bound<Meter> a; B.Bound<Meter> b;
        if(args[0]=="ab") { a=A.Api.BindHosts<Meter>(); b=B.Api.BindHosts<Meter>(); }
        else { b=B.Api.BindHosts<Meter>(); a=A.Api.BindHosts<Meter>(); }
        using(a) using(b) {
            InstalledScalars.Test(a);
            Fails<ArgumentException>(()=>B.Api.BindHosts<Other>());
            var x=a.Make(7); var y=b.Make(5);
            Check(ReferenceEquals(a.Identity(x),x) && ReferenceEquals(b.Identity(x),x));
            Check(x.Equals(y) && !ReferenceEquals(x,y));
            a.Keep(x); Check(ReferenceEquals(a.Held(),x));
            Check(b.Update(x,42)==42 && a.Read(x)==42 && x.Level==42);
            Check(a.Verdict(true).Value==42 && b.Verdict(false).Error=="ordinary refusal");
            Check(a.Layered(x,true).Value.Value==42 && b.Layered(x,false).Value.Error=="inner refusal");
            var original=new TargetInvocationException("domain error",null);
            x.Hook=()=>throw original;
            Check(ReferenceEquals(Fails<TargetInvocationException>(()=>a.Read(x)),original));
            y.Hook=()=>b.Read(x);
            Check(ReferenceEquals(Fails<TargetInvocationException>(()=>a.Read(y)),original));
            Check(Fails<A.DeclaredError<string>>(()=>a.Mapped(x)).Payload=="host read failed");
            var declared=Fails<B.DeclaredError<string>>(()=>b.Layered(x,true));
            Check(declared.Declaration=="Peer.layered" && declared.Payload=="declared refusal");
            var io=Fails<A.LeanIOException>(()=>a.Replaced(x));
            Check(io.Declaration=="Workshop.replaced" && io.Message.Contains("replacement"));
            x.Hook=()=>{ Fails<InvalidOperationException>(a.Dispose); return 89; }; Check(a.Read(x)==89); x.Hook=null;
            Check(System.Threading.Tasks.Task.Run(()=>Fails<InvalidOperationException>(()=>a.Read(x))).Result!=null);
            Fails<ArgumentNullException>(()=>b.Read(null!));
            a.Dispose(); a.Dispose(); Fails<ObjectDisposedException>(()=>a.Read(x));
            Check(ReferenceEquals(b.Identity(x),x)); b.Dispose();
        }
        using(var reopened=A.Api.BindHosts<Meter>()) {
            Fails<InvalidOperationException>(()=>reopened.Held()); reopened.Forget();
            Check(reopened.Read(reopened.Make(19))==19);
            using var nested=B.Api.BindHosts<Meter>();
            var sentinel=new OutOfMemoryException("injected CLR fatal");
            var inner=new Meter(1) { Hook=()=>throw sentinel };
            int readsAfterFailure=0;
            var outer=new Meter(2) { OnGet=()=>readsAfterFailure++, OnSet=()=>{
                Check(ReferenceEquals(Fails<OutOfMemoryException>(()=>nested.Read(inner)),sentinel));
            }};
            // Update calls the setter followed by the getter. Catching nested B's
            // fatal inside the setter must not allow a second external effect.
            Fails<A.RuntimeUnavailableException>(()=>reopened.Update(outer,23));
            Check(readsAfterFailure==0);
            Fails<B.RuntimeUnavailableException>(()=>nested.Read(new Meter(1)));
        }
        Console.WriteLine(args[0]+": ordinary C# calls; shared identity, mutable reference, original exception, nested Except, declared EIO, stale binding and cleanup");
    }
}
