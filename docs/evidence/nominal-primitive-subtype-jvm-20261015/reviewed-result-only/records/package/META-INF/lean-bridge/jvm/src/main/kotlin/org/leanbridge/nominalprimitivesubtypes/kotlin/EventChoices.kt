package `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`

class `EventChoices`(@kotlin.jvm.JvmField val `values`: kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Result`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`, `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>>) : `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Event` {
    fun `values`(): kotlin.Array<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Option`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Result`<`org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`, `org`.`leanbridge`.`nominalprimitivesubtypes`.`kotlin`.`Packet`>>> = `values`
    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `EventChoices`
            && java.util.Objects.deepEquals(this.`values`, other.`values`)
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`EventChoices`::class.java, this.`values`))
}
