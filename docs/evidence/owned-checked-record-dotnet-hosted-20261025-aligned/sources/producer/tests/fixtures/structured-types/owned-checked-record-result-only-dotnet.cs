using System;
using System.Numerics;
using LeanBridge.OwnedCheckedRecords;

static class Consumer
{
    private static int checks;
    private static void Check(bool value) { checks++; if (!value) throw new Exception("check"); }
    public static void Main()
    {
        using var ticket = Api.NewTicket(new BigInteger(20), "result-only");
        var produced = Api.ClaimFor(ticket);
        Check(produced.IsSome);
        Check(produced.Value.Quota == BigInteger.Zero);
        Check(Api.Serial(produced.Value.Holder) == new BigInteger(20));
        produced.Value.Holder.Dispose(); ticket.Dispose();
        Check(ticket.IsClosed);
        Console.WriteLine($"owned-checked-record-result-only-dotnet:{checks}");
    }
}
