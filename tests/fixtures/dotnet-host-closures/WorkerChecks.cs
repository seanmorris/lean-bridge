using System;
using System.Threading.Tasks;
using A=LeanBridge.Workshop;
using Binding=LeanBridge.Workshop.Bound<Box>;

internal static class WorkerChecks
{
    internal static async Task Exercise(Binding first,Box x)
    {
        using var second=A.Api.BindHosts<Box>();
        using var stale=first.Remember(x);
        using var live=second.Remember(x);
        var original=new FormatException("returned function inside worker callback");
        x.Hook=()=>throw original;
        try {
            await second.Relay(x,v=>live.Invoke(v));
            throw new Exception("lost callback failure");
        } catch(FormatException e) when(ReferenceEquals(e,original)) {}
        x.Hook=null;
        int skipped=0,completed=0;
        var cancelled=first.Relay(x,v=>{++skipped;return stale.Invoke(v);});
        var survivor=second.Relay(x,v=>{
            ++completed;
            try { second.Dispose(); throw new Exception("disposed active callback"); }
            catch(InvalidOperationException) {}
            return live.Invoke(v);
        });
        first.Dispose();
        try { stale.Invoke(x); throw new Exception("revoked function still usable"); }
        catch(ObjectDisposedException) {}
        try { await cancelled; throw new Exception("revoked task completed"); }
        catch(OperationCanceledException) {}
        if(!ReferenceEquals(await survivor,x) || skipped!=0 || completed!=1)
            throw new Exception("cancellation reached the wrong binding");
        Console.WriteLine("CLR returned functions in callbacks: original exception, cancellation, sibling completed once");
    }
}
