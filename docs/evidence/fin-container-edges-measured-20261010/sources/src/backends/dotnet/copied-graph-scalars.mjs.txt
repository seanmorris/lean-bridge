/**
 * Exact primitive leaves inside C# finite graph adapters.
 *
 * @file
 */

/**
 * Emit input/output bodies without introducing host coercions or native tags.
 *
 * @param node - Native graph leaf and its public C# type.
 */
export const dotnetGraphScalar = node => {
	const name = node.ref.name, raw = node.raw;
	if(name === "unit") return { input: ["return 0;"], output: ['if (*value != 0) throw new GraphInvalidNative("Invalid native Unit");', "return default;"] };
	if(name === "bool") return { input: ["return value ? (byte)1 : (byte)0;"], output: ['return *value switch { 0 => false, 1 => true, _ => throw new GraphInvalidNative("Invalid native Bool") };'] };
	if(name === "char") return {
		input: ['if (!global::System.Text.Rune.IsValid(value.Value)) throw new global::System.ArgumentException("Invalid Unicode scalar");', "return (uint)value.Value;"]
		, output: ['if (!global::System.Text.Rune.IsValid((int)*value)) throw new GraphInvalidNative("Invalid native Char");', "return new global::System.Text.Rune((int)*value);"]
	};
	if(["nat", "int"].includes(name)) return {
		input: [
			...name === "nat" ? ['if (value.Sign < 0) throw new global::System.ArgumentOutOfRangeException(nameof(value), "Nat cannot be negative");'] : []
			, "var magnitude = global::System.Numerics.BigInteger.Abs(value);"
			, "var length = value.IsZero ? 0 : checked((magnitude.GetByteCount(isUnsigned: true) + 3) / 4);"
			, "scope.Native((nuint)length, 4);"
			, "var data = scope.Allocate<uint>((nuint)length);"
			, "if (!scope.CheckOnly && length != 0 && !magnitude.TryWriteBytes(new global::System.Span<byte>((void*)data, checked(length * 4)), out _, isUnsigned: true, isBigEndian: false))"
			, '    throw new global::System.InvalidOperationException("BigInteger conversion failed");'
			, `return new ${raw} { Data = data, Length = (nuint)length${name === "int" ? ", Negative = value.Sign < 0 ? (byte)1 : (byte)0" : ""} };`
		]
		, output: [
			...name === "int" ? ['if (value->Negative > 1) throw new GraphInvalidNative("Invalid native Int sign");'] : []
			, "scope.Native(value->Length, 4); scope.Storage(value->Length, 4); scope.Storage(64);"
			, "var digits = Checked<uint>(value->Data, value->Length, 4);"
			, 'if (value->Length != 0 && digits[value->Length - 1] == 0) throw new GraphInvalidNative("Noncanonical native magnitude");'
			, ...name === "int" ? ['if (value->Length == 0 && value->Negative != 0) throw new GraphInvalidNative("Native negative zero");'] : []
			, "Checkpoint();"
			, "var result = new global::System.Numerics.BigInteger(new global::System.ReadOnlySpan<byte>(digits, checked((int)value->Length * 4)), isUnsigned: true, isBigEndian: false);"
			, `return ${name === "int" ? "value->Negative != 0 ? -result : result" : "result"};`
		]
	};
	if(name === "string" || name === "bytes") return {
		input: [
			"global::System.ArgumentNullException.ThrowIfNull(value);"
			, `var length = ${name === "string" ? "Utf8.GetByteCount(value)" : "value.Length"};`
			, "scope.Native((nuint)length);"
			, "var data = scope.Allocate<byte>((nuint)length);"
			, `if (!scope.CheckOnly) ${name === "string" ? "Utf8.GetBytes(value, new global::System.Span<byte>((void*)data, length));" : "global::System.MemoryExtensions.AsSpan<byte>(value).CopyTo(new global::System.Span<byte>((void*)data, length));"}`
			, `return new ${raw} { Data = data, Length = (nuint)length };`
		]
		, output: [
			"scope.Native(value->Length);"
			, "var data = Checked<byte>(value->Data, value->Length, 1);"
			, "var bytes = new global::System.ReadOnlySpan<byte>(data, checked((int)value->Length));"
			, ...name === "string" ? [
				"try", "{"
				, "    scope.Storage((nuint)Utf8.GetCharCount(bytes), 2); scope.Storage(32);"
				, "    Checkpoint(); return Utf8.GetString(bytes);", "}"
				, "catch (global::System.Text.DecoderFallbackException)"
				, '{ throw new GraphInvalidNative("Invalid native UTF-8"); }'
			] : ["scope.Storage(value->Length); scope.Storage(32);", "Checkpoint(); return bytes.ToArray();"]
		]
	};
	return { input: ["return value;"], output: ["return *value;"] };
};
