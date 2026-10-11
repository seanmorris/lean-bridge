using System;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text;
using LeanBridge.Structuralsubtypes;

class Consumer {
    static int checks, rejections, snapshotControls;
    static BigInteger N(long value) => new BigInteger(value);
    static Option<BigInteger> S(BigInteger value) => Option<BigInteger>.Some(value);
    static Option<(BigInteger, BigInteger)> P(BigInteger a, BigInteger b) => Option<(BigInteger, BigInteger)>.Some((a, b));
    static Option<(byte, BigInteger)> B(byte a, BigInteger b) => Option<(byte, BigInteger)>.Some((a, b));
    static void Check(bool condition, string label) {
        if (!condition) throw new Exception("failed: " + label);
        ++checks;
    }
    // Independent complete snapshots, without calling any generated Equals method.
    static void WriteSnapshot(BinaryWriter writer, object? value) {
        if (value is null) { writer.Write("null"); return; }
        Type type = value.GetType();
        writer.Write(type.FullName!);
        if (value is BigInteger integer) {
            byte[] bytes = integer.ToByteArray(); writer.Write(bytes.Length); writer.Write(bytes);
        } else if (value is byte octet) { writer.Write(octet); }
        else if (value is string text) {
            writer.Write(text.Length);
            foreach (char unit in text) writer.Write((ushort)unit);
        } else if (value is Array array) {
            writer.Write(array.Rank); writer.Write(array.Length);
            foreach (object? item in array) WriteSnapshot(writer, item);
        } else if (value is ITuple tuple) {
            writer.Write(tuple.Length);
            for (int i = 0; i < tuple.Length; ++i) WriteSnapshot(writer, tuple[i]);
        } else if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Option<>)) {
            bool present = (bool)type.GetProperty("IsSome")!.GetValue(value)!;
            writer.Write(present);
            if (present) WriteSnapshot(writer, type.GetProperty("Value")!.GetValue(value));
        } else if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Result<,>)) {
            bool initialized = (bool)type.GetProperty("IsInitialized")!.GetValue(value)!;
            writer.Write(initialized);
            if (initialized) {
                bool ok = (bool)type.GetProperty("IsOk")!.GetValue(value)!;
                writer.Write(ok); WriteSnapshot(writer, type.GetProperty(ok ? "Value" : "Error")!.GetValue(value));
            }
        } else throw new Exception("unsupported snapshot: " + type);
    }
    static string Snapshot(object value) {
        using var stream = new MemoryStream();
        using (var writer = new BinaryWriter(stream, Encoding.UTF8, true)) WriteSnapshot(writer, value);
        return Convert.ToHexString(stream.ToArray());
    }
    static bool Same(object left, object right) => Snapshot(left) == Snapshot(right);
    static string Subtype(string path, string constructor) => path + " was rejected by StructuralSubtypes." + constructor;
    static string Fin(string path, BigInteger bound) => path + " is not below its Fin " + bound + " bound";
    static void Refused(object input, Action call, string expected) {
        string before = Snapshot(input);
        bool accepted = true;
        try { call(); }
        catch (ArgumentException error) when (error.GetType() == typeof(ArgumentException)) {
            Check(error.Message == expected, "refusal: " + expected + "; got " + error.Message);
            accepted = false;
        }
        if (accepted) throw new Exception("accepted: " + expected);
        Check(Snapshot(input) == before, "complete rejected inputs unchanged");
        ++rejections;
    }
    static void Main() {
        BigInteger huge = N(1) << 100, wide = (N(10) << 64) + 10;
        Option<BigInteger>[] originalFirst = [S(huge), default];
        Option<(byte, string)>[] originalSecond = [Option<(byte, string)>.Some((255, "a\0tail"))];
        object original = (originalFirst, originalSecond);
        object[] changed = [
            (new Option<BigInteger>[] { S(huge + 1), default }, originalSecond),
            (new Option<BigInteger>[] { default, default }, originalSecond),
            (new Option<BigInteger>[] { S(huge), default, default }, originalSecond),
            (originalFirst, new Option<(byte, string)>[] { Option<(byte, string)>.Some((254, "a\0tail")) }),
            (originalFirst, new Option<(byte, string)>[] { Option<(byte, string)>.Some((255, "a\0changed")) }),
            (originalFirst, new Option<(byte, string)>[] { default })
        ];
        foreach (object mutation in changed) { Check(!Same(mutation, original), "snapshot mutation control"); ++snapshotControls; }
        Check(Api.Scalar(huge) == huge, "wide scalar");
        Refused(N(0), () => Api.Scalar(N(0)), Subtype("value0", "checkedPositive"));
        foreach (var (name, call) in new (string, Func<BigInteger[], BigInteger[]>)[] {
            ("arrays", Api.Arrays), ("lists", Api.Lists), ("specialized", Api.Specialized)
        }) {
            Check(call([]).Length == 0, name + " empty");
            BigInteger[] values = [1, huge, 3];
            Check(Same(call(values), values), name + " wide values");
            for (int position = 0; position < 3; ++position) {
                BigInteger[] bad = (BigInteger[])values.Clone(); bad[position] = 0;
                Refused(bad, () => call(bad), Subtype($"value0[{position}]", "checkedPositive"));
            }
            Check(Same(call(values), values), name + " recovery");
        }
        Check(Api.Options(default).IsNone, "absent option");
        Check(Same(Api.Options(S(huge)), S(huge)), "present option");
        Refused(S(0), () => Api.Options(S(0)), Subtype("value0?", "checkedPositive"));
        string text = "héllo\0tail\U0001F642";
        Check(Api.Product((huge, text)) == (huge, text), "Unicode and complete NUL suffix");
        Refused((N(0), text), () => Api.Product((N(0), text)), Subtype("value0.0", "checkedPositive"));
        Refused((huge, ""), () => Api.Product((huge, "")), Subtype("value0.1", "checkedWord"));
        var ok = Result<BigInteger, string>.Ok(huge); var error = Result<BigInteger, string>.Err(text);
        Check(Same(Api.Branch(ok), ok), "active ok");
        Check(Same(Api.Branch(error), error), "active error");
        var badOk = Result<BigInteger, string>.Ok(0); var badError = Result<BigInteger, string>.Err("");
        Refused(badOk, () => Api.Branch(badOk), Subtype("value0.ok", "checkedPositive"));
        Refused(badError, () => Api.Branch(badError), Subtype("value0.error", "checkedWord"));
        Option<(byte, BigInteger)>[] bytes = [default, B(255, huge)];
        Check(Same(Api.ByteBranches(bytes), bytes), "UInt8 and Nat");
        Option<(byte, BigInteger)>[] badByte = [default, B(0, huge)], badNat = [default, B(1, 0)];
        Refused(badByte, () => Api.ByteBranches(badByte), Subtype("value0[1]?.0", "checkedByte"));
        Refused(badNat, () => Api.ByteBranches(badNat), Subtype("value0[1]?.1", "checkedPositive"));
        Option<(BigInteger, BigInteger)>[][] nested = [[default, P(huge, wide - 1)], [], [P(2, 3)]];
        Check(Api.Nested(nested) == 3, "nested valid");
        for (int row = 0; row < 3; ++row) for (int column = 0; column < 3; ++column) {
            var rows = Enumerable.Range(0, 3).Select(_ => Enumerable.Repeat(P(huge, wide - 1), 3).ToArray()).ToArray();
            rows[row][column] = P(0, wide);
            Refused(rows, () => Api.Nested(rows), Fin($"value0[{row}][{column}]?.1", wide));
            rows[row][column] = P(0, wide - 1);
            Refused(rows, () => Api.Nested(rows), Subtype($"value0[{row}][{column}]?.0", "checkedPositive"));
            rows[row][column] = P(1, wide - 1);
            Check(Api.Nested(rows) == 3, "nested recovery");
        }
        Option<BigInteger>[] first = [S(1), default, S(huge)], second = [S(huge), S(3), default];
        Option<BigInteger>[] normalized = [S(huge + 1), S(4), default];
        var joined = first.Concat(normalized).ToArray();
        Check(Same(Api.AliasPair((first, second)), (first, normalized)), "per-site alias constructors");
        Check(Same(Api.AliasArguments(first, second), joined), "per-parameter constructors");
        Check(Api.PlainFin([default, S(0), S(9)]) == 3, "Fin endpoints");
        Option<BigInteger>[] badFin = [S(10)];
        Refused(badFin, () => Api.PlainFin(badFin), Fin("value0[0]?", 10));
        for (int position = 0; position < 3; ++position) {
            Option<BigInteger>[] left = [S(1), S(huge), S(3)], right = [S(huge), S(3), S(4)];
            left[position] = S(0);
            Refused((left, second), () => Api.AliasPair((left, second)), Subtype($"value0.0[{position}]?", "checkedPositive"));
            right[position] = S(0);
            Refused((first, right), () => Api.AliasPair((first, right)), Subtype($"value0.1[{position}]?", "normalizePositive"));
        }
        for (int round = 0; round < 1000; ++round) {
            Option<BigInteger>[] late = [S(huge), S(3), S(4)]; int position = round % 3;
            late[position] = S(0);
            Refused((first, late), () => Api.AliasArguments(first, late), Subtype($"value1[{position}]?", "normalizePositive"));
            string before = Snapshot((first, second));
            Check(Same(Api.AliasArguments(first, second), joined), "late recovery");
            Check(Snapshot((first, second)) == before, "normalization does not mutate either input");
        }
        Console.WriteLine($"{{\"checks\":{checks},\"rejections\":{rejections},\"snapshotControls\":{snapshotControls}}}");
    }
}
