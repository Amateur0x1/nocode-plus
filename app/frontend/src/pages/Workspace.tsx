import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft,
  Code2,
  Download,
  Eye,
  Loader2,
  Monitor,
  Rocket,
  Send,
  Smartphone,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AI_MODEL,
  SYSTEM_PROMPT,
  client,
  extractHtmlCode,
  getErrorDetail,
  stripCodeBlocks,
  type AppVersion,
  type ChatMsg,
  type VibeProject,
} from '@/lib/vibe';

type ViewMode = 'preview' | 'code';
type DeviceMode = 'desktop' | 'mobile';

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<VibeProject | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const user = await client.auth.me();
        if (!user?.data) {
          client.auth.toLogin();
          return;
        }
        const projRes = await client.entities.vibe_projects.get({ id: id! });
        setProject(projRes.data as VibeProject);
        const [msgRes, verRes] = await Promise.all([
          client.entities.chat_messages.query({
            query: { project_id: projectId },
            sort: 'created_at',
            limit: 200,
          }),
          client.entities.app_versions.query({
            query: { project_id: projectId },
            sort: 'version_number',
            limit: 200,
          }),
        ]);
        const msgs = (msgRes.data?.items ?? []) as ChatMsg[];
        const vers = (verRes.data?.items ?? []) as AppVersion[];
        setMessages(msgs);
        setVersions(vers);
        setSelectedVersionId(vers.length ? vers[vers.length - 1].id : null);
      } catch (e) {
        toast.error('项目加载失败', { description: getErrorDetail(e) });
      } finally {
        setLoading(false);
      }
    };
    if (Number.isFinite(projectId)) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  const currentHtml =
    versions.find((v) => v.id === selectedVersionId)?.html_code ??
    (versions.length ? versions[versions.length - 1].html_code : '');

  const buildAiMessages = useCallback(
    (userText: string, history: ChatMsg[]) => {
      const convo = history
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }))
        .filter((m) => m.content.length < 4000);
      const context: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: SYSTEM_PROMPT },
      ];
      if (currentHtml) {
        context.push({
          role: 'user',
          content: `这是当前应用的完整 HTML 代码:\n\n${currentHtml.slice(0, 60000)}`,
        });
        context.push({
          role: 'assistant',
          content: '已了解当前代码,请告诉我需要的修改。',
        });
      }
      context.push(...convo);
      context.push({ role: 'user', content: userText });
      return context;
    },
    [currentHtml]
  );

  const persistFailure = async (userText: string, replyText: string) => {
    await client.entities.chat_messages.create({
      data: { project_id: projectId, role: 'user', content: userText },
    });
    await client.entities.chat_messages.create({
      data: { project_id: projectId, role: 'assistant', content: replyText },
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || generating) return;
    setError('');
    setInput('');
    setGenerating(true);
    setStreamText('');

    const userMsg: ChatMsg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);

    let streamed = '';
    try {
      await client.ai.gentxt({
        messages: buildAiMessages(text, messages),
        model: AI_MODEL,
        stream: true,
        onChunk: (chunk) => {
          streamed += chunk.content;
          setStreamText(streamed);
        },
        onError: (e) => {
          throw new Error((e as { message?: string })?.message || '生成失败');
        },
      });

      const html = extractHtmlCode(streamed);
      if (html) {
        const nextNumber = versions.length + 1;
        const verRes = await client.entities.app_versions.create({
          data: {
            project_id: projectId,
            version_number: nextNumber,
            html_code: html,
            prompt: text,
          },
        });
        const newVersion = verRes.data as AppVersion;
        setVersions((prev) => [...prev, newVersion]);
        setSelectedVersionId(newVersion.id);
        setViewMode('preview');
        if (versions.length === 0) {
          await client.entities.vibe_projects.update({
            id: projectId,
            data: { name: text.replace(/\s+/g, ' ').slice(0, 24) },
          });
        }
      }
      const replyMsg: ChatMsg = { role: 'assistant', content: stripCodeBlocks(streamed) };
      setMessages((prev) => [...prev, replyMsg]);
      await persistFailure(text, replyMsg.content);
    } catch (e) {
      const detail = getErrorDetail(e);
      setError(detail);
      if (streamed) {
        setMessages((prev) => [...prev, { role: 'assistant', content: stripCodeBlocks(streamed) }]);
      }
    } finally {
      setStreamText('');
      setGenerating(false);
    }
  };

  const handleExport = () => {
    if (!currentHtml) return;
    const blob = new Blob([currentHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'vibe-app'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('HTML 文件已导出');
  };

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const isLatest = selectedVersionId === versions[versions.length - 1]?.id;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 font-['Space_Grotesk'] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin text-lime-400" /> 正在打开工作台…
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 font-['Space_Grotesk'] flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/')}
            aria-label="返回项目列表"
            className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-zinc-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{project?.name}</p>
            <p className="text-[11px] text-zinc-600 font-['IBM_Plex_Mono'] truncate">
              v{versions.length || 0} · {project?.description?.slice(0, 40)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-zinc-800 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 hover:text-zinc-50"
            onClick={handleExport}
            disabled={!currentHtml}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" /> 导出
          </Button>
          <Button
            size="sm"
            className="bg-lime-400 hover:bg-lime-300 text-zinc-950 font-medium"
            onClick={() =>
              toast.info('发布功能即将上线', {
                description: '当前版本支持导出 HTML 文件,一键发布正在建设中。',
              })
            }
          >
            <Rocket className="w-3.5 h-3.5 mr-1.5" /> 发布
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
        {/* Chat panel */}
        <aside className="lg:w-[340px] border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col shrink-0 h-[45%] lg:h-auto">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500 leading-relaxed">
                描述你想做的应用,AI 会生成第一版;之后继续对话即可不断迭代。
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? `local-${i}`} className="animate-in fade-in duration-150">
                {m.role === 'user' ? (
                  <div className="ml-6 rounded-xl rounded-tr-sm bg-lime-950 border border-lime-900/60 px-3.5 py-2.5 text-[13px] text-lime-100 leading-relaxed">
                    {m.content}
                  </div>
                ) : (
                  <div className="mr-6 rounded-xl rounded-tl-sm bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-[13px] text-zinc-200 leading-relaxed">
                    {m.content}
                  </div>
                )}
              </div>
            ))}
            {generating && (
              <div className="mr-6 rounded-xl rounded-tl-sm bg-zinc-900 border border-zinc-800 px-3.5 py-2.5 text-[13px] text-zinc-400 leading-relaxed">
                {streamText ? (
                  <span className="whitespace-pre-wrap">{stripCodeBlocks(streamText)}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                    正在生成…
                  </span>
                )}
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
          {error && (
            <div className="mx-4 mb-2 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300 flex items-center justify-between gap-2">
              <span className="truncate">{error}</span>
              <button
                onClick={() => {
                  setError('');
                  setInput(messages[messages.length - 1]?.role === 'user' ? messages[messages.length - 1].content : '');
                }}
                className="text-red-200 underline shrink-0"
              >
                重试
              </button>
            </div>
          )}
          <div className="p-3 border-t border-zinc-800">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="继续描述你的想法或修改…"
              className="min-h-[64px] bg-zinc-900 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-lime-400/40 resize-none text-sm"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-zinc-600 font-['IBM_Plex_Mono']">Shift+Enter 换行</p>
              <Button
                size="sm"
                disabled={generating || !input.trim()}
                onClick={handleSend}
                className="bg-lime-400 hover:bg-lime-300 text-zinc-950 font-medium"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </aside>

        {/* Preview panel */}
        <main className="flex-1 flex flex-col min-h-0">
          <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-3 shrink-0 gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setViewMode('preview')}
                aria-label="预览视图"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  viewMode === 'preview' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> 预览
              </button>
              <button
                onClick={() => setViewMode('code')}
                aria-label="代码视图"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                  viewMode === 'code' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" /> 代码
              </button>
            </div>
            <div className="flex items-center gap-2">
              {versions.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
                  <History className="w-3.5 h-3.5 text-zinc-500" />
                  <select
                    aria-label="切换版本"
                    value={selectedVersionId ?? ''}
                    onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                    className="bg-transparent text-[12px] font-['IBM_Plex_Mono'] text-zinc-300 outline-none cursor-pointer [&>option]:bg-zinc-900"
                  >
                    {[...versions].reverse().map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version_number}
                      </option>
                    ))}
                  </select>
                  {!isLatest && (
                    <button
                      onClick={() => setSelectedVersionId(versions[versions.length - 1].id)}
                      className="text-[11px] text-lime-400 hover:underline"
                    >
                      回到最新
                    </button>
                  )}
                </div>
              )}
              <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => setDeviceMode('desktop')}
                  aria-label="桌面视图"
                  className={`p-2 transition-colors ${
                    deviceMode === 'desktop' ? 'bg-zinc-800 text-zinc-50' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeviceMode('mobile')}
                  aria-label="移动视图"
                  className={`p-2 transition-colors ${
                    deviceMode === 'mobile' ? 'bg-zinc-800 text-zinc-50' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-zinc-900/50 flex items-center justify-center overflow-auto p-3">
            {!currentHtml ? (
              <div className="text-center max-w-sm">
                <div className="mx-auto w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                  <span className="font-['IBM_Plex_Mono'] text-lime-400 text-sm">&lt;/&gt;</span>
                </div>
                <p className="text-sm text-zinc-400">还没有生成任何应用</p>
                <p className="mt-1.5 text-[13px] text-zinc-600 leading-relaxed">
                  在左侧描述你的想法,AI 将生成第一版应用并在这里实时预览。
                </p>
              </div>
            ) : viewMode === 'preview' ? (
              <iframe
                title="应用预览"
                srcDoc={currentHtml}
                sandbox="allow-scripts"
                className={`h-full bg-white rounded-lg border border-zinc-800 transition-all ${
                  deviceMode === 'mobile' ? 'w-[390px] max-w-full' : 'w-full'
                }`}
              />
            ) : (
              <pre className="w-full h-full m-0 p-4 overflow-auto rounded-lg bg-zinc-950 border border-zinc-800 text-[12px] leading-relaxed font-['IBM_Plex_Mono'] text-zinc-300">
                <code>{currentHtml}</code>
              </pre>
            )}
          </div>
          {selectedVersion && (
            <div className="h-8 border-t border-zinc-800 px-3 flex items-center shrink-0">
              <p className="text-[11px] text-zinc-600 font-['IBM_Plex_Mono'] truncate">
                v{selectedVersion.version_number} ← {selectedVersion.prompt.slice(0, 60)}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
