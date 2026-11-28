// Private representation shared only with generated JNI code. A nominal
// object is never encoded into a number or looked up by equals/hashCode.
final class HostWire {
    static Object encode(String k, Object v) {
        return switch(k) {
            case "unit" -> null;
            case "nominal","receiver","bytes" -> v;
            case "bool" -> (Boolean)v ? 1L : 0L;
            case "float32" -> Integer.toUnsignedLong(Float.floatToRawIntBits((Float)v));
            case "float64" -> Double.doubleToRawLongBits((Double)v);
            case "int","nat" -> ((java.math.BigInteger)v).toString().getBytes(java.nio.charset.StandardCharsets.US_ASCII);
            case "string" -> ((String)v).getBytes(java.nio.charset.StandardCharsets.UTF_8);
            case "char","uint8","uint16","uint32","uint64","usize","isize","int8","int16","int32","int64" -> ((Number)v).longValue();
            default -> throw new IllegalArgumentException("unknown JNI carrier " + k);
        };
    }
    static Object decode(String k, Class<?> type, Object v) {
        return switch(k) {
            case "unit" -> {
                if (v != null) throw new IllegalArgumentException("expected Unit");
                yield type == void.class ? null : type.getEnumConstants()[0];
            }
            case "nominal","receiver","bytes" -> type.cast(v);
            case "int","nat" -> new java.math.BigInteger(new String((byte[])v,java.nio.charset.StandardCharsets.US_ASCII));
            case "string" -> new String((byte[])v,java.nio.charset.StandardCharsets.UTF_8);
            case "bool" -> (Long)v != 0;
            case "char","uint8","uint16","int32" -> ((Long)v).intValue();
            case "int8" -> ((Long)v).byteValue();
            case "int16" -> ((Long)v).shortValue();
            case "uint32","isize","int64" -> (Long)v;
            case "uint64","usize" -> new java.math.BigInteger(Long.toUnsignedString((Long)v));
            case "float32" -> Float.intBitsToFloat(((Long)v).intValue());
            case "float64" -> Double.longBitsToDouble((Long)v);
            default -> throw new IllegalArgumentException("unknown JNI carrier " + k);
        };
    }
}
