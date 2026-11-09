// ===== 资源中心视图（resource.js） =====
(function () {
    const esc = s => ReadLab.esc(s);

    function currentFilters() {
        return {
            kw: document.getElementById('resource-search').value.trim().toLowerCase(),
            grade: document.getElementById('filter-grade').value,
            type: document.getElementById('filter-type').value
        };
    }

    function renderList() {
        const f = currentFilters();
        let projects = ReadLab.Projects.all();
        if (f.grade) {
            projects = projects.filter(p => p.grade === f.grade);
        }
        if (f.type) {
            projects = projects.filter(p => p.type === f.type);
        }
        if (f.kw) {
            projects = projects.filter(p =>
                (p.name || '').toLowerCase().includes(f.kw) ||
                (p.theme || '').toLowerCase().includes(f.kw) ||
                (p.article || '').toLowerCase().includes(f.kw));
        }
        document.getElementById('resource-count').textContent = projects.length;

        const box = document.getElementById('resource-list');
        if (!projects.length) {
            box.innerHTML = '<div class="empty-state">暂无项目数据，可在「阅读工作台」保存文章后出现在这里。</div>';
            return;
        }
        box.innerHTML = projects.map(p => {
            const featTags = Object.keys(p.features || {}).map(id =>
                `<span class="tag">${esc(p.features[id].name)}</span>`).join('');
            return `
            <div class="resource-item">
                <div class="resource-item-main">
                    <div class="resource-item-title">${esc(p.name || '未命名项目')}</div>
                    <div class="resource-item-tags">
                        <span class="tag">${esc(p.grade || '未设年级')}</span>
                        <span class="tag">${esc(p.type || '未设类型')}</span>
                        ${p.theme ? `<span class="tag">${esc(p.theme)}</span>` : ''}
                        ${featTags}
                    </div>
                    <div class="resource-item-meta">
                        ${p.wordCount || 0} 词 · 更新于 ${ReadLab.fmtTime(p.updatedAt || p.createdAt)}
                    </div>
                </div>
                <div class="resource-item-actions">
                    <button class="btn-secondary btn-sm" data-act="open" data-id="${p.id}">打开分析</button>
                    <button class="btn-secondary btn-sm" data-act="annotate" data-id="${p.id}">去标注</button>
                    <button class="btn-outline btn-sm" data-act="del" data-id="${p.id}">删除</button>
                </div>
            </div>`;
        }).join('');

        box.querySelectorAll('button[data-act]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const p = ReadLab.Projects.get(id);
                if (!p) return;
                if (btn.dataset.act === 'open') {
                    ReadLab.navigate('workspace', { projectId: id, projectName: p.name, from: 'resource', logRecent: true });
                } else if (btn.dataset.act === 'annotate') {
                    ReadLab.navigate('annotation', { projectId: id, projectName: p.name, from: 'resource', logRecent: true });
                } else if (btn.dataset.act === 'del') {
                    if (confirm('确定删除项目「' + p.name + '」吗？该操作不可恢复。')) {
                        ReadLab.Projects.remove(id);
                        renderList();
                        ReadLab.toast('项目已删除');
                    }
                }
            });
        });
    }

    // 把当前工作台内容保存为项目（与工作台“保存当前”一致）
    function saveFromWorkspace() {
        const text = document.getElementById('article-input').value;
        if (!text.trim()) {
            ReadLab.toast('请先在「阅读工作台」输入文章内容');
            ReadLab.navigate('workspace');
            return;
        }
        document.getElementById('btn-save-workspace').click();
        renderList();
    }

    ReadLab.views.resource = {
        render() {
            if (!this._bound) {
                document.getElementById('resource-search').addEventListener('input', renderList);
                document.getElementById('filter-grade').addEventListener('change', renderList);
                document.getElementById('filter-type').addEventListener('change', renderList);
                document.getElementById('btn-save-resource').addEventListener('click', saveFromWorkspace);
                this._bound = true;
            }
            renderList();
        }
    };
})();
