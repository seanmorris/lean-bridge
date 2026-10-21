import org.leanbridge.zeropayloadcheckedrecords.*;
final class Probe {
    static Object witnessCount() { return Api.witnessCount(null); }
    static Object absentCount() { return Api.absentCount(null); }
    static void tokenTag() { Api.tokenTag(null); }
    static Object markerCount() { return Api.markerCount(null); }
    static Object markCount() { return Api.markCount(null); }
}
