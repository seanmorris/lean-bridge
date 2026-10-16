package `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`

class `Packet`(@kotlin.jvm.JvmField val `digit`: java.math.BigInteger, @kotlin.jvm.JvmField val `word`: java.math.BigInteger) {
    fun `digit`(): java.math.BigInteger = `digit`
    fun `word`(): java.math.BigInteger = `word`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `Packet`
            && java.util.Objects.deepEquals(this.`digit`, other.`digit`)
            && java.util.Objects.deepEquals(this.`word`, other.`word`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`Packet`::class.java, this.`digit`, this.`word`))
}
