App({
  globalData: {
    ws: null,
    clientId: Date.now() + "_" + Math.random().toString(36).slice(2),
    drawerId: null
  },

  onLaunch() {
    const ws = wx.connectSocket({
      url: "ws://127.0.0.1:8765"
    })

    this.globalData.ws = ws

    ws.onOpen(() => {
      // 只做一件事：告诉服务器我是谁
      ws.send({
        data: JSON.stringify({
          type: "join",
          playerId: this.globalData.clientId
        })
      })
    })
  }
})
