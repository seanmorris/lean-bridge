using System;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.Loader;
using Call = System.Func<int,int,object?,object?>;
using Build = System.Func<string,System.Type,System.Type,System.Func<int,int,object?,object?>>;

public class Box {
    public Box(uint n) { Level=n; }
    public uint Level { get; set; }
    public uint Read()=>Level;
    public Action? Hook;
    public Box Identity() { Hook?.Invoke(); return this; }
    public Box Child()=>new(7); // No CLR reference back to its parent.
    public override bool Equals(object? other)=>other is Box;
    public override int GetHashCode()=>throw new Exception("must not hash a user object");
}
public sealed class Other { public Other Identity()=>this; }
internal static class Client {
    private const int Open=0, Close=1, Self=2, Save=3, Same=4, Recall=5, Clear=6,
        RejectSecond=7, Factory=8, Live=9, Child=10, Handles=11;
    static void Check(bool pass,[CallerArgumentExpression("pass")] string expression="") {
        if(!pass) throw new Exception(expression);
    }
    static void Fail<T>(Action action) where T:Exception {
        try { action(); } catch(T) { return; } throw new Exception("Missing "+typeof(T));
    }
    static void Collect() { GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); }
    static Build Load(AssemblyLoadContext loader,string path) =>
        loader.LoadFromAssemblyPath(path+".dll").GetType("Port")!.GetMethod("Connect")!.CreateDelegate<Build>();
    [MethodImpl(MethodImplOptions.NoInlining)]
    static WeakReference Exercise(Call a,Call b) {
        var x=new Box(1); var y=new Box(2);
        Check(x.Equals(y) && !ReferenceEquals(x,y));
        Check(((Box)a(Factory,0,null)!).Level==42 && (int)b(Live,0,null)! == 0);
        Fail<ArgumentException>(()=>a(RejectSecond,1,x)); Check((int)b(Live,0,null)! == 0);
        Check(ReferenceEquals(a(Save,0,x),x) && (bool)b(Same,0,x)! && !(bool)b(Same,0,y)!);
        Check(ReferenceEquals(b(Recall,0,null),x) && (int)b(Live,0,null)! == 1);
        Fail<InvalidOperationException>(()=>b(Recall,1,null));
        Check(!(bool)b(Same,1,x)! && (int)b(Live,0,null)! == 2);
        x.Hook=()=>Fail<InvalidOperationException>(()=>a(Close,0,null));
        Check(ReferenceEquals(a(Self,0,x),x)); x.Hook=null;
        a(Clear,0,null); Check((int)b(Live,0,null)! == 1);
        a(Close,0,null); a(Close,0,null); Fail<InvalidOperationException>(()=>a(Self,0,x));
        Check(ReferenceEquals(b(Save,1,x),x)); return new WeakReference(x);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static WeakReference Borrow(Call b) {
        var parent=new Box(1);
        Check(((Box)b(Child,0,parent)!).Level==7); return new WeakReference(parent);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static WeakReference Abandon(Build build,string lib) {
        var binding=build(lib,typeof(Box),typeof(Box)); binding(Open,0,null);
        var x=new Box(1); Check(ReferenceEquals(binding(Self,1,x),x)); return new WeakReference(x);
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static (WeakReference,WeakReference) Pair(string first,string second) {
        var one=new AssemblyLoadContext("A",true); var two=new AssemblyLoadContext("B",true);
        var buildA=Load(one,first); var buildB=Load(two,second);
        Check(one!=two && buildA.Method.DeclaringType!.Assembly!=buildB.Method.DeclaringType!.Assembly);
        var a=buildA(first+".so",typeof(Box),typeof(Box));
        var b=buildB(second+".so",typeof(Box),typeof(Box));
        a(Open,0,null);
        int baseline=(int)a(Handles,0,null)!;
        var mismatch=buildB(second+".so",typeof(Box),typeof(Other));
        Fail<ArgumentException>(()=>mismatch(Open,0,null)); Check((int)a(Handles,0,null)! == baseline);
        b(Open,0,null);
        var strong=Exercise(a,b); Collect(); Check(strong.IsAlive);
        b(Close,0,null); Collect(); Check(!strong.IsAlive && (int)b(Live,0,null)! == 0);
        b(Open,0,null); Fail<InvalidOperationException>(()=>b(Recall,1,null)); b(Clear,0,null);
        var parent=Borrow(b); Collect(); Check(parent.IsAlive && (int)b(Live,0,null)! == 1);
        b(Clear,0,null); Collect(); Check(!parent.IsAlive);
        var orphan=Abandon(buildA,first+".so"); Collect(); Check((int)b(Live,0,null)! == 1 && orphan.IsAlive);
        b(Close,0,null); Collect();
        Check(!orphan.IsAlive && (int)b(Live,0,null)! == 0 && (int)a(Handles,0,null)! == 0);
        one.Unload(); two.Unload(); return (new WeakReference(one),new WeakReference(two));
    }
    public static void Main(string[] args) {
        var ctx=Pair(args[0],args[1]);
        for(int i=0;i<12 && (ctx.Item1.IsAlive || ctx.Item2.IsAlive);i++) Collect();
        Check(!ctx.Item1.IsAlive && !ctx.Item2.IsAlive);
        Console.WriteLine("CLR shared Lean pointer; distinct kinds and equal objects; anchored borrow; rollback; zero handles; both contexts unloaded");
    }
}
