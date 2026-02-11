App({
  globalData: {
    ws: null,
    socketOpen: false,
    sendQueue: [], // 连接前的消息队列
    clientId: Date.now() + "_" + Math.random().toString(36).slice(2),
    drawerId: null
  },

  onLaunch() {
    console.log("App启动，初始化WebSocket")

    const ws = wx.connectSocket({
      url: "ws://192.168.5.59:8765" // 改成你局域网IP
    })

    this.globalData.ws = ws

    ws.onOpen(() => {
      console.log("WebSocket连接成功")
      this.globalData.socketOpen = true

      // 连接成功后先发送join
      this.safeSend({
        type: "join",
        playerId: this.globalData.clientId
      })

      // 发送缓冲队列中的消息
      while (this.globalData.sendQueue.length > 0) {
        const msg = this.globalData.sendQueue.shift()
        this.safeSend(msg)
      }
    })

    ws.onError(err => {
      console.error("WebSocket错误：", err)
    })

    ws.onClose(() => {
      console.log("WebSocket已关闭")
      this.globalData.socketOpen = false
    })
  },

  // ================= 安全发送函数 =================
  safeSend(data) {
    if (!this.globalData.socketOpen) {
      console.warn("连接未就绪，暂存消息：", data)
      this.globalData.sendQueue.push(data)
      return
    }
    this.globalData.ws.send({
      data: JSON.stringify(data)
    })
  }
})
