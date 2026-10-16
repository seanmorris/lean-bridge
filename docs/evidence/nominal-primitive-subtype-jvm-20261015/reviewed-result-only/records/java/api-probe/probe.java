import org.leanbridge.nominalprimitivesubtypes.*;
final class Probe {
    static Object echoA() { return Api.echoA(null); }
    static Object echoB() { return Api.echoB(null); }
    static Object refuseUnit() { return Api.refuseUnit(null); }
    static Object combine() { return Api.combine(null, null); }
    static Object echoPair() { return Api.echoPair(null); }
    static Object echoEventA() { return Api.echoEventA(null); }
    static Object echoEventB() { return Api.echoEventB(null); }
    static Object aliases() { return Api.aliases(null, null); }
    static PacketPair inputValue;
}
