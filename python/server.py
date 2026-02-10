import asyncio
import websockets
import json

clients = []          # [{ "id": playerId, "ws": ws }]
drawer_index = 0

answers = ["苹果", "香蕉", "西瓜"]
current_answer = answers[0]

async def broadcast(msg):
    for c in clients:
        await c["ws"].send(json.dumps(msg))

async def handler(ws):
    global drawer_index, current_answer

    player_id = None

    try:
        async for message in ws:
            data = json.loads(message)

            # ===== 玩家加入 =====
            if data["type"] == "join":
                player_id = data["playerId"]

                clients.append({
                    "id": player_id,
                    "ws": ws
                })

                print("玩家加入:", player_id)

                drawer = clients[drawer_index]["id"]

                # 🔴 第一局：必须发 role + answer
                await broadcast({
                    "type": "role",
                    "drawer": drawer
                })

                await broadcast({
                    "type": "next_round",
                    "drawer": drawer,
                    "answer": current_answer
                })

                await broadcast({
                    "type": "clear"
                })
                continue

            # ===== 画画 =====
            if data["type"] == "draw":
                for c in clients:
                    if c["ws"] != ws:
                        await c["ws"].send(message)
                continue

            # ===== 猜词 =====
            if data["type"] == "guess":
                correct = data["answer"] == current_answer

                await broadcast({
                    "type": "guess_result",
                    "from": player_id,
                    "correct": correct
                })

                if correct:
                    drawer_index = (drawer_index + 1) % len(clients)
                    current_answer = answers[drawer_index % len(answers)]
                    drawer = clients[drawer_index]["id"]

                    await broadcast({
                        "type": "next_round",
                        "drawer": drawer,
                        "answer": current_answer
                    })

                    await broadcast({
                        "type": "clear"
                    })
                continue

    finally:
        if player_id:
            print("玩家离开:", player_id)
            for c in clients[:]:
                if c["id"] == player_id:
                    clients.remove(c)

async def main():
    print("服务器启动 ws://0.0.0.0:8765")
    async with websockets.serve(handler, "0.0.0.0", 8765):
        await asyncio.Future()

asyncio.run(main())
