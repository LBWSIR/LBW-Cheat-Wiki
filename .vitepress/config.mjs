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
        pointer-events: none !important;    /* 禁止右键点击保存图片 */
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
                  {
                    text: 'FAC/Expander 教程',
                    link: '/cs2/expandera',
                    collapsed: true,
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
                  {
                    text: 'Akebi',
                    link: '/genshin/akebi',
                    collapsed: true, // 关键：这一行就是实现折叠的开关！
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
                link: '/gta5/install',
                items: [
                  { text: 'Alpha 使用教程', link: '/gta5/alpha' }
                ]
              },
              // --- 崩坏：星穹铁道 ---
              {
                text: '崩坏：星穹铁道',
                link: '/starrail',
                items: [
                  {
                    text: 'Niluli 教程',
                    link: '/starrail/niluli',
                    collapsed: true,
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
                  {
                    text: 'Meow 教程',
                    link: '/mingchao/meow',
                    collapsed: true,
                    items: [
                      { text: 'Meow 传送教程', link: '/mingchao/meow_teleport' },
                      { text: 'Meow 功能图', link: '/mingchao/meow_features' },
                      { text: 'Meow 常见问题', link: '/mingchao/meow_faq' }
                    ]
                  }
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
