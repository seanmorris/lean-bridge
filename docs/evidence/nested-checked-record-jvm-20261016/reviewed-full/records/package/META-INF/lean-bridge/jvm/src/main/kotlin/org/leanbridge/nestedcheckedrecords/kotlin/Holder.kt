package `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`

class `Holder`(@kotlin.jvm.JvmField val `packet`: `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet`, @kotlin.jvm.JvmField val `tag`: java.math.BigInteger) {
    fun `packet`(): `org`.`leanbridge`.`nestedcheckedrecords`.`kotlin`.`Packet` = `packet`
    fun `tag`(): java.math.BigInteger = `tag`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `Holder`
            && java.util.Objects.deepEquals(this.`packet`, other.`packet`)
            && java.util.Objects.deepEquals(this.`tag`, other.`tag`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`Holder`::class.java, this.`packet`, this.`tag`))
}
