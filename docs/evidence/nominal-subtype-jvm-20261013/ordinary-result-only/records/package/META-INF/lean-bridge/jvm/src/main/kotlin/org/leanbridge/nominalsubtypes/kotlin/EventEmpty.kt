package `org`.`leanbridge`.`nominalsubtypes`.`kotlin`

class `EventEmpty`() : `org`.`leanbridge`.`nominalsubtypes`.`kotlin`.`Event` {

    override fun equals(other: kotlin.Any?): kotlin.Boolean {
        if (this === other) return true
        return other is `EventEmpty`
    }
    override fun hashCode(): kotlin.Int = java.util.Arrays.deepHashCode(kotlin.arrayOf<kotlin.Any?>(`EventEmpty`::class.java))
}
