    private static void same(Ticket ticket, BigInteger expected) {
        check(serial(ticket).equals(expected), "resource identity payload");
    }
    private static void exercise() {
        var huge = BigInteger.ONE.shiftLeft(200).add(BigInteger.valueOf(37));
        try (var ticket = newTicket(huge, "Java\0🌱")) {
            check(label(ticket).equals("Java\0🌱"), "UTF8 resource label");
            var payload = new Payload(huge.negate(), new byte[] { 0, -1, 1 });
            var bundle = new Bundle(ticket, Option.some(ticket), new Ticket[] { ticket, ticket }, new Ticket[] { ticket }, payload);
            var copied = echoRecord(bundle);
            same(copied.primary(), huge); same(copied.spare().value(), huge);
            check(copied.payload().equals(payload) && copied.peers().length == 2 && copied.history().length == 1, "record children");
            check(copied.primary() != copied.peers()[0], "aliases are separate wrappers");
            copied.primary().close(); same(copied.peers()[1], huge); drop(copied);
            var alias = echoAlias(bundle); same(alias.primary(), huge); drop(alias);
            var array = echoArray(new Ticket[] { ticket, ticket }); check(array.length == 2, "array"); drop(array);
            var list = echoList(new Ticket[] { ticket }); same(list[0], huge); drop(list);
            check(!echoOption(Option.none()).isSome(), "none");
            var option = echoOption(Option.some(ticket)); same(option.value(), huge); drop(option);
            Option<Ticket>[] rowInput = new Option[] { Option.none(), Option.some(ticket) };
            var row = echoRow(rowInput);
            check(!row[0].isSome(), "alias row none"); same(row[1].value(), huge); drop(row);
            var product = new Pair<>(ticket, new Pair<>(Option.some(ticket), payload));
            var copiedProduct = echoTuple(product); same(copiedProduct.first(), huge);
            check(copiedProduct.second().second().equals(payload), "nested product"); drop(copiedProduct);
            for (Result<Bundle, Ticket> result : List.<Result<Bundle, Ticket>>of(Result.ok(bundle), Result.err(ticket))) {
                var echoed = echoResult(result); check(echoed.isOk() == result.isOk(), "result branches"); drop(echoed);
            }
            for (Choice value : new Choice[] { new ChoiceEmpty(), new ChoiceOne(ticket), new ChoicePair(ticket, ticket), new ChoiceMany(new Ticket[] { ticket, ticket }) }) {
                var echoed = echoVariant(value); check(echoed.getClass() == value.getClass(), "all variant constructors"); drop(echoed);
            }
            var tree = new TreeBranch(new Tree[] { new TreeLeaf(ticket), new TreeBranch(new Tree[] { new TreeLeaf(ticket) }) });
            var copiedTree = echoRecursive(tree);
            check(copiedTree instanceof TreeBranch branch && branch.children().length == 2, "recursive array edge"); drop(copiedTree);
            Chain chain = new ChainStop();
            for (int i = 0; i < 40; i++) chain = new ChainLink(ticket, Option.some(chain));
            var copiedChain = echoChain(chain); check(copiedChain instanceof ChainLink, "boxed nominal recursion"); drop(copiedChain);
            Option<Result<Bundle, Ticket>>[][] nested = new Option[][] {
                { Option.none(), Option.some(Result.ok(bundle)), Option.some(Result.err(ticket)) }
            };
            var copiedNested = echoNested(nested); check(copiedNested[0].length == 3, "nested array/list/option/result"); drop(copiedNested);
            var mixed = new Mixed(ticket, new Option[] { Option.none(), Option.some(Option.none()), Option.some(Option.some(false)) },
                Option.some(Unit.INSTANCE), Result.ok(bundle), huge.negate(), huge, 0x1f331, -0.0, 1.5f,
                new byte[] { 0, -1 }, new BigInteger[] { BigInteger.ZERO, BigInteger.ONE.shiftLeft(64).subtract(BigInteger.ONE) },
                product, new ChainLink(ticket, Option.some(new ChainStop())));
            var copiedMixed = echoMixed(mixed);
            check(!copiedMixed.markers()[2].value().value() && copiedMixed.signed().equals(huge.negate()), "mixed copied and owned values"); drop(copiedMixed);
            try (var closure = makeRecord(bundle); var kept = closure.retain()) {
                closure.close(); var value = kept.invoke(true, bundle); same(value.primary(), huge); drop(value);
                var supplied = kept.asCallback().invoke(false, bundle); same(supplied.primary(), huge); drop(supplied);
            }
            try (var recursive = makeRecursive(tree)) {
                var value = recursive.invoke(true, tree); check(value instanceof TreeBranch, "returned recursive closure"); drop(value);
            }
            var cycles = new Tree[1]; cycles[0] = new TreeBranch(cycles);
            reject(IllegalArgumentException.class, () -> echoRecursive(cycles[0]));
            reject(IllegalArgumentException.class, () -> cycles[0].hashCode());
            reject(IllegalArgumentException.class, () -> echoRecord(null));
            reject(IllegalArgumentException.class, () -> echoOption((Option)Option.some("wrong")));
            reject(IllegalArgumentException.class, () -> echoResult((Result)Result.ok("wrong")));
            Option<Ticket>[] invalidRow = new Option[] { Option.some("wrong") };
            reject(IllegalArgumentException.class, () -> echoRow(invalidRow));
            reject(IllegalArgumentException.class, () -> echoArray(new Ticket[] { null }));
            reject(_OwnedConvert.Limit.class, () -> echoArray(new Ticket[262145]));
            reject(_OwnedConvert.Limit.class, () -> echoMixed(with(mixed, "bytes", new byte[16 * 1024 * 1024])));
            Chain deep = new ChainStop();
            for (int i = 0; i < 130; i++) deep = new ChainLink(ticket, Option.some(deep));
            Chain tooDeep = deep; reject(_OwnedConvert.Limit.class, () -> echoChain(tooDeep));
            failures(() -> echoMixed(mixed)); failures(() -> makeRecord(bundle));
            var independent = ticket.retain(); ticket.close(); same(independent, huge);
            reject(LeanBridgeException.class, () -> echoRecord(bundle)); independent.close();
        }
    }
