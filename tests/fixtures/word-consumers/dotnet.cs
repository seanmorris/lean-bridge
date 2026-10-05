using System;
using System.Linq;
using LeanBridge.Words;
class Consumer {
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception("Platform integer mismatch"); ++checks; }
    static void Main() {
        ulong[] us = [0, 1, uint.MaxValue, 9007199254740993, ulong.MaxValue];
        long[] ss = [long.MinValue, -9007199254740993, -1, 0, long.MaxValue];
        Func<ulong, ulong> keepUnsigned = Api.KeepUnsigned;
        Func<long, long> keepSigned = Api.KeepSigned;
        Check(Api.WordBits() == 64);
        for (int i = 0; i < us.Length; ++i) {
            Check(keepUnsigned(us[i]) == us[i]);
            Check(keepSigned(ss[i]) == ss[i]);
            Check(Api.UnsignedText(us[i]) == us[i].ToString(System.Globalization.CultureInfo.InvariantCulture));
            Check(Api.SignedText(ss[i]) == ss[i].ToString(System.Globalization.CultureInfo.InvariantCulture));
            Check(Api.AdvanceUnsigned(us[i]) == unchecked(us[i] + 1));
            Check(Api.AdvanceSigned(ss[i]) == unchecked(ss[i] + 1));
        }
        for (int i = 0; i < 1000; ++i) {
            var sample = Api.KeepSample(new Sample(ulong.MaxValue, long.MinValue, us, ss));
            Check(sample.Natural == ulong.MaxValue && sample.Integer == long.MinValue);
            Check(sample.UnsignedValues.SequenceEqual(us) && sample.SignedValues.SequenceEqual(ss));
            Check(Api.KeepUnsignedValues(us).SequenceEqual(us));
            Check(Api.KeepSignedValues(ss).SequenceEqual(ss));
            var ur = Api.KeepUnsignedRows([us, []]);
            var sr = Api.KeepSignedRows([ss, []]);
            Check(ur.Length == 2 && ur[0].SequenceEqual(us) && ur[1].Length == 0);
            Check(sr.Length == 2 && sr[0].SequenceEqual(ss) && sr[1].Length == 0);
        }
        Console.WriteLine($"word-ok:{checks}");
    }
}
