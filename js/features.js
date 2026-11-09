// ===== 五大分析功能（Features） =====
// 全部基于本地规则实现，可直接离线运行：
//  1. diagnosis  文章基础诊断 —— 词数 / 句数 / 平均句长 / 词汇丰富度 / 估时 / 难度
//  2. keywords   核心词汇筛选 —— 去停用词后的高频词 + 本地词典释义
//  3. sentences  长难句识别   —— 按句长与从句标志词识别并标注从句引导词
//  4. structure  文章结构分析 —— 分段提取要点、识别转折/因果等逻辑信号词
//  5. teaching   教学资源生成 —— 结合年级/类型/主题/教学目标生成教学建议
(function () {

    // ---------- 文本工具 ----------
    const STOPWORDS = new Set(('a,an,the,and,or,but,if,because,although,though,while,when,where,however,therefore,so,since,unless,until,before,after,about,above,below,under,over,between,among,through,across,into,onto,with,without,within,for,of,to,from,at,in,on,by,against,toward,during,is,are,was,were,be,been,being,am,' +
        'i,me,my,we,us,our,you,your,he,him,his,she,her,it,its,they,them,their,this,that,these,those,' +
        'not,no,nor,do,does,did,have,has,had,will,would,can,could,should,may,might,must,shall,' +
        'than,then,there,here,also,more,most,some,any,all,each,every,both,few,many,much,other,another,such,only,own,same,too,very,just,' +
        'what,which,who,whom,whose,how,why,as,up,down,out,off,again,further,once,now,ever,never,s,t,don,didn,isn,aren,wasn,weren,won,couldn,shouldn,mustn').split(','));

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function tokenize(text) {
        return (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)) || [];
    }

    function splitSentences(text) {
        return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) || [text]).map(s => s.trim()).filter(s => s.length > 0);
    }

    function splitParagraphs(text) {
        return text.split(/\n\s*\n|\r\n\s*\r\n/).map(p => p.trim()).filter(p => p);
    }

    // 从句引导词（用于长难句标注）
    const CLAUSE_MARKERS = ['which', 'that', 'who', 'whom', 'whose', 'because', 'although', 'though', 'while', 'when', 'if', 'unless', 'since', 'after', 'before', 'as', 'so that', 'in order that', 'what', 'where'];
    // 逻辑信号词（用于结构分析）
    const LOGIC_MARKERS = {
        '转折': ['however', 'but', 'yet', 'nevertheless', 'on the contrary', 'in contrast'],
        '因果': ['because', 'therefore', 'thus', 'as a result', 'consequently', 'so', 'due to', 'owing to'],
        '递进': ['moreover', 'furthermore', 'in addition', 'besides', 'also', 'what is more'],
        '举例': ['for example', 'for instance', 'such as', 'take ... as an example'],
        '总结': ['in conclusion', 'to sum up', 'in short', 'in brief', 'overall', 'in a word'],
        '顺序': ['first', 'firstly', 'second', 'secondly', 'finally', 'lastly', 'then', 'next']
    };

    // ---------- 功能定义 ----------
    const FEATURES = [
        { id: 'diagnosis', name: '文章基础诊断', icon: '📊', desc: '词数、句长、难度等基础指标' },
        { id: 'keywords', name: '核心词汇筛选', icon: '🔑', desc: '提取高频核心词汇与释义' },
        { id: 'sentences', name: '长难句识别', icon: '🧩', desc: '定位并解析长难句与从句' },
        { id: 'structure', name: '文章结构分析', icon: '🏛️', desc: '分段要点与逻辑结构梳理' },
        { id: 'teaching', name: '教学资源生成', icon: '📚', desc: '生成教学建议与课堂问题' }
    ];

    // ---------- 1. 文章基础诊断 ----------
    function runDiagnosis(ctx) {
        const text = ctx.text;
        const words = tokenize(text);
        const sentences = splitSentences(text);
        const paragraphs = splitParagraphs(text);
        const wordCount = words.length;
        const unique = new Set(words).size;
        const avgLen = sentences.length ? (wordCount / sentences.length) : 0;
        const longSentences = sentences.filter(s => tokenize(s).length >= 20).length;
        const stopwordRatio = wordCount ? (words.filter(w => STOPWORDS.has(w)).length / wordCount * 100) : 0;
        const minutes = Math.max(1, Math.round(wordCount / 200 * 10) / 10);
        // 粗略难度评估：平均句长 + 长句占比 + 词汇丰富度
        const longRatio = sentences.length ? longSentences / sentences.length : 0;
        let level = '基础';
        if (avgLen > 22 || longRatio > 0.4) level = '较高';
        else if (avgLen > 15 || longRatio > 0.2 || unique / Math.max(1, wordCount) > 0.6) level = '中等';

        return `
        <div class="metric-grid">
            <div class="metric"><div class="metric-num">${wordCount}</div><div class="metric-label">总词数</div></div>
            <div class="metric"><div class="metric-num">${sentences.length}</div><div class="metric-label">句子数</div></div>
            <div class="metric"><div class="metric-num">${paragraphs.length}</div><div class="metric-label">段落数</div></div>
            <div class="metric"><div class="metric-num">${Math.round(avgLen * 10) / 10}</div><div class="metric-label">平均句长（词）</div></div>
            <div class="metric"><div class="metric-num">${unique}</div><div class="metric-label">不同单词数</div></div>
            <div class="metric"><div class="metric-num">${Math.round(unique / Math.max(1, wordCount) * 100)}%</div><div class="metric-label">词汇丰富度</div></div>
            <div class="metric"><div class="metric-num">${longSentences}</div><div class="metric-label">长句数（≥20词）</div></div>
            <div class="metric"><div class="metric-num">${Math.round(stopwordRatio)}%</div><div class="metric-label">功能词占比</div></div>
            <div class="metric"><div class="metric-num">${minutes}</div><div class="metric-label">预计阅读时长（分钟）</div></div>
            <div class="metric"><div class="metric-num">${level}</div><div class="metric-label">综合难度评估</div></div>
        </div>
        <div class="result-block">
            <h4>诊断建议</h4>
            <p>${level === '基础' ? '文章整体难度较低，适合用于基础词汇巩固和快速阅读训练，可重点训练略读（skimming）抓主旨。' :
                level === '中等' ? '文章难度中等，适合训练精读与猜词策略，建议配合核心词汇表与长难句拆解使用。' :
                '文章难度较高，句子偏长、从句较多，建议先做长难句分析，再进行段落大意归纳，降低阅读负荷。'}</p>
            <p>已选择年级「${esc(ctx.grade)}」、类型「${esc(ctx.type)}」${ctx.theme ? '、主题「' + esc(ctx.theme) + '」' : ''}；${longSentences > 0 ? '建议结合「长难句识别」功能重点讲解 ' + longSentences + ' 个长句。' : '本文长句不多，可侧重词汇与篇章结构教学。'}</p>
        </div>`;
    }

    // ---------- 2. 核心词汇筛选 ----------
    function runKeywords(ctx) {
        const words = tokenize(ctx.text);
        const freq = new Map();
        words.forEach(w => { if (!STOPWORDS.has(w) && w.length >= 2) freq.set(w, (freq.get(w) || 0) + 1); });
        const list = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
        const dict = window.READLAB_DICT || {};
        if (!list.length) return '<p class="empty-state">未提取到有效词汇，请检查文章内容。</p>';
        const rows = list.map(([w, c]) => {
            const t = dict[w] || dict[w.replace(/'s$/, '')] || '';
            return `<tr><td><b>${esc(w)}</b></td><td>${c}</td><td>${t ? esc(t) : '<span class="text-muted">—（未收录）</span>'}</td></tr>`;
        }).join('');
        return `
        <div class="result-block">
            <h4>核心词汇 Top ${list.length}（按词频排序）</h4>
            <div class="kw-row">
                ${list.slice(0, 8).map(([w, c]) => `<span class="kw-pill"><b>${esc(w)}</b> ×${c}</span>`).join('')}
            </div>
        </div>
        <div class="result-block">
            <h4>词汇明细表</h4>
            <table><thead><tr><th>单词</th><th>词频</th><th>释义（本地词典）</th></tr></thead><tbody>${rows}</tbody></table>
        </div>
        <div class="result-block">
            <p>教学提示：建议将词频 ≥ 2 的词作为精讲词汇；未收录释义的词可让学生结合上下文猜词，或加入「个人生词本」补充学习。</p>
        </div>`;
    }

    // ---------- 3. 长难句识别 ----------
    function runSentences(ctx) {
        const sentences = splitSentences(ctx.text)
            .map(s => ({ s: s, n: tokenize(s).length }))
            .filter(x => x.n >= 18)
            .sort((a, b) => b.n - a.n)
            .slice(0, 8);
        if (!sentences.length) {
            return '<p class="empty-state">本文没有达到 18 词的长句，句子结构较为简单，可直接进入词汇与结构分析。</p>';
        }
        const items = sentences.map(({ s, n }) => {
            let html = esc(s);
            // 高亮从句引导词
            CLAUSE_MARKERS.forEach(m => {
                html = html.replace(new RegExp('\\b(' + m + ')\\b', 'gi'), '<span class="clause-mark">$1</span>');
            });
            const found = CLAUSE_MARKERS.filter(m => new RegExp('\\b' + m + '\\b', 'i').test(s));
            return `<div class="sentence-item">
                <div><b>【${n} 词】</b>${html}</div>
                <div style="margin-top:6px;font-size:13px;color:var(--text-secondary);">
                    从句引导词：${found.length ? found.map(esc).join('、') : '未检出明显引导词（可能为分词/插入语结构）'}；
                    建议先找<b>主谓</b>，再把引导词引导的从句作为整体理解。
                </div>
            </div>`;
        }).join('');
        return `
        <div class="result-block">
            <h4>识别到 ${sentences.length} 个长难句（按长度排序）</h4>
            ${items}
        </div>
        <div class="result-block">
            <p>拆解口诀：① 找谓语动词定位主干 → ② 划出从句引导词 → ③ 从句整体当作“大名词/大形容词/大副词”理解 → ④ 最后处理插入语与同位语。</p>
        </div>`;
    }

    // ---------- 4. 文章结构分析 ----------
    function runStructure(ctx) {
        const paras = splitParagraphs(ctx.text);
        if (paras.length < 2) {
            return '<p class="empty-state">段落不足，请用空行分隔段落后再分析结构（单段文章建议直接做句子层面分析）。</p>';
        }
        const steps = paras.map((p, i) => {
            const sents = splitSentences(p);
            const first = sents[0] || p;
            const words = tokenize(p).filter(w => !STOPWORDS.has(w) && w.length >= 3).slice(0, 5);
            // 检测逻辑信号词
            const low = p.toLowerCase();
            const signals = [];
            Object.keys(LOGIC_MARKERS).forEach(k => {
                if (LOGIC_MARKERS[k].some(m => low.includes(m))) signals.push(k);
            });
            let role;
            if (i === 0) role = ctx.type === '议论文' ? '引入 / 提出观点' : ctx.type === '记叙文' ? '背景 / 开端' : '引入话题';
            else if (i === paras.length - 1) role = '总结 / 升华';
            else role = ctx.type === '议论文' ? '论证展开' : ctx.type === '记叙文' ? '情节发展' : '主体说明';
            const label = `段落 ${i + 1} · ${role}`;
            const sigText = signals.length ? '逻辑信号：' + signals.join('、') : '';
            return `<div class="structure-step">
                <span class="step-badge">${esc(label)}</span>
                <span class="step-text">“${esc(first.slice(0, 70))}${first.length > 70 ? '…' : ''}”
                ${words.length ? '｜关键词：' + words.map(esc).join(', ') : ''}
                ${sigText ? '<br><b style="color:var(--deep-blue);">' + esc(sigText) + '</b>' : ''}</span>
            </div>`;
        }).join('');
        const pattern = paras.length <= 2 ? '总分' : (paras.length === 3 ? '总—分—总' : '总—分—分—总（多层展开）');
        return `
        <div class="result-block">
            <h4>结构框架：${esc(pattern)}（共 ${paras.length} 段，文章类型：${esc(ctx.type)}）</h4>
            ${steps}
        </div>
        <div class="result-block">
            <h4>教学建议</h4>
            <p>可让学生用一句话概括每段大意（paragraph summary），再串成全文思维导图；${ctx.type === '议论文' ? '重点关注「论点—论据—结论」链条。' : ctx.type === '记叙文' ? '按「开端—发展—高潮—结局」梳理情节线。' : '关注每段主题句（多为段首句）。'}</p>
        </div>`;
    }

    // ---------- 5. 教学资源生成 ----------
    function runTeaching(ctx) {
        const words = tokenize(ctx.text);
        const freq = new Map();
        words.forEach(w => { if (!STOPWORDS.has(w) && w.length >= 3) freq.set(w, (freq.get(w) || 0) + 1); });
        const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const theme = ctx.theme || '本课主题';
        const objective = ctx.objective || '理解文章主旨、掌握核心词汇';
        const kw = top.map(([w]) => w);
        const q1 = kw[0] ? `How does the word “${esc(kw[0])}” help explain the main idea?` : 'What is the main idea of the passage?';
        return `
        <div class="result-block">
            <h4>课前导入（Lead-in）</h4>
            <p>1. 以「${esc(theme)}」为话题，请学生用 2-3 个英文单词进行头脑风暴（brainstorm）。</p>
            <p>2. 展示文章标题，让学生预测文章内容（prediction）：What do you think the passage will talk about?</p>
        </div>
        <div class="result-block">
            <h4>读中任务（While-reading）</h4>
            <p>教学目标：${esc(objective)}。建议任务链：略读找主旨 → 扫读定位细节 → 精读分析长难句。</p>
            <p>核心词任务：圈出 ${top.length ? '“' + top.slice(0, 5).map(([w]) => esc(w)).join('”、“') + '”' : '文章高频词'} 等关键词，结合上下文猜测词义。</p>
        </div>
        <div class="result-block">
            <h4>读后讨论（Post-reading）</h4>
            <p>1. ${q1}</p>
            <p>2. What is the writer's attitude toward ${esc(theme)}? How do you know?</p>
            <p>3. 结合自身经历：What can we do about it in our daily life?</p>
        </div>
        <div class="result-block">
            <h4>课堂活动与作业建议</h4>
            <p>活动：小组内用核心词汇复述文章结构（retell with key words），每组 1 分钟。</p>
            <p>作业：用 ${top.length ? '“' + top.slice(0, 3).map(([w]) => esc(w)).join('”、“') + '”' : '本课核心词'} 各造一句，并写一段 60 词左右的读后感。</p>
        </div>`;
    }

    // ---------- 对外接口 ----------
    const RUNNERS = {
        diagnosis: runDiagnosis,
        keywords: runKeywords,
        sentences: runSentences,
        structure: runStructure,
        teaching: runTeaching
    };

    window.Features = {
        list: FEATURES,
        get: id => FEATURES.find(f => f.id === id),
        /**
         * 运行某个分析功能
         * @param {string} id 功能 id
         * @param {{text:string,grade:string,type:string,theme:string,objective:string}} ctx 上下文
         * @returns {{name:string, html:string} | null}
         */
        run(id, ctx) {
            const f = this.get(id);
            if (!f || !ctx || !ctx.text || !ctx.text.trim()) return null;
            return { name: f.name, html: RUNNERS[id](ctx) };
        }
    };
})();
