// ===== 阅读工作台视图（workspace.js） =====
(function () {
    const esc = s => ReadLab.esc(s);

    // ---------- 功能选择条 ----------
    function renderChips() {
        const box = document.getElementById('feature-chips');
        box.innerHTML = Features.list.map(f =>
            `<button class="feature-chip" data-feature="${f.id}">${f.icon} ${esc(f.name)}</button>`).join('');
        box.querySelectorAll('.feature-chip').forEach(btn => {
            btn.addEventListener('click', () => setActiveFeature(btn.dataset.feature));
        });
    }

    function setActiveFeature(id) {
        ReadLab.state.activeFeature = id;
        document.querySelectorAll('#feature-chips .feature-chip').forEach(b => {
            b.classList.toggle('active', b.dataset.feature === id);
        });
    }

    // ---------- 词数统计 ----------
    function updateWordCount() {
        const text = document.getElementById('article-input').value;
        document.getElementById('word-count').textContent = ReadLab.Projects.countWords(text);
    }

    // ---------- 运行分析 ----------
    function analyze() {
        const text = document.getElementById('article-input').value;
        if (!text.trim()) { ReadLab.toast('请先粘贴英语文章'); return; }
        const id = ReadLab.state.activeFeature || 'diagnosis';
        const ctx = getCtx(text);
        const result = Features.run(id, ctx);
        if (!result) { ReadLab.toast('分析失败，请检查文章内容'); return; }
        ReadLab.state.lastResult = { id: id, html: result.html };
        document.getElementById('feature-title').textContent = result.name;
        document.getElementById('feature-results').innerHTML = result.html;
        document.getElementById('result-panel').style.display = 'block';
        document.getElementById('btn-save-feature-result').style.display = 'inline-flex';
        document.getElementById('result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getCtx(text) {
        return {
            text: text,
            grade: document.getElementById('grade-select').value,
            type: document.getElementById('type-select').value,
            theme: document.getElementById('theme-input').value.trim(),
            objective: document.getElementById('objective-input').value.trim()
        };
    }

    // ---------- 保存项目 ----------
    function saveProject() {
        const text = document.getElementById('article-input').value;
        const nameInput = document.getElementById('project-name-input').value.trim();
        const theme = document.getElementById('theme-input').value.trim();
        const name = nameInput || (theme ? theme + '阅读' : '未命名项目 ' + ReadLab.fmtTime(Date.now()).slice(5, 16));
        let p = ReadLab.state.projectId ? ReadLab.Projects.get(ReadLab.state.projectId) : null;
        if (!p) {
            p = { id: 'p_' + Date.now(), createdAt: Date.now(), features: {} };
        }
        Object.assign(p, {
            name: name,
            grade: document.getElementById('grade-select').value,
            type: document.getElementById('type-select').value,
            theme: theme,
            objective: document.getElementById('objective-input').value.trim(),
            article: text,
            wordCount: ReadLab.Projects.countWords(text)
        });
        ReadLab.Projects.save(p);
        ReadLab.state.projectId = p.id;
        document.getElementById('project-name-input').value = name;
        ReadLab.Recent.add({ name: name, view: 'workspace' });
        ReadLab.toast('已保存到资源中心：' + name);
    }

    function saveFeatureResult() {
        const r = ReadLab.state.lastResult;
        if (!r) return;
        if (!ReadLab.state.projectId) {
            // 先保存项目，再挂结果
            saveProject();
        }
        const p = ReadLab.Projects.get(ReadLab.state.projectId);
        if (!p) { ReadLab.toast('保存失败：找不到项目'); return; }
        p.features = p.features || {};
        p.features[r.id] = { name: Features.get(r.id).name, html: r.html, time: Date.now() };
        ReadLab.Projects.save(p);
        ReadLab.toast('功能结果已保存到项目「' + p.name + '」');
    }

    // ---------- 打开已有项目 ----------
    function loadProject(p) {
        ReadLab.state.projectId = p.id;
        document.getElementById('project-name-input').value = p.name || '';
        document.getElementById('grade-select').value = p.grade || '七年级';
        document.getElementById('type-select').value = p.type || '记叙文';
        document.getElementById('theme-input').value = p.theme || '';
        document.getElementById('objective-input').value = p.objective || '';
        document.getElementById('article-input').value = p.article || '';
        updateWordCount();
        // 若项目已保存过分析结果，默认展示诊断或最近保存的结果
        const ids = Object.keys(p.features || {});
        if (ids.length) {
            const fid = ids[ids.length - 1];
            setActiveFeature(fid);
            document.getElementById('feature-title').textContent = p.features[fid].name;
            document.getElementById('feature-results').innerHTML = p.features[fid].html;
            document.getElementById('result-panel').style.display = 'block';
            document.getElementById('btn-save-feature-result').style.display = 'none';
        } else {
            document.getElementById('result-panel').style.display = 'none';
        }
    }

    ReadLab.views.workspace = {
        render(params) {
            // 首次渲染时绑定事件
            if (!this._bound) {
                renderChips();
                document.getElementById('article-input').addEventListener('input', updateWordCount);
                document.getElementById('btn-analyze').addEventListener('click', analyze);
                document.getElementById('btn-clear-article').addEventListener('click', () => {
                    document.getElementById('article-input').value = '';
                    updateWordCount();
                    document.getElementById('result-panel').style.display = 'none';
                    ReadLab.state.lastResult = null;
                });
                document.getElementById('btn-save-workspace').addEventListener('click', saveProject);
                document.getElementById('btn-save-feature-result').addEventListener('click', saveFeatureResult);
                this._bound = true;
            }
            setActiveFeature(params.feature || ReadLab.state.activeFeature || 'diagnosis');
            if (params.projectId) {
                const p = ReadLab.Projects.get(params.projectId);
                if (p) { loadProject(p); return; }
            }
            if (params.newBlank) {
                // 清空为新建
                ReadLab.state.projectId = null;
                document.getElementById('project-name-input').value = '';
                document.getElementById('article-input').value = '';
                document.getElementById('theme-input').value = '';
                document.getElementById('objective-input').value = '';
                updateWordCount();
                document.getElementById('result-panel').style.display = 'none';
            }
        }
    };
})();
