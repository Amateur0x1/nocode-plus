import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, LogIn, Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { client, getErrorDetail, type VibeProject } from '@/lib/vibe';

const IDEAS = [
  '一个番茄钟专注计时器,带统计面板',
  '个人记账本,支持分类和月度汇总',
  '团队投票小工具,实时显示结果条形图',
  '单词记忆卡片,支持翻转和进度记录',
];

export default function Index() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<'loading' | 'authed' | 'anonymous'>('loading');
  const [projects, setProjects] = useState<VibeProject[]>([]);
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    client.auth
      .me()
      .then(async (res) => {
        if (res?.data) {
          setAuthState('authed');
          await loadProjects();
        } else {
          setAuthState('anonymous');
        }
      })
      .catch(() => setAuthState('anonymous'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProjects = async () => {
    try {
      const res = await client.entities.vibe_projects.query({
        query: {},
        sort: '-updated_at',
        limit: 50,
      });
      setProjects((res.data?.items ?? []) as VibeProject[]);
    } catch (e) {
      toast.error('项目列表加载失败', { description: getErrorDetail(e) });
    }
  };

  const requireLogin = () => {
    if (authState === 'authed') return true;
    client.auth.toLogin();
    return false;
  };

  const handleCreate = async (desc?: string) => {
    const text = (desc ?? description).trim();
    if (!text) {
      toast.error('先描述一下你想做的应用吧');
      return;
    }
    if (!requireLogin()) return;
    setCreating(true);
    try {
      const name = text.replace(/\s+/g, ' ').slice(0, 24) || '未命名应用';
      const res = await client.entities.vibe_projects.create({
        data: { name, description: text },
      });
      navigate(`/project/${res.data.id}`);
    } catch (e) {
      toast.error('创建项目失败', { description: getErrorDetail(e) });
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await client.entities.vibe_projects.delete({ id });
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success('项目已删除');
    } catch (e) {
      toast.error('删除失败', { description: getErrorDetail(e) });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-['Space_Grotesk']">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-lime-400 flex items-center justify-center">
              <span className="font-['IBM_Plex_Mono'] font-medium text-zinc-950 text-sm">&lt;/&gt;</span>
            </div>
            <span className="font-semibold text-[15px]">VibeCoding Studio</span>
          </div>
          {authState === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
          {authState === 'anonymous' && (
            <Button
              size="sm"
              className="bg-lime-400 hover:bg-lime-300 text-zinc-950 font-medium"
              onClick={() => client.auth.toLogin()}
            >
              <LogIn className="w-4 h-4 mr-1.5" /> 登录
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14 grid lg:grid-cols-[1fr_340px] gap-10">
        {/* Hero + create */}
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400 font-['IBM_Plex_Mono']">
            <Sparkles className="w-3.5 h-3.5 text-lime-400" />
            自然语言 → 可运行应用
          </div>
          <h1 className="mt-5 text-4xl md:text-[44px] font-bold leading-[1.15] tracking-tight">
            用一句话,
            <br />
            生成你的<span className="text-lime-400">应用</span>。
          </h1>
          <p className="mt-4 text-[15px] text-zinc-400 leading-relaxed max-w-xl">
            描述你的想法,AI 立即生成一个可交互预览的完整应用。继续对话,不断迭代,直到满意为止。
          </p>

          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如:做一个倒计时目标管理工具,首页展示目标卡片,可以添加、完成和删除目标…"
              className="min-h-[96px] bg-zinc-950 border-zinc-800 text-zinc-50 placeholder:text-zinc-600 focus-visible:ring-lime-400/40 resize-none text-sm"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-600 font-['IBM_Plex_Mono']">Enter 生成 · DeepSeek Flash 驱动</p>
              <Button
                disabled={creating}
                onClick={() => handleCreate()}
                className="bg-lime-400 hover:bg-lime-300 text-zinc-950 font-medium"
              >
                {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                {creating ? '创建中…' : '开始生成'}
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs text-zinc-500 mb-3">没有灵感?试试这些:</p>
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  onClick={() => handleCreate(idea)}
                  disabled={creating}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[13px] text-zinc-300 hover:border-lime-400/50 hover:text-zinc-50 transition-colors disabled:opacity-50"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Recent projects */}
        <aside>
          <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
            我的项目
            <span className="text-zinc-600 font-['IBM_Plex_Mono'] text-xs ml-auto">{projects.length}</span>
          </h2>
          {authState === 'loading' && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中…
            </div>
          )}
          {authState === 'anonymous' && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400 leading-relaxed">
              登录后即可创建项目,你的对话历史和生成的代码版本都会自动保存。
            </div>
          )}
          {authState === 'authed' && projects.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500 leading-relaxed">
              还没有项目。在左侧描述你的第一个想法,开始 Vibe 吧。
            </div>
          )}
          <div className="space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group rounded-xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors"
              >
                <button
                  onClick={() => navigate(`/project/${p.id}`)}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-100 truncate">{p.name}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-lime-400 shrink-0" />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{p.description}</p>
                </button>
                <div className="px-4 pb-2.5 flex justify-end">
                  <button
                    aria-label={`删除项目 ${p.name}`}
                    onClick={() => handleDelete(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}
