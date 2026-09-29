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

export const AI_MODEL = 'claude-opus-5';

export const SYSTEM_PROMPT = `你是 VibeCoding Studio 的应用生成引擎。用户会用自然语言描述想要的应用,或对现有应用提出修改。
你的任务是输出一个完整的单文件 Web 应用:
1. 输出一个自包含的 HTML 文件,包含全部 HTML、内联 <style> 样式和内联 <script> 脚本,可直接在浏览器中运行。
2. 始终在 \`\`\`html 代码块中输出完整的 HTML 文件,不要输出片段、差异或省略。
3. 在代码块之前,用 1-2 句简短的中文说明你创建或修改了什么。
4. 界面文字使用中文,设计要现代、美观、有真实可用的交互功能,不要使用占位内容。
5. 不要引用外部本地文件;图标可使用 emoji 或内联 SVG;如需字体或库可引用公共 CDN。`;

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
