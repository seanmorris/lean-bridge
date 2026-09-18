using System;
using System.Linq;
using System.Text;
using LeanBridge.Glyphs;

class Consumer {
    static int checks;
    static void Check(bool value) { if (!value) throw new Exception("Char check failed"); ++checks; }
    static void Main() {
        int[] points = [__POINTS__];
        Rune[] values = points.Select(point => new Rune(point)).ToArray();
        Func<Rune, Rune> keep = Api.Keep;
        foreach (Rune value in values) {
            Check(keep(value) == value);
            Check(Api.Point(value) == value.Value);
            Check(Api.Text(value) == value.ToString());
            Check(Api.Choose(true, value, new Rune('x')) == value);
            Check(Api.Choose(false, new Rune('x'), value) == value);
            Check(Api.KeepArray(values).SequenceEqual(values));
            Label label = Api.KeepLabel(new Label(value, values));
            Check(label.Marker == value && label.Line.SequenceEqual(values));
            Rune[][] rows = Api.KeepRows([values, [], [value]]);
            Check(rows.Length == 3 && rows[0].SequenceEqual(values) && rows[1].Length == 0 && rows[2][0] == value);
        }
        Check(Api.Sprout() == new Rune(0x1f331));
        Check(Api.KeepArray([]).Length == 0);
        foreach (int bad in new int[] {-1, 0xd800, 0xdfff, 0x110000, int.MaxValue}) Check(!Rune.TryCreate(bad, out _));
        for (int i = 0; i < 1000; ++i) Check(Api.KeepRows([values, values])[1].SequenceEqual(values));
        Console.WriteLine($"char-ok:{checks}");
    }
}
