using System;
using System.Linq;
using System.Numerics;
using LeanBridge.Checkedrecords;
class Consumer {
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception("checked-record assertion failed"); checks++; }
    static BigInteger N(long value) => new BigInteger(value);
    // BEGIN CHECKED INPUT HELPERS
    static bool Rejected(Action call, string message) {
        try { call(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == message; }
        return false;
    }
    // END CHECKED INPUT HELPERS
    static void Main() {
        var big = BigInteger.One << 100;
        // BEGIN CHECKED INPUT CASES
        var good = new Interval(N(3), N(10));
        var bad = new Interval(N(9), N(3));
        var values = new BigInteger[] { N(9), N(2), N(4) };
        var triple = new Triple(values);
        Check(Api.Width(good) == N(7));
        Check(Api.Width(new Interval(N(1), N(1))) == N(0));
        Check(Api.Width(new Interval(big, big + N(9))) == N(9));
        Check(Api.Span(good, new Interval(N(5), N(20))) == N(17));
        Check(Rejected(() => Api.Width(bad), "value0 was rejected by CheckedRecords.mkInterval"));
        Check(Rejected(() => Api.Span(bad, good), "value0 was rejected by CheckedRecords.mkInterval"));
        Check(Rejected(() => Api.Span(good, bad), "value1 was rejected by CheckedRecords.mkInterval"));
        Check(Api.Total(triple) == N(15));
        Check(Api.FirstOf(triple) == N(9));
        Check(Api.Smallest(triple) == N(2));
        Check(triple.Data.SequenceEqual(new BigInteger[] { N(9), N(2), N(4) }) && values.SequenceEqual(new BigInteger[] { N(9), N(2), N(4) }));
        Check(Api.Scale(N(3), triple).Data.SequenceEqual(new BigInteger[] { N(27), N(6), N(12) }));
        Check(triple.Data.SequenceEqual(new BigInteger[] { N(9), N(2), N(4) }) && values.SequenceEqual(new BigInteger[] { N(9), N(2), N(4) }));
        Check(Rejected(() => Api.Total(new Triple(new BigInteger[] {  })), "value0 was rejected by CheckedRecords.mkTriple"));
        Check(Rejected(() => Api.FirstOf(new Triple(new BigInteger[] { N(1), N(2) })), "value0 was rejected by CheckedRecords.mkTriple"));
        Check(Rejected(() => Api.Smallest(new Triple(new BigInteger[] { N(4), N(3), N(2), N(1) })), "value0 was rejected by CheckedRecords.sortedTriple"));
        Check(Rejected(() => Api.Scale(N(3), new Triple(new BigInteger[] { N(1), N(2) })), "value1 was rejected by CheckedRecords.mkTriple"));
        Check(Api.Complement(new Percent(N(0))) == N(100));
        Check(Api.Complement(new Percent(N(100))) == N(0));
        Check(Rejected(() => Api.Complement(new Percent(N(101))), "value0 was rejected by CheckedRecords.mkPercent"));
        Check(Rejected(() => Api.Complement(new Percent(big)), "value0 was rejected by CheckedRecords.mkPercent"));
        for (int i = 0; i < 1000; ++i) {
            Check(Rejected(() => Api.Width(new Interval(N(i + 1), N(i))), "value0 was rejected by CheckedRecords.mkInterval"));
            Check(Api.Width(new Interval(N(i), N(i + 7))) == N(7));
            Check(Rejected(() => Api.Total(new Triple(new BigInteger[] { N(1), N(2) })), "value0 was rejected by CheckedRecords.mkTriple"));
            Check(Api.Total(triple) == N(15));
            Check(Rejected(() => Api.Smallest(new Triple(new BigInteger[] { N(4), N(3), N(2), N(1) })), "value0 was rejected by CheckedRecords.sortedTriple"));
            Check(Api.Smallest(triple) == N(2));
            Check(Rejected(() => Api.Complement(new Percent(N(101))), "value0 was rejected by CheckedRecords.mkPercent"));
            Check(Api.Complement(new Percent(N(100))) == N(0));
        }
        Check(triple.Data.SequenceEqual(new BigInteger[] { N(9), N(2), N(4) }) && values.SequenceEqual(new BigInteger[] { N(9), N(2), N(4) }) && good.Lo == N(3) && good.Hi == N(10) && bad.Lo == N(9) && bad.Hi == N(3));
        // END CHECKED INPUT CASES
        Check(Api.Repeated(big).Data.SequenceEqual(new BigInteger[] { big, big, big }));
        var first = Api.Repeated(N(7));
        var second = Api.Repeated(N(7));
        first.Data[0] = N(99);
        Check(second.Data.SequenceEqual(new BigInteger[] { N(7), N(7), N(7) }));
        for (int i = 0; i < 1000; ++i) {
            Check(Api.Repeated(N(i)).Data.SequenceEqual(new BigInteger[] { N(i), N(i), N(i) }));
        }
        Console.WriteLine($"checked-record-ok:{checks}");
    }
}
