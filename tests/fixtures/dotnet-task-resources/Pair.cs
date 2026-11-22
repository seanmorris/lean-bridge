using System;
using LeanBridge.Resources.Shared;
using LeanBridge.LeaseDepot;
using Desk = LeanBridge.LeaseDesk.Api;
using Depot = LeanBridge.LeaseDepot.Api;

LeanRuntime.Run(async () =>
{
    using Ticket ticket = Desk.Issue(40);
    using Ticket retained = ticket.Retain();
    using Ticket result = await Depot.Revisit(ticket, n => n + 2);
    ticket.Dispose();
    if (Desk.Count(result) != 42 || !retained.SameResource(result)) throw new Exception("Identity or mutation lost");
    try { using var unexpected = await Depot.Checked(true, retained); throw new Exception("Expected EIO"); }
    catch (DeclaredError<Ticket> error)
    {
        using Ticket payload = error.Payload;
        if (!payload.SameResource(result)) throw new Exception("Wrong EIO payload");
    }
});
Console.WriteLine("Ticket, Task<Ticket> and DeclaredError<Ticket> compose across the two installed packages");
