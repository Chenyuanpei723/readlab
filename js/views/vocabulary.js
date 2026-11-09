// ===== 个人生词本视图（vocabulary.js） =====
(function () {
    const esc = s => ReadLab.esc(s);
    const STATUSES = { unlearnt: '未学习', learning: '学习中', mastered: '已掌握' };

    // ---------- 数据 ----------
    function all() { return ReadLab.store.get('vocabulary', []); }
    function saveList(list) { ReadLab.store.set('vocabulary', list); }

    function addWord({ word, trans, source }) {
        word = (word || '').trim().toLowerCase();
        if (!word) return false;
        const list = all();
        if (list.some(w => w.word === word)) {
            ReadLab.toast('「' + word + '」已在生词本中');
            return false;
        }
        list.unshift({
            id: 'w_' + Date.now(),
            word: word,
            trans: trans || '',
            note: '',
            status: 'unlearnt',
            source: source || '',
            addedAt: Date.now()
        });
        saveList(list);
        ReadLab.toast('已加入生词本：' + word);
        if (ReadLab.state.view === 'vocabulary') render();
        return true;
    }

    function setStatus(id, status) {
        const list = all();
        const w = list.find(x => x.id === id);
        if (w) {
            w.status = status;
            saveList(list);
            render();
        }
    }

    function removeWord(id) {
        saveList(all().filter(w => w.id !== id));
        render();
        ReadLab.toast('已删除');
    }

    function setNote(id, note) {
        const list = all();
        const w = list.find(x => x.id === id);
        if (w) { w.note = note; saveList(list); }
    }

    // ---------- 渲染 ----------
    function render() {
        renderStats();
        renderList();
    }

    function renderStats() {
        const list = all();
        document.getElementById('stat-total').textContent = list.length;
        document.getElementById('stat-mastered').textContent = list.filter(w => w.status === 'mastered').length;
        document.getElementById('stat-learning').textContent = list.filter(w => w.status === 'learning').length;
        document.getElementById('stat-unlearnt').textContent = list.filter(w => w.status === 'unlearnt').length;
    }

    function renderList() {
        const kw = document.getElementById('vocabulary-search').value.trim().toLowerCase();
        const list = all().filter(w =>
            !kw || w.word.includes(kw) || (w.trans || '').toLowerCase().includes(kw));
        const box = document.getElementById('vocabulary-container');

        if (!list.length) {
            box.innerHTML = `
                <div class="vocabulary-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <p class="text-muted">${kw ? '没有匹配的生词。' : '还没有收录生词，在「阅读标注」中点击单词即可加入。'}</p>
                    ${kw ? '' : '<button class="btn-primary" id="btn-manual-add">手动添加生词</button>'}
                </div>`;
            const btn = box.querySelector('#btn-manual-add');
            if (btn) btn.addEventListener('click', manualAdd);
            return;
        }

        box.innerHTML = list.map(w => `
            <div class="vocabulary-item">
                <span class="v-word">${esc(w.word)}</span>
                <span class="v-trans">${esc(w.trans || '—')}${w.note ? '<br><span style="font-size:12px;">📝 ' + esc(w.note) + '</span>' : ''}</span>
                <span class="v-source" title="${esc(w.source)}">${esc(w.source || '')}</span>
                <span class="status-badge status-${w.status}">${STATUSES[w.status]}</span>
                <div class="v-actions">
                    <button class="btn-sm btn-outline" data-act="cycle" data-id="${w.id}" title="切换状态">${w.status === 'unlearnt' ? '→学习中' : w.status === 'learning' ? '→已掌握' : '→未学习'}</button>
                    <button class="btn-sm btn-outline" data-act="note" data-id="${w.id}">备注</button>
                    <button class="btn-sm btn-outline" data-act="del" data-id="${w.id}">删除</button>
                </div>
            </div>`).join('');

        box.querySelectorAll('button[data-act]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const w = all().find(x => x.id === id);
                if (!w) return;
                if (btn.dataset.act === 'cycle') {
                    const order = ['unlearnt', 'learning', 'mastered'];
                    const next = order[(order.indexOf(w.status) + 1) % 3];
                    setStatus(id, next);
                } else if (btn.dataset.act === 'note') {
                    const note = prompt('为「' + w.word + '」添加备注（词性、记忆法、例句等）：', w.note || '');
                    if (note !== null) { setNote(id, note.trim()); renderList(); }
                } else if (btn.dataset.act === 'del') {
                    if (confirm('确定删除生词「' + w.word + '」吗？')) removeWord(id);
                }
            });
        });
    }

    // ---------- 手动添加 ----------
    function manualAdd() {
        const word = (prompt('请输入要添加的英文单词：') || '').trim();
        if (!word) return;
        const trans = (window.Dictionary && Dictionary.lookup(word.toLowerCase())) || '';
        addWord({ word: word, trans: trans, source: '手动添加' });
    }

    // ---------- 复习模式 ----------
    const review = { queue: [], index: 0, revealed: false };

    function startReview() {
        const pool = all().filter(w => w.status !== 'mastered');
        if (!pool.length) { ReadLab.toast('没有待复习的生词（已掌握的词不参与）'); return; }
        review.queue = pool.slice();
        review.index = 0;
        review.revealed = false;
        document.getElementById('vocabulary-review').style.display = 'block';
        renderReview();
        document.getElementById('vocabulary-review').scrollIntoView({ behavior: 'smooth' });
    }

    function renderReview() {
        if (!review.queue.length) {
            document.getElementById('vocabulary-review').style.display = 'none';
            return;
        }
        const w = review.queue[review.index];
        document.getElementById('review-progress').textContent =
            Math.round((review.index + 1) / review.queue.length * 100) + '%（' + (review.index + 1) + '/' + review.queue.length + '）';
        document.getElementById('review-word').textContent = w.word;
        document.getElementById('review-question').innerHTML = review.revealed
            ? (esc(w.trans || '（暂无释义，可补充备注）') + '<br><span style="font-size:13px;">状态：' + STATUSES[w.status] + '</span>')
            : '请回忆该单词的含义，然后点击 <b>「下一词」前先自测</b>，或使用下方按钮标记掌握情况。';
        document.getElementById('review-examples').textContent = w.source ? '例句来源：' + w.source : '';
    }

    function reviewNext() {
        if (!review.queue.length) return;
        if (review.index < review.queue.length - 1) {
            review.index++; review.revealed = false;
        } else {
            ReadLab.toast('本轮复习完成，共 ' + review.queue.length + ' 个词！');
            document.getElementById('vocabulary-review').style.display = 'none';
            renderStats();
            return;
        }
        renderReview();
    }

    function reviewPrev() {
        if (!review.queue.length) return;
        if (review.index > 0) { review.index--; review.revealed = false; renderReview(); }
    }

    function reviewMark(status) {
        if (!review.queue.length) return;
        const w = review.queue[review.index];
        setStatus(w.id, status);
        w.status = status;
        review.revealed = true;
        renderReview();
        reviewNext();
    }

    // ---------- 打印 ----------
    function printList() {
        const list = all();
        if (!list.length) { ReadLab.toast('生词本为空，无法打印'); return; }
        const rows = list.map((w, i) =>
            `<tr><td>${i + 1}</td><td style="font-weight:700;">${esc(w.word)}</td><td>${esc(w.trans || '')}</td><td>${esc(w.note || '')}</td><td>${STATUSES[w.status]}</td></tr>`).join('');
        const html = `<html><head><meta charset="utf-8"><title>ReadLab 生词表</title>
            <style>body{font-family:"Microsoft YaHei",sans-serif;padding:24px;} h1{font-size:20px;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{border:1px solid #999;padding:6px 10px;font-size:13px;text-align:left;} th{background:#f0f0f0;}</style>
            </head><body><h1>ReadLab 生词表（${new Date().toLocaleDateString()}）</h1>
            <table><thead><tr><th>#</th><th>单词</th><th>释义</th><th>备注</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table>
            </body></html>`;
        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
    }

    // ---------- 注册视图 ----------
    ReadLab.views.vocabulary = {
        render() {
            if (!this._bound) {
                document.getElementById('vocabulary-search').addEventListener('input', renderList);
                document.getElementById('btn-review-start').addEventListener('click', startReview);
                document.getElementById('btn-print').addEventListener('click', printList);
                document.getElementById('btn-review-next').addEventListener('click', reviewNext);
                document.getElementById('btn-review-prev').addEventListener('click', reviewPrev);
                document.querySelectorAll('#vocabulary-review .vocabulary-status-row button').forEach(btn => {
                    btn.addEventListener('click', () =>
                        reviewMark(btn.dataset.action === 'mark-mastered' ? 'mastered' : 'learning'));
                });
                this._bound = true;
            }
            // 复习面板默认收起
            document.getElementById('vocabulary-review').style.display = 'none';
            render();
        }
    };

    // 暴露给词典浮层调用
    window.Vocabulary = { add: addWord, all: all };
})();
