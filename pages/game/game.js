let ws = null
let ctx = null
let drawing = false
let lastX = 0
let lastY = 0

Page({
  data: {
    isDrawer: false
  },

  onLoad() {
    ctx = wx.createCanvasContext('board')

    ws = wx.connectSocket({
      url: 'ws://127.0.0.1:8765'
    })

    ws.onMessage(res => {
      const msg = JSON.parse(res.data)

      // 身份
      if (msg.type === 'role') {
        this.setData({
          isDrawer: msg.drawerId === ws._socketTaskId
        })
      }

      // 画画
      if (msg.type === 'draw') {
        const [x1, y1] = msg.from
        const [x2, y2] = msg.to
        this.drawLine(x1, y1, x2, y2)
      }

      // 清空
      if (msg.type === 'clear') {
        ctx.clearRect(0, 0, 1000, 1000)
        ctx.draw()
      }
    })
  },

  onTouchStart(e) {
    if (!this.data.isDrawer) return
    const { x, y } = e.touches[0]
    lastX = x
    lastY = y
    drawing = true
  },

  onTouchMove(e) {
    if (!this.data.isDrawer || !drawing) return

    const { x, y } = e.touches[0]

    this.drawLine(lastX, lastY, x, y)

    ws.send({
      data: JSON.stringify({
        type: 'draw',
        from: [lastX, lastY],
        to: [x, y]
      })
    })

    lastX = x
    lastY = y
  },

  onTouchEnd() {
    drawing = false
  },

  drawLine(x1, y1, x2, y2) {
    ctx.setStrokeStyle('#000')
    ctx.setLineWidth(4)
    ctx.setLineCap('round')
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.draw(true)
  },

  clearBoard() {
    ctx.clearRect(0, 0, 1000, 1000)
    ctx.draw()

    ws.send({
      data: JSON.stringify({ type: 'clear' })
    })
  }
  
})
