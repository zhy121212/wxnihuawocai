// game.js
const app = getApp()
const CANVAS_LOGIC_WIDTH = 400
const CANVAS_LOGIC_HEIGHT = 400

Page({
  data: {
    playerId: app.globalData.clientId,
    isDrawer: false,
    drawerName: "",
    answer: "",
    hint: "",
    guessText: "",
    lastCanvasImage: "",
    lastAnswer: "",
    lastDrawer: "",
    showRoundEnd: false,
    isTimeout: false,
    boardWidth: 300,
    boardHeight: 400,
    guessHistory: [],
    showChoiceModal: false,
    choiceOptions: [],
    waitingForChoice: false,
    remainingTime: 60,
    scrollToView: ""
  },

  drawBuffer: [],
  lastSendTime: 0,
  lastRemotePoint: null,
  preventTouchMove() {},

  onLoad(options) {
    const drawerName = options.drawer || ""
    const isDrawer = (this.data.playerId === drawerName)
    
    this.setData({
      isDrawer: isDrawer,
      drawerName: drawerName,
      answer: isDrawer ? options.answer : "",
      hint: isDrawer ? "" : options.hint
    })
  },

  onReady() {
    // 初始化画布尺寸
    try {
      const windowInfo = wx.getWindowInfo()
      const displayWidth = windowInfo.windowWidth * 0.92
      const displayHeight = (displayWidth / CANVAS_LOGIC_WIDTH) * CANVAS_LOGIC_HEIGHT
      const maxH = windowInfo.windowHeight * 0.5
      let finalW = displayWidth
      let finalH = displayHeight
      if (displayHeight > maxH) {
        finalH = maxH
        finalW = (finalH / CANVAS_LOGIC_HEIGHT) * CANVAS_LOGIC_WIDTH
      }
      this.setData({ boardWidth: finalW, boardHeight: finalH })
    } catch (e) {
      console.error("获取窗口信息失败", e)
    }

    this.ctx = wx.createCanvasContext("board", this)
    this.lastX = null
    this.lastY = null

    const ws = app.globalData.ws
    ws.onMessage(res => {
      const data = JSON.parse(res.data)

      if (data.type === "draw_batch") this.drawBatchLines(data.points)
      if (data.type === "clear") this.clearCanvas()

      if (data.type === "guess_history_update") {
        const formattedHistory = data.history.map(item => {
          const splitIndex = item.indexOf(': ');
          return { player: item.substring(0, splitIndex), text: item.substring(splitIndex + 2) };
        });
        this.setData({ guessHistory: formattedHistory });
        setTimeout(() => { this.setData({ scrollToView: 'scroll-bottom' }); }, 100);
      }
      
      if (data.type === "guess_result") {
         if(!data.correct) wx.showToast({ title: "❌ 猜错了", icon: "none" })
         else wx.showToast({ title: "🎉 猜对了！", icon: "success" })
      }

      if (data.type === "time_update") this.setData({ remainingTime: data.remaining })

      if (data.type === "round_over") this.handleRoundEnd(false, data)
      if (data.type === "round_timeout") this.handleRoundEnd(true, data)

      if (data.type === "choose_words") {
        this.setData({ showChoiceModal: true, choiceOptions: data.options, waitingForChoice: false, showRoundEnd: false })
      }

      if (data.type === "waiting_for_choice") {
        this.setData({ waitingForChoice: true, showRoundEnd: false })
      }

      if (data.type === "game_start") {
        const isD = (this.data.playerId === data.drawer)
        
        // 防止重复刷新
        if (this.data.answer === data.answer && this.data.drawerName === data.drawer) {
            return;
        }

        this.setData({
          isDrawer: isD,
          drawerName: data.drawer,
          answer: isD ? data.answer : "",
          hint: isD ? "" : data.hint,
          guessText: "",
          guessHistory: [],
          showChoiceModal: false,
          waitingForChoice: false,
          remainingTime: 60,
          lastCanvasImage: "" // 关键：清空上一局的截图数据
        })
        
        // 关键：清空画布内容
        this.clearCanvas()
      }
    })
  },

  handleRoundEnd(isTimeout, data) {
    if(this.data.showChoiceModal || this.data.waitingForChoice) return
    wx.canvasToTempFilePath({
      canvasId: "board",
      success: resPath => {
        this.setData({
          lastCanvasImage: resPath.tempFilePath,
          showRoundEnd: true,
          lastAnswer: data.answer,
          lastDrawer: data.drawer,
          guessHistory: [],
          isTimeout: isTimeout
        })
      }
    })
  },

  chooseWord(e) {
    const word = e.currentTarget.dataset.word
    this.setData({ showChoiceModal: false })
    app.safeSend({ type: "word_chosen", word: word })
  },

  closeRoundEnd() {
    this.setData({ showRoundEnd: false })
    app.safeSend({ type: "close_round" })
  },

  onTouchStart(e) {
    if (!this.data.isDrawer) return
    const t = e.touches[0]; this.lastX = t.x; this.lastY = t.y
    this.drawLocalPoint(t.x, t.y)
    const nx = t.x / this.data.boardWidth; const ny = t.y / this.data.boardHeight
    this.drawBuffer.push({ x: nx, y: ny, newLine: true })
    this.flushDrawBuffer()
  },
  onTouchMove(e) {
    if (!this.data.isDrawer) return
    const t = e.touches[0], x = t.x, y = t.y
    if (this.lastX !== null) {
      this.drawLocalLine(this.lastX, this.lastY, x, y)
      const nx = x / this.data.boardWidth; const ny = y / this.data.boardHeight
      this.drawBuffer.push({ x: nx, y: ny, newLine: false })
      const now = Date.now()
      if (now - this.lastSendTime > 50 || this.drawBuffer.length > 5) {
        this.flushDrawBuffer(); this.lastSendTime = now
      }
    }
    this.lastX = x; this.lastY = y
  },
  onTouchEnd() { if (!this.data.isDrawer) return; this.flushDrawBuffer(); this.lastX = null; this.lastY = null },
  flushDrawBuffer() { if (this.drawBuffer.length === 0) return; app.safeSend({ type: "draw_batch", points: [...this.drawBuffer] }); this.drawBuffer = [] },
  drawLocalPoint(x, y) { const ctx = this.ctx; ctx.setFillStyle("#000"); ctx.beginPath(); ctx.arc(x, y, 2, 0, 2 * Math.PI); ctx.fill(); ctx.draw(true) },
  drawLocalLine(x1, y1, x2, y2) { const ctx = this.ctx; ctx.setStrokeStyle("#000"); ctx.setLineWidth(4); ctx.setLineCap("round"); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.draw(true) },
  drawBatchLines(points) {
    if (!points || points.length === 0) return; const ctx = this.ctx; ctx.setStrokeStyle("#000"); ctx.setLineWidth(4); ctx.setLineCap("round")
    const localW = this.data.boardWidth; const localH = this.data.boardHeight
    for (let i = 0; i < points.length; i++) {
      const p = points[i]; const localX = p.x * localW; const localY = p.y * localH
      if (p.newLine) { this.lastRemotePoint = { x: p.x, y: p.y }; ctx.setFillStyle("#000"); ctx.beginPath(); ctx.arc(localX, localY, 2, 0, 2 * Math.PI); ctx.fill() }
      else { if (this.lastRemotePoint) { const prevLocalX = this.lastRemotePoint.x * localW; const prevLocalY = this.lastRemotePoint.y * localH; ctx.beginPath(); ctx.moveTo(prevLocalX, prevLocalY); ctx.lineTo(localX, localY); ctx.stroke() }; this.lastRemotePoint = { x: p.x, y: p.y } }
    }
    ctx.draw(true)
  },
  clearCanvas() { if (!this.ctx) return; this.ctx.clearRect(0, 0, this.data.boardWidth, this.data.boardHeight); this.ctx.draw(); this.lastRemotePoint = null },
  clearBoard() { if (!this.data.isDrawer) return; this.clearCanvas(); app.safeSend({ type: "clear" }) },
  onGuessInput(e) { this.setData({ guessText: e.detail.value }) },
  submitGuess() { if (!this.data.guessText) return; app.safeSend({ type: "guess", answer: this.data.guessText }); this.setData({ guessText: "" }) }
})
