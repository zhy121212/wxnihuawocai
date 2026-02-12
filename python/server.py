# server.py
import asyncio, websockets, json, random

rooms = {}
answers = ["苹果","香蕉","西瓜"]

async def broadcast(room, msg):
    for c in room["clients"]:
        try:
            await c["ws"].send(json.dumps(msg))
        except:
            pass

def get_room_by_player(pid):
    for room in rooms.values():
        for c in room["clients"]:
            if c["id"] == pid:
                return room
    return None

async def handler(ws):
    player_id = None
    room_id = None
    try:
        async for message in ws:
            data = json.loads(message)
            typ = data["type"]

            if typ == "join_room":
                player_id = data["playerId"]
                room_id = data["roomId"]
                if room_id not in rooms:
                    rooms[room_id] = {"id": room_id, "host": player_id, "clients": [], "drawer_index": 0, "current_answer": None, "game_started": False}
                room = rooms[room_id]
                if not any(c["id"] == player_id for c in room["clients"]):
                    room["clients"].append({"id": player_id, "ws": ws, "ready": False})
                await broadcast(room, {"type": "room_info", "host": room["host"], "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]})
                continue

            if typ == "set_ready":
                room = get_room_by_player(player_id)
                if not room: continue
                for c in room["clients"]:
                    if c["id"] == player_id:
                        c["ready"] = data.get("ready", False)
                await broadcast(room, {"type": "room_info", "host": room["host"], "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]})
                continue

            if typ == "start_game":
                room = get_room_by_player(player_id)
                if not room: continue
                if player_id != room["host"]: continue
                if not room["clients"] or not all(c["ready"] for c in room["clients"]): continue
                room["game_started"] = True
                room["drawer_index"] = 0
                room["current_answer"] = random.choice(answers)
                drawer = room["clients"][room["drawer_index"]]["id"]
                await broadcast(room, {"type": "game_start", "drawer": drawer, "answer": room["current_answer"]})
                await broadcast(room, {"type": "clear"})
                continue

            room = get_room_by_player(player_id)
            if not room or not room["game_started"]: continue

            if typ == "draw":
                for c in room["clients"]:
                    if c["ws"] != ws:
                        await c["ws"].send(message)
                continue

            if typ == "clear":
                await broadcast(room, {"type": "clear"})
                continue

            if typ == "guess":
                correct = data["answer"] == room["current_answer"]
                await broadcast(room, {"type": "guess_result", "correct": correct})
                if correct:
                    room["drawer_index"] = (room["drawer_index"] + 1) % len(room["clients"])
                    room["current_answer"] = random.choice(answers)
                    drawer = room["clients"][room["drawer_index"]]["id"]
                    await broadcast(room, {"type": "next_round", "drawer": drawer, "answer": room["current_answer"]})
                    await broadcast(room, {"type": "clear"})

    finally:
        if player_id and room_id and room_id in rooms:
            room = rooms[room_id]
            room["clients"] = [c for c in room["clients"] if c["id"] != player_id]
            if room["host"] == player_id and room["clients"]:
                room["host"] = room["clients"][0]["id"]
            if room["clients"]:
                await broadcast(room, {"type": "room_info", "host": room["host"], "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]})
            else:
                del rooms[room_id]

async def main():
    print("服务器启动 ws://127.0.0.1:8765 (仅本地)")
    async with websockets.serve(handler, "0.0.0.0", 8765):
        await asyncio.Future()  # 永远运行

if __name__ == "__main__":
    asyncio.run(main())
