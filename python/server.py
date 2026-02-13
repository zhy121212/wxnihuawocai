# server.py
import asyncio, websockets, json, random, requests
# ================= 配置区域 =================
AI_API_KEY = "sk-3c213a53c3034bc2af367beeaeb3c9ee"
AI_API_URL = "https://api.deepseek.com/chat/completions"
AI_MODEL = "deepseek-chat"
REFILL_THRESHOLD = 30
ROUND_TIME = 60 # 每局60秒
# ================= 词库 =================
DEFAULT_ANSWERS = [
    {"word": "熊猫", "hint": "黑白相间，爱吃竹子，国宝动物"}, 
    {"word": "长颈鹿", "hint": "脖子非常长，身上有斑点，吃树叶"}, 
    {"word": "企鹅", "hint": "住在南极，黑白羽毛，走路摇摇摆摆"}, 
    {"word": "大象", "hint": "体型巨大，有长鼻子和大耳朵"}, 
    {"word": "狮子", "hint": "草原之王，雄性有鬃毛，猫科动物"}, 
    {"word": "老虎", "hint": "身上有条纹，森林之王，猫科动物"}, 
    {"word": "猴子", "hint": "聪明灵活，喜欢爬树，爱吃香蕉"}, 
    {"word": "兔子", "hint": "长耳朵短尾巴，爱吃胡萝卜，蹦蹦跳跳"}, 
    {"word": "蜜蜂", "hint": "采花酿蜜，有翅膀会飞，群居昆虫"}, 
    {"word": "蝴蝶", "hint": "有美丽翅膀，会飞，由毛毛虫变成"}, 
    {"word": "苹果", "hint": "常见水果，红色或绿色，圆形"}, 
    {"word": "香蕉", "hint": "黄色弯曲水果，剥皮吃，软糯香甜"}, 
    {"word": "西瓜", "hint": "夏天水果，外绿内红，有黑籽"}, 
    {"word": "葡萄", "hint": "一串串的，紫色或绿色，圆圆的"}, 
    {"word": "汉堡", "hint": "西式快餐，两片面包夹肉和菜"}, 
    {"word": "披萨", "hint": "意大利美食，圆饼上有芝士和配料"}, 
    {"word": "手机", "hint": "通讯工具，可以打电话上网，长方形"}, 
    {"word": "眼镜", "hint": "戴在眼睛上，有镜片和镜框"}, 
    {"word": "太阳", "hint": "天上最亮的，圆形，给我们光和热"}, 
    {"word": "月亮", "hint": "晚上出现在天空，有时圆有时弯"}, 
    {"word": "彩虹", "hint": "雨后天晴出现，七种颜色，弯弯的桥"}, 
    {"word": "睡觉", "hint": "闭着眼睛躺着，晚上做的，休息"}, 
    {"word": "跑步", "hint": "运动方式，双脚交替快速前进"}, 
    {"word": "医生", "hint": "穿白大褂，在医院工作，治病救人"}
]
ANSWERS = []
is_refilling = False
# ================= AI 生成模块 =================
def get_ai_words():
    if not AI_API_KEY: return []
    try:
        headers = {"Authorization": f"Bearer {AI_API_KEY}", "Content-Type": "application/json"}
        payload = {
            "model": AI_MODEL,
            "messages": [{"role": "user", "content": "请给我20个适合你画我猜游戏的中文词语，每个词语附带一个详细提示（10个字以上，描述特征或用途）。只返回JSON数组格式，例如 [{\"word\":\"熊猫\",\"hint\":\"黑白相间爱吃竹子的国宝动物\"}]。不要有多余的废话。"}],
            "temperature": 0.8
        }
        response = requests.post(AI_API_URL, headers=headers, json=payload, timeout=15, proxies={"http": None, "https": None})
        if response.status_code == 200:
            content = response.json()['choices'][0]['message']['content']
            content = content.strip().replace("```json", "").replace("```", "")
            words = json.loads(content)
            if isinstance(words, list) and len(words) > 0 and 'word' in words[0]: return words
    except Exception as e: print(f"AI 生成出错: {e}")
    return []
# ================= 智能补充逻辑 =================
async def smart_refill():
    global is_refilling
    if len(ANSWERS) >= REFILL_THRESHOLD or is_refilling: return
    is_refilling = True
    print(f"词库剩余 {len(ANSWERS)} 个，开始后台补充...")
    loop = asyncio.get_event_loop()
    new_words = await loop.run_in_executor(None, get_ai_words)
    if new_words: ANSWERS.extend(new_words); print(f"补充完成！当前总数: {len(ANSWERS)}")
    is_refilling = False
# ================= 游戏核心逻辑 =================
rooms = {}
async def broadcast(room, msg):
    for c in room["clients"]:
        try: await c["ws"].send(json.dumps(msg))
        except: pass
def get_room_by_player(pid):
    for room in rooms.values():
        for c in room["clients"]:
            if c["id"] == pid: return room
    return None
