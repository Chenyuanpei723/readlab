// ===== 阅读标注视图（annotation.js） =====
// 功能：文章输入/生成标注视图、划词高亮（黄/蓝/绿）、添加批注、
//       标注记录定位、整篇心得、逐段总结、按项目/草稿保存。
(function () {
    const esc = s => ReadLab.esc(s);
    const COLORS = { 'highlight-yellow': 'mk-yellow', 'highlight-blue': 'mk-blue', 'highlight-green': 'mk-green' };
    const COLOR_NAMES = { 'mk-yellow': '黄色', 'mk-blue': '蓝色', 'mk-green': '绿色' };

    // ---------- 当前标注文档 ----------
    function docKey() {
        return 'annodoc_' + (ReadLab.state.annotationProjectId || 'draft');
    }
    function loadDoc() {
        return ReadLab.store.get(docKey(), null) || {
            title: '', article: '', paragraphsHtml: [], records: [],
            insight: '', paragraphNotes: [], updatedAt: 0
        };
    }
    function saveDoc(doc) {
        doc.updatedAt = Date.now();
        ReadLab.store.set(docKey(), doc);
        flashSaved();
    }
    function flashSaved() {
        ['save-status', 'article-save-status'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.display = 'inline';
            setTimeout(() => { el.style.display = 'none'; }, 1800);
        });
    }

    // ---------- 文本 → 标注视图 ----------
    // 把每个单词包进 span.w，供点击查词；再叠加已保存的高亮/批注 HTML。
    // 安全约定：逐段转义后再拼 HTML。必须先按"单词/非单词"切分再分别转义，
    // 否则先转义会把 < 变成 &lt;，后续按字母包裹时又会把实体里的 lt / amp 包进 span，破坏实体。
    function renderParagraphHTML(text) {
        return text.split(/\n\s*\n|\r\n\s*\r\n/).map(p => p.trim()).filter(Boolean).map(para => {
            // 先按"单词/非单词"切分再分别转义，避免实体被二次包裹
            const html = para.replace(/[A-Za-z]+(?:'[A-Za-z]+)?|[^A-Za-z]+/g, seg => {
                if (/^[A-Za-z]/.test(seg)) {
                    return '<span class="w" data-w="' + seg.toLowerCase() + '">' + esc(seg) + '</span>';
                }
                return esc(seg);
            });
            return '<p>' + html + '</p>';
        });
    }

    function renderArticle() {
        const raw = document.getElementById('annotation-article-input').value;
        if (!raw.trim()) { ReadLab.toast('请先输入文章内容'); return; }
        const doc = loadDoc();
        doc.title = doc.title || '未命名文章';
        doc.article = raw;
        doc.paragraphsHtml = renderParagraphHTML(raw);
        doc.records = [];          // 重新生成视图时重置标注
        doc.paragraphNotes = [];
        saveDoc(doc);
        paintArticle(doc);
        ReadLab.toast('标注视图已生成，选中文字即可标记或批注');
    }

    function paintArticle(doc) {
        const body = document.getElementById('article-body');
        body.innerHTML = (doc.paragraphsHtml || []).join('');
        document.getElementById('annotation-reading-content').style.display = 'block';
        document.getElementById('annotation-input-area').style.display = 'none';
        renderParagraphSummaries(doc);
        renderRecords(doc);
        renderInsight(doc);
    }

    function showInputArea() {
        document.getElementById('annotation-input-area').style.display = 'block';
        document.getElementById('annotation-reading-content').style.display = 'none';
    }

    // ---------- 划词工具栏 ----------
    let pendingRange = null;

    function hideToolbar() {
        document.getElementById('annotation-toolbar').style.display = 'none';
        pendingRange = null;
    }

    function onSelectionChange() {
        const toolbar = document.getElementById('annotation-toolbar');
        const body = document.getElementById('article-body');
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { hideToolbar(); return; }
        const range = sel.getRangeAt(0);
        if (!body.contains(range.commonAncestorContainer) ||
            document.getElementById('annotation-reading-content').style.display === 'none') {
            hideToolbar(); return;
        }
        pendingRange = range.cloneRange();
        const rect = range.getBoundingClientRect();
        toolbar.style.display = 'block';
        let top = rect.top - 130, left = rect.left;
        if (top < 70) top = rect.bottom + 8;
        if (left + 140 > window.innerWidth) left = window.innerWidth - 150;
        toolbar.style.top = top + 'px';
        toolbar.style.left = left + 'px';
    }

    function wrapSelection(cssClass, note) {
        if (!pendingRange) return;
        const doc = loadDoc();
        const span = document.createElement('span');
        span.className = 'mark ' + cssClass;
        const aid = 'a_' + Date.now();
        span.setAttribute('data-aid', aid);
        if (note) { span.setAttribute('data-note', note); span.title = note; }
        try {
            pendingRange.surroundContents(span);
        } catch (e) {
            // 跨节点时降级处理
            const frag = pendingRange.extractContents();
            span.appendChild(frag);
            pendingRange.insertNode(span);
        }
        window.getSelection().removeAllRanges();
        // 读取段落 HTML 持久化
        doc.paragraphsHtml = [...document.getElementById('article-body').querySelectorAll('p')].map(p => p.innerHTML);
        doc.records.push({
            id: aid,
            type: cssClass === 'mk-comment' ? 'comment' : 'highlight',
            color: cssClass,
            text: span.textContent.slice(0, 60),
            note: note || '',
            time: Date.now()
        });
        saveDoc(doc);
        renderRecords(doc);
    }

    // 点击已有标记 → 可删除
    document.addEventListener('click', function (e) {
        const mark = e.target.closest('#article-body span.mark');
        if (!mark) return;
        const kind = mark.classList.contains('mk-comment') ? '批注' : (COLOR_NAMES[mark.classList] ? COLOR_NAMES[mark.classList] : '标记');
        if (confirm('删除这个' + kind + '吗？')) {
            const aid = mark.getAttribute('data-aid');
            const doc = loadDoc();
            // 用子节点替换标记，保留文本
            const parent = mark.parentNode;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
            doc.paragraphsHtml = [...document.getElementById('article-body').querySelectorAll('p')].map(p => p.innerHTML);
            doc.records = (doc.records || []).filter(r => r.id !== aid);
            saveDoc(doc);
            renderRecords(doc);
        }
    });

    // ---------- 标注记录 ----------
    function renderRecords(doc) {
        const records = doc.records || [];
        document.getElementById('anno-count-total').textContent = records.length;
        document.getElementById('anno-count-highlight').textContent = records.filter(r => r.type === 'highlight').length;
        document.getElementById('anno-count-comment').textContent = records.filter(r => r.type === 'comment').length;

        const box = document.getElementById('annotation-records');
        if (!records.length) {
            box.innerHTML = '<div class="annotation-record-empty">暂无标注记录</div>';
            return;
        }
        box.innerHTML = records.slice().reverse().map(r => `
            <div class="annotation-record" data-aid="${r.id}">
                <div>${r.type === 'comment' ? '💬 批注：' + esc(r.note) : '🖍️ ' + esc(COLOR_NAMES[r.color] || '标记') + '：' + esc(r.text)}</div>
                <div class="rec-meta">${ReadLab.fmtTime(r.time)}${r.note && r.type === 'highlight' ? ' · ' + esc(r.note) : ''}</div>
            </div>`).join('');
        box.querySelectorAll('.annotation-record').forEach(el => {
            el.addEventListener('click', () => {
                const target = document.querySelector('#article-body span.mark[data-aid="' + el.dataset.aid + '"]');
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    target.classList.add('flash-target');
                    setTimeout(() => target.classList.remove('flash-target'), 2600);
                }
            });
        });
    }

    // ---------- 阅读心得 ----------
    function renderInsight(doc) {
        document.getElementById('reading-insight-input').value = doc.insight || '';
        document.getElementById('reading-insight-display').textContent =
            doc.insight ? doc.insight : '暂无阅读心得';
    }

    function saveInsight() {
        const doc = loadDoc();
        doc.insight = document.getElementById('reading-insight-input').value.trim();
        saveDoc(doc);
        renderInsight(doc);
        ReadLab.toast('心得已保存');
    }

    // ---------- 段落总结 ----------
    function renderParagraphSummaries(doc) {
        const box = document.getElementById('paragraph-summaries');
        const paras = doc.paragraphsHtml || [];
        if (!paras.length) {
            box.innerHTML = '<div class="empty-state">生成标注视图后，可为每个段落填写总结。</div>';
            return;
        }
        doc.paragraphNotes = doc.paragraphNotes || [];
        box.innerHTML = paras.map((html, i) => {
            const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            return `
            <div class="paragraph-summary-item">
                <div class="para-src">段落 ${i + 1}：${esc(plain.slice(0, 90))}${plain.length > 90 ? '…' : ''}</div>
                <textarea data-para="${i}" placeholder="用 1-2 句英文或中文概括本段大意...">${esc(doc.paragraphNotes[i] || '')}</textarea>
            </div>`;
        }).join('');
        box.querySelectorAll('textarea[data-para]').forEach(ta => {
            ta.addEventListener('input', () => {
                const d = loadDoc();
                d.paragraphNotes = d.paragraphNotes || [];
                d.paragraphNotes[parseInt(ta.dataset.para, 10)] = ta.value;
                clearTimeout(this._pt);
                this._pt = setTimeout(() => saveDoc(d), 600);
            });
        });
    }

    // ---------- 保存 / 项目关联 ----------
    function saveCurrent() {
        const raw = document.getElementById('annotation-article-input').value ||
                    getCurrentArticleText();
        const doc = loadDoc();
        doc.article = doc.article || raw;
        if (!doc.article) { ReadLab.toast('没有可保存的文章'); return; }
        doc.title = getDocTitle();
        saveDoc(doc);
        ReadLab.toast('文章与标注已保存（' + (ReadLab.state.annotationProjectId === 'draft' || !ReadLab.state.annotationProjectId ? '草稿' : '项目：' + getDocTitle()) + '）');
    }

    function getCurrentArticleText() {
        const body = document.getElementById('article-body');
        if (document.getElementById('annotation-reading-content').style.display !== 'none') {
            return [...body.querySelectorAll('p')].map(p => p.textContent).join('\n\n');
        }
        return '';
    }

    function getDocTitle() {
        const pid = ReadLab.state.annotationProjectId;
        if (pid && pid !== 'draft') {
            const p = ReadLab.Projects.get(pid);
            if (p) return p.name;
        }
        return '草稿文章';
    }

    // 同步保存到项目（若关联了项目）
    function syncToProject() {
        const pid = ReadLab.state.annotationProjectId;
        if (!pid || pid === 'draft') return;
        const p = ReadLab.Projects.get(pid);
        const doc = loadDoc();
        if (p) {
            p.article = doc.article || p.article;
            p.wordCount = ReadLab.Projects.countWords(p.article);
            ReadLab.Projects.save(p);
        }
    }

    // ---------- 注册视图 ----------
    ReadLab.views.annotation = {
        render(params) {
            if (!this._bound) {
                // 工具栏按钮
                document.querySelectorAll('#annotation-toolbar .annotation-btn').forEach(btn => {
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        const action = btn.dataset.action;
                        if (action === 'cancel') { window.getSelection().removeAllRanges(); hideToolbar(); return; }
                        if (!pendingRange) { hideToolbar(); return; }
                        if (action === 'comment') {
                            const note = prompt('请输入批注内容：');
                            if (note && note.trim()) wrapSelection('mk-comment', note.trim());
                        } else if (COLORS[action]) {
                            wrapSelection(COLORS[action], '');
                        }
                        hideToolbar();
                    });
                });
                // 选中文字 → 显示工具栏
                document.addEventListener('mouseup', () => setTimeout(onSelectionChange, 10));
                // 生成/保存/清除
                document.getElementById('btn-render-article').addEventListener('click', renderArticle);
                document.getElementById('btn-save-annotation').addEventListener('click', () => {
                    saveCurrent(); syncToProject();
                });
                document.getElementById('btn-clear-annotations').addEventListener('click', () => {
                    const doc = loadDoc();
                    if (!doc.article) { ReadLab.toast('暂无文章'); return; }
                    if (!confirm('确定清除全部标注、批注、心得与段落总结吗？')) return;
                    doc.paragraphsHtml = renderParagraphHTML(doc.article);
                    doc.records = []; doc.insight = ''; doc.paragraphNotes = [];
                    saveDoc(doc);
                    paintArticle(doc);
                    document.getElementById('annotation-article-input').value = doc.article;
                    ReadLab.toast('已清除全部标注');
                });
                // 心得
                document.getElementById('btn-save-insight').addEventListener('click', saveInsight);
                document.getElementById('btn-clear-insight').addEventListener('click', () => {
                    document.getElementById('reading-insight-input').value = '';
                    const doc = loadDoc(); doc.insight = ''; saveDoc(doc);
                    renderInsight(doc);
                });
                // 项目下拉框
                this.fillProjectSelect();
                document.getElementById('annotation-project-select').addEventListener('change', e => {
                    ReadLab.state.annotationProjectId = e.target.value;
                    this.loadCurrent();
                });
                this._bound = true;
            } else {
                this.fillProjectSelect();
            }

            // 来自资源中心「去标注」
            if (params.projectId) {
                ReadLab.state.annotationProjectId = params.projectId;
                document.getElementById('annotation-project-select').value = params.projectId;
            } else if (!ReadLab.state.annotationProjectId) {
                ReadLab.state.annotationProjectId = 'draft';
                document.getElementById('annotation-project-select').value = 'draft';
            }
            this.loadCurrent();
        },

        fillProjectSelect() {
            const sel = document.getElementById('annotation-project-select');
            const current = ReadLab.state.annotationProjectId || 'draft';
            sel.innerHTML = '<option value="draft">草稿（未关联项目）</option>' +
                ReadLab.Projects.all().map(p =>
                    `<option value="${p.id}">${esc(p.name)}</option>`).join('');
            sel.value = [...sel.options].some(o => o.value === current) ? current : 'draft';
            ReadLab.state.annotationProjectId = sel.value;
        },

        loadCurrent() {
            const doc = loadDoc();
            document.getElementById('annotation-article-title').textContent = getDocTitle();
            if (doc.paragraphsHtml && doc.paragraphsHtml.length) {
                // 已有标注视图：恢复
                if (doc.article) document.getElementById('annotation-article-input').value = doc.article;
                paintArticle(doc);
            } else if (doc.article) {
                // 只有原文：预填输入框
                document.getElementById('annotation-article-input').value = doc.article;
                showInputArea();
                document.getElementById('paragraph-summaries').innerHTML =
                    '<div class="empty-state">点击「生成标注视图」后，可为每个段落填写总结。</div>';
                renderInsight(doc);
                renderRecords(doc);
            } else {
                showInputArea();
                document.getElementById('paragraph-summaries').innerHTML =
                    '<div class="empty-state">生成标注视图后，可为每个段落填写总结。</div>';
                document.getElementById('annotation-records').innerHTML =
                    '<div class="annotation-record-empty">暂无标注记录</div>';
                ['anno-count-total', 'anno-count-highlight', 'anno-count-comment'].forEach(id =>
                    document.getElementById(id).textContent = '0');
                renderInsight(doc);
            }
        }
    };
})();
