const app = getApp()

Page({
  data: {
    playerId: app.globalData.clientId,
    isDrawer: false,
    answer: "",
    guessText: "",
    lastCanvasImage: "",
    lastAnswer: "",      // 保存上一轮答案
    showRoundEnd: false,
    boardWidth: 300,
    boardHeight: 300,
    guessHistory: []     // 历史猜测
  },

  onLoad(options){
    this.setData({
      isDrawer: this.data.playerId === options.drawer,
      answer: options.answer
    })
  },

  onReady(){
    // 动态计算画板尺寸，自适应屏幕宽度，固定高度为屏幕高度的50%
    wx.getSystemInfo({
      success: res => {
        const width = res.windowWidth * 0.9
        const height = res.windowHeight * 0.5
        this.setData({ boardWidth: width, boardHeight: height })
      }
    })

    this.ctx = wx.createCanvasContext("board", this)
    this.lastX = null
    this.lastY = null

    const ws = app.globalData.ws
    ws.onMessage(res => {
      const data = JSON.parse(res.data)

      if(data.type === "draw") this.drawLine(data.x1, data.y1, data.x2, data.y2)
      if(data.type === "clear") this.clearCanvas()

      if(data.type === "guess_result"){
        wx.showToast({ title: data.correct ? "🎉 猜对了" : "❌ 猜错了", icon: data.correct ? "success" : "none" })
        // 正确时保存上一轮答案，用于弹窗
        if(data.correct){
          this.setData({ lastAnswer: this.data.answer })
        }
      }

      if(data.type === "next_round"){
        // 保存上一轮画作
        wx.canvasToTempFilePath({
          canvasId: "board",
          success: resPath => {
            this.setData({ 
              lastCanvasImage: resPath.tempFilePath,
              showRoundEnd: true
            })
          }
        })
        // 更新新一轮答案和状态
        this.setData({
          isDrawer: this.data.playerId === data.drawer,
          answer: data.answer,
          guessText: "",
          guessHistory: []
        })
        this.clearCanvas()
      }

      if(data.type === "guess_history"){
        this.setData({ guessHistory: data.guess_history })
      }
    })
  },

  closeRoundEnd(){
    this.setData({ showRoundEnd: false, guessText: "", guessHistory: [], lastAnswer: "" })
  },

  onTouchStart(e){
    if(!this.data.isDrawer) return
    const t = e.touches[0]
    this.lastX = t.x
    this.lastY = t.y
  },

  onTouchMove(e){ 
    if(!this.data.isDrawer) return
    const t = e.touches[0], x = t.x, y = t.y
    if(this.lastX !== null){
      this.drawLine(this.lastX, this.lastY, x, y)
      app.safeSend({ type: "draw", x1: this.lastX, y1: this.lastY, x2: x, y2: y })
    }
    this.lastX = x
    this.lastY = y
  },

  onTouchEnd(){
    this.lastX = null
    this.lastY = null
  },

  drawLine(x1, y1, x2, y2){
    const ctx = this.ctx
    ctx.setStrokeStyle("#000")
    ctx.setLineWidth(4)
    ctx.setLineCap("round")
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.draw(true)
  },

  clearCanvas(){ 
    if(!this.ctx) return
    this.ctx.clearRect(0, 0, this.data.boardWidth, this.data.boardHeight)
    this.ctx.draw()
  },

  clearBoard(){
    if(!this.data.isDrawer) return
    this.clearCanvas()
    app.safeSend({ type: "clear" })
  },

  onGuessInput(e){
    this.setData({ guessText: e.detail.value })
  },

  submitGuess(){
    if(!this.data.guessText) return
    app.safeSend({ type: "guess", answer: this.data.guessText })
    this.setData({ guessText: "" })
  }
})
