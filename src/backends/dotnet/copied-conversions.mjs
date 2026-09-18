/**
 * Generate scoped copied-value conversions without exposing native layouts.
 *
 * @file
 */

/**
 * Render all unmanaged C structs, including nested and empty records.
 *
 * @param model - Closed copied-value C# model.
 */
export const copiedNativeTypes = model => model.surface.copies.filter(copy => copy.aggregate).map(copy => `
[StructLayout(LayoutKind.Sequential)]
internal struct N${copy.index}
{
${copy.record ? copy.fields.length ? copy.fields.map((field, index) => `    internal ${model.nativeType(field.type)} F${index};`).join("\n") : "    internal byte Empty;"
	: `    internal nint Data;
    internal nuint Length;
    internal nint Context;
    internal nint Release;${copy.ref.name === "int" ? "\n    internal byte Negative;" : ""}`}
}`).join("\n");

/**
 * Render input/output conversions for each admitted type exactly once.
 *
 * @param model - Closed copied-value C# model.
 */
export const copiedConversions = model => model.surface.copies.map(copy => {
	const i = copy.index, type = model.publicType(copy), native = model.nativeType(copy);
	let input, output;
	if(copy.record)
	{
		input = `ArgumentNullException.ThrowIfNull(value);
        scope.Charge(1, sizeof(${native}));
        return new ${native} { ${copy.fields.map((field, index) => `F${index} = To${field.type.index}(value.${field.publicName}${field.type.aggregate ? ", scope" : ""})`).join(", ")} };`;
		output = `return new ${type}(${copy.fields.map((field, index) => `From${field.type.index}(value.F${index})`).join(", ")});`;
	} else if(copy.element)
	{
		const e = copy.element, et = model.nativeType(e);
		input = `ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, sizeof(${et}), Math.Max(sizeof(${et}), IntPtr.Size));
        for (var index = 0; index < value.Length; index++) ((${et}*)data)[index] = To${e.index}(value[index]${e.aggregate ? ", scope" : ""});
        return new ${native} { Data = data, Length = (nuint)value.Length };`;
		output = `var result = new ${model.publicType(e).replace(/\[\]/g, "")}[checked((int)value.Length)]${model.publicType(e).includes("[]") ? "[]".repeat(model.publicType(e).split("[]").length - 1) : ""};
        for (var index = 0; index < result.Length; index++) result[index] = From${e.index}(((${et}*)value.Data)[index]);
        return result;`;
	} else switch(copy.ref.name)
	{
		case "unit": input = "return 0;"; output = "return default;"; break;
		case "bool": input = "return value ? (byte)1 : (byte)0;"; output = "return value != 0;"; break;
		case "char": input = "return (uint)value.Value;"; output = "return new global::System.Text.Rune(value);"; break;
		case "string":
			input = `ArgumentNullException.ThrowIfNull(value);
        var length = Utf8.GetByteCount(value);
        var data = scope.Allocate(length, 1);
        Utf8.GetBytes(value, new Span<byte>((void*)data, length));
        return new ${native} { Data = data, Length = (nuint)length };`;
			output = "return Utf8.GetString(new ReadOnlySpan<byte>((void*)value.Data, checked((int)value.Length)));"; break;
		case "bytes":
			input = `ArgumentNullException.ThrowIfNull(value);
        var data = scope.Allocate(value.Length, 1);
        value.AsSpan().CopyTo(new Span<byte>((void*)data, value.Length));
        return new ${native} { Data = data, Length = (nuint)value.Length };`;
			output = "return new ReadOnlySpan<byte>((void*)value.Data, checked((int)value.Length)).ToArray();"; break;
		case "nat": case "int":
			input = `${copy.ref.name === "nat" ? 'if (value.Sign < 0) throw new ArgumentOutOfRangeException(nameof(value), "Lean Nat cannot be negative");\n        ' : ""}var magnitude = global::System.Numerics.BigInteger.Abs(value);
        var limbs = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 3) / 4);
        var data = scope.Allocate(limbs, sizeof(uint));
        if (limbs != 0 && !magnitude.TryWriteBytes(new Span<byte>((void*)data, checked(limbs * 4)), out _, isUnsigned: true, isBigEndian: false)) throw new InvalidOperationException("Integer conversion failed");
        return new ${native} { Data = data, Length = (nuint)limbs${copy.ref.name === "int" ? ", Negative = value.Sign < 0 ? (byte)1 : (byte)0" : ""} };`;
			output = `var result = new global::System.Numerics.BigInteger(new ReadOnlySpan<byte>((void*)value.Data, checked((int)value.Length * 4)), isUnsigned: true, isBigEndian: false);
        return ${copy.ref.name === "int" ? "value.Negative != 0 ? -result : result" : "result"};`; break;
		default: input = "return value;"; output = "return value;";
	}
	return `    private static ${native} To${i}(${type} value${copy.aggregate ? ", Scope scope" : ""})
    {
        ${input}
    }
    private static ${type} From${i}(${native} value)
    {
        ${output}
    }`;
}).join("\n");

/** C# scoped scratch allocation. Native results use their own generated clear functions. */
export const copiedScope = `internal sealed unsafe class Scope : IDisposable
{
    private readonly global::System.Collections.Generic.List<nint> allocations = new();
    private int remaining = 16 * 1024 * 1024;
    internal void Charge(int count, int width)
    {
        if (count < 0 || width <= 0 || count > remaining / width) throw new ArgumentException("Lean Bridge copy budget exceeded (16 MiB per call)");
        remaining -= count * width;
    }
    internal nint Allocate(int count, int width, int chargeWidth = 0)
    {
        Charge(count, chargeWidth == 0 ? width : chargeWidth);
        if (count == 0) return 0;
        var data = (nint)NativeMemory.AllocZeroed(checked((nuint)count * (nuint)width));
        if (data == 0) throw new OutOfMemoryException();
        try { allocations.Add(data); }
        catch { NativeMemory.Free((void*)data); throw; }
        return data;
    }
    public void Dispose()
    {
        foreach (var data in allocations) NativeMemory.Free((void*)data);
        allocations.Clear();
    }
}`;
