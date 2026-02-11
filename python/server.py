import asyncio
import websockets
import json
import random

# 房间列表，每个房间是 dict
rooms = {}
answers = ["苹果", "香蕉", "西瓜"]


async def broadcast(room, msg):
    """向房间内所有客户端广播消息"""
    for c in room["clients"]:
        try:
            await c["ws"].send(json.dumps(msg))
        except:
            pass  # 防止发送异常挂掉


def get_room_by_player(player_id):
    for room in rooms.values():
        for c in room["clients"]:
            if c["id"] == player_id:
                return room
    return None


async def handler(ws):
    player_id = None
    room_id = None

    try:
        async for message in ws:
            data = json.loads(message)
            typ = data["type"]

            # ===== 加入房间 =====
            if typ == "join_room":
                player_id = data["playerId"]
                room_id = data["roomId"]

                if room_id not in rooms:
                    # 第一个加入的人是房主
                    rooms[room_id] = {
                        "id": room_id,
                        "host": player_id,
                        "clients": [],
                        "drawer_index": 0,
                        "current_answer": None,
                        "game_started": False
                    }

                room = rooms[room_id]

                # 防止重复加入
                if not any(c["id"] == player_id for c in room["clients"]):
                    room["clients"].append({
                        "id": player_id,
                        "ws": ws,
                        "ready": False
                    })

                print(f"玩家 {player_id} 加入房间 {room_id}")

                # 广播房间信息
                await broadcast(room, {
                    "type": "room_info",
                    "host": room["host"],
                    "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]
                })
                continue

            # ===== 玩家准备 =====
            if typ == "set_ready":
                room = get_room_by_player(player_id)
                if not room:
                    continue

                for c in room["clients"]:
                    if c["id"] == player_id:
                        c["ready"] = data.get("ready", False)

                await broadcast(room, {
                    "type": "room_info",
                    "host": room["host"],
                    "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]
                })
                continue

            # ===== 房主开始游戏 =====
            if typ == "start_game":
                room = get_room_by_player(player_id)
                if not room:
                    continue

                # 不是房主
                if player_id != room["host"]:
                    continue

                # 房间没人或者有人没准备
                if not room["clients"] or not all(c["ready"] for c in room["clients"]):
                    continue

                room["game_started"] = True
                room["drawer_index"] = 0
                room["current_answer"] = random.choice(answers)
                drawer = room["clients"][room["drawer_index"]]["id"]

                print(f"房间 {room_id} 游戏开始，画手 {drawer}，答案 {room['current_answer']}")

                await broadcast(room, {
                    "type": "game_start",
                    "drawer": drawer,
                    "answer": room["current_answer"]
                })

                await broadcast(room, {"type": "clear"})
                continue

            # ===== 游戏未开始，忽略其他消息 =====
            room = get_room_by_player(player_id)
            if not room or not room["game_started"]:
                continue

            # ===== 画画 =====
            if typ == "draw":
                for c in room["clients"]:
                    if c["ws"] != ws:
                        await c["ws"].send(message)
                continue

            # ===== 清空画布 =====
            if typ == "clear":
                await broadcast(room, {"type": "clear"})
                continue

            # ===== 猜词 =====
            if typ == "guess":
                correct = data["answer"] == room["current_answer"]

                await broadcast(room, {
                    "type": "guess_result",
                    "from": player_id,
                    "correct": correct
                })

                if correct:
                    # 切换画手
                    room["drawer_index"] = (room["drawer_index"] + 1) % len(room["clients"])
                    room["current_answer"] = random.choice(answers)
                    drawer = room["clients"][room["drawer_index"]]["id"]

                    print(f"房间 {room_id} 下一局，画手 {drawer}，答案 {room['current_answer']}")

                    await broadcast(room, {
                        "type": "next_round",
                        "drawer": drawer,
                        "answer": room["current_answer"]
                    })

                    await broadcast(room, {"type": "clear"})

    finally:
        # 玩家断开
        if player_id and room_id and room_id in rooms:
            room = rooms[room_id]
            room["clients"] = [c for c in room["clients"] if c["id"] != player_id]
            print(f"玩家 {player_id} 离开房间 {room_id}")

            # 更新房主，如果房主离开，默认第一个成员为新房主
            if room["host"] == player_id and room["clients"]:
                room["host"] = room["clients"][0]["id"]

            # 广播更新房间成员
            if room["clients"]:
                await broadcast(room, {
                    "type": "room_info",
                    "host": room["host"],
                    "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]
                })
            else:
                # 房间没人了，删除房间
                del rooms[room_id]


async def main():
    print("服务器启动 ws://0.0.0.0:8765")
    async with websockets.serve(handler, "0.0.0.0", 8765):
        await asyncio.Future()


asyncio.run(main())
