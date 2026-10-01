using System;
using LeanBridge.OwnedAggregates;

using var original = Api.NewTicket(42, "example");
Console.WriteLine(original.Serial);

using var borrowed = original.RetainTicket();
using var independent = borrowed.Retain();
original.Dispose();
if (!borrowed.IsClosed)
    throw new InvalidOperationException("The borrowed result must expire with its owner.");

Console.WriteLine(independent.Serial);
