// Independent installed-NuGet consumer for checked owned aggregates.
using System;
using System.Collections.Generic;
using System.Numerics;
using LeanBridge.OwnedSubtypes;

internal static class Program
{
    private static int checks;

    private static void Check(bool value, string message)
    {
        checks++;
        if (!value) throw new Exception($"owned Subtype .NET check {checks}: {message}");
    }

    private static void Rejected(Action operation)
    {
        try { operation(); }
        catch (LeanBridgeException error)
        {
            Check(error.Status == 1, $"expected invalid argument, got status {error.Status}");
            return;
        }
        throw new Exception("expected checked-constructor rejection");
    }

    private static Bundle Bundle(Ticket ticket, int count) => new(
        ticket,
        Option<Ticket>.None,
        new[] { ticket },
        new[] { ticket },
        new Payload(new BigInteger(count), new byte[] { 0, 255 })
    );

    private static void Release(Bundle value)
    {
        value.Primary.Dispose();
        if (value.Spare.IsSome) value.Spare.Value.Dispose();
        foreach (var ticket in value.Peers) ticket.Dispose();
        foreach (var ticket in value.History) ticket.Dispose();
    }

    private static void SerialIs(Ticket ticket, int expected, string message) =>
        Check(Api.Serial(ticket) == expected, message);

    private static void Main()
    {
        var ticket = Api.NewTicket(41, "dotnet\0checked");
        var retained = ticket.Retain();
        SerialIs(ticket, 41, "fresh resource is usable");
        SerialIs(retained, 41, "explicit retain is independent");

        var valid = Bundle(ticket, 7);
        for (var index = 0; index < 25; index++)
        {
            var echoed = Api.EchoRecord(valid);
            Check(echoed.Payload.Count == 7, "selected constructor accepts a valid value");
            SerialIs(echoed.Primary, 41, "selected constructor preserves the resource");
            var alternate = Api.EchoRecordAlternate(valid);
            Check(alternate.Payload.Bytes.AsSpan().SequenceEqual(new byte[] { 0, 255 }), "alternate constructor preserves bytes");
            SerialIs(alternate.Primary, 41, "alternate constructor preserves the resource");
            Release(echoed);
            Release(alternate);
        }
        Check(!ticket.IsClosed, "borrowed calls do not consume the input owner");

        var invalid = Bundle(ticket, -1);
        Rejected(() => Api.EchoRecord(invalid));
        Rejected(() => Api.EchoRecordAlternate(invalid));
        Check(!ticket.IsClosed, "borrowed rejection preserves the input owner");
        SerialIs(ticket, 41, "borrowed rejection leaves the resource usable");

        var moving = Api.NewTicket(51, "moving");
        var kept = moving.Retain();
        Rejected(() => Api.TransferRecord(Bundle(moving, -1)));
        Check(!moving.IsClosed, "transfer rejection happens before ownership movement");
        SerialIs(moving, 51, "rejected transfer leaves the original usable");
        SerialIs(kept, 51, "rejected transfer leaves the retain usable");

        var moved = Api.TransferRecord(Bundle(moving, 9));
        Check(moving.IsClosed, "successful transfer consumes the selected owner");
        SerialIs(kept, 51, "successful transfer preserves an independent retain");
        Check(moved.Payload.Count == 9, "successful transfer preserves the checked field");
        SerialIs(moved.Primary, 51, "successful transfer returns a usable resource");

        Release(moved);
        ticket.Dispose();
        retained.Dispose();
        moving.Dispose();
        kept.Dispose();
        Check(ticket.IsClosed && retained.IsClosed && moving.IsClosed && kept.IsClosed,
            "cleanup is explicit and idempotent");

        Console.WriteLine($"owned-subtype-dotnet:{checks}");
    }
}
