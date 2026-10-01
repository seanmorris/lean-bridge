    static void receiverMembers() {
        try (TicketValue receiver = newTicket(BigInteger.valueOf(42), "receiver");
             TicketValue other = newTicket(BigInteger.valueOf(99), "other");
             TicketValue shared = receiver.share();
             TicketValue independent = receiver.retain();
             TicketValue borrowed = receiver.retainTicket();
             TicketValue selected = receiver.chooseTicket(other)) {
            check(receiver.getSerial().equals(BigInteger.valueOf(42)), "receiver property calls Lean");
            check(receiver.get().getSerial().equals(BigInteger.valueOf(42)), "raw receiver property calls Lean");
            check(receiver.getLabel().equals("receiver"), "second getter calls Lean");
            check(selected.getSerial().equals(BigInteger.valueOf(99)), "member selects other owner");
            Value<Ticket> erased = receiver;
            try (var alias = erased.share(); var retained = erased.retain()) {
                check(alias instanceof TicketValue, "share preserves nominal owner through base");
                check(retained instanceof TicketValue, "retain preserves nominal owner through base");
            }
            receiver.close();
            check(shared.getSerial().equals(BigInteger.valueOf(42)), "shared guard preserves owner");
            shared.close();
            status(4, borrowed::getSerial);
            check(independent.getSerial().equals(BigInteger.valueOf(42)), "independent member survives release");
            check(selected.getSerial().equals(BigInteger.valueOf(99)), "other argument remains result anchor");
            other.close(); status(4, selected::getSerial);
        }
        try (TicketValue kept = Api.newTicket(BigInteger.valueOf(42), "aggregates")) {
            for (boolean raw : new boolean[] { false, true }) {
                try (TicketValue source = Api.newTicket(BigInteger.valueOf(81), "parameter");
                     TicketValue selected = raw ? kept.get().chooseTicket(source) : kept.chooseTicket(source)) {
                    check(selected.getSerial().equals(BigInteger.valueOf(81)), "raw and whole methods select argument owner");
                    source.close(); check(selected.isClosed() && kept.getSerial().intValueExact() == 42, "selected argument controls lifetime");
                }
            }
            try (BundleValue record = Api.copyEchoRecordResult(bundle(kept.get()));
                 TicketValue primary = record.getPrimary();
                 BundleValue echoed = record.echoRecord();
                 BundleValue callback = record.callbackRecord(incoming -> incoming);
                 var closure = record.makeRecord();
                 BundleValue reply = closure.get().invoke(false, bundle(kept.get()));
                 TicketValue replyPrimary = reply.getPrimary()) {
                check(primary.getSerial().intValueExact() == 42 && record.get().primary().getSerial().intValueExact() == 42, "property is separate from record field");
                check(record.getPayload().count().intValueExact() == -17, "copied record property");
                record.close();
                check(primary.isClosed() && echoed.isClosed() && callback.isClosed() && closure.isClosed(), "member descendants expire with record");
                check(!reply.isClosed() && replyPrimary.getSerial().intValueExact() == 42, "returned closure publishes independent nominal owner");
            }
            for (Choice branch : new Choice[] { new ChoiceEmpty(), new ChoiceMany(new Ticket[0]), new ChoiceOne(kept.get()) }) {
                try (ChoiceValue choice = Api.copyEchoVariantResult(branch); ChoiceValue view = choice.echoVariant()) {
                    check(view.get().equals(branch), "empty and populated variants expose members");
                    choice.close(); check(view.isClosed(), "variant receiver borrow expires");
                }
            }
            for (Tree branch : new Tree[] { new TreeBranch(new Tree[0]), new TreeLeaf(kept.get()) }) {
                try (TreeValue tree = Api.copyEchoRecursiveResult(branch); TreeValue view = tree.echoRecursive();
                     TreeValue callback = tree.callbackRecursive(incoming -> incoming); var closure = tree.makeRecursive();
                     TreeValue reply = closure.get().invoke(false, branch)) {
                    check(reply.get().equals(branch) && callback.get().equals(branch), "recursive receiver calls");
                    tree.close(); check(view.isClosed() && callback.isClosed() && closure.isClosed(), "recursive descendants expire");
                    check(!reply.isClosed(), "recursive closure reply owns its result");
                }
            }
            try (BundleValue record = Api.copyEchoRecordResult(bundle(kept.get()));
                 BundleValue alias = record.share(); BundleValue view = record.echoRecord()) {
                Ticket[] escaped = new Ticket[1];
                try (BundleValue moved = record.moveRecord(incoming -> {
                    check(record.isClosed() && alias.isClosed() && view.isClosed(), "consuming member closes aliases before callback");
                    escaped[0] = incoming.primary();
                    check(escaped[0].getSerial().intValueExact() == 42, "raw callback member during frame");
                    return incoming;
                }); TicketValue primary = moved.getPrimary()) {
                    check(primary.getSerial().intValueExact() == 42, "consuming aggregate returns nominal owner");
                    check(reject(LeanBridgeException.class, escaped[0]::getSerial).status() == 4,
                        "callback member expires with its frame");
                    escaped[0].close();
                }
            }
            try (TicketValue receiver = Api.newTicket(BigInteger.valueOf(6), "anchor");
                 TicketValue consumed = Api.newTicket(BigInteger.valueOf(9), "consumed");
                 TicketValue mixed = receiver.mixedTicket(consumed)) {
                check(!receiver.isClosed() && consumed.isClosed() && mixed.getSerial().intValueExact() == 9, "mixed receiver ownership");
                receiver.close(); check(mixed.isClosed(), "mixed result follows receiver");
            }
        }
        try (TicketValue original = newTicket(BigInteger.ONE, "consuming");
             TicketValue alias = original.share();
             TicketValue independent = original.retain();
             TicketValue result = original.transferTicket()) {
            check(original.isClosed() && alias.isClosed(), "member consumes original owner");
            check(result.getSerial().equals(BigInteger.ONE), "consuming method returns typed owner");
            check(independent.getSerial().equals(BigInteger.ONE), "independent retain survives consumption");
        }
    }