# 新增：倒计时任务
async def timer_task(room_id):
    if room_id not in rooms: return
    room = rooms[room_id]
    
    for i in range(ROUND_TIME, 0, -1):
        if room.get("is_round_over"): return # 如果回合已结束（猜对了），停止倒计时
        
        await broadcast(room, {"type": "time_update", "remaining": i})
        await asyncio.sleep(1)
    
    # 时间到
    if not room.get("is_round_over"):
        room["is_round_over"] = True
        drawer_name = room["clients"][room["drawer_index"]]["id"]
        answer = room["current_answer"]
        # 发送超时消息
        await broadcast(room, {"type": "round_timeout", "drawer": drawer_name, "answer": answer})
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
                    rooms[room_id] = {
                        "id": room_id, "host": player_id, "clients": [], 
                        "drawer_index": 0, "current_answer": None, "current_hint": None, 
                        "game_started": False, "guess_history": [], "is_round_over": False,
                        "timer": None
                    }
                room = rooms[room_id]
                if not any(c["id"] == player_id for c in room["clients"]):
                    room["clients"].append({"id": player_id, "ws": ws, "ready": False})
                await broadcast(room, {"type": "room_info", "host": room["host"], "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]})
                continue
            if typ == "set_ready":
                room = get_room_by_player(player_id)
                if not room: continue
                for c in room["clients"]:
                    if c["id"] == player_id: c["ready"] = data.get("ready", False)
                await broadcast(room, {"type": "room_info", "host": room["host"], "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]})
                continue
            if typ == "start_game":
                room = get_room_by_player(player_id)
                if not room or player_id != room["host"] or not room["clients"] or not all(c["ready"] for c in room["clients"]): continue
                
                asyncio.create_task(smart_refill())
                room["game_started"] = True
                room["drawer_index"] = 0
                room["guess_history"] = []
                
                if len(ANSWERS) < 3: ANSWERS.extend(DEFAULT_ANSWERS)
                options = random.sample(ANSWERS, 3)
                room["pending_options"] = options
                drawer = room["clients"][room["drawer_index"]]["id"]
                drawer_ws = [c["ws"] for c in room["clients"] if c["id"] == drawer][0]
                await drawer_ws.send(json.dumps({"type": "choose_words", "options": [o["word"] for o in options]}))
                for c in room["clients"]:
                    if c["id"] != drawer: await c["ws"].send(json.dumps({"type": "waiting_for_choice"}))
                continue
            if typ == "word_chosen":
                room = get_room_by_player(player_id)
                if not room: continue
                selected_word = data.get("word")
                selected_obj = next((x for x in room["pending_options"] if x["word"] == selected_word), None)
                if selected_obj:
                    room["current_answer"] = selected_obj["word"]
                    char_count = len(selected_obj["word"])
                    final_hint = f"{selected_obj['hint']} ({char_count}个字)"
                    room["current_hint"] = final_hint
                    room["guess_history"] = []
                    room["is_round_over"] = False # 重置结束标志
                    
                    drawer = room["clients"][room["drawer_index"]]["id"]
                    await broadcast(room, {"type": "game_start", "drawer": drawer, "answer": room["current_answer"], "hint": room["current_hint"]})
                    await broadcast(room, {"type": "clear"})
                    
                    # 【新增】启动倒计时
                    if room["timer"]: room["timer"].cancel() # 防止旧的计时器还在
                    room["timer"] = asyncio.create_task(timer_task(room_id))
                continue
            if typ == "close_round":
                room = get_room_by_player(player_id)
                if not room or not room.get("is_round_over"): continue
                room["is_round_over"] = False
                room["drawer_index"] = (room["drawer_index"] + 1) % len(room["clients"])
                
                asyncio.create_task(smart_refill())
                if len(ANSWERS) < 3: ANSWERS.extend(DEFAULT_ANSWERS)
                options = random.sample(ANSWERS, 3)
                room["pending_options"] = options
                new_drawer = room["clients"][room["drawer_index"]]["id"]
                drawer_ws = [c["ws"] for c in room["clients"] if c["id"] == new_drawer][0]
                await drawer_ws.send(json.dumps({"type": "choose_words", "options": [o["word"] for o in options]}))
                for c in room["clients"]:
                    if c["id"] != new_drawer: await c["ws"].send(json.dumps({"type": "waiting_for_choice"}))
                continue
            room = get_room_by_player(player_id)
            if not room or not room["game_started"]: continue
            if typ == "draw_batch":
                for c in room["clients"]:
                    if c["ws"] != ws: await c["ws"].send(message)
                continue
            if typ == "clear":
                await broadcast(room, {"type": "clear"})
                continue
            if typ == "guess":
                guess_text = data.get("answer")
                correct = guess_text == room["current_answer"]
                await broadcast(room, {"type": "guess_result", "correct": correct, "guess_text": guess_text, "player_id": player_id})
                
                if correct:
                    # 猜对了，取消计时器
                    if room["timer"]: room["timer"].cancel()
                    
                    drawer_name = room["clients"][room["drawer_index"]]["id"]
                    answer = room["current_answer"]
                    room["is_round_over"] = True
                    await broadcast(room, {"type": "round_over", "drawer": drawer_name, "answer": answer})
                else:
                    room["guess_history"].append(f"{player_id}: {guess_text}")
                    await broadcast(room, {"type": "guess_history_update", "history": room["guess_history"]})
    finally:
        if player_id and room_id and room_id in rooms:
            room = rooms[room_id]
            room["clients"] = [c for c in room["clients"] if c["id"] != player_id]
            if room["host"] == player_id and room["clients"]: room["host"] = room["clients"][0]["id"]
            if room["clients"]: await broadcast(room, {"type": "room_info", "host": room["host"], "members": [{"id": c["id"], "ready": c["ready"]} for c in room["clients"]]})
            else: 
                # 房间没人了，清理计时器
                if room["timer"]: room["timer"].cancel()
                del rooms[room_id]
async def main():
    global ANSWERS
    ANSWERS = DEFAULT_ANSWERS[:]
    print("正在进行首次词库扩充...")
    first_batch = await asyncio.get_event_loop().run_in_executor(None, get_ai_words)
    if first_batch: ANSWERS.extend(first_batch); print(f"首次扩充成功，当前总数: {len(ANSWERS)}")
    print("服务器启动 ws://0.0.0.0:8765")
    async with websockets.serve(handler, "0.0.0.0", 8765): await asyncio.Future()
if __name__ == "__main__": asyncio.run(main())