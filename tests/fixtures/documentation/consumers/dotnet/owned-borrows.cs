using System;
using LeanBridge.OwnedAggregates;

using var original = Api.NewTicket(42, "task");
using var borrowed = Api.RetainTicket(original);
using var kept = borrowed.Retain();
original.Dispose();
if (!borrowed.IsClosed)
    throw new Exception("The borrowed result outlived its original owner.");
Console.WriteLine(Api.Serial(kept.Get()));
