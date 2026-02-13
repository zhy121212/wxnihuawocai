// index.js
const app = getApp()

Page({
  data: {
    roomId: "room1",
    playerId: "",
    inputName: "",
    members: [],
    host: "",
    ready: false,
    allReady: false,
    gameStarted: false,
    showChoiceModal: false,
    choiceOptions: [],
    hasJoined: false
  },

  onLoad() {
    // 初始化监听
    this.initWebSocket();
  },

  initWebSocket() {
    const ws = app.globalData.ws
    if (!ws) return;

    ws.onMessage(res => {
      const data = JSON.parse(res.data)
      
      if (data.type === "room_info") {
        const allReady = data.members.length > 0 && data.members.every(m => m.ready)
        this.setData({ host: data.host, members: data.members, allReady })
      }
      
      if (data.type === "choose_words") {
        // 只有当用户真的在首页大厅时，才弹窗
        if (this.isActivePage()) {
            this.setData({ showChoiceModal: true, choiceOptions: data.options })
        }
      }
      
      if (data.type === "game_start") {
        // --- 核心修复 ---
        // 在跳转前，检查当前页面是否是 index 页面
        // 如果当前已经在 game 页面（或者别的页面），直接忽略这条消息，防止重复跳转
        if (!this.isActivePage()) {
            console.log('当前不在大厅，忽略跳转指令');
            return;
        }

        wx.navigateTo({ 
          url: `/pages/game/game?drawer=${data.drawer}&answer=${data.answer}&hint=${data.hint}`
        })
      }
    })
  },

  // 新增：判断当前页面是否是本页面（是否在最顶层）
  isActivePage() {
    const pages = getCurrentPages();
    if (pages.length === 0) return false;
    const currentPage = pages[pages.length - 1];
    // 检查当前页面路由是否包含 'index' (根据你的实际路径判断)
    return currentPage.route.includes('index');
  },

  onNameInput(e) {
    this.setData({ inputName: e.detail.value })
  },

  joinRoom() {
    let name = this.data.inputName.trim()
    if (!name) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    
    app.globalData.clientId = name
    app.safeSend({ type: "join_room", playerId: name, roomId: this.data.roomId })
    this.setData({ playerId: name, hasJoined: true })
  },

  toggleReady() {
    const ready = !this.data.ready
    this.setData({ ready })
    app.safeSend({ type: "set_ready", ready })
  },

  startGame() {
    app.safeSend({ type: "start_game" })
  },

  chooseWord(e) {
    const word = e.currentTarget.dataset.word
    this.setData({ showChoiceModal: false })
    app.safeSend({ type: "word_chosen", word: word })
    
    // 为了更好的体验，可以加个提示，但不需要关闭弹窗
    // 因为选完词后，服务器会立即下发 game_start，页面会跳转
    // 如果这时候关了弹窗，会看到一瞬间的大厅，体验不好
    // 所以让 game_start 带着页面跳转即可
  }
})
