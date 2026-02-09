Page({
  data: {
    role: 'draw', // draw | guess
    wordList: ['苹果', '猫', '房子', '汽车', '太阳', '月亮'],
    answer: '',
    inputValue: '',
    result: ''
  },

  onReady() {
    // 初始化画布
    this.ctx = wx.createCanvasContext('drawCanvas', this)
    this.ctx.setStrokeStyle('#000')
    this.ctx.setLineWidth(3)
    this.ctx.setLineCap('round')
    this.ctx.setLineJoin('round')

    // 自动开始一局
    this.startNewGame()
  },

  // ========== 画画 ==========
  onTouchStart(e) {
    if (this.data.role !== 'draw') return

    const { x, y } = e.touches[0]
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
  },

  onTouchMove(e) {
    if (this.data.role !== 'draw') return

    const { x, y } = e.touches[0]
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
    this.ctx.draw(true)
  },

  clearCanvas() {
    this.ctx.clearRect(0, 0, 300, 400)
    this.ctx.draw()
  },

  // ========== 游戏 ==========
  startNewGame() {
    const list = this.data.wordList
    const randomIndex = Math.floor(Math.random() * list.length)
    const answer = list[randomIndex]

    const role = Math.random() > 0.5 ? 'draw' : 'guess'

    this.setData({
      answer,
      role,
      inputValue: '',
      result: ''
    })

    this.clearCanvas()

    console.log('本局答案：', answer)
    console.log('我的角色：', role)
  },

  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  submitGuess() {
    if (this.data.role !== 'guess') {
      this.setData({ result: '你是画画的人 👀' })
      return
    }

    if (this.data.inputValue === this.data.answer) {
      this.setData({ result: '🎉 猜对了！' })
    } else {
      this.setData({ result: '❌ 再试试' })
    }
  }
})
