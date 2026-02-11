const app = getApp()

Page({
  data: {
    roomId: "room1",
    playerId: "player_" + Math.floor(Math.random() * 1000),
    members: [],
    host: "",
    ready: false,
    allReady: false,
    gameStarted: false,
    isDrawer: false,
    answer: "",
    guessText: ""
  },

  onLoad() {
    // 自动加入房间（核心）
    app.safeSend({
      type: "join_room",
      playerId: this.data.playerId,
      roomId: this.data.roomId
    })
  },

  onReady() {
    this.ctx = wx.createCanvasContext("board", this)
    this.lastX = null
    this.lastY = null

    const ws = app.globalData.ws

    ws.onMessage(res => {
      const data = JSON.parse(res.data)

      // ===== 房间信息 =====
      if (data.type === "room_info") {
        const allReady =
          data.members.length > 0 &&
          data.members.every(m => m.ready)

        this.setData({
          host: data.host,
          members: data.members,
          allReady
        })
        return
      }

      // ===== 游戏开始 =====
      if (data.type === "game_start") {
        this.setData({
          gameStarted: true,
          isDrawer: this.data.playerId === data.drawer,
          answer: data.answer
        })
        this.clearCanvas()
        return
      }

      // ===== 下一局 =====
      if (data.type === "next_round") {
        this.setData({
          isDrawer: this.data.playerId === data.drawer,
          answer: data.answer,
          guessText: ""
        })
        this.clearCanvas()
        return
      }

      // ===== 画画同步 =====
      if (data.type === "draw") {
        this.drawLine(data.x1, data.y1, data.x2, data.y2)
        return
      }

      // ===== 清空画布 =====
      if (data.type === "clear") {
        this.clearCanvas()
        return
      }

      // ===== 猜词结果 =====
      if (data.type === "guess_result") {
        wx.showToast({
          title: data.correct ? "🎉 猜对了" : "❌ 猜错了",
          icon: data.correct ? "success" : "none"
        })
        return
      }
    })
  },

  // ================= 准备 =================
  toggleReady() {
    const ready = !this.data.ready
    this.setData({ ready })

    app.safeSend({
      type: "set_ready",
      ready
    })
  },

  // ================= 房主开始 =================
  startGame() {
    app.safeSend({ type: "start_game" })
  },

  // ================= 画画 =================
  onTouchStart(e) {
    if (!this.data.isDrawer || !this.data.gameStarted) return
    const t = e.touches[0]
    this.lastX = t.x
    this.lastY = t.y
  },

  onTouchMove(e) {
    if (!this.data.isDrawer || !this.data.gameStarted) return
    const t = e.touches[0]
    const x = t.x
    const y = t.y

    if (this.lastX !== null) {
      this.drawLine(this.lastX, this.lastY, x, y)
      app.safeSend({
        type: "draw",
        x1: this.lastX,
        y1: this.lastY,
        x2: x,
        y2: y
      })
    }

    this.lastX = x
    this.lastY = y
  },

  onTouchEnd() {
    this.lastX = null
    this.lastY = null
  },

  drawLine(x1, y1, x2, y2) {
    const ctx = this.ctx
    ctx.setStrokeStyle("#000")
    ctx.setLineWidth(3)
    ctx.setLineCap("round")
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.draw(true)
  },

  // ================= 清空 =================
  clearCanvas() {
    if (!this.ctx) return
    this.ctx.clearRect(0, 0, 1000, 1000)
    this.ctx.draw()
  },

  clearBoard() {
    if (!this.data.isDrawer) return
    this.clearCanvas()
    app.safeSend({ type: "clear" })
  },

  // ================= 猜词 =================
  onGuessInput(e) {
    this.setData({ guessText: e.detail.value })
  },

  submitGuess() {
    if (!this.data.guessText || !this.data.gameStarted) return
    app.safeSend({
      type: "guess",
      answer: this.data.guessText
    })
    this.setData({ guessText: "" })
  }
})
