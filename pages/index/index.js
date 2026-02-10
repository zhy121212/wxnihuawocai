const app = getApp()

Page({
  data: {
    isDrawer: false,
    answer: "",
    guessText: ""
  },

  onReady() {
    // 初始化画布
    this.ctx = wx.createCanvasContext("board", this)
    this.lastX = null
    this.lastY = null

    const ws = app.globalData.ws

    ws.onMessage(res => {
      const data = JSON.parse(res.data)

      // ===== 角色分配 =====
      if (data.type === "role") {
        app.globalData.drawerId = data.drawer
        this.setData({
          isDrawer: app.globalData.clientId === data.drawer
        })
        return
      }

      // ===== 画画同步 =====
      if (data.type === "draw") {
        this.drawLine(
          data.x1,
          data.y1,
          data.x2,
          data.y2
        )
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

      // ===== 下一局 =====
      if (data.type === "next_round") {
        app.globalData.drawerId = data.drawer

        this.setData({
          isDrawer: app.globalData.clientId === data.drawer,
          answer: data.answer,
          guessText: ""
        })

        this.ctx.clearRect(0, 0, 1000, 1000)
        this.ctx.draw()
        return
      }

      // ===== 清空画布 =====
      if (data.type === "clear") {
        this.ctx.clearRect(0, 0, 1000, 1000)
        this.ctx.draw()
        return
      }
    })
  },

  // ================= 画画 =================

  onTouchStart(e) {
    if (!this.data.isDrawer) return
    const t = e.touches[0]
    this.lastX = t.x
    this.lastY = t.y
  },

  onTouchMove(e) {
    if (!this.data.isDrawer) return

    const t = e.touches[0]
    const x = t.x
    const y = t.y
    const ws = app.globalData.ws

    if (this.lastX !== null) {
      this.drawLine(this.lastX, this.lastY, x, y)

      ws.send({
        data: JSON.stringify({
          type: "draw",
          from: app.globalData.clientId,
          x1: this.lastX,
          y1: this.lastY,
          x2: x,
          y2: y
        })
      })
    }

    this.lastX = x
    this.lastY = y
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

  // ================= 清空画布 =================

  clearBoard() {
    // 本地清空
    this.ctx.clearRect(0, 0, 1000, 1000)
    this.ctx.draw()

    // 通知服务器
    const ws = app.globalData.ws
    ws.send({
      data: JSON.stringify({
        type: "clear",
        from: app.globalData.clientId
      })
    })
  },

  // ================= 猜词 =================

  onGuessInput(e) {
    this.setData({
      guessText: e.detail.value
    })
  },

  submitGuess() {
    if (!this.data.guessText) return

    const ws = app.globalData.ws
    ws.send({
      data: JSON.stringify({
        type: "guess",
        from: app.globalData.clientId,
        answer: this.data.guessText
      })
    })

    this.setData({ guessText: "" })
  }
})
