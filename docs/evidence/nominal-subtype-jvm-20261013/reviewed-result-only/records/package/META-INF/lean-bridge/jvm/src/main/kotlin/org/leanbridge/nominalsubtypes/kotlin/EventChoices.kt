package `org`.`leanbridge`.`nominalsubtypes`.`kotlin`

class `EventChoices`(@kotlin.jvm.JvmField val `values`: kotlin.Array<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Result`<java.math.BigInteger, java.math.BigInteger>>>) : `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Event` {
    fun `values`(): kotlin.Array<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Result`<java.math.BigInteger, java.math.BigInteger>>> = `values`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `EventChoices`
            && java.util.Objects.deepEquals(this.`values`, other.`values`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`EventChoices`::class.java, this.`values`))
}
