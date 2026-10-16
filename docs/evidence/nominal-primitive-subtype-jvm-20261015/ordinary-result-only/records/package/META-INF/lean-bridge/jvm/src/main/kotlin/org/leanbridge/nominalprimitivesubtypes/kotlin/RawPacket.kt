package `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`

class `RawPacket`(@kotlin.jvm.JvmField val `unitValue`: `org`.`leanbridge`.`nominalprimitivesubtypes`.Unit, @kotlin.jvm.JvmField val `boolValue`: kotlin.Boolean, @kotlin.jvm.JvmField val `uint8Value`: kotlin.Int, @kotlin.jvm.JvmField val `uint16Value`: kotlin.Int, @kotlin.jvm.JvmField val `uint32Value`: kotlin.Long, @kotlin.jvm.JvmField val `uint64Value`: java.math.BigInteger, @kotlin.jvm.JvmField val `int8Value`: kotlin.Byte, @kotlin.jvm.JvmField val `int16Value`: kotlin.Short, @kotlin.jvm.JvmField val `int32Value`: kotlin.Int, @kotlin.jvm.JvmField val `int64Value`: kotlin.Long, @kotlin.jvm.JvmField val `natValue`: java.math.BigInteger, @kotlin.jvm.JvmField val `intValue`: java.math.BigInteger, @kotlin.jvm.JvmField val `float32Value`: kotlin.Float, @kotlin.jvm.JvmField val `float64Value`: kotlin.Double, @kotlin.jvm.JvmField val `textValue`: kotlin.String, @kotlin.jvm.JvmField val `bytesValue`: kotlin.ByteArray, @kotlin.jvm.JvmField val `charValue`: kotlin.Int, @kotlin.jvm.JvmField val `usizeValue`: java.math.BigInteger, @kotlin.jvm.JvmField val `isizeValue`: kotlin.Long, @kotlin.jvm.JvmField val `digit`: java.math.BigInteger) {
    fun `unitValue`(): `org`.`leanbridge`.`nominalprimitivesubtypes`.Unit = `unitValue`
    fun `boolValue`(): kotlin.Boolean = `boolValue`
    fun `uint8Value`(): kotlin.Int = `uint8Value`
    fun `uint16Value`(): kotlin.Int = `uint16Value`
    fun `uint32Value`(): kotlin.Long = `uint32Value`
    fun `uint64Value`(): java.math.BigInteger = `uint64Value`
    fun `int8Value`(): kotlin.Byte = `int8Value`
    fun `int16Value`(): kotlin.Short = `int16Value`
    fun `int32Value`(): kotlin.Int = `int32Value`
    fun `int64Value`(): kotlin.Long = `int64Value`
    fun `natValue`(): java.math.BigInteger = `natValue`
    fun `intValue`(): java.math.BigInteger = `intValue`
    fun `float32Value`(): kotlin.Float = `float32Value`
    fun `float64Value`(): kotlin.Double = `float64Value`
    fun `textValue`(): kotlin.String = `textValue`
    fun `bytesValue`(): kotlin.ByteArray = `bytesValue`
    fun `charValue`(): kotlin.Int = `charValue`
    fun `usizeValue`(): java.math.BigInteger = `usizeValue`
    fun `isizeValue`(): kotlin.Long = `isizeValue`
    fun `digit`(): java.math.BigInteger = `digit`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `RawPacket`
            && java.util.Objects.deepEquals(this.`unitValue`, other.`unitValue`)
            && java.util.Objects.deepEquals(this.`boolValue`, other.`boolValue`)
            && java.util.Objects.deepEquals(this.`uint8Value`, other.`uint8Value`)
            && java.util.Objects.deepEquals(this.`uint16Value`, other.`uint16Value`)
            && java.util.Objects.deepEquals(this.`uint32Value`, other.`uint32Value`)
            && java.util.Objects.deepEquals(this.`uint64Value`, other.`uint64Value`)
            && java.util.Objects.deepEquals(this.`int8Value`, other.`int8Value`)
            && java.util.Objects.deepEquals(this.`int16Value`, other.`int16Value`)
            && java.util.Objects.deepEquals(this.`int32Value`, other.`int32Value`)
            && java.util.Objects.deepEquals(this.`int64Value`, other.`int64Value`)
            && java.util.Objects.deepEquals(this.`natValue`, other.`natValue`)
            && java.util.Objects.deepEquals(this.`intValue`, other.`intValue`)
            && java.util.Objects.deepEquals(this.`float32Value`, other.`float32Value`)
            && java.util.Objects.deepEquals(this.`float64Value`, other.`float64Value`)
            && java.util.Objects.deepEquals(this.`textValue`, other.`textValue`)
            && java.util.Objects.deepEquals(this.`bytesValue`, other.`bytesValue`)
            && java.util.Objects.deepEquals(this.`charValue`, other.`charValue`)
            && java.util.Objects.deepEquals(this.`usizeValue`, other.`usizeValue`)
            && java.util.Objects.deepEquals(this.`isizeValue`, other.`isizeValue`)
            && java.util.Objects.deepEquals(this.`digit`, other.`digit`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`RawPacket`::class.java, this.`unitValue`, this.`boolValue`, this.`uint8Value`, this.`uint16Value`, this.`uint32Value`, this.`uint64Value`, this.`int8Value`, this.`int16Value`, this.`int32Value`, this.`int64Value`, this.`natValue`, this.`intValue`, this.`float32Value`, this.`float64Value`, this.`textValue`, this.`bytesValue`, this.`charValue`, this.`usizeValue`, this.`isizeValue`, this.`digit`))
}
