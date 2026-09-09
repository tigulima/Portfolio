/* Portfolio — Thiago Imai
   Porte vanilla da logica que rodava sobre o runtime do Claude Design.
   Mesmo comportamento, sem React/Babel: rotas, idioma, hero com scroll,
   reveal-on-scroll, o process scroller de 7 passos e a cortina de transicao. */
(function () {
  'use strict';

  var state = {
    route: 'home',
    lang: 'en',
    section: 'hero',
    showMore: false,
    menuOpen: false,
    pstep: 1,
    pdir: 'down'
  };

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- secao de processo --------------------------------------------------
  // So conta como processo o que segue o formato do Sleevee: cada etapa com a
  // sua foto e a sua descricao, num .ppanel. As outras formas que o design
  // deixou pelo caminho - a lista com os nomes das etapas e nada mais, ou o
  // texto de "Your words needed" - ficam ocultas ate serem escritas.
  //
  // O criterio e estrutural, entao um case que ganhar o processo depois passa a
  // mostra-lo sozinho, com quantas etapas tiver e com os nomes que tiver.
  function podarProcessos() {
    document.querySelectorAll(
      '[data-screen-label^="Case"] [style*="var(--col-narrow)"]'
    ).forEach(function (linha) {
      var pareceProcesso = linha.querySelector('ol') ||
                           linha.querySelector('[data-process-todo]');
      if (!pareceProcesso) return;                    // e outra linha qualquer
      if (linha.querySelector('.ppanel')) return;     // esta preenchida
      linha.hidden = true;
    });
  }

  // onN e resolvido contra a etapa atual em vez de sair de uma lista fixa, para
  // o processo aceitar quantas etapas o case tiver.
  function valorDe(chave, v) {
    var etapa = /^on(\d+)$/.exec(chave);
    if (etapa) return state.pstep === parseInt(etapa[1], 10);
    return v[chave];
  }

  // ---- valores derivados, o equivalente ao renderVals() do original --------
  function vals() {
    var r = state.route, s = state.section, cur = state.pstep;
    var v = {
      isHome: r === 'home',
      isEtique: r === 'etique',
      isCanario: r === 'canario',
      isSubtract: r === 'subtract',
      isSleevee: r === 'sleevee',
      isExtensionista: r === 'extensionista',
      isAnjo: r === 'anjo',

      showSpectrum: true,
      // os rotulos "On the App Store" / "Waiting on Apple" / "Built at work"
      // que separavam a lista por status: a secao work e uma lista unica
      groupByStatus: false,
      showPending: true,

      isEn: state.lang === 'en',
      isPt: state.lang === 'pt',
      enCls: state.lang === 'en' ? 'on' : '',
      ptCls: state.lang === 'pt' ? 'on' : '',

      menuCls: state.menuOpen ? 'nav-open' : '',
      moreCls: state.showMore ? 'more-open' : '',
      moreLabel: state.showMore ? 'Show less' : 'See more',

      atWork: r === 'home' ? s === 'work' : true,
      atAbout: r === 'home' && s === 'about',
      atExperience: r === 'home' && s === 'experience',
      atContact: r === 'home' && s === 'contact',

      pdir: state.pdir
    };
    return v;
  }

  // ---- aplica o estado no DOM ---------------------------------------------
  function render() {
    var v = vals();

    document.querySelectorAll('[data-if]').forEach(function (el) {
      el.hidden = !valorDe(el.getAttribute('data-if'), v);
    });
    document.querySelectorAll('[data-bind-active]').forEach(function (el) {
      if (v[el.getAttribute('data-bind-active')]) el.setAttribute('data-active', '');
      else el.removeAttribute('data-active');
    });
    document.querySelectorAll('[data-bind-on]').forEach(function (el) {
      el.setAttribute('data-on',
        valorDe(el.getAttribute('data-bind-on'), v) ? 'true' : 'false');
    });
    document.querySelectorAll('[data-bind-dir]').forEach(function (el) {
      el.setAttribute('data-dir', v[el.getAttribute('data-bind-dir')]);
    });
    document.querySelectorAll('[data-cls]').forEach(function (el) {
      var key = el.getAttribute('data-cls');
      var base = el.getAttribute('data-cls-base');
      if (base === null) {
        base = el.className.replace(/\s*\b(on|nav-open|more-open)\b\s*/g, ' ').trim();
        el.setAttribute('data-cls-base', base);
      }
      el.className = (base + ' ' + (v[key] || '')).trim();
    });
    document.querySelectorAll('[data-txt]').forEach(function (el) {
      var next = v[el.getAttribute('data-txt')];
      if (el.textContent !== next) el.textContent = next;
    });

    // o botao do menu: informa o estado a leitores de tela e e o que o CSS
    // usa para cruzar as duas barras
    var burger = document.querySelector('.navburger');
    if (burger) burger.setAttribute('aria-expanded', state.menuOpen ? 'true' : 'false');

    wireShots();
    applyLang();
    markReveal();
    sizeMore();
    requestAnimationFrame(sweepReveal);
  }

  // ---- traducao: troca os nos de texto, guardando o original --------------
  var origText = new Map();

  function applyLang() {
    var dict = window.PT_STRINGS || null;
    var pt = state.lang === 'pt';
    if (pt && !dict) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (pt) {
        var base = origText.has(n) ? origText.get(n) : n.nodeValue;
        var hit = dict[base.trim()];
        if (hit) {
          var next = base.match(/^\s*/)[0] + hit + base.match(/\s*$/)[0];
          if (!origText.has(n)) origText.set(n, n.nodeValue);
          if (n.nodeValue !== next) n.nodeValue = next;
        }
      } else if (origText.has(n)) {
        n.nodeValue = origText.get(n);
        origText.delete(n);
      }
    }
  }

  // ---- reveal on scroll: 20px de subida + fade, herdado do site de 2022 ----
  var pending = [];

  var REVEAL_GROUPS = [
    '#work > div > header, #work > div > div > div > p',
    '#work .rowstack, #work .sidewrap, #work > div > div > button, #work > div > div > div > a',
    '#about .letter',
    '#experience > div > header, #experience > div > div > div',
    '#contact > div > *',
    '[data-screen-label^="Case"] section[style*="surface-paper"] > div > div:not(.ptrack)',
    '[data-screen-label^="Case"] section[style*="surface-void"] > div > a[style*="radius-panels"]'
  ];

  function markReveal() {
    REVEAL_GROUPS.forEach(function (sel) {
      var k = 0;
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.dataset.rv) return;
        el.dataset.rv = '1';
        el.classList.add('rv');
        el.style.transitionDelay = Math.min(k * 60, 300) + 'ms';
        pending.push(el);
        k++;
      });
    });
  }

  // ultimo recurso: revela o que ainda estiver na fila, para nenhum bloco
  // ficar presoem opacity 0 porque a notificacao de scroll nunca chegou
  function revealAll() {
    pending.forEach(function (el) { el.classList.add('rv-in'); });
    pending = [];
  }

  function sweepReveal() {
    if (!pending.length) return;
    var h = window.innerHeight, rest = [];
    for (var i = 0; i < pending.length; i++) {
      var el = pending[i];
      if (el.dataset.rvWait) { rest.push(el); continue; }
      var r = el.getBoundingClientRect();
      if (r.top < h * 1.08 && r.bottom > -40) el.classList.add('rv-in');
      else if (r.bottom <= -40) el.classList.add('rv-in');
      else rest.push(el);
    }
    pending = rest;
  }

  // ---- "ver mais": anima a altura a partir do conteudo medido -------------
  var moreTimer;

  function sizeMore() {
    var w = document.querySelector('.morewrap');
    var inner = w && w.firstElementChild;
    if (!inner) return;
    var open = state.showMore, pad = 24;
    var from = w.getBoundingClientRect().height;
    var to = open ? inner.scrollHeight + pad : 0;
    if (Math.abs(to - from) < 1) { w.style.overflow = open ? 'visible' : 'hidden'; return; }
    w.style.overflow = 'hidden';
    clearInterval(moreTimer);
    var t0 = performance.now(), ms = 420;
    moreTimer = setInterval(function () {
      var k = Math.min((performance.now() - t0) / ms, 1);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var h = from + (to - from) * e;
      w.style.maxHeight = h + 'px';
      w.style.paddingTop = Math.min(h, pad) + 'px';
      if (k >= 1) {
        clearInterval(moreTimer);
        w.style.maxHeight = open ? 'none' : '0px';
        w.style.paddingTop = open ? pad + 'px' : '0px';
        w.style.overflow = open ? 'visible' : 'hidden';
      }
    }, 16);
  }

  // ---- carrossel de telas: um device por vez no celular, com bolinhas -----
  function wireShots() {
    document.querySelectorAll('.shots').forEach(function (row) {
      if (row.dataset.wired) return;
      row.dataset.wired = '1';
      var n = row.children.length;
      if (n < 2) return;
      var dots = document.createElement('div');
      dots.className = 'shotdots';
      for (var i = 0; i < n; i++) dots.appendChild(document.createElement('span'));
      row.after(dots);
      var sync = function () {
        var i = Math.round(row.scrollLeft /
          Math.max(1, row.scrollWidth - row.clientWidth) * (n - 1));
        Array.prototype.forEach.call(dots.children, function (d, k) {
          if (k === i) d.setAttribute('data-on', '');
          else d.removeAttribute('data-on');
        });
      };
      row.addEventListener('scroll', sync, { passive: true });
      sync();
    });
  }

  // ---- rolagem tweenada: scrollTo nativo trava dentro de alguns frames ----
  var snapTimer, snapping = false, navigating = false, navT, snapT, snapCool, lastP;

  function tweenScroll(to, ms, done) {
    var sc = document.scrollingElement || document.documentElement;
    clearInterval(snapTimer);
    snapping = false;
    var from = sc.scrollTop, t0 = performance.now();
    if (Math.abs(to - from) < 2) { if (done) done(); return; }
    snapping = true;
    snapTimer = setInterval(function () {
      var k = Math.min((performance.now() - t0) / ms, 1);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      sc.scrollTop = from + (to - from) * e;
      if (k >= 1) {
        clearInterval(snapTimer);
        snapping = false;
        if (done) done();
      }
    }, 16);
  }

  function scrollToId(id, offset) {
    setTimeout(function () {
      var sc = document.scrollingElement || document.documentElement;
      var el = document.getElementById(id);
      if (!el) { tweenScroll(0, 420); return; }
      var top = el.getBoundingClientRect().top + sc.scrollTop -
        (offset === undefined ? 90 : offset);
      navigating = true;
      clearTimeout(snapT);
      clearTimeout(navT);
      navT = setTimeout(function () { navigating = false; }, 700);
      tweenScroll(top < 0 ? 0 : top, 520);
    }, 60);
  }

  // ---- hero: a copy sai, os tres aparelhos entram ------------------------
  var wasNarrow = false;

  function driveHero() {
    var hero = document.getElementById('hero');
    var stage = hero && hero.querySelector('.herostage');
    if (!stage || hero.hidden) return;
    var travel = hero.offsetHeight - stage.offsetHeight;
    var p = travel > 0
      ? Math.min(Math.max(-hero.getBoundingClientRect().top / travel, 0), 1) : 0;
    var ease = function (t) { return t * t * (3 - 2 * t); };
    var narrow = window.innerWidth <= 760;
    var seg = function (a, b) {
      return ease(Math.min(Math.max((p - a) / (b - a), 0), 1));
    };
    var out = narrow ? seg(0, 0.2) : ease(Math.min(p / 0.45, 1));
    var inn = narrow ? seg(0.06, 0.25)
      : ease(Math.min(Math.max((p - 0.25) / 0.45, 0), 1));
    stage.style.setProperty('--copy-o', String(1 - out));
    stage.style.setProperty('--copy-y', String(out));
    stage.style.setProperty('--copy-pe', out > 0.6 ? 'none' : 'auto');
    stage.style.setProperty('--ph-o', String(inn));
    stage.style.setProperty('--ph-pe', inn > 0.995 ? 'auto' : 'none');

    if (narrow) {
      driveStack(stage, p);
      snapHero(hero, travel, p, 4);
      return;
    }
    if (wasNarrow) resetStack();
    wasNarrow = false;
    snapHero(hero, travel, p, 2);
  }

  // celular: os tres aparelhos sao uma pilha e cada passo tira o da frente
  function driveStack(stage, p) {
    wasNarrow = true;
    var cards = stage.querySelectorAll('.phones > a');
    if (!cards.length) return;
    var from = 0.25;
    var k = Math.min(Math.max((p - from) / (1 - from), 0), 1);
    var step = Math.min(Math.floor(k * cards.length), cards.length - 1);
    Array.prototype.forEach.call(cards, function (c, i) {
      var pos = i - step;
      var v = pos < 0 ? '-1' : String(Math.min(pos, 2));
      if (c.dataset.pos !== v) c.dataset.pos = v;
      var front = pos === 0 ? '1' : '0';
      if (c.dataset.front !== front) c.dataset.front = front;
    });
  }

  function resetStack() {
    document.querySelectorAll('.phones > a').forEach(function (c) {
      delete c.dataset.pos;
      delete c.dataset.front;
    });
  }

  // encaixa no fim mais proximo, para os aparelhos nunca ficarem pela metade
  function snapHero(hero, travel, p, slots) {
    if (travel <= 0 || snapping || navigating) return;
    var n = (slots || 2) - 1;
    var prev = lastP;
    lastP = p;
    if (snapCool && performance.now() < snapCool) { clearTimeout(snapT); return; }
    var edge = 0.06 / n;
    if (p <= edge || p >= 1 - edge) { clearTimeout(snapT); return; }
    if (prev == null || Math.abs(p - prev) < 0.002 / n) return;
    var up = p < prev;
    var cur = p * n;
    var target = (up ? Math.floor(cur - 0.001) : Math.ceil(cur + 0.001)) / n;
    clearTimeout(snapT);
    snapT = setTimeout(function () {
      var sc = document.scrollingElement || document.documentElement;
      var base = sc.scrollTop + hero.getBoundingClientRect().top;
      tweenScroll(base + Math.min(Math.max(target, 0), 1) * travel, 420, function () {
        snapCool = performance.now() + 420;
        lastP = null;
      });
    }, 160);
  }

  // ---- o processo se le sozinho conforme voce rola ------------------------
  function driveProcess() {
    var track = document.querySelector('.ptrack');
    var step = document.querySelector('.pstep');
    if (!track || !step || !track.offsetParent) return;
    var steps = step.parentElement.children.length;
    var stick = track.firstElementChild;
    var travel = track.offsetHeight - stick.offsetHeight;
    if (travel < innerHeight * 0.5) return; // solto (celular): o clique conduz
    var r = track.getBoundingClientRect();
    var p = -r.top / travel;
    var i = Math.min(steps, Math.max(1, Math.floor(p * steps) + 1));
    if (i !== state.pstep) {
      state.pdir = i > state.pstep ? 'down' : 'up';
      state.pstep = i;
      followStep(i);
      render();
    }
  }

  // celular: a tira de passos rola sozinha para o ativo ficar a vista
  function followStep(i) {
    var ol = document.querySelector('.pgrid > ol');
    if (!ol || ol.scrollWidth <= ol.clientWidth + 4) return;
    var li = ol.children[i - 1];
    if (!li) return;
    ol.scrollTo({
      left: li.offsetLeft - (ol.clientWidth - li.offsetWidth) / 2,
      behavior: 'smooth'
    });
  }

  function trackSection() {
    if (state.route !== 'home') return;
    var ids = ['hero', 'work', 'about', 'experience', 'contact'];
    var found = 'hero';
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= 160) found = id;
    });
    if (found !== state.section) { state.section = found; render(); }
  }

  // ---- cortina: as trocas de rota acontecem fora de vista -----------------
  var curtaining = false, curtA, curtB;

  function withCurtain(swap) {
    var c = document.querySelector('.curtain');
    if (!c || reduced || curtaining) { swap(); return; }
    curtaining = true;
    clearTimeout(curtA);
    clearTimeout(curtB);
    c.classList.remove('reveal');
    c.classList.add('cover');
    curtA = setTimeout(function () {
      swap();
      c.classList.remove('cover');
      c.classList.add('reveal');
      curtB = setTimeout(function () {
        c.classList.remove('reveal');
        curtaining = false;
      }, 480);
    }, 470);
  }

  var returnSlug = null;

  // ---- historico: cada case e uma entrada, para o voltar do navegador -----
  // O endereco usa hash e nao caminho de propriedade: o Firebase Hosting serve
  // arquivos estaticos, entao recarregar /etique daria 404 sem um rewrite.
  var SLUGS = ['etique', 'canario', 'subtract', 'sleevee', 'extensionista', 'anjo'];

  function routeFromUrl() {
    var h = (location.hash || '').replace(/^#/, '');
    return SLUGS.indexOf(h) !== -1 ? h : 'home';
  }

  function pushRoute(slug) {
    if (!window.history || !history.pushState) return;
    var url = slug === 'home'
      ? location.pathname + location.search
      : '#' + slug;
    history.pushState({ route: slug }, '', url);
  }

  // fromHistory: a mudanca ja veio do navegador, empilhar de novo criaria um laco
  function openCase(slug, fromHistory) {
    returnSlug = slug;
    if (!fromHistory) pushRoute(slug);
    withCurtain(function () {
      origText.clear();
      state.route = slug;
      render();
      window.scrollTo({ top: 0 });
    });
  }

  function backToWork(fromHistory) {
    var slug = returnSlug;
    if (!fromHistory) pushRoute('home');
    withCurtain(function () {
      origText.clear();
      state.route = 'home';
      state.section = 'work';
      render();
      scrollToId(slug ? 'row-' + slug : 'work', slug ? 200 : 90);
    });
  }

  function toSection(id) {
    if (state.route !== 'home') {
      pushRoute('home');
      origText.clear();
      state.route = 'home';
      state.section = id;
      render();
      scrollToId(id);
    } else {
      state.section = id;
      render();
      scrollToId(id);
    }
  }

  function goCases() {
    var hero = document.getElementById('hero');
    var stage = hero && hero.querySelector('.herostage');
    if (!stage) return toSection('work');
    var sc = document.scrollingElement || document.documentElement;
    var travel = hero.offsetHeight - stage.offsetHeight;
    navigating = true;
    clearTimeout(snapT);
    clearTimeout(navT);
    navT = setTimeout(function () { navigating = false; }, 700);
    tweenScroll(sc.scrollTop + hero.getBoundingClientRect().top + travel, 520);
  }

  // ---- acoes, enderecadas por data-act ------------------------------------
  var actions = {
    goHome: function () {
      if (state.route !== 'home') pushRoute('home');
      origText.clear();
      state.route = 'home';
      state.section = 'hero';
      render();
      window.scrollTo({ top: 0 });
    },
    goWork: function () { toSection('work'); },
    goAbout: function () { toSection('about'); },
    goExperience: function () { toSection('experience'); },
    goContact: function () { toSection('contact'); },
    goCases: goCases,
    backToWork: backToWork,

    setEn: function () { state.lang = 'en'; render(); },
    setPt: function () { state.lang = 'pt'; render(); },

    toggleMore: function () { state.showMore = !state.showMore; render(); },
    toggleMenu: function () { state.menuOpen = !state.menuOpen; render(); },

    menuWork: function () { state.menuOpen = false; toSection('work'); },
    menuAbout: function () { state.menuOpen = false; toSection('about'); },
    menuExperience: function () { state.menuOpen = false; toSection('experience'); },
    menuContact: function () { state.menuOpen = false; toSection('contact'); },
    menuEn: function () { state.lang = 'en'; state.menuOpen = false; render(); },
    menuPt: function () { state.lang = 'pt'; state.menuOpen = false; render(); }
  };

  ['etique', 'canario', 'subtract', 'sleevee', 'extensionista', 'anjo']
    .forEach(function (slug) {
      actions['go' + slug.charAt(0).toUpperCase() + slug.slice(1)] =
        function () { openCase(slug); };
    });

  // clique num passo do processo: pN, com N vindo do proprio atributo, para
  // nao depender de quantas etapas o case tem
  function irParaEtapa(n) {
    state.pdir = n > state.pstep ? 'down' : 'up';
    state.pstep = n;
    followStep(n);
    render();
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var etapa = /^p(\d+)$/.exec(act);
    if (etapa) {
      ev.preventDefault();
      irParaEtapa(parseInt(etapa[1], 10));
      return;
    }
    var fn = actions[act];
    if (!fn) return;
    ev.preventDefault();
    fn();
  });

  // ---- boot ---------------------------------------------------------------
  var sweepSeen = false;

  function onScroll() {
    sweepSeen = true;
    trackSection();
    driveHero();
    sweepReveal();
    driveProcess();
  }

  function init() {
    // a escala dos aparelhos do hero, que era uma prop do editor
    var hv = document.querySelector('[data-hero-vars]');
    if (hv) hv.style.setProperty('--ph-scale', '1.45');

    // antes do primeiro render: some com os processos ainda nao escritos
    podarProcessos();

    // o endereco manda na rota inicial, entao um link para um case abre nele
    var inicial = routeFromUrl();
    if (inicial !== 'home') {
      state.route = inicial;
      state.section = 'work';
      returnSlug = inicial;
    }
    if (window.history) {
      // o navegador restauraria a rolagem antes de a rota ser aplicada
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      if (history.replaceState) history.replaceState({ route: inicial }, '');
    }

    // voltar/avancar do navegador: aplica a rota do endereco sem reempilhar
    window.addEventListener('popstate', function () {
      var alvo = routeFromUrl();
      if (alvo === state.route) return;
      if (alvo === 'home') backToWork(true);
      else openCase(alvo, true);
    });

    render();
    driveHero();

    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    var lastTop = -1;
    (function tick() {
      var sc = document.scrollingElement || document.documentElement;
      if (sc.scrollTop !== lastTop) { lastTop = sc.scrollTop; onScroll(); }
      if (pending.length) sweepReveal();
      requestAnimationFrame(tick);
    })();

    // rAF nao roda em aba oculta nem em segundo plano; este timer e a unica
    // fonte que continua entregando, entao o hero nunca congela no meio
    var polledTop = -1;
    setInterval(function () {
      var sc = document.scrollingElement || document.documentElement;
      if (sc.scrollTop !== polledTop) { polledTop = sc.scrollTop; onScroll(); }
    }, 100);

    // se o sweep nunca teve a chance de rodar, nada fica invisivel
    var safety = setInterval(function () {
      clearInterval(safety);
      if (!sweepSeen) revealAll();
    }, 2600);

    // uma imagem que decodifica depois do bloco revelado entra seca:
    // segura o reveal ate a propria imagem estar pronta
    document.querySelectorAll('#work img, #about img').forEach(function (img) {
      if (img.complete) return;
      var owner = img.closest('.rv');
      if (!owner) return;
      owner.dataset.rvWait = '1';
      var done = function () { delete owner.dataset.rvWait; sweepReveal(); };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    });

    // a animacao de entrada tem 1,2s; depois disso, fixa o estado final
    setTimeout(function () { document.body.classList.add('anim-done'); }, 1400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
