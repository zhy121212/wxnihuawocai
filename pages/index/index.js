// index.js
const app = getApp()

Page({
  data: {
    roomId: "room1",
    playerId: "", // 用户最终确定的名字
    inputName: "", // 输入框里的内容
    members: [],
    host: "",
    ready: false,
    allReady: false,
    gameStarted: false,
    showChoiceModal: false,
    choiceOptions: [],
    hasJoined: false // 是否已进入房间
  },

  onLoad() {
    // 监听服务器消息
    const ws = app.globalData.ws
    ws.onMessage(res => {
      const data = JSON.parse(res.data)
      if(data.type==="room_info"){
        const allReady = data.members.length>0 && data.members.every(m=>m.ready)
        this.setData({ host: data.host, members: data.members, allReady })
      }
      
      if(data.type==="choose_words"){
        this.setData({ 
          showChoiceModal: true, 
          choiceOptions: data.options 
        })
      }
      
      if(data.type==="game_start"){
        wx.navigateTo({ 
          url: `/pages/game/game?drawer=${data.drawer}&answer=${data.answer}&hint=${data.hint}`
        })
      }
    })
  },

  // 新增：输入名字
  onNameInput(e){
    this.setData({ inputName: e.detail.value })
  },

  // 新增：点击进入房间
  joinRoom(){
    let name = this.data.inputName.trim()
    if(!name){
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    
    // 更新全局ID
    app.globalData.clientId = name
    
    // 发送加入房间请求
    app.safeSend({ 
      type: "join_room", 
      playerId: name, 
      roomId: this.data.roomId 
    })

    this.setData({ 
      playerId: name, 
      hasJoined: true 
    })
  },

  toggleReady(){
    const ready = !this.data.ready
    this.setData({ ready })
    app.safeSend({ type:"set_ready", ready })
  },

  startGame(){
    app.safeSend({ type:"start_game" })
  },

  chooseWord(e){
    const word = e.currentTarget.dataset.word
    this.setData({ showChoiceModal: false })
    app.safeSend({ type: "word_chosen", word: word })
  }
})
