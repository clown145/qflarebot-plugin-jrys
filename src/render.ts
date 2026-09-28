import type { PluginContext } from '@qqbot/sdk'

/**
 * 内置 t2i 插件导出的服务里用到的方法（类型从它的源码抄来，插件之间不互相 import）。
 * renderUrl 是后加的，老版本的 t2i 只有 renderBase64
 */
interface T2IService {
  renderUrl?(html: string, options?: RenderOptions): Promise<{ url: string }>
  renderBase64?(html: string, options?: RenderOptions): Promise<{ base64: string }>
}

interface RenderOptions {
  width?: number
  height?: number
  type?: 'jpeg' | 'png'
  quality?: number
  fullPage?: boolean
}

const POSTER: RenderOptions = { width: 1080, height: 1920, type: 'jpeg', quality: 85, fullPage: true }

/**
 * 海报 HTML → 图片消息。渲染交给内置 t2i 插件：服务地址、超时只在 t2i 那里填一次。
 *
 * 优先 renderUrl：图存在 T2I 服务上、QQ 直接去拉，图片字节不经过 Worker。以前这里自己下载整张 1080×1920 的 JPEG
 * 再转 base64，吃的是免费版每次请求那 10 ms CPU。t2i 没装、停用或渲染失败都抛错，调用方按「渲染异常」降级
 */
export async function renderPoster(ctx: PluginContext<unknown>, html: string): Promise<{ url: string } | { base64: string }> {
  const t2i = ctx.service<T2IService>('t2i')
  if (typeof t2i.renderUrl === 'function') return { url: (await t2i.renderUrl(html, POSTER)).url }
  if (typeof t2i.renderBase64 === 'function') return { base64: (await t2i.renderBase64(html, POSTER)).base64 }
  throw new Error('t2i 插件没有提供渲染方法')
}
