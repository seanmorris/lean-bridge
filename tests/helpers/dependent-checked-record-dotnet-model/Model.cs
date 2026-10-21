// Independent contract oracle for the immutable dependent-record C# caller: it
// mirrors the generated NuGet API surface over managed BigInteger values only,
// with no compiled Lean component, so the caller's exact totals and fault
// sensitivity can be measured without producing a package. Never evidence of
// installed acceptance.
using System;
using System.Numerics;

namespace LeanBridge.Dependentrecords
{
    public sealed class LeanBridgeException : Exception
    {
        public int Status { get; }
        internal LeanBridgeException(int status, string message) : base(message) => Status = status;
    }

    public sealed record Dependent(BigInteger Bound, BigInteger Below);

    public static class Api
    {
        static string Fault => Environment.GetEnvironmentVariable("LEAN_BRIDGE_DEPENDENT_FAULT") ?? "";
        static string Prefix =>
#if REVIEWED
            "value0";
#else
            "arg0";
#endif

        static BigInteger Nat(BigInteger value)
        {
            if (value.Sign < 0) throw new ArgumentOutOfRangeException(nameof(value), "Lean Nat cannot be negative");
            return value;
        }

        // The checked constructor: Lean refuses the payload unless below < bound.
        static void Checked(Dependent value)
        {
            ArgumentNullException.ThrowIfNull(value);
            var bound = Nat(value.Bound);
            var below = Nat(value.Below);
            if (below >= bound && Fault != "accept-invalid")
            {
                var prefix = Fault == "wrong-message" ? "wrong0" : Prefix;
                var message = prefix + " was rejected by DependentRecords.mkDependent";
                if (Fault == "wrong-status") throw new LeanBridgeException(2, message);
                throw new ArgumentException(message);
            }
        }

#if !RESULT_ONLY || INPUTS_EXPORTED
        public static BigInteger DependentTotal(Dependent value)
        {
            Checked(value);
            return value.Bound + value.Below;
        }

        public static Dependent DependentRoundtrip(Dependent value)
        {
            Checked(value);
            return Fault == "wrong-roundtrip" ? new Dependent(value.Bound + 1, value.Below) : value;
        }
#endif

#if !MISSING_PRODUCER
        public static Dependent DependentResult(BigInteger seed)
        {
            seed = Nat(seed);
            return new Dependent(seed + (Fault == "wrong-produced" ? 2 : 1), seed);
        }
#endif
    }
}
