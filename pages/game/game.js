// pages/game/game.js

let ws = null
let ctx = null
let drawing = false
let lastX = 0
let lastY = 0

Page({
  onLoad() {
    // 1. 初始化 canvas
    ctx = wx.createCanvasContext('board')

    // 2. 连接 WebSocket（改成你自己的）
    ws = wx.connectSocket({
      url: 'ws://127.0.0.1:8765'
    })

    ws.onOpen(() => {
      console.log('WS connected')
    })

    ws.onMessage(res => {
      const msg = JSON.parse(res.data)
      if (msg.type === 'draw') {
        const [x1, y1] = msg.from
        const [x2, y2] = msg.to
        this.drawLine(x1, y1, x2, y2, msg.color, msg.width)
      }
    })
  },

  onTouchStart(e) {
    const { x, y } = e.touches[0]
    lastX = x
    lastY = y
    drawing = true
  },

  onTouchMove(e) {
    if (!drawing) return

    const { x, y } = e.touches[0]

    // 本地画
    this.drawLine(lastX, lastY, x, y)

    // 发给服务器
    ws.send({
      data: JSON.stringify({
        type: 'draw',
        from: [lastX, lastY],
        to: [x, y],
        color: '#000',
        width: 4
      })
    })

    lastX = x
    lastY = y
  },

  onTouchEnd() {
    drawing = false
  },

  drawLine(x1, y1, x2, y2, color = '#000', width = 4) {
    ctx.setStrokeStyle(color)
    ctx.setLineWidth(width)
    ctx.setLineCap('round')

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.draw(true)
  }
})
