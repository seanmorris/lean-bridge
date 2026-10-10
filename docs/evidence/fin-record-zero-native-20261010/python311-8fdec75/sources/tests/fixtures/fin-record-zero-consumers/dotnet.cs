using System;
using System.Collections;
using System.Numerics;
using LeanBridge.Finrecordzero;
class Consumer {
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception($"check {checks}"); ++checks; }
    static Fields Value(string member = "", BigInteger digit = default) => new("kept", [7, BigInteger.One << 100], member == "array" ? [digit] : [], member == "list" ? [digit] : []);
    static Fields[] Row() => [Value(), Value(), Value()];
    static bool Same(object value, object before) => StructuralComparisons.StructuralEqualityComparer.Equals(value, before);
    static bool Refused<T>(Func<T, object> call, Func<T> build, string path) where T : notnull {
        T value = build(), before = build();
        try { call(value); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == path + " is not below its Fin 0 bound" && Same(value, before); }
        return false;
    }
    static void Main() {
        foreach (Func<Zero[], Zero[]> call in new Func<Zero[], Zero[]>[]{Api.ArrayRecords, Api.ListRecords}) {
            Check(call([]).Length == 0);
            foreach (BigInteger digit in new BigInteger[]{0, 1, BigInteger.One << 100})
                Check(Refused<Zero[]>(v => call(v), () => [new Zero(digit)], "arg0[0].digit"));
            Check(call([]).Length == 0);
        }
        Check(Api.FieldCollections(Value()).Equals(Value()));
        foreach (string member in new[]{"array", "list"}) foreach (BigInteger digit in new BigInteger[]{0, 1, BigInteger.One << 100})
            Check(Refused<Fields>(v => Api.FieldCollections(v), () => Value(member, digit), $"arg0.{member}[0]"));
        Check(Api.FieldCollections(Value()).Equals(Value()));
        foreach (Func<Fields[], Fields[]> call in new Func<Fields[], Fields[]>[]{Api.ArrayFields, Api.ListFields}) {
            Check(call([]).Length == 0);
            Check(Same(call(Row()), Row()));
            for (int index = 0; index < 3; ++index) foreach (string member in new[]{"array", "list"}) {
                Check(Refused<Fields[]>(v => call(v), () => { Fields[] values = Row(); values[index] = Value(member); return values; }, $"arg0[{index}].{member}[0]"));
                Check(Same(call(Row()), Row()));
            }
        }
        for (int index = 0; index < 1000; ++index) {
            Check(Api.FieldCollections(Value()).Equals(Value()));
            string member = index % 2 == 0 ? "array" : "list";
            Check(Refused<Fields>(v => Api.FieldCollections(v), () => Value(member, index), $"arg0.{member}[0]"));
        }
        Console.WriteLine($"fin-record-zero-ok:{checks}");
    }
}
