import DefaultTheme from 'vitepress/theme'
import mediumZoom from 'medium-zoom'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import './custom.css'

// SPA 页面切换时上报 pageview 到服务端
function reportPV(path, ref) {
  try {
    const params = new URLSearchParams({ path, ref: ref || document.referrer || '' });
    fetch(`/__pv?${params.toString()}`, { keepalive: true });
  } catch (e) { /* 静默忽略 */ }
}

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()
    const initZoom = () => {
      mediumZoom('.vp-doc img:not(.no-zoom)', { background: 'var(--vp-c-bg)' })
    }
    onMounted(() => {
      nextTick(() => initZoom())
      // 首次加载上报
      reportPV(route.path, document.referrer)
    })
    watch(
      () => route.path,
      (to, from) => {
        nextTick(() => initZoom())
        // SPA 路由切换时上报
        if (to !== from) {
          reportPV(to, location.origin + from)
        }
      }
    )
  }
}
