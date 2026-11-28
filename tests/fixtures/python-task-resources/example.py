import asyncio
import lease_desk as desk
import lease_depot as depot


async def main():
    with desk.issue(40) as ticket:
        with await depot.revisit(ticket, lambda n: n + 2) as returned:
            assert returned.same_resource(ticket)
            print(desk.count(returned))


asyncio.run(main())
