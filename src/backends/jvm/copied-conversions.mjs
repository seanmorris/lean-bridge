/**
 * Generate private recursively copied JVM value conversions.
 *
 * @file
 */

/**
 * Read one value from its computed C layout.
 *
 * @param copy - Closed C layout.
 * @param value - Native value expression.
 * @param offset - Byte offset.
 */
export const readJvmValue = (copy, value, offset = 0) => copy.aggregate ? `${value}.asSlice(${offset}, ${copy.size})` : `${value}.get(${copy.layout}, ${offset})`;
/**
 * Write one scalar or nested copied C value.
 *
 * @param copy - Closed C layout.
 * @param value - Native destination.
 * @param offset - Byte offset.
 * @param source - Native source.
 */
const writeValue = (copy, value, offset, source) => copy.aggregate ? `MemorySegment.copy(${source}, 0, ${value}, ${offset}, ${copy.size});` : `${value}.set(${copy.layout}, ${offset}, ${source});`;

/**
 * Render typed input and output conversion methods.
 *
 * @param model - Closed JVM model.
 */
export const copiedJvmConversions = model => model.surface.copies.map(copy => {
	const type = model.publicType(copy), i = copy.index;
	let input, output;
	if(copy.record)
	{
		input = `Objects.requireNonNull(value);
        var result = scope.allocate(${copy.size}, ${copy.alignment});
${copy.fields.map(field => `        ${writeValue(field.type, "result", field.offset, `to${field.type.index}(value.${field.publicName}()${field.type.aggregate ? ", scope" : ""})`)}`).join("\n")}
        return result;`;
		output = `return new ${type}(${copy.fields.map(field => `from${field.type.index}(${readJvmValue(field.type, "value", field.offset)})`).join(", ")});`;
	} else if(copy.element)
	{
		const e = copy.element;
		input = `Objects.requireNonNull(value);
        scope.charge((long)value.length * Math.max(${e.size}, 8));
        var data = scope.arena.allocate(Math.max(1, (long)value.length * ${e.size}), ${e.alignment});
        for (int index = 0; index < value.length; index++) { ${writeValue(e, "data", `(long)index * ${e.size}`, `to${e.index}(value[index]${e.aggregate ? ", scope" : ""})`)} }
        return slice(scope, data, value.length, 32);`;
		output = `int count = Math.toIntExact(value.get(JAVA_LONG, 8));
        var result = new ${model.publicType(e).replace(/\[\]/g, "")}[count]${"[]".repeat(model.publicType(e).split("[]").length - 1)};
        var data = value.get(ADDRESS, 0).reinterpret((long)count * ${e.size});
        for (int index = 0; index < count; index++) result[index] = from${e.index}(${readJvmValue(e, "data", `(long)index * ${e.size}`)});
        return result;`;
	} else switch(copy.ref.name)
	{
		case "unit": input = "Objects.requireNonNull(value); return (byte)0;"; output = "return Unit.INSTANCE;"; break;
		case "bool": input = "return value ? (byte)1 : (byte)0;"; output = "return value != 0;"; break;
		case "char":
			input = 'if (value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) throw new IllegalArgumentException("Char requires a Unicode scalar code point"); return value;';
			output = 'if (value < 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff)) throw new IllegalArgumentException("Invalid native Unicode scalar"); return value;'; break;
		case "uint8": case "uint16": case "uint32":
			input = `if (value < 0 || value > ${copy.ref.name === "uint8" ? "255" : copy.ref.name === "uint16" ? "65535" : "0xffff_ffffL"}) throw new IllegalArgumentException("${copy.ref.name} is out of range"); return (${copy.nativeType})value;`;
			output = `return ${copy.ref.name === "uint8" ? "Byte.toUnsignedInt" : copy.ref.name === "uint16" ? "Short.toUnsignedInt" : "Integer.toUnsignedLong"}(value);`; break;
		case "uint64": input = 'Objects.requireNonNull(value); if (value.signum() < 0 || value.bitLength() > 64) throw new IllegalArgumentException("uint64 is out of range"); return value.longValue();';
			output = "return BigInteger.valueOf(value >>> 1).shiftLeft(1).add(BigInteger.valueOf(value & 1));"; break;
		case "string": input = `Objects.requireNonNull(value);
        int length = utf8Length(value);
        var data = scope.allocate(Math.max(1, length), 1);
        try {
            var encoder = StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT);
            var buffer = data.asByteBuffer();
            var encoded = encoder.encode(CharBuffer.wrap(value), buffer, true);
            if (!encoded.isUnderflow()) encoded.throwException();
            var flushed = encoder.flush(buffer);
            if (!flushed.isUnderflow()) flushed.throwException();
        } catch (CharacterCodingException error) { throw new IllegalArgumentException("Invalid UTF-16", error); }
        return slice(scope, data, length, 32);`;
			output = 'try { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(data(value).asByteBuffer()).toString(); } catch (CharacterCodingException error) { throw new IllegalArgumentException("Invalid native UTF-8", error); }'; break;
		case "bytes": input = `Objects.requireNonNull(value);
        var data = scope.allocate(Math.max(1, value.length), 1);
        MemorySegment.copy(MemorySegment.ofArray(value), 0, data, 0, value.length);
        return slice(scope, data, value.length, 32);`;
			output = "return data(value).toArray(JAVA_BYTE);"; break;
		case "nat": case "int": input = `Objects.requireNonNull(value);
        ${copy.ref.name === "nat" ? 'if (value.signum() < 0) throw new IllegalArgumentException("Nat cannot be negative");' : ""}
        var magnitude = value.abs();
        long limbs = ((long)magnitude.bitLength() + 31) / 32;
        var data = scope.allocate(Math.max(1, limbs * 4), 4);
        byte[] bytes = magnitude.toByteArray();
        for (int index = 0; index < bytes.length && index < limbs * 4; index++) data.set(JAVA_BYTE, index, bytes[bytes.length - 1 - index]);
        var result = slice(scope, data, limbs, ${copy.size});
        ${copy.ref.name === "int" ? "result.set(JAVA_BYTE, 32, (byte)(value.signum() < 0 ? 1 : 0));" : ""}
        return result;`;
			output = `int length = Math.toIntExact(value.get(JAVA_LONG, 8) * 4);
        byte[] bytes = value.get(ADDRESS, 0).reinterpret(length).toArray(JAVA_BYTE);
        for (int left = 0, right = bytes.length - 1; left < right; left++, right--) { byte saved = bytes[left]; bytes[left] = bytes[right]; bytes[right] = saved; }
        var result = new BigInteger(1, bytes);
        return ${copy.ref.name === "int" ? "value.get(JAVA_BYTE, 32) != 0 ? result.negate() : result" : "result"};`; break;
		default: input = "return value;"; output = "return value;";
	}
	return `    private static ${copy.nativeType} to${i}(${type} value${copy.aggregate ? ", Scope scope" : ""}) {
        ${input}
    }
    private static ${type} from${i}(${copy.nativeType} value) {
        ${output}
    }`;
}).join("\n");

