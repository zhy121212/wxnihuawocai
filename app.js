App({
  globalData: {
    ws: null,
    socketOpen: false,
    sendQueue: [],
    clientId: "player_" + Math.floor(Math.random()*1000)
  },

  onLaunch() {
    const ws = wx.connectSocket({
      url: "ws://209.54.106.29:8765"
    })
    this.globalData.ws = ws

    ws.onOpen(() => {
      this.globalData.socketOpen = true
      this.safeSend({ type: "join_room", playerId: this.globalData.clientId, roomId: "room1" })
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
