package `org`.`leanbridge`.`nominalsubtypes`.`kotlin`

class `Envelope`(@kotlin.jvm.JvmField val `payload`: java.math.BigInteger, @kotlin.jvm.JvmField val `digit`: java.math.BigInteger) {
    fun `payload`(): java.math.BigInteger = `payload`
    fun `digit`(): java.math.BigInteger = `digit`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `Envelope`
            && java.util.Objects.deepEquals(this.`payload`, other.`payload`)
            && java.util.Objects.deepEquals(this.`digit`, other.`digit`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`Envelope`::class.java, this.`payload`, this.`digit`))
}
