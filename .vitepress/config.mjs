// .vitepress/config.mjs
export default {
  title: "LBW教程网", // 浏览器标签页标题
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
    
    // --- 融合后的搜索栏配置开始 ---
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
// --- 侧边栏配置：实现 CS2 归属于 售后规则 ---
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
                  { text: 'NIX 详细教程', link: '/cs2/nix' } ,// 在 CS2 分页内部
                  { text: 'icheat 详细教程', link: '/cs2/free icheat' } // 在 CS2 分页内部
                ]
              },
              // --- 分支二：元神教程 ---
              {
                text: '原神教程',
                link: '/yuanshen' ,
                items: [
                  { text: '原神Unicore', link: '/genshin/unicore' }, // 这里的路径根据你实际文件夹修改
                  { text: '原神Akebi', link: '/genshin/akebi' }
                ]
                               
              },
              // --- 分支三：VPN教程 ---
              {
                text: 'VPN教程',
                link: '/vpn' ,
                items: [
                  { text: 'PC', link: '/vpn/pc' }, // 这里的路径根据你实际文件夹修改
                  { text: '安卓', link: '/vpn/android' },
                  { }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}