package example;

import java.math.BigInteger;

public final class CheckedMembers {
    public static final Exception MARK = new Exception("original");
    public static class Box {
        long level;
        boolean fail;
        public Box(long level) { this.level = level; }
        public long read() throws Exception { if (fail) throw MARK; return level; }
        public Box identity() { return this; }
        public void setLevel(long n) { level = n; }
        public long getLevel() { return level; }
        public static long twice(long v) { return 2*v; }
        public byte[] data(byte[] b) { b[0]++; last = b; return b; }
        public byte[] last;
        public Box peer(Box v) { return v; }
        public BigInteger big(BigInteger v) { return v; }
        public String text(String v) { return v; }
        public int ch(int v) { return v; }
        @Override public boolean equals(Object other) { return other instanceof Box; }
        @Override public int hashCode() { return 0; }
    }
    public static class Sub extends Box { public Sub(long x) { super(x); } }
    public static class Wrong {
        public Wrong(long x) {}
        public static long read() { return 1; }
    }
    public static class Narrow { public Narrow(int x) {} public long read() { return 0; } }
    static class Hidden extends Box { public Hidden(long n) { super(n); } }
    static void check(boolean b) { if (!b) throw new AssertionError(); }
    interface Action { void run() throws Throwable; }
    static void reject(Class<?> expected, Action f) throws Throwable {
        try { f.run(); } catch (Throwable e) { if (expected.isInstance(e)) return; throw e; }
        throw new AssertionError("accepted invalid operation");
    }
    public static void main(String[] args) throws Throwable {
        var h = HostContract.bind(Void.class, Box.class, Box.class);
        var box = (Box)h.invoke(Slots.create, new Object[]{4294967295L});
        check((long)h.invoke(Slots.read, new Object[]{box}) == 4294967295L);
        check(h.invoke(Slots.setLevel, new Object[]{box, 47L}) == null);
        check((long)h.invoke(Slots.getLevel, new Object[]{box}) == 47);
        check(h.invoke(Slots.identity, new Object[]{box}) == box);
        Box other = new Sub(47);
        check(other.equals(box) && other != box && h.invoke(Slots.peer, new Object[]{box,other}) == other);
        check((long)h.invoke(Slots.twice, new Object[]{23L}) == 46);
        reject(IllegalArgumentException.class, () -> h.invoke(Slots.setLevel, new Object[]{box, -1L}));
        reject(HostMembers.BoundaryFailure.class, () -> h.invoke(Slots.setLevel, new Object[]{box, 1}));
        check(box.level == 47);
        byte[] original = {3};
        byte[] copy = (byte[])h.invoke(Slots.data, new Object[]{box,original});
        check(original[0] == 3 && copy[0] == 4 && copy != box.last && box.last != original);
        var n = BigInteger.ONE.shiftLeft(180);
        check(n.equals(h.invoke(Slots.big, new Object[]{box,n})));
        reject(IllegalArgumentException.class, () -> h.invoke(Slots.big, new Object[]{box,n.negate()}));
        String s = "X\0\uD83D\uDC1D";
        check(s.equals(h.invoke(Slots.text, new Object[]{box,s})));
        reject(IllegalArgumentException.class, () -> h.invoke(Slots.text, new Object[]{box,"\uD800"}));
        check((int)h.invoke(Slots.ch, new Object[]{box, 0x1f41d}) == 0x1f41d);
        reject(IllegalArgumentException.class, () -> h.invoke(Slots.ch, new Object[]{box, 0xdc00}));
        box.fail = true;
        try { h.invoke(Slots.read, new Object[]{box}); throw new AssertionError(); }
        catch (Exception e) { check(e == MARK); }
        box.fail = false;
        box.level = -1;
        reject(HostMembers.BoundaryFailure.class, () -> h.invoke(Slots.read, new Object[]{box}));
        reject(IllegalArgumentException.class, () -> HostContract.bind(Void.class, Wrong.class, Box.class));
        reject(IllegalArgumentException.class, () -> HostContract.bind(Void.class, Narrow.class, Box.class));
        reject(IllegalArgumentException.class, () -> HostContract.bind(Void.class, Hidden.class, Box.class));
        System.out.println("exact members, object identity, checked scalars and original Throwable");
    }
}
