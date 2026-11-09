// ===== 单词查询浮层（Dictionary） =====
// 功能：在「阅读标注」的文章视图中点击任意单词 → 弹出释义浮层，
//       支持朗读（speechSynthesis）、一键加入生词本。
(function () {
    let currentWord = '';
    let currentSentence = '';

    function lookup(word) {
        if (!word) return null;
        const d = window.READLAB_DICT || {};
        if (d[word]) return d[word];
        if (d[word.toLowerCase()]) return d[word.toLowerCase()];
        return null;
    }

    function getPopup() { return document.getElementById('word-popup'); }

    function show(word, x, y, sentence) {
        currentWord = word;
        currentSentence = sentence || '';
        const pop = getPopup();
        document.getElementById('wp-word').textContent = word;
        const trans = lookup(word);
        const transEl = document.getElementById('wp-trans');
        transEl.textContent = trans ? trans : '暂无本地释义，可直接加入生词本后补充笔记';
        pop.style.display = 'block';
        // 定位：防止超出视口
        const rect = pop.getBoundingClientRect();
        let left = x + 8, top = y + 12;
        if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
        if (top + rect.height > window.innerHeight - 10) top = window.innerHeight - rect.height - 10;
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
    }

    function hide() {
        const pop = getPopup();
        if (pop) pop.style.display = 'none';
    }

    function speak(text) {
        try {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-US';
            u.rate = 0.9;
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
        } catch (e) { /* 浏览器不支持时静默 */ }
    }

    // 点击文章中的单词（span.w）触发查询
    document.addEventListener('click', function (e) {
        const w = e.target.closest('span.w');
        if (!w) return;
        e.stopPropagation();
        const word = (w.dataset.w || w.textContent).replace(/[^A-Za-z'-]/g, '');
        if (!word) return;
        const p = w.closest('p');
        const sentence = p ? p.textContent.slice(0, 160) : '';
        show(word, e.clientX, e.clientY, sentence);
    });

    // 点击其他区域关闭浮层
    document.addEventListener('click', function (e) {
        const pop = getPopup();
        if (!pop || pop.style.display === 'none') return;
        if (pop.contains(e.target)) return;
        if (e.target.closest('span.w')) return;
        hide();
    });

    // 浮层按钮
    document.addEventListener('DOMContentLoaded', function () {
        const btnSpeak = document.getElementById('wp-speak');
        const btnAdd = document.getElementById('wp-add');
        const btnClose = document.getElementById('wp-close');
        if (btnSpeak) btnSpeak.addEventListener('click', function () { speak(currentWord); });
        if (btnClose) btnClose.addEventListener('click', hide);
        if (btnAdd) {
            btnAdd.addEventListener('click', function () {
                if (typeof Vocabulary === 'undefined' || !Vocabulary.add) { hide(); return; }
                const ok = Vocabulary.add({
                    word: currentWord,
                    trans: lookup(currentWord) || '',
                    source: currentSentence
                });
                if (ok) hide();
            });
        }
    });

    window.Dictionary = { lookup: lookup, show: show, hide: hide, speak: speak };
})();
