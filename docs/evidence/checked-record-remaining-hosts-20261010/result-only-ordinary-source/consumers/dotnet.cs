using System;
using System.Linq;
using System.Numerics;
using LeanBridge.Checkedrecords;
class Consumer {
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception("checked-record assertion failed"); checks++; }
    static BigInteger N(long value) => new BigInteger(value);
    static void Main() {
        var big = BigInteger.One << 100;
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