/** Shared private input-budget and strict-text helpers. */
export const copiedJvmScope = `final class Scope {
        final Arena arena;
        long remaining = 16 * 1024 * 1024;
        Scope(Arena arena) { this.arena = arena; }
        void charge(long bytes) {
            if (bytes < 0 || bytes > remaining) throw new IllegalArgumentException("Lean Bridge copy budget exceeded (16 MiB per call)");
            remaining -= bytes;
        }
        MemorySegment allocate(long bytes, long alignment) { charge(bytes); return arena.allocate(bytes, alignment); }
    }`;

/** Shared scoped-span, strict-text and native-error helpers. */
export const copiedJvmHelpers = `    private static MemorySegment slice(Scope scope, MemorySegment data, long length, int size) {
        var result = scope.arena.allocate(size, 8);
        result.set(ADDRESS, 0, data); result.set(JAVA_LONG, 8, length);
        return result;
    }
    private static MemorySegment data(MemorySegment value) { return value.get(ADDRESS, 0).reinterpret(value.get(JAVA_LONG, 8)); }
    private static int utf8Length(String value) {
        long length = 0;
        for (int index = 0; index < value.length(); index++) {
            char next = value.charAt(index);
            if (Character.isHighSurrogate(next)) {
                if (++index == value.length() || !Character.isLowSurrogate(value.charAt(index))) throw new IllegalArgumentException("Invalid UTF-16");
                length += 4;
            } else if (Character.isLowSurrogate(next)) throw new IllegalArgumentException("Invalid UTF-16");
            else length += next < 128 ? 1 : next < 2048 ? 2 : 3;
        }
        if (length > 16 * 1024 * 1024) throw new IllegalArgumentException("Lean Bridge copy budget exceeded");
        return (int)length;
    }
    private static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) return runtime;
        if (error instanceof Error fatal) throw fatal;
        return new LeanBridgeException("Native call failed", error);
    }
    private static void check(int status, MemorySegment error) {
        if (status == 0) return;
        var address = error.get(ADDRESS, 8);
        String message = address.equals(MemorySegment.NULL) ? "Lean call failed" : new String(address.reinterpret(error.get(JAVA_LONG, 16)).toArray(JAVA_BYTE), StandardCharsets.UTF_8);
        if (status == 1) throw new IllegalArgumentException(message);
        throw new LeanBridgeException(message, null);
    }`;
