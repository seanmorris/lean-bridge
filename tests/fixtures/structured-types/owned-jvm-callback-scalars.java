    private static void exercise() {
        try (var ticket = newTicket(BigInteger.valueOf(42), "A\0🌱")) {
            var original = makePacket(ticket);
            check(inspect(original), "Lean constructs all nineteen scalars");
            var copy = echo(original);
            check(inspect(copy), "Java scalar packet round trips");
            check(copy.scalars().equals(original.scalars()), "all scalar values preserved");
            check(copy.scalars().bytes() != original.scalars().bytes(), "bytes copied");
            check(copy.optional().equals(original.optional()), "nested options preserved");
            check(copy.ticket() != original.ticket(), "resource wrapper independently owned");
            check(copy.scalars().text().equals("A\0🌱"), "Unicode and embedded null");
            check(copy.scalars().u64().bitLength() == 64, "unsigned 64-bit value");
            check(copy.scalars().natural().bitLength() == 129, "arbitrary precision value");
            check(copy.scalars().integer().signum() == -1, "negative integer");
            check(units(new Unit[] { Unit.INSTANCE }).length == 1, "Unit list");
            try (var kept = copy.ticket().retain()) {
                drop(copy); check(!kept.isClosed(), "retained scalar packet resource survives");
            }
            failures(() -> echo(original)); drop(original);
        }
    }
