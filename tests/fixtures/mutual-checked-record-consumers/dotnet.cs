// Independent installed C# caller for mutually recursive checked records.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Text;
using System.Text.Json;
using LeanBridge.Mutualcheckedrecords;

static class Consumer
{
    static int checks, rejections, hostRejections, calls, snapshots, recoveries;
    const int Rounds = 128;
    static readonly Dictionary<string, object> Failures = new();

    static BigInteger N(long value) => new(value);
    static Option<Step> None() => Option<Step>.None;
    static Option<Step> Some(Step value) => Option<Step>.Some(value);
    static Option<Envelope> NoEnvelope() => Option<Envelope>.None;
    static Option<Envelope> SomeEnvelope(Envelope value) => Option<Envelope>.Some(value);
    static Envelope Envelope(long value, long mode, Option<Step> next = default) =>
        new(N(value), N(mode), next);
    static Envelope Nested(long outer, long mode, long inner, long innerMode) =>
        Envelope(outer, mode, Some(new StepMore(Envelope(inner, innerMode))));

    static void Check(bool condition, string label)
    {
        if (!condition) throw new InvalidOperationException("failed: " + label);
        ++checks;
    }

    static string Snapshot(Envelope? value)
    {
        var text = new StringBuilder();
        var active = new HashSet<object>(ReferenceEqualityComparer.Instance);
        void Record(Envelope? item)
        {
            if (item is null) { text.Append("null"); return; }
            if (!active.Add(item)) { text.Append("#cycle"); return; }
            text.Append("E(").Append(item.Value).Append(',').Append(item.Mode).Append(',');
            if (item.Next.IsNone) text.Append("none");
            else Step(item.Next.Value);
            text.Append(')'); active.Remove(item);
        }
        void Step(LeanBridge.Mutualcheckedrecords.Step? item)
        {
            if (item is null) { text.Append("null-step"); return; }
            if (!active.Add(item)) { text.Append("#cycle-step"); return; }
            switch (item)
            {
                case StepStop: text.Append("stop"); break;
                case StepMore more: text.Append("more("); Record(more.Packet); text.Append(')'); break;
                default: text.Append("unknown-step"); break;
            }
            active.Remove(item);
        }
        Record(value); return text.ToString();
    }

    static string Snapshot(Option<Envelope>[]? values)
    {
        if (values is null) return "null-array";
        return "[" + string.Join(";", values.Select(value =>
            value.IsSome ? "some(" + Snapshot(value.Value) + ")" : "none")) + "]";
    }

    static TOutput Accepted<TInput, TOutput>(
        string name, TInput input, Func<TInput, TOutput> invoke,
        Func<TInput, string> snapshot, Func<TOutput, bool> expected, string label)
    {
        string before = snapshot(input); ++calls;
        TOutput output = invoke(input);
        Check(expected(output), label);
        Check(snapshot(input) == before, label + " preserved every input");
        ++snapshots;
        return output;
    }

    static Exception Refused(
        string name, Action invoke, Func<string> snapshot,
        Func<Exception, bool> expected, string label, bool host = false)
    {
        string before = snapshot(); Exception? failure = null; ++calls;
        try { invoke(); }
        catch (Exception error) { failure = error; }
        Check(failure is not null && expected(failure), label + ": " + failure);
        Check(snapshot() == before, label + " preserved every input");
        ++snapshots;
        if (host) ++hostRejections; else ++rejections;
        if (!Failures.ContainsKey(label)) Failures[label] = new {
            name = failure!.GetType().Name, message = failure.Message
        };
        return failure!;
    }

    static bool Exact(Exception error, string message) =>
        error.GetType() == typeof(ArgumentException)
        && error.Message == message && ((ArgumentException)error).ParamName is null;

    static void Recover()
    {
        Envelope valid = Nested(40, 2, 80, 1);
        Accepted("first", valid, Api.First, Snapshot, result => result == 41,
            "recovery after refusal");
        ++recoveries;
    }

    static void RejectAndRecover(
        string name, Action invoke, Func<string> snapshot,
        Func<Exception, bool> expected, string label, bool host = false)
    {
        Refused(name, invoke, snapshot, expected, label, host); Recover();
    }

    static Envelope Deep(int levels)
    {
        Envelope value = Envelope(40, 2);
        while (levels-- > 0) value = Envelope(40, 2, Some(new StepMore(value)));
        return value;
    }

