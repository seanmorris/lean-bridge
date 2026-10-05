    private static int memberCollections;
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static TicketValue TemporaryMemberReceiver()
    {
        var owner = Api.NewTicket(42, "temporary member");
        var guard = new WeakReference(owner.Guard);
        wholeReadHook = () => allocationHook = () => {
            GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
            memberCollections++;
            Check(guard.IsAlive, "temporary nominal receiver remains rooted throughout native call");
        };
        return owner;
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void ReceiverMembers()
    {
        using var owner = Api.NewTicket(42, "member\0🙂");
        Check(owner.Serial == 42 && owner.Get().Serial == 42, "read-only property on whole and raw owners");
        Check(owner.Label == "member\0🙂" && owner.Get().Label == owner.Label, "Unicode property");
        var serial = typeof(TicketValue).GetProperty("Serial");
        Check(serial is not null && !serial.CanWrite && serial.GetMethod!.IsPublic, "actual public read-only C# property");
        Check(serial!.GetValue(owner) is BigInteger value && value == 42, "property reflection dispatch");
        using var view = owner.RetainTicket();
        using var child = view.RetainTicket();
        using var kept = view.Retain();
        var copied = owner.Label;
        Func<TicketValue> later = owner.RetainTicket;
        owner.Dispose();
        Check(view.IsClosed && child.IsClosed && copied == "member\0🙂", "receiver descendants expire, copied property survives");
        Reject<LeanBridgeException>(() => { _ = view.Serial; }, 4);
        Reject<LeanBridgeException>(() => later(), 4);
        Check(kept.Serial == 42, "typed independent retention survives owner closure");
        Value<Ticket> erased = kept;
        using var shared = erased.Share();
        using var retained = erased.Retain();
        Check(shared is TicketValue && retained is TicketValue, "generic base dispatch preserves nominal owner type");
        Check(((TicketValue)shared).Serial == 42 && ((TicketValue)retained).Serial == 42, "retained and shared member APIs");
        for (int index = 0; index < 3; index++)
        {
            Check(TemporaryMemberReceiver().Serial == 42, "temporary copied property result");
            Check(TemporaryMemberReceiver().Label == "temporary member", "temporary string property result");
            using var selected = TemporaryMemberReceiver().ChooseTicket(kept);
            Check(selected.Serial == 42, "temporary method receiver");
        }
        Check(memberCollections == 9, "all optimized nominal receiver GC schedules executed");

        foreach (var raw in new[] { false, true })
        {
            using var source = Api.NewTicket(81, "parameter anchor");
            using var chosen = raw ? kept.Get().ChooseTicket(source) : kept.ChooseTicket(source);
            Check(chosen.Serial == 81, "method borrows from the selected non-receiver argument");
            source.Dispose();
            Check(chosen.IsClosed && kept.Serial == 42, "parameter lifetime is not receiver lifetime");
        }
        using (var receiver = Api.NewTicket(1, "receiver"))
        using (var source = Api.NewTicket(2, "source"))
        using (var selected = receiver.ChooseTicket(source))
        {
            receiver.Dispose();
            Check(selected.Serial == 2, "closing receiver does not expire parameter-anchored result");
            source.Dispose(); Check(selected.IsClosed, "closing parameter expires its result");
        }

        using (var record = Api.CopyValue(Bundle(kept.Get())))
        {
            using var primary = record.Primary;
            Check(primary.Serial == 42 && record.Get().Primary.Serial == 42, "owner property is distinct from record field");
            Check(record.Payload.Count == -17 && record.Payload.Bytes[1] == 255, "copied record property");
            using var recordView = record.EchoRecord();
            using var callbackView = record.CallbackRecord(incoming => incoming);
            using var closure = record.MakeRecord();
            using var reply = closure.Get().Invoke(false, Bundle(kept.Get()));
            using var replyPrimary = reply.Primary;
            Check(replyPrimary.Serial == 42, "returned closure publishes a nominal owner");
            record.Dispose();
            Check(primary.IsClosed && recordView.IsClosed && callbackView.IsClosed && closure.IsClosed, "record receiver children expire");
            Check(!reply.IsClosed && replyPrimary.Serial == 42, "closure reply has its own owner");
        }
        foreach (Choice branch in new Choice[] { new ChoiceEmpty(), new ChoiceMany(Array.Empty<Ticket>()), new ChoiceOne(kept.Get()) })
        {
            using var choice = Api.CopyValue(branch);
            using var borrowed = choice.EchoVariant();
            Check(borrowed.Get().Equals(branch), "each variant case exposes the same owner method");
            choice.Dispose(); Check(borrowed.IsClosed, "empty and nonempty variant borrows expire");
        }
        foreach (Tree branch in new Tree[] { new TreeBranch(Array.Empty<Tree>()), new TreeLeaf(kept.Get()) })
        {
            using var tree = Api.CopyValue(branch);
            using var borrowed = tree.EchoRecursive();
            using var callback = tree.CallbackRecursive(incoming => incoming);
            using var closure = tree.MakeRecursive();
            using var reply = closure.Get().Invoke(false, branch);
            Check(reply.Get().Equals(branch) && callback.Get().Equals(branch), "recursive receiver calls");
            tree.Dispose();
            Check(borrowed.IsClosed && callback.IsClosed && closure.IsClosed, "recursive receiver descendants expire");
            Check(!reply.IsClosed && reply.Get().Equals(branch), "recursive closure returns independent owner");
        }
        using (var root = Api.NewTicket(12, "consuming receiver"))
        using (var alias = root.Share())
        using (var dependent = root.RetainTicket())
        using (var moved = root.TransferTicket())
        {
            Check(root.IsClosed && alias.IsClosed && dependent.IsClosed && moved.Serial == 12, "method consumes the original whole owner");
        }
        using (var record = Api.CopyValue(Bundle(kept.Get())))
        using (var alias = record.Share())
        using (var dependent = record.EchoRecord())
        {
            Ticket? escaped = null;
            using var moved = record.MoveRecord(incoming => {
                Check(record.IsClosed && alias.IsClosed && dependent.IsClosed, "consuming method closes aliases before callback");
                escaped = incoming.Primary;
                Check(escaped.Serial == 42, "raw callback receiver works during its frame");
                return incoming;
            });
            using var primary = moved.Primary;
            Check(primary.Serial == 42, "consuming aggregate receiver publishes typed result");
            Reject<LeanBridgeException>(() => { _ = escaped!.Serial; }, 4);
            escaped!.Dispose();
        }
        using (var receiver = Api.NewTicket(6, "anchor"))
        using (var consumed = Api.NewTicket(9, "moved"))
        using (var mixed = receiver.MixedTicket(consumed))
        {
            Check(!receiver.IsClosed && consumed.IsClosed && mixed.Serial == 9, "one argument consumed, receiver borrowed");
            receiver.Dispose(); Check(mixed.IsClosed, "mixed method keeps receiver anchor");
        }
    }
