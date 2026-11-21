/* GameCars - a static gallery for GitHub Pages.  Data: data/site.json (owner, files repository), data/games.json (the games),
   data/g/<slug>.json (the models of one game: [name, label, zip size, release tag, asset, thumbnail]), data/search.json (every model).
   The models themselves are zips in the GitHub Releases of the files repository: one release per game, one zip per model. */
const GC = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const SECTION = {cars: 'Cars', dlc: 'DLC cars', traffic: 'Traffic', other: 'Other vehicles', unused: 'Cut / unused', rims: 'Rims'};
  let SITE = null;

  const getJSON = (url) => fetch(url).then((r) => {
    if (!r.ok) throw new Error(url + ': ' + r.status);
    return r.json();
  });
  const fmtSize = (b) => !b ? '' : b < 1e6 ? Math.max(1, Math.round(b / 1e3)) + ' KB' : b < 1e9 ? (b / 1e6).toFixed(1) + ' MB' : (b / 1e9).toFixed(2) + ' GB';
  const files = () => `https://github.com/${SITE.owner}/${SITE.files_repo}`;
  const assetUrl = (tag, asset) => `${files()}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`;
  const releaseUrl = (tag) => `${files()}/releases/tag/${encodeURIComponent(tag)}`;

  function fail(err) {
    const box = el('div', 'error', 'Could not load the data of the page (' + err.message + '). ' +
      'Opened from the disk? Browsers block that: start a small web server in the site folder (python -m http.server) and open http://localhost:8000.');
    document.querySelector('main').prepend(box);
  }

  function card(name, label, size, tag, asset, thumb, extra) {
    const c = el('article', 'card');
    const pic = el('a', 'pic');
    pic.href = assetUrl(tag, asset);
    pic.title = 'Download ' + name;
    if (thumb) {
      const img = el('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = name;
      img.src = thumb;
      pic.append(img);
    } else {
      pic.append(el('div', 'noimg', 'no picture'));
    }
    const meta = el('div', 'meta');
    meta.append(el('div', 'name', name));
    if (label) meta.append(el('div', 'label', label));
    if (extra) meta.append(el('div', 'label', extra));
    const row = el('div', 'row');
    row.append(el('span', 'size', fmtSize(size)));
    const dl = el('a', 'dl', 'Download');
    dl.href = assetUrl(tag, asset);
    row.append(dl);
    meta.append(row);
    c.append(pic, meta);
    return c;
  }

  function footer() {
    const p = $('#foot-links');
    if (!p) return;
    const a = el('a', null, 'Files repository (all downloads)');
    a.href = files() + '/releases';
    p.append(a, document.createTextNode(' · updated ' + SITE.built));
  }

  async function home() {
    try {
      SITE = await getJSON('data/site.json');
      const games = await getJSON('data/games.json');
      footer();
      $('#stats').textContent = `${games.length} games · ${SITE.totals.models.toLocaleString('en')} models · ${fmtSize(SITE.totals.bytes)} of zips`;
      const box = $('#games');
      for (const g of games) {
        const a = el('a', 'game');
        a.href = 'game.html?g=' + encodeURIComponent(g.slug);
        const pic = el('div', 'cover');
        if (g.cover) {
          const img = el('img');
          img.loading = 'lazy';
          img.alt = g.title;
          img.src = g.cover;
          pic.append(img);
        }
        a.append(pic, el('h3', null, g.title), el('p', 'desc', g.desc),
          el('p', 'count', Object.entries(g.counts).map(([k, n]) => `${n} ${SECTION[k].toLowerCase()}`).join(' · ')));
        box.append(a);
      }
      const titles = Object.fromEntries(games.map((g) => [g.slug, g.title]));
      let index = null;
      const getIndex = async () => index || (index = await getJSON('data/search.json'));
      const tabs = $('#home-tabs');
      const views = {games: box, rims: $('#rims')};
      let view = 'games';
      let rimsReady = false;
      tabs.querySelectorAll('.tab').forEach((b) => {
        b.onclick = async () => {
          view = b.dataset.view;
          tabs.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
          for (const [k, v] of Object.entries(views)) v.classList.toggle('hidden', k !== view);
          if (view === 'rims' && !rimsReady) {
            rimsReady = true;
            await rimsView(games, titles, getIndex);
          }
        };
      });
      let timer = null;
      $('#q').addEventListener('input', (ev) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const q = ev.target.value.trim().toLowerCase();
          const res = $('#results');
          if (q.length < 2) {
            res.classList.add('hidden');
            tabs.classList.remove('hidden');
            views[view].classList.remove('hidden');
            return;
          }
          const all = await getIndex();
          const hits = all.filter((r) => r[2].toLowerCase().includes(q) || (r[3] && r[3].toLowerCase().includes(q))).slice(0, 300);
          $('#results-grid').replaceChildren(...hits.map((r) => card(r[2], r[3], r[7], r[5], r[6], r[4], `${titles[r[0]]} · ${SECTION[r[1]]}`)));
          $('#results-title').textContent = hits.length ? `${hits.length}${hits.length === 300 ? '+' : ''} found` : 'Nothing found';
          res.classList.remove('hidden');
          tabs.classList.add('hidden');
          for (const v of Object.values(views)) v.classList.add('hidden');
        }, 200);
      });
    } catch (err) {
      fail(err);
    }
  }

  async function rimsView(games, titles, getIndex) {
    const rims = (await getIndex()).filter((r) => r[1] === 'rims');
    const sel = $('#rim-game');
    const counts = {};
    rims.forEach((r) => { counts[r[0]] = (counts[r[0]] || 0) + 1; });
    sel.append(new Option(`All games (${rims.length})`, ''));
    for (const g of games) {
      if (counts[g.slug]) sel.append(new Option(`${g.title} (${counts[g.slug]})`, g.slug));
    }
    const grid = $('#rim-grid');
    const more = $('#rim-more');
    const page = 240;
    let list = [];
    let shown = 0;
    const draw = (reset) => {
      if (reset) {
        const g = sel.value;
        const f = $('#rim-filter').value.trim().toLowerCase();
        list = rims.filter((r) => (!g || r[0] === g) && (!f || r[2].toLowerCase().includes(f)));
        grid.replaceChildren();
        shown = 0;
      }
      const next = list.slice(shown, shown + page);
      grid.append(...next.map((r) => card(r[2], r[3], r[7], r[5], r[6], r[4], titles[r[0]])));
      shown += next.length;
      $('#rim-shown').textContent = `${shown} of ${list.length}`;
      more.classList.toggle('hidden', shown >= list.length);
    };
    sel.onchange = () => draw(true);
    let timer = null;
    $('#rim-filter').addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => draw(true), 150);
    });
    more.onclick = () => draw(false);
    draw(true);
  }

  async function game() {
    try {
      SITE = await getJSON('data/site.json');
      footer();
      const slug = new URLSearchParams(location.search).get('g');
      if (!slug) {
        location.href = './';
        return;
      }
      const g = await getJSON('data/g/' + encodeURIComponent(slug) + '.json');
      document.title = g.title + ' - GameCars';
      $('#title').textContent = g.title;
      $('#desc').textContent = g.desc;
      $('#counts').textContent = g.sections.map((s) => `${s.items.length} ${s.label.toLowerCase()}`).join(' · ');
      const bulk = $('#bulk');
      bulk.append(el('span', null, 'Everything of this game: '));
      g.tags.forEach((t, i) => {
        const a = el('a', null, g.tags.length > 1 ? `release page ${i + 1}` : 'release page');
        a.href = releaseUrl(t);
        bulk.append(a);
        if (i < g.tags.length - 1) bulk.append(document.createTextNode(' · '));
      });
      for (const x of g.extras) {
        bulk.append(document.createTextNode(' · '));
        const a = el('a', null, `${x.label} (${fmtSize(x.size)})`);
        a.href = assetUrl(x.tag, x.asset);
        bulk.append(a);
      }
      bulk.append(el('br'), document.createTextNode('All at once with the GitHub CLI: '),
        el('code', null, g.tags.map((t) => `gh release download ${t} -R ${SITE.owner}/${SITE.files_repo}`).join(' ; ')));
      const notes = $('#notes');
      for (const line of g.notes) notes.append(el('p', null, line));

      let current = g.sections[0];
      let filter = '';
      let sort = 'name';
      const tabs = $('#tabs');
      const grid = $('#grid');
      const draw = () => {
        if (!current) return;
        let rows = current.items.filter((r) => !filter || r[0].toLowerCase().includes(filter) || (r[1] && r[1].toLowerCase().includes(filter)));
        rows = rows.slice().sort(sort === 'size' ? (a, b) => b[2] - a[2] : (a, b) => a[0].localeCompare(b[0], 'en', {numeric: true}));
        grid.classList.toggle('small', current.key === 'rims');
        grid.replaceChildren(...rows.map((r) => card(r[0], r[1], r[2], r[3], r[4], r[5])));
        $('#shown').textContent = `${rows.length} of ${current.items.length}`;
      };
      for (const s of g.sections) {
        const b = el('button', 'tab', `${s.label} (${s.items.length})`);
        b.onclick = () => {
          current = s;
          [...tabs.children].forEach((x) => x.classList.toggle('on', x === b));
          draw();
        };
        tabs.append(b);
      }
      if (tabs.firstChild) tabs.firstChild.classList.add('on');
      if (g.sections.length < 2) tabs.classList.add('hidden');
      let timer = null;
      $('#filter').addEventListener('input', (ev) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          filter = ev.target.value.trim().toLowerCase();
          draw();
        }, 150);
      });
      $('#sort').addEventListener('change', (ev) => {
        sort = ev.target.value;
        draw();
      });
      draw();
    } catch (err) {
      fail(err);
    }
  }

  return {home, game};
})();
