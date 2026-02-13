App({
  globalData: {
    ws: null,
    socketOpen: false,
    sendQueue: [],
    clientId: "" // 先留空，等用户输入名字后赋值
  },

  onLaunch() {
    // 生成一个临时的随机ID，或者等用户输入
    this.globalData.clientId = "user_" + Math.floor(Math.random() * 10000)
    
    const ws = wx.connectSocket({
      url: "ws://192.168.0.166:8675"
    })
    this.globalData.ws = ws

    ws.onOpen(() => {
      this.globalData.socketOpen = true
      // 发送队列中积压的消息
      while(this.globalData.sendQueue.length){
        this.safeSend(this.globalData.sendQueue.shift())
      }
    })

    ws.onError(err => console.error("WebSocket错误:", err))
    ws.onClose(() => this.globalData.socketOpen = false)
  },

  safeSend(data){
    if(!this.globalData.socketOpen){
      this.globalData.sendQueue.push(data)
      return
    }
    this.globalData.ws.send({ data: JSON.stringify(data) })
  }
})
