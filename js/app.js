// ===== ReadLab 应用核心（app.js） =====
// 职责：视图路由、localStorage 持久化、项目/最近使用管理、新建项目弹窗、全局提示。
// 注意：本文件必须在各 views/*.js 之前加载（views 依赖 ReadLab 命名空间）。
(function () {

    // ---------- 本地存储 ----------
    const store = {
        get(key, def) {
            try {
                const v = localStorage.getItem('readlab_' + key);
                return v === null ? def : JSON.parse(v);
            } catch (e) { return def; }
        },
        set(key, val) {
            try { localStorage.setItem('readlab_' + key, JSON.stringify(val)); }
            catch (e) { ReadLab.toast('保存失败：浏览器存储不可用'); }
        },
        remove(key) { localStorage.removeItem('readlab_' + key); }
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ---------- 项目管理 ----------
    const Projects = {
        all() { return store.get('projects', []); },
        get(id) { return this.all().find(p => p.id === id) || null; },
        save(p) {
            const list = this.all();
            const idx = list.findIndex(x => x.id === p.id);
            p.updatedAt = Date.now();
            if (idx >= 0) list[idx] = p; else list.unshift(p);
            store.set('projects', list);
            return p;
        },
        remove(id) {
            store.set('projects', this.all().filter(p => p.id !== id));
        },
        countWords(text) {
            const m = (text || '').toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g);
            return m ? m.length : 0;
        }
    };

    // ---------- 最近使用 ----------
    const Recent = {
        list() { return store.get('recent', []); },
        add(entry) {
            const list = this.list().filter(r => !(r.name === entry.name && r.view === entry.view));
            list.unshift(Object.assign({ time: Date.now() }, entry));
            store.set('recent', list.slice(0, 20));
        },
        clear() { store.set('recent', []); }
    };

    // ---------- 全局提示 ----------
    let toastTimer = null;
    function toast(msg) {
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2200);
    }

    function fmtTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // ---------- 应用主体 ----------
    window.ReadLab = {
        store, Projects, Recent, esc, fmtTime, toast,
        state: {
            view: 'home',
            activeFeature: null,     // 工作台当前选中功能
            projectId: null,         // 工作台当前项目
            lastResult: null,        // 最近一次分析结果
            fromView: null           // 返回按钮来源
        },
        views: {},                   // 各视图模块在此注册：views.home.render(params)...

        /** 渲染工作台侧边栏的功能子菜单 */
        renderSubMenu() {
            const ul = document.getElementById('sub-menu-workspace');
            if (!ul) return;
            ul.innerHTML = (window.Features ? Features.list : []).map(f =>
                `<li><a href="#" data-feature="${f.id}">${f.icon} ${f.name}</a></li>`).join('');
            ul.querySelectorAll('a[data-feature]').forEach(a => {
                a.addEventListener('click', e => {
                    e.preventDefault();
                    this.navigate('workspace', { feature: a.dataset.feature });
                });
            });
        },

        /** 视图切换 */
        navigate(view, params) {
            params = params || {};
            const views = ['home', 'workspace', 'annotation', 'vocabulary', 'resource'];
            if (views.indexOf(view) < 0) view = 'home';
            this.state.view = view;

            document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; });
            const el = document.getElementById('view-' + view);
            if (el) el.style.display = 'block';

            document.querySelectorAll('.nav-link').forEach(a => {
                a.classList.toggle('active', a.dataset.view === view);
            });

            const titles = { home: '首页', workspace: '阅读工作台', annotation: '阅读标注', vocabulary: '个人生词本', resource: '资源中心' };
            document.getElementById('page-title').textContent = titles[view] || view;
            document.getElementById('breadcrumb').textContent = params.projectName ? ' / ' + params.projectName : '';

            // 返回按钮：从资源中心打开项目详情时显示
            const backBtn = document.getElementById('back-btn');
            if (params.from) {
                this.state.fromView = params.from;
                backBtn.style.display = 'inline-flex';
            } else if (view === 'home') {
                backBtn.style.display = 'none';
            }

            // 记录最近使用（带名称的入口）
            if (params.logRecent && params.projectName) {
                Recent.add({ name: params.projectName, view: view, feature: params.feature || '' });
            }

            const mod = this.views[view];
            if (mod && typeof mod.render === 'function') mod.render(params);
        },

        /** 初始化 */
        init() {
            // 导航点击
            document.querySelectorAll('.sidebar .nav-link').forEach(a => {
                a.addEventListener('click', e => {
                    e.preventDefault();
                    this.navigate(a.dataset.view);
                });
            });

            // 返回按钮
            document.getElementById('back-btn').addEventListener('click', () => {
                this.navigate(this.state.fromView || 'resource');
            });

            // 顶部日期
            const d = new Date();
            const pad = n => String(n).padStart(2, '0');
            document.getElementById('date-display').textContent =
                `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]}`;

            // 「查看全部」→ 资源中心
            document.getElementById('view-recent-link').addEventListener('click', e => {
                e.preventDefault();
                this.navigate('resource');
            });

            // 新建项目弹窗
            const modal = document.getElementById('modal-new-project');
            document.getElementById('btn-new-project').addEventListener('click', () => {
                modal.style.display = 'flex';
                setTimeout(() => document.getElementById('np-name').focus(), 50);
            });
            document.getElementById('np-cancel').addEventListener('click', () => { modal.style.display = 'none'; });
            modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
            document.getElementById('np-confirm').addEventListener('click', () => {
                const name = document.getElementById('np-name').value.trim();
                if (!name) { this.toast('请填写项目名称'); return; }
                const p = Projects.save({
                    id: 'p_' + Date.now(),
                    name: name,
                    grade: document.getElementById('np-grade').value,
                    type: document.getElementById('np-type').value,
                    theme: document.getElementById('np-theme').value.trim(),
                    objective: '',
                    article: '',
                    wordCount: 0,
                    features: {},
                    createdAt: Date.now()
                });
                modal.style.display = 'none';
                ['np-name', 'np-theme'].forEach(id => { document.getElementById(id).value = ''; });
                this.toast('项目已创建');
                this.navigate('workspace', { projectId: p.id, projectName: p.name, from: 'resource' });
            });

            // 渲染子菜单并进入首页
            this.renderSubMenu();
            this.navigate('home');
        }
    };
})();
