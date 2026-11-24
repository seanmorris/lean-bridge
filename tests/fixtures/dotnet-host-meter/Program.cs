using System;
using System.Numerics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using LeanBridge.GeneratedHost;

public sealed partial class Box {
    public uint Level { get; set; }
    public Box(uint n) { Level=n; }
    public uint Read() => Level;
    public Box Identity() => this;
    public static Func<uint,uint> Handler = n => n*2;
    public static uint Observe(uint n) => Handler(n);
    public static uint Observe(int n) => throw new Exception("wrong overload");
}
internal static unsafe class Program {
    private static HostMembers binding = null!;
    private static delegate* unmanaged[Cdecl]<ulong,delegate* unmanaged[Cdecl]<ulong,int,ulong*,nuint,ulong*,uint*,int>,int,uint,uint*,uint*,int> entry;
    internal static void Check(bool good) { if(!good) throw new Exception("check failed"); }
    static uint Call(int op,uint n) {
        using var frame=new HostCall(binding.InvokeWire);
        uint number=0, fault=0; int status=entry(frame.Id,HostCall.Entry,op,n,&number,&fault);
        frame.Check(fault);
        return status switch { 0=>number, 1=>throw new System.IO.IOException("replaced"), 2=>throw new InvalidOperationException("retired"),
            4=>throw new ApplicationException("mapped in Lean"), _=>throw new Exception("invalid status") };
    }
    public static int Main(string[] args) {
        entry=(delegate* unmanaged[Cdecl]<ulong,delegate* unmanaged[Cdecl]<ulong,int,ulong*,nuint,ulong*,uint*,int>,int,uint,uint*,uint*,int>)
            NativeLibrary.GetExport(NativeLibrary.Load(args[0]),"frame_call");
        binding=HostContract.Bind(typeof(Box));
        var x=(Box)binding.Invoke(Slots.New,11U)!; var y=(Box)binding.Invoke(Slots.New,11U)!;
        Check(!ReferenceEquals(x,y) && ReferenceEquals(binding.Invoke(Slots.Identity,x),x));
        binding.Invoke(Slots.Set,x,37U); Check((uint)binding.Invoke(Slots.Get,x)! == 37U && (uint)binding.Invoke(Slots.Read,y)! == 11U);
        try { binding.Invoke(Slots.Set,x,-1); throw new Exception(); } catch(HostMembers.BadValue){Check(x.Level==37U);}
        try { HostContract.Bind(typeof(string)); throw new Exception(); } catch(ArgumentException){}
        Check(Call(0,5)==11);
        Check(Call(5,0)==41 && Box.Units==1);
        Box.InvalidNat=true;
        try { Call(5,0); throw new Exception(); } catch(HostMembers.BadValue seen) { Check(seen.InnerException is ArgumentOutOfRangeException); }
        Box.InvalidNat=false;
        Box.InvalidText=true;
        try { Call(5,0); throw new Exception(); } catch(HostMembers.BadValue seen) { Check(seen.InnerException is System.Text.EncoderFallbackException); }
        Box.InvalidText=false;
        Box.Handler = n => n==2 ? Call(0,10)+1 : n*2;
        Check(Call(0,2)==23);
        var a=new TargetInvocationException("same",new Exception()); var b=new TargetInvocationException("same",new Exception());
        Box.Handler=n=>throw (n==5?a:b);
        for(int i=0;i<12;i++) {
            try { Call(1,5); throw new Exception(); } catch(TargetInvocationException caught) { Check(ReferenceEquals(caught,a)); }
        }
        try { Call(2,5); throw new Exception(); } catch(ApplicationException e) { Check(e.Message=="mapped in Lean"); }
        try { Call(3,5); throw new Exception(); } catch(System.IO.IOException e) { Check(e.Message=="replaced"); }
        Check(Call(4,5)==999);
        Task.Run(() => { try { Call(4,5); throw new Exception(); } catch(InvalidOperationException e) { Check(e.Message.Contains("main thread")); } }).GetAwaiter().GetResult();
        var fatal=new OutOfMemoryException("injected"); Box.Handler=n=>throw fatal;
        try { Call(4,5); throw new Exception(); } catch(OutOfMemoryException seen) { Check(ReferenceEquals(fatal,seen)); }
        Box.Handler=n=>throw new Exception("retired runtime called host");
        try { Call(0,5); throw new Exception(); } catch(InvalidOperationException e) { Check(e.Message=="retired"); }
        Console.WriteLine("CLR: 19 generated scalar imports, exact members, nested native reentry, original exception identity, mapped/replaced/caught errors, wrong thread, fatal retirement");
        return 0;
    }
}
