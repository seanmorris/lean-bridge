import org.leanbridge.zeropayloadcheckedrecords.kotlin.*
fun witnessCountNull() = Api.witnessCount(Witness())
fun absentCountNull() = Api.absentCount(Witness())
fun tokenTagNull() = Api.tokenTag(Token(org.leanbridge.zeropayloadcheckedrecords.Unit.INSTANCE))
fun markerCountNull() = Api.markerCount(Marker())
fun markCountNull() = Api.markCount(MarkBlank())
fun witnessesNull() = Api.witnesses(java.math.BigInteger.ZERO)
fun maybeWitnessNull() = Api.maybeWitness(false)
fun produceMarkNull() = Api.produceMark(false)