    static Envelope Cyclic()
    {
        var more = new StepMore(Envelope(40, 2));
        var value = Envelope(40, 2, Some(more));
        typeof(StepMore).GetProperty(nameof(StepMore.Packet))!.SetValue(more, value);
        Check(ReferenceEquals(more.Packet, value), "cycle control");
        return value;
    }

    static void Run()
    {
        Check(IntPtr.Size == 8 && BitConverter.IsLittleEndian, "native platform");
        var envelopeProperties = typeof(Envelope).GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(property => property.Name).Order().ToArray();
        Check(envelopeProperties.SequenceEqual(new[] { "Mode", "Next", "Value" }),
            "proof field is absent from the public record");
        Check(typeof(Envelope).GetConstructors().Single().GetParameters().Length == 3,
            "proof-free public constructor");
        Check(typeof(Step).IsAbstract && typeof(StepStop).IsSealed && typeof(StepMore).IsSealed,
            "closed typed recursive variant");

        Envelope original = Nested(40, 2, 80, 1);
        string originalSnapshot = Snapshot(original);
        Accepted("first", original, Api.First, Snapshot, result => result == 41, "first");
        Accepted("second", original, Api.Second, Snapshot, result => result == 42, "second");
        Accepted("echo", original, Api.Echo, Snapshot,
            result => Snapshot(result) == Snapshot(Nested(41, 2, 81, 1)), "echo");
        Envelope absent = Envelope(40, 2);
        Accepted("first", absent, Api.First, Snapshot, result => result == 41,
            "inactive option branch");
        Envelope stopped = Envelope(40, 2, Some(new StepStop()));
        Accepted("first", stopped, Api.First, Snapshot, result => result == 41,
            "active empty variant branch");
        Option<Envelope>[] groups = [SomeEnvelope(original), NoEnvelope()];
        Accepted("groups", groups, Api.Groups, Snapshot, result => result == 2,
            "transparent recursive alias carrier");
        Accepted("echoGroups", groups, Api.EchoGroups, Snapshot,
            result => Snapshot(result) == Snapshot(new[] {
                SomeEnvelope(Nested(42, 2, 82, 1)), NoEnvelope()
            }), "recursive alias result");
        Envelope produced = Accepted("produce", N(5), Api.Produce, value => value.ToString(),
            result => Snapshot(result) == Snapshot(Nested(6, 1, 7, 2)),
            "constructor-free result");
        Check(typeof(Envelope).GetProperty("Linked") is null
            && Snapshot(produced) == Snapshot(Nested(6, 1, 7, 2)),
            "erased proof absent from produced result");

        Envelope invalid = Nested(100, 2, 80, 1);
        RejectAndRecover("first", () => Api.First(invalid), () => Snapshot(invalid),
            error => Exact(error,
                "arg0.value was rejected by MutualCheckedRecords.plusOne"),
            "outer-subtype");
        invalid = Nested(40, 2, 100, 1);
        RejectAndRecover("first", () => Api.First(invalid), () => Snapshot(invalid),
            error => Exact(error,
                "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"),
            "late-subtype");
        invalid = Nested(0, 2, 80, 1);
        RejectAndRecover("first", () => Api.First(invalid), () => Snapshot(invalid),
            error => Exact(error,
                "arg0 was rejected by MutualCheckedRecords.mkEnvelope"),
            "outer-record");
        invalid = Nested(40, 3, 80, 1);
        RejectAndRecover("first", () => Api.First(invalid), () => Snapshot(invalid),
            error => Exact(error, "arg0.mode is not below its Fin 3 bound"),
            "outer-fin");
        invalid = Nested(40, 2, 80, 3);
        RejectAndRecover("first", () => Api.First(invalid), () => Snapshot(invalid),
            error => Exact(error,
                "arg0.next?.more.packet.mode is not below its Fin 3 bound"),
            "nested-fin");
        Option<Envelope>[] invalidGroups = [SomeEnvelope(Nested(40, 2, 100, 1))];
        RejectAndRecover("groups", () => Api.Groups(invalidGroups),
            () => Snapshot(invalidGroups), error => Exact(error,
                "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"),
            "group-late-subtype");
        invalidGroups = [SomeEnvelope(Nested(40, 2, 95, 1))];
        RejectAndRecover("echoGroups", () => Api.EchoGroups(invalidGroups),
            () => Snapshot(invalidGroups), error => Exact(error,
                "arg0[0]?.next?.more.packet.value was rejected by MutualCheckedRecords.plusTwo"),
            "echo-group-late-subtype");
        invalid = Nested(90, 2, 80, 1);
        RejectAndRecover("second", () => Api.Second(invalid), () => Snapshot(invalid),
            error => Exact(error,
                "arg0.value was rejected by MutualCheckedRecords.plusTwo"),
            "alternate-subtype");

        Envelope? missing = null;
        RejectAndRecover("first", () => Api.First(missing!), () => Snapshot(missing),
            error => error.GetType() == typeof(ArgumentNullException)
                && ((ArgumentNullException)error).ParamName == "value",
            "null-record", true);
        invalid = Envelope(40, 2, Some(new StepMore(null!)));
        RejectAndRecover("first", () => Api.First(invalid), () => Snapshot(invalid),
            error => error.GetType() == typeof(ArgumentNullException)
                && ((ArgumentNullException)error).ParamName == "value",
            "null-active-field", true);
        Option<Envelope>[]? missingGroups = null;
        RejectAndRecover("groups", () => Api.Groups(missingGroups!),
            () => Snapshot(missingGroups),
            error => error.GetType() == typeof(ArgumentNullException)
                && ((ArgumentNullException)error).ParamName == "value",
            "null-alias-carrier", true);
        Envelope cycle = Cyclic();
        RejectAndRecover("first", () => Api.First(cycle), () => Snapshot(cycle),
            error => error.GetType() == typeof(ArgumentException)
                && error.Message == "Cyclic copied input",
            "cycle", true);
        Envelope deep = Deep(48);
        RejectAndRecover("first", () => Api.First(deep), () => Snapshot(deep),
            error => error.GetType().Name == "GraphLimit"
                && error.Message == "Copied graph depth or node limit exceeded",
            "depth", true);
        BigInteger negative = -BigInteger.One;
        RejectAndRecover("produce", () => Api.Produce(negative), () => negative.ToString(),
            error => error.GetType() == typeof(ArgumentOutOfRangeException)
                && ((ArgumentOutOfRangeException)error).ParamName == "value"
                && error.Message.StartsWith("Nat cannot be negative", StringComparison.Ordinal),
            "negative-nat", true);

        for (int round = 0; round < Rounds; ++round)
        {
            long outer = 2 + round % 80, inner = 3 + round % 70;
            Envelope valid = Nested(outer, round % 3, inner, round % 3);
            Accepted("first", valid, Api.First, Snapshot, result => result == outer + 1,
                "round first");
            Envelope late = Nested(40, 2, 100, 1);
            Refused("first", () => Api.First(late), () => Snapshot(late),
                error => Exact(error,
                    "arg0.next?.more.packet.value was rejected by MutualCheckedRecords.plusOne"),
                "round late subtype");
            Accepted("second", valid, Api.Second, Snapshot, result => result == outer + 2,
                "round alternate constructor");
            Envelope malformed = Envelope(40, 2, Some(new StepMore(null!)));
            Refused("first", () => Api.First(malformed), () => Snapshot(malformed),
                error => error.GetType() == typeof(ArgumentNullException),
                "round malformed active field", true);
            Option<Envelope>[] alias = [NoEnvelope(), SomeEnvelope(valid)];
            Accepted("groups", alias, Api.Groups, Snapshot, result => result == 2,
                "round alias carrier");
            ++recoveries;
        }
        Check(Snapshot(original) == originalSnapshot, "all calls preserved reused input");
    }

    static int Main(string[] arguments)
    {
        try
        {
            if (arguments.Length == 1 && arguments[0] == "--runtime")
            {
                Console.WriteLine(JsonSerializer.Serialize(new {
                    version = Environment.Version.ToString(),
                    description = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                    directory = System.Runtime.InteropServices.RuntimeEnvironment.GetRuntimeDirectory(),
                    command = Environment.ProcessPath,
                    architecture = System.Runtime.InteropServices.RuntimeInformation.ProcessArchitecture.ToString(),
                    os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
                    littleEndian = BitConverter.IsLittleEndian
                }));
                return 0;
            }
            if (arguments.Length != 0)
                throw new InvalidOperationException("Unexpected caller arguments");
            Run();
            Console.WriteLine(JsonSerializer.Serialize(new {
                checks, rejections, hostRejections, calls, snapshots, recoveries,
                rounds = Rounds, wordBits = IntPtr.Size * 8, failures = Failures
            }));
            return 0;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error); return 1;
        }
    }
}
