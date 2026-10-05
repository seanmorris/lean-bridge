"""Every marked call or assignment must fail strict checking of installed stubs."""
import lean_aliases as api

api.echo_nat("bad")
api.echo_char(7)
api.echo_bytes(bytearray())
api.reverse_rows(["bad"])
api.echo_outcome(api.Ok((1, "bad")))
api.echo_unit(1)
api.echo_bool(1)
packet = api.Packet(1, "", (), None, api.Err(""))
packet.count = 7
