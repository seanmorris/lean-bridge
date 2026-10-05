import lean_variants as lb

lb.echo(lb.ModeFirst())
lb.SignalData("not a count", "text")
lb.SignalData(1, b"not text")
lb.SignalMarker(0)
lb.echo({"kind": "idle"})
lb.NestedOutcome(lb.Ok((lb.SignalIdle(), lb.SignalStopped())))
lb.BuffersPair("not bytes", b"")
lb.OneOnly(1).value = 2
