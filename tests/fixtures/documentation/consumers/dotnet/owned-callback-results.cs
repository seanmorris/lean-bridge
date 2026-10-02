using System;
using LeanBridge.OwnedAggregates;

using var ticket = Api.NewTicket(42, "example");
var value = new Bundle(ticket.Get(), Option<Ticket>.None,
    Array.Empty<Ticket>(), Array.Empty<Ticket>(), new Payload(0, new byte[0]));
using var original = Api.CopyValue(value);
using var closure = Api.MakeRecord(value);
using var borrowed = closure.Get().Invoke(false, original);
using var kept = borrowed.Retain();
Console.WriteLine(Api.Serial(borrowed.Get().Primary));

original.Dispose();
if (!borrowed.IsClosed)
    throw new Exception("The callback result outlived its original owner.");
Console.WriteLine(Api.Serial(kept.Get().Primary));
