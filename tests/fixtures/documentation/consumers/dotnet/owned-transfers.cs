using System;
using LeanBridge.OwnedAggregates;

using var original = Api.NewTicket(42, "task");
using var kept = original.Retain();
using var received = Api.RetainTicket(original);
if (!original.IsClosed || Api.Serial(received) != 42 || Api.Serial(kept) != 42)
    throw new Exception("Transfer did not preserve the retained reference.");
Console.WriteLine("transferred");
