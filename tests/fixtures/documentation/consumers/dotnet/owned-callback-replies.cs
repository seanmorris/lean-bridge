using System;
using LeanBridge.OwnedAggregates;

using var ticket = Api.NewTicket(42, "example");
var value = new Bundle(ticket.Get(), Option<Ticket>.None,
    Array.Empty<Ticket>(), Array.Empty<Ticket>(), new Payload(0, new byte[0]));
using var whole = Api.CopyValue(value);
using var rawReply = Api.CallbackRecord(value, borrowed => borrowed);
using var wholeReply = Api.CallbackRecord(value, borrowed => whole);
whole.Dispose();
Console.WriteLine(Api.Serial(rawReply.Get().Primary));
Console.WriteLine(Api.Serial(wholeReply.Get().Primary));
