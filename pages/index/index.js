const app = getApp()

Page({
  data: {
    roomId: "room1",
    playerId: app.globalData.clientId,
    members: [],
    host: "",
    ready: false,
    allReady: false,
    gameStarted: false
  },

  onLoad() {
    const ws = app.globalData.ws
    ws.onMessage(res => {
      const data = JSON.parse(res.data)
      if(data.type==="room_info"){
        const allReady = data.members.length>0 && data.members.every(m=>m.ready)
        this.setData({ host: data.host, members: data.members, allReady })
      }
      if(data.type==="game_start"){
        wx.navigateTo({ url:"/pages/game/game?drawer="+data.drawer+"&answer="+data.answer })
      }
    })
  },

  toggleReady(){
    const ready = !this.data.ready
    this.setData({ ready })
    app.safeSend({ type:"set_ready", ready })
  },

  startGame(){
    app.safeSend({ type:"start_game" })
  }
})
