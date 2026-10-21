import org.leanbridge.zeropayloadcheckedrecords.kotlin.*
fun witnessesNull() = Api.witnesses(java.math.BigInteger.ZERO)
fun maybeWitnessNull() = Api.maybeWitness(false)
fun produceMarkNull() = Api.produceMark(false)
