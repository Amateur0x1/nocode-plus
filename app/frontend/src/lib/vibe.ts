import { createClient } from '@metagptx/web-sdk';

export const client = createClient();

export interface VibeProject {
  id: number;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMsg {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
}

export interface AppVersion {
  id: number;
  version_number: number;
  html_code: string;
  prompt: string;
}

export const AI_MODEL_LABEL = 'DeepSeek Flash';

export const SYSTEM_PROMPT = `你是 VibeCoding Studio 的应用生成引擎。用户会用自然语言描述想要的应用,或对现有应用提出修改。

【运行环境 —— 非常重要】
你生成的 HTML 会通过 <iframe srcdoc="..."> 直接嵌入到工作台的预览区运行,用户会在这个 iframe 里直接点击、输入、操作你的应用。因此:
1. 必须输出一个完整、自包含的单文件 HTML(<!DOCTYPE html><html><head>…</head><body>…</body></html>),所有样式写在 <style>,所有逻辑写在 <script>(放在 </body> 前或使用 DOMContentLoaded)。
2. 不得依赖任何本地/相对路径文件(如 ./app.js、/images/x.png、其他 .html 页面);iframe 中不存在这些文件。
3. 多页面效果用单页内视图切换实现(JS 显示/隐藏区块或 hash 路由),禁止 <a href="other.html"> 跳转和整页刷新式表单提交;<form> 的提交必须 e.preventDefault() 并用 JS 处理。
4. 可以通过 https 公共 CDN 引入库或字体(如 Tailwind CDN、Chart.js、Google Fonts);图标优先用 emoji 或内联 SVG,图片用 https 公网链接或 CSS/SVG 绘制。
5. 数据持久化使用 localStorage,并用 try/catch 包裹,失败时退化为内存存储,保证应用照常运行。
6. 布局自适应 iframe 尺寸:html,body 设 margin:0 和 min-height:100%,同时兼容桌面宽度和约 390px 的手机宽度。

【交互质量】
- 必须是真正可用的交互应用:所有按钮、输入框、列表、弹层都要有实际功能和状态变化,不要占位按钮或静态截图式页面。
- 首屏就要预置少量合理示例数据,让用户打开即可操作。
- 界面文字使用中文,视觉现代、美观、有明确的配色与层级,包含 hover/active 等交互反馈。

【修改已有应用时】
在提供的当前代码基础上修改,保留原有功能,除非用户要求删除;每次都输出修改后的完整文件,不要只输出片段或差异。

【输出格式】
先用 1-2 句中文简述你创建或修改了什么,然后在一个 \`\`\`html 代码块中输出完整 HTML,代码块之后不要再输出其他内容。`;

/** 从 AI 输出中提取完整的 HTML 代码,失败返回 null */
export function extractHtmlCode(text: string): string | null {
  const fenceMatch = text.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  const candidates = [fenceMatch?.[1] ?? '', text];
  for (const candidate of candidates) {
    const match = candidate.match(/<html[\s\S]*<\/html>/i);
    if (match) return match[0];
  }
  return null;
}

/** 去掉代码块,只保留说明文字用于气泡展示 */
export function stripCodeBlocks(text: string): string {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<html[\s\S]*<\/html>/i, '')
    .trim();
  return cleaned || '已完成本次更新 ✓';
}

export function getErrorDetail(e: unknown): string {
  const err = e as { data?: { detail?: string }; response?: { data?: { detail?: string } }; message?: string };
  return err?.data?.detail || err?.response?.data?.detail || err?.message || '请求失败,请重试';
}
