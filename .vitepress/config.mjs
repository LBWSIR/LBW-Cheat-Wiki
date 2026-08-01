// .vitepress/config.mjs
import { defineConfig } from 'vitepress'

export default defineConfig({
  // 忽略构建时的额外文件（old flow 中的无扩展名图片等）
  vite: {
    server: {
      watch: {
        ignored: ['**/old flow/**', '**/node_modules/**']
      }
    },
    build: {
      rollupOptions: {}
    }
  },

  title: "LBW教程网",
  head: [
    // --- 1. 动态噪点水印与防选中 CSS ---
    ['style', {}, `
      /* 全站禁止文本选中 */
      html, body {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }

      /* 噪点遮罩：干扰 OCR 识别但保留图片清晰度 */
      .main img {
        position: relative;
        display: inline-block;
        -webkit-user-drag: none !important; /* 禁止拖拽图片 */
      }

      /* 利用背景图片实现噪点干扰 (Base64 格式免去文件路径烦恼) */
      .vp-doc img {
        background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAElBMVEUAAAD8/Pz09PT4+Pj29vb////66v9zAAAAAXRSTlMAQObYZgAAADlJREFUKM9jGAWDCYwaBWQDclGYDchFYTYgF4XZgFwUZgNyUZgNyEVhNiAXhdmAXBRmA3JRmA3IBQC6YAtj779S/wAAAABJRU5ErkJggg==');
        background-repeat: repeat;
        opacity: 0.95; /* 微调透明度 */
      }
    `],

    // --- 2. 禁用右键与 F12 脚本 ---
    ['script', {}, `
      document.oncontextmenu = function() { return false; }; // 禁用右键
      document.onkeydown = function(e) {
        // 禁用 F12 (123) 和 Ctrl+U (85)
        if (e.keyCode == 123 || (e.ctrlKey && e.keyCode == 85)) return false;
        // 禁用 Ctrl+Shift+I (73)
        if (e.ctrlKey && e.shiftKey && e.keyCode == 73) return false;
      };
    `]
  ],
  themeConfig: {
    logo: '/logo.png', // 左上角的小图片 /
    siteTitle: 'LBW教程网', // 网站左上角标题
    
    // --- 搜索栏配置 ---
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '无法找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },
// --- 侧边栏配置 ---
    sidebar: [
      {
        text: 'Wiki主页', 
        collapsed: false,
        items: [
          { 
            text: '售后规则 (点击查看)', 
            link: '/rules', 
            items: [
              { 
                text: 'CS2教程', 
                link: '/cs2', 
                items: [
                  { text: 'NIX 详细教程', link: '/cs2/nix' },
                  { text: 'iCheat 详细教程', link: '/cs2/free icheat' },
                  { text: 'Midnight 教程', link: '/cs2/midnight' },
                  { text: 'FAC/Expandera 教程',
                    collapsed: true,
                    link: '/cs2/expandera',
                    items: [
                      { text: 'Expandera 疑难杂症', link: '/cs2/expandera_troubleshoot' },
                      { text: 'Fatality 参数教程', link: '/cs2/expandera_fatality' }
                    ]
                  }
                ]
              },
              // --- 原神教程 ---
              {
                text: '原神教程',
                link: '/yuanshen',
                items: [
                  { text: 'Unicore', link: '/genshin/unicore' },
                  { text: 'Akebi',
                    collapsed: true,
                    link: '/genshin/akebi',
                    items: [
                      { text: 'Akebi 常见问题', link: '/genshin/akebi_faq' },
                      { text: 'Akebi 报错', link: '/genshin/akebi_errors' },
                      { text: 'Akebi 瞬移文件', link: '/genshin/akebi_teleport' }
                    ]
                  }
                ]
              },
              // --- VPN教程 ---
              {
                text: 'VPN教程',
                collapsed: true, // 关键：这一行就是实现折叠的开关！
                link: '/vpn',
                items: [
                  { text: 'PC', link: '/vpn/pc' },
                  { text: '安卓', link: '/vpn/android' },
                  { text: 'iOS', link: '/vpn/ios' }
                ]
              },
              // --- GTA5教程 ---
              {
                text: 'GTA5教程',
                collapsed: true,
                link: '/gta5',
                items: [
                  { text: 'BattlEye & 战眼详解', link: '/gta5/battleye' },
                  { text: 'GTAV 菜单通用设置', link: '/gta5/gamesetting' },
                  { text: 'GTAV 原号解封教程', link: '/gta5/unban' },
                  {
                    text: 'Lexis 词汇',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/lexis/use' },
                      { text: '解绑教程', link: '/gta5/lexis/hwid' },
                      { text: 'DLCS 加载教程', link: '/gta5/lexis/dlcs' },
                      { text: 'Lua 加载教程', link: '/gta5/lexis/lua' },
                      { text: 'ASI 加载教程', link: '/gta5/lexis/asi' },
                      { text: '刷钱教程', link: '/gta5/lexis/money' },
                      { text: '密码相关', link: '/gta5/lexis/password' },
                      { text: '错误解决', link: '/gta5/lexis/error' },
                      { text: '功能介绍', link: '/gta5/lexis/show' },
                      { text: '更新公告', link: '/gta5/lexis/update' }
                    ]
                  },
                  {
                    text: 'Stand',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/stand/use' },
                      { text: '解绑教程', link: '/gta5/stand/hwid' },
                      { text: '功能搜索教程', link: '/gta5/stand/search' },
                      { text: 'Lua 脚本安装', link: '/gta5/stand/lua' },
                      { text: 'ASI 插件安装', link: '/gta5/stand/asi' },
                      { text: 'DLCS 加载教程', link: '/gta5/stand/dlcs' },
                      { text: '刷钱教程', link: '/gta5/stand/money' },
                      { text: '手机教程', link: '/gta5/stand/phone' },
                      { text: '存档教程', link: '/gta5/stand/save' },
                      { text: '标签说明', link: '/gta5/stand/label' },
                      { text: '功能介绍', link: '/gta5/stand/show' },
                      { text: '更新公告', link: '/gta5/stand/update' }
                    ]
                  },
                  {
                    text: 'Cherax 樱桃',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/cherax/use' },
                      { text: '解绑教程', link: '/gta5/cherax/hwid' },
                      { text: '脚本教程', link: '/gta5/cherax/lua' },
                      { text: '功能介绍', link: '/gta5/cherax/show' },
                      { text: '更新公告', link: '/gta5/cherax/update' }
                    ]
                  },
                  {
                    text: 'Midnight 午夜',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/midnight/use' },
                      { text: '解绑教程', link: '/gta5/midnight/hwid' },
                      { text: '功能介绍', link: '/gta5/midnight/show' },
                      { text: '更新公告', link: '/gta5/midnight/update' }
                    ]
                  },
                  {
                    text: 'Yari 长矛',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/yari/use' },
                      { text: '解绑教程', link: '/gta5/yari/hwid' },
                      { text: '功能介绍', link: '/gta5/yari/show' },
                      { text: '更新公告', link: '/gta5/yari/update' }
                    ]
                  },
                  {
                    text: 'XiPro',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/xipro/use' },
                      { text: '解绑教程', link: '/gta5/xipro/hwid' },
                      { text: '注入问题', link: '/gta5/xipro/injectionfaq' },
                      { text: '功能介绍', link: '/gta5/xipro/show' },
                      { text: '更新公告', link: '/gta5/xipro/update' }
                    ]
                  },
                  {
                    text: 'XiRush',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/xirush/use' },
                      { text: '解绑教程', link: '/gta5/xirush/hwid' },
                      { text: '注入问题', link: '/gta5/xirush/injectionfaq' },
                      { text: '功能介绍', link: '/gta5/xirush/show' },
                      { text: '更新公告', link: '/gta5/xirush/update' }
                    ]
                  },
                  {
                    text: 'Frieza 弗利萨',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/frieza/use' },
                      { text: '解绑教程', link: '/gta5/frieza/hwid' },
                      { text: '功能介绍', link: '/gta5/frieza/show' },
                      { text: '更新公告', link: '/gta5/frieza/update' }
                    ]
                  },
                  {
                    text: 'Rain 及时雨',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/rain/use' },
                      { text: '解绑教程', link: '/gta5/rain/hwid' },
                      { text: '功能介绍', link: '/gta5/rain/show' },
                      { text: '更新公告', link: '/gta5/rain/update' }
                    ]
                  },
                  {
                    text: 'Atlas 阿特拉斯',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/atlas/use' },
                      { text: '解绑教程', link: '/gta5/atlas/hwid' },
                      { text: '功能介绍', link: '/gta5/atlas/show' },
                      { text: '更新公告', link: '/gta5/atlas/update' }
                    ]
                  },
                  {
                    text: '0xCheats',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/0xcheats/use' },
                      { text: '解绑教程', link: '/gta5/0xcheats/hwid' },
                      { text: '功能介绍', link: '/gta5/0xcheats/show' },
                      { text: '更新公告', link: '/gta5/0xcheats/update' }
                    ]
                  },
                  {
                    text: 'Ethereal 空灵',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/ethereal/use' },
                      { text: '解绑教程', link: '/gta5/ethereal/hwid' },
                      { text: '功能介绍', link: '/gta5/ethereal/show' },
                      { text: '更新公告', link: '/gta5/ethereal/update' }
                    ]
                  },
                  {
                    text: 'Goddess',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/goddess/use' },
                      { text: '解绑教程', link: '/gta5/goddess/hwid' },
                      { text: '功能介绍', link: '/gta5/goddess/show' },
                      { text: '更新公告', link: '/gta5/goddess/update' }
                    ]
                  },
                  {
                    text: 'Alpha',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/alpha/use' },
                      { text: '解绑教程', link: '/gta5/alpha/hwid' },
                      { text: '功能介绍', link: '/gta5/alpha/show' },
                      { text: '更新公告', link: '/gta5/alpha/update' }
                    ]
                  },
                  {
                    text: 'BaiZe 白泽',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/baize/use' },
                      { text: '解绑教程', link: '/gta5/baize/hwid' },
                      { text: '功能介绍', link: '/gta5/baize/show' }
                    ]
                  },
                  {
                    text: 'BH',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/bh/use' },
                      { text: '解绑教程', link: '/gta5/bh/hwid' },
                      { text: '功能介绍', link: '/gta5/bh/show' },
                      { text: '更新公告', link: '/gta5/bh/update' }
                    ]
                  },
                  {
                    text: 'Drill',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/drill/use' },
                      { text: '解绑教程', link: '/gta5/drill/hwid' },
                      { text: '功能介绍', link: '/gta5/drill/show' },
                      { text: '更新公告', link: '/gta5/drill/update' }
                    ]
                  },
                  {
                    text: 'Erebus',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/erebus/use' },
                      { text: '解绑教程', link: '/gta5/erebus/hwid' },
                      { text: '功能介绍', link: '/gta5/erebus/show' },
                      { text: '更新公告', link: '/gta5/erebus/update' }
                    ]
                  },
                  {
                    text: 'Faramita 彼岸',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/faramita/use' },
                      { text: '解绑教程', link: '/gta5/faramita/hwid' },
                      { text: '功能介绍', link: '/gta5/faramita/show' },
                      { text: '更新公告', link: '/gta5/faramita/update' }
                    ]
                  },
                  {
                    text: 'Hybird-X',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/hybird-x/use' },
                      { text: '解绑教程', link: '/gta5/hybird-x/hwid' },
                      { text: '功能介绍', link: '/gta5/hybird-x/show' },
                      { text: '更新公告', link: '/gta5/hybird-x/update' }
                    ]
                  },
                  {
                    text: 'INFamous',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/infamous/use' },
                      { text: '解绑教程', link: '/gta5/infamous/hwid' },
                      { text: '功能介绍', link: '/gta5/infamous/show' },
                      { text: '更新公告', link: '/gta5/infamous/update' }
                    ]
                  },
                  {
                    text: 'MdayS',
                    collapsed: true,
                    items: [
                      { text: '使用教程', link: '/gta5/mdays/use' },
                      { text: '解绑教程', link: '/gta5/mdays/hwid' },
                      { text: '功能介绍', link: '/gta5/mdays/show' },
                      { text: '更新公告', link: '/gta5/mdays/update' }
                    ]
                  }
                ]
              },
              // --- 崩坏：星穹铁道 ---
              {
                text: '崩坏：星穹铁道',
                link: '/starrail',
                items: [
                  { text: 'Niluli 教程',
                    collapsed: true,
                    link: '/starrail/niluli',
                    items: [
                      { text: 'Niluli 启动教程', link: '/starrail/niluli_start' },
                      { text: 'Niluli 功能图', link: '/starrail/niluli_features' },
                      { text: 'Niluli 常见问题', link: '/starrail/niluli_faq' }
                    ]
                  }
                ]
              },
              // --- 鸣朝教程 ---
              {
                text: '鸣朝教程',
                link: '/mingchao',
                items: [
                  { text: 'Meow 教程',
                    collapsed: true,
                    link: '/mingchao/meow',
                    items: [
                      { text: 'Meow 传送教程', link: '/mingchao/meow_teleport' },
                      { text: 'Meow 功能图', link: '/mingchao/meow_features' },
                      { text: 'Meow 常见问题', link: '/mingchao/meow_faq' }
                    ]
                  }
                ]
              },
              // --- TBH 教程 ---
              {
                text: 'TBH 教程',
                collapsed: true,
                link: '/tbh',
                items: [
                  { text: '观星教程', link: '/tbh/guansing' },
                  { text: '祈祷术教程', link: '/tbh/qidaoshu' },
                  { text: '存档编辑器教程', link: '/tbh/cundang_editor' },
                  { text: '挂机助手教程', link: '/tbh/guaji_assist' },
                  { text: '多开教程', link: '/tbh/duokai' }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
)
