// Serialize observed public values only. Expected values stay with the Lean oracle.
using System;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Text.Json;

internal static class Wire
{
    internal static readonly System.Collections.Generic.List<object> Results = new();
    internal static readonly System.Collections.Generic.List<object> Errors = new();
    internal static void Check(bool value) { if (!value) throw new InvalidOperationException("Corpus assertion failed"); }
    internal static object Integer<T>(T value) where T : IFormattable => new { integer = value.ToString(null, CultureInfo.InvariantCulture) };
    internal static object Text(string value) => new { @string = value };
    internal static object Boolean(bool value) => new { @bool = value };
    internal static object Unit() => new { unit = true };
    internal static object Bytes(byte[] value) => new { bytes = value.Select(x => (int)x).ToArray() };
    internal static object Array<T>(T[] value, Func<T, object> encode) => new { array = value.Select(encode).ToArray() };
    internal static object F32(float value) => new { float32 = float.IsNaN(value) ? "nan" : BitConverter.SingleToUInt32Bits(value).ToString(CultureInfo.InvariantCulture) };
    internal static object F64(double value) => new { float64 = double.IsNaN(value) ? "nan" : BitConverter.DoubleToUInt64Bits(value).ToString(CultureInfo.InvariantCulture) };
    internal static string Snapshot(object value) => JsonSerializer.Serialize(value);
    internal static void Same(object left, object right) => Check(Snapshot(left) == Snapshot(right));
    internal static Exception Reject(Type expected, Action call)
    {
        try { call(); } catch (Exception error) { Check(error.GetType() == expected); return error; }
        throw new InvalidOperationException("Invalid public input was accepted");
    }
    internal static void Method(Type api, string name, Type result, params Type[] parameters)
    {
        var method = api.GetMethod(name, BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)!;
        Check(method is not null && !method.IsGenericMethod && method.ReturnType == result);
        Check(method!.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
    }
    internal static void Record(Type record, string[] names, Type[] types)
    {
        Check(record.IsClass && record.IsSealed);
        var constructors = record.GetConstructors();
        Check(constructors.Length == 1 && constructors[0].GetParameters().Select(p => p.ParameterType).SequenceEqual(types));
        for (var i = 0; i < names.Length; ++i)
        {
            var property = record.GetProperty(names[i])!;
            Check(property is not null && property.PropertyType == types[i] && property.GetMethod!.IsPublic);
            Check(property!.SetMethod!.ReturnParameter.GetRequiredCustomModifiers().Contains(typeof(System.Runtime.CompilerServices.IsExternalInit)));
        }
    }
}
