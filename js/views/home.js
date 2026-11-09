// ===== 首页视图（home.js） =====
(function () {
    const R = () => window.ReadLab;
    const esc = s => ReadLab.esc(s);

    function renderStats() {
        const projects = ReadLab.Projects.all();
        const recent = ReadLab.Recent.list();
        document.getElementById('stat-projects').textContent = projects.length;
        document.getElementById('stat-recent').textContent = recent.length;
        document.getElementById('stat-features').textContent = Features.list.length;
        document.getElementById('stat-total-projects').textContent = projects.length;
        document.getElementById('stat-total-words').textContent =
            projects.reduce((s, p) => s + (p.wordCount || 0), 0);
        document.getElementById('stat-saved-features').textContent =
            projects.reduce((s, p) => s + Object.keys(p.features || {}).length, 0);
    }

    function renderRecent() {
        const box = document.getElementById('recent-list');
        const list = ReadLab.Recent.list();
        if (!list.length) {
            box.innerHTML = '<div class="empty-state">暂无最近使用记录</div>';
            return;
        }
        box.innerHTML = list.slice(0, 6).map(r => `
            <div class="recent-item" data-view="${r.view}" data-name="${esc(r.name)}">
                <div>
                    <div class="recent-item-title">${esc(r.name)}</div>
                    <div class="recent-item-meta">${esc(r.feature || '综合使用')} · ${ReadLab.fmtTime(r.time)}</div>
                </div>
                <span class="link-btn">打开 →</span>
            </div>`).join('');
        box.querySelectorAll('.recent-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.dataset.view;
                // 最近条目统一跳转到资源中心或对应视图
                ReadLab.navigate(view === 'workspace' ? 'resource' : view, { logRecent: false });
            });
        });
    }

    function renderFeatureGrid() {
        const grid = document.getElementById('feature-grid');
        grid.innerHTML = Features.list.map(f => `
            <div class="feature-card-item" data-feature="${f.id}">
                <div class="feature-card-icon">${f.icon}</div>
                <div class="feature-card-name">${esc(f.name)}</div>
                <div class="feature-card-desc">${esc(f.desc)}</div>
                <div class="feature-card-go">去使用 →</div>
            </div>`).join('');
        grid.querySelectorAll('.feature-card-item').forEach(item => {
            item.addEventListener('click', () => {
                ReadLab.navigate('workspace', { feature: item.dataset.feature });
            });
        });
    }

    ReadLab.views.home = {
        render() {
            renderStats();
            renderRecent();
            renderFeatureGrid();
        }
    };
})();
