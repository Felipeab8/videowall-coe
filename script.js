// ============================================
// RELÓGIO / ÚLTIMA ATUALIZAÇÃO
// ============================================
function updateLiveTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const liveTime = document.getElementById('liveTime');
    if (liveTime) {
        liveTime.textContent = `ÚLTIMA ATUALIZAÇÃO: ${hours}:${minutes}:${seconds}`;
    }
}

setInterval(updateLiveTime, 1000);
updateLiveTime();

const menuItems = document.querySelectorAll('.menu-item');

// O editor pode criar, remover e recarregar telas inteiras, entao a lista
// e consultada na hora: uma NodeList fixa ficaria apontando para o passado.
function allScreens() {
    return document.querySelectorAll('.screen');
}
const btnClaro = document.getElementById('btnClaro');
const btnEditar = document.getElementById('btnEditar');
const btnLive = document.getElementById('btnLive');

function isEditing() {
    return document.body.classList.contains('edit-mode');
}

// ============================================
// NAVEGAÇÃO ENTRE TELAS
// ============================================
menuItems.forEach((item) => {
    item.addEventListener('click', () => {
        const screenIndex = item.getAttribute('data-screen');
        const target = document.getElementById('screen-' + screenIndex);
        // tela apagada no editor: sem destino, trocar so deixaria a area
        // em branco — melhor ficar onde esta e avisar.
        if (!target) return;
        menuItems.forEach((m) => m.classList.remove('active'));
        allScreens().forEach((s) => s.classList.remove('active'));
        item.classList.add('active');
        target.classList.add('active');
        syncMenuGroups();
        setAlertsPage(false);
        if (isMobile()) setSidebarCollapsed(true, false);
        scheduleFit();
    });
});

// Visao geral: cards e alertas levam a tela da area. Delegado no
// documento porque o editor pode remontar o palco inteiro; reaproveita
// o clique do item do menu para manter grupo, gaveta e escala em dia.
document.addEventListener('click', (ev) => {
    const alvo = ev.target.closest('[data-goto]');
    if (!alvo || isEditing()) return;
    const item = document.querySelector('.menu-item[data-screen="' + alvo.getAttribute('data-goto') + '"]');
    if (!item) return;
    item.click();
    const grupo = item.closest('.menu-group');
    if (grupo) openOnlyGroup(grupo);
});

// ============================================
// MENU EM GRUPOS
// Cada área abre dois destinos: a tela de dados e a tela da câmera.
// ============================================
const menuGroups = document.querySelectorAll('.menu-group');

function setGroupOpen(group, open) {
    group.classList.toggle('is-open', open);
    const parent = group.querySelector('.menu-parent');
    const submenu = group.querySelector('.submenu');
    if (parent) parent.setAttribute('aria-expanded', String(open));
    if (submenu) submenu.hidden = !open;
}

// um grupo aberto por vez: o menu inteiro continua cabendo sem rolagem
function openOnlyGroup(group) {
    menuGroups.forEach((g) => setGroupOpen(g, g === group));
}

function syncMenuGroups() {
    menuGroups.forEach((g) => {
        g.classList.toggle('is-current', !!g.querySelector('.menu-item.active'));
    });
}

document.querySelectorAll('.menu-parent').forEach((parent) => {
    parent.addEventListener('click', () => {
        const group = parent.closest('.menu-group');
        if (!group) return;

        // clicar de novo no grupo aberto apenas recolhe, sem trocar de tela
        if (group.classList.contains('is-open')) {
            setGroupOpen(group, false);
            scheduleFit();
            return;
        }

        openOnlyGroup(group);
        const tela = group.querySelector('.menu-item');
        if (tela && !tela.classList.contains('active')) tela.click();
        else scheduleFit();
    });
});

// abre o grupo da tela que já está no ar
const itemAtivo = document.querySelector('.menu-item.active');
if (itemAtivo && itemAtivo.closest('.menu-group')) {
    openOnlyGroup(itemAtivo.closest('.menu-group'));
}
syncMenuGroups();

// ============================================
// CELULAR
// Abaixo de 768px o CSS desliga a escala fluida e a pagina rola por
// inteiro; aqui o script acompanha: sem ajuste de escala e com o menu
// de telas em gaveta (comeca fechado, fecha ao escolher uma tela).
// ============================================
const mobileQuery = window.matchMedia('(max-width: 768px)');

function isMobile() {
    return mobileQuery.matches;
}

// O cabecalho quebra em duas linhas no celular; a gaveta do menu precisa
// da altura real dele, medida aqui (--header-real), nao da travada no CSS.
const headerEl = document.querySelector('.header');

function measureHeader() {
    if (!headerEl) return;
    document.documentElement.style.setProperty('--header-real', headerEl.offsetHeight + 'px');
}

window.addEventListener('resize', measureHeader);
window.addEventListener('load', measureHeader);
measureHeader();

// ============================================
// AJUSTE À TELA (qualquer resolução, sem rolagem)
// O CSS já escala tudo proporcionalmente pela variável --fit.
// Aqui vem a rede de segurança: se a tela ativa ainda transbordar
// (monitor baixo demais, texto editado, tabela mais longa), a raiz
// encolhe em passos até o conteúdo caber — ou até o piso, quando
// o excesso passa a ser resolvido pela rolagem interna do bloco.
// ============================================
const FIT_FLOOR = 0.62;   // não encolhe além disso: legibilidade à distância
const FIT_STEP = 0.96;    // ~4% por passo
const FIT_SLACK = 2;      // folga em px para ignorar arredondamento

function fitTargets() {
    const active = alertsPageOpen()
        ? alertsPage
        : document.querySelector('.screen.active');
    if (!active) return [];
    // .table-scroll--livre rola por dentro em vez de encolher a tela inteira
    // (lista longa de caminhoes): fica fora da conta. Bloco com overflow
    // visivel tambem sai: o que passa dele ja aparece na medida da tela, e
    // um menu aberto por cima (contratos da expedicao) nao e transbordo.
    const blocos = active.querySelectorAll('.content-section:not(.content-section--livre), .table-scroll:not(.table-scroll--livre), .alerts-list, .geral-grid');
    return [active, ...Array.prototype.filter.call(blocos, (el) => getComputedStyle(el).overflowY !== 'visible')];
}

function fitOverflow(targets) {
    let worst = 0;
    for (const el of targets) {
        const over = el.scrollHeight - el.clientHeight;
        if (over > worst) worst = over;
    }
    return worst;
}

let fitPending = false;

function fitToScreen() {
    fitPending = false;
    const root = document.documentElement;
    root.style.setProperty('--fit-adjust', '1');

    // no celular a pagina rola inteira: nada para encolher
    if (isMobile()) return;

    const targets = fitTargets();
    if (!targets.length) return;

    let scale = 1;
    while (scale > FIT_FLOOR && fitOverflow(targets) > FIT_SLACK) {
        scale *= FIT_STEP;
        root.style.setProperty('--fit-adjust', scale.toFixed(4));
    }
}

function scheduleFit() {
    if (fitPending) return;
    fitPending = true;
    requestAnimationFrame(fitToScreen);
}

window.addEventListener('resize', scheduleFit);
window.addEventListener('load', scheduleFit);
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleFit);
}

// ============================================
// MENU RECOLHÍVEL (tela cheia)
// No celular o mesmo estado vira gaveta: aberta por cima da tela,
// com fundo escurecido, sem lembrar a escolha entre visitas.
// ============================================
const SIDEBAR_STORAGE_KEY = 'videowall:sidebar-collapsed';
const btnSidebarToggle = document.getElementById('btnSidebarToggle');
const btnSidebarReveal = document.getElementById('btnSidebarReveal');
const btnMenuMobile = document.getElementById('btnMenuMobile');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

function setSidebarCollapsed(collapsed, persist = true) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);

    if (btnSidebarToggle) {
        btnSidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    }
    if (btnSidebarReveal) {
        btnSidebarReveal.setAttribute('aria-expanded', String(!collapsed));
        btnSidebarReveal.tabIndex = collapsed ? 0 : -1;
    }
    if (btnMenuMobile) {
        btnMenuMobile.setAttribute('aria-expanded', String(!collapsed));
    }
    if (sidebarBackdrop) {
        sidebarBackdrop.hidden = collapsed || !isMobile();
    }

    if (!persist || isMobile()) return;
    try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    } catch (err) {
        /* armazenamento indisponível: segue apenas em memória */
    }
}

function toggleSidebar() {
    setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    scheduleFit();
}

if (btnSidebarToggle) {
    btnSidebarToggle.addEventListener('click', toggleSidebar);
}

if (btnSidebarReveal) {
    btnSidebarReveal.addEventListener('click', toggleSidebar);
}

if (btnMenuMobile) {
    btnMenuMobile.addEventListener('click', toggleSidebar);
}

if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => setSidebarCollapsed(true, false));
}

document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key !== 'b' && event.key !== 'B') return;
    event.preventDefault();
    toggleSidebar();
});

function sidebarStoredCollapsed() {
    try {
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
    } catch (err) {
        return false;
    }
}

// celular: gaveta sempre fechada ao abrir; desktop: como ficou da ultima vez
setSidebarCollapsed(isMobile() || sidebarStoredCollapsed(), false);

// girar o aparelho ou redimensionar a janela cruza o corte: reaplica o padrao
const onMobileChange = () => {
    setSidebarCollapsed(isMobile() || sidebarStoredCollapsed(), false);
    scheduleFit();
};
if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', onMobileChange);
else if (mobileQuery.addListener) mobileQuery.addListener(onMobileChange);

// ============================================
// PÁGINA DE ALERTAS (funcionalidade acessada pelo cabeçalho)
// ============================================
let alertsPage = document.getElementById('alertsPage');
const btnAlertas = document.getElementById('btnAlertas');
const btnFecharAlertas = document.getElementById('btnFecharAlertas');
const alertsBadge = document.getElementById('alertsBadge');

function alertsPageOpen() {
    return !!alertsPage && !alertsPage.hidden;
}

function refreshAlertsBadge() {
    if (!alertsPage) return;
    const items = alertsPage.querySelectorAll('.alerts-list .alert-item');
    const critical = alertsPage.querySelectorAll('.alerts-list .alert-critical').length;
    if (alertsBadge) alertsBadge.textContent = String(items.length);
    if (btnAlertas) {
        btnAlertas.classList.toggle('has-critical', critical > 0);
        btnAlertas.setAttribute('title', items.length === 1
            ? '1 alerta ativo'
            : items.length + ' alertas ativos');
    }
}

function setAlertsPage(open) {
    if (!alertsPage) return;
    alertsPage.hidden = !open;
    document.body.classList.toggle('alerts-open', open);
    if (btnAlertas) {
        btnAlertas.classList.toggle('active', open);
        btnAlertas.setAttribute('aria-expanded', String(open));
    }
    if (open) {
        if (isMobile()) setSidebarCollapsed(true, false);
        refreshAlertsBadge();
        alertsPage.scrollIntoView({ block: 'start' });
    }
    scheduleFit();
}

if (btnAlertas) {
    btnAlertas.addEventListener('click', () => setAlertsPage(!alertsPageOpen()));
}

if (btnFecharAlertas) {
    btnFecharAlertas.addEventListener('click', () => setAlertsPage(false));
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && alertsPageOpen()) setAlertsPage(false);
});

refreshAlertsBadge();

document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const btn = event.target.closest('.flow-btn');
    if (!btn) return;
    event.stopPropagation();
    if (isEditing()) return;
    const group = btn.parentElement;
    if (group) group.querySelectorAll('.flow-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
});

// ============================================
// TABELA AGRUPADA: recolher / expandir unidade
// ============================================
document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const btn = event.target.closest('.row-toggle');
    if (!btn) return;
    event.stopPropagation();
    const row = btn.closest('tr');
    if (!row) return;

    const key = row.dataset.group;
    const collapsed = row.classList.toggle('is-collapsed');
    btn.textContent = collapsed ? '+' : '−';
    btn.setAttribute('aria-expanded', String(!collapsed));

    document.querySelectorAll('tr[data-parent="' + key + '"]').forEach((child) => {
        child.hidden = collapsed;
    });
    scheduleFit();
});

// ============================================
// TEMA
// ============================================
const ICON_SUN = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<circle cx="12" cy="12" r="4"></circle>'
    + '<path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41"></path>'
    + '</svg>';

const ICON_MOON = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
    + '</svg>';

function updateThemeButtonLabel() {
    if (!btnClaro) return;
    const isLight = document.body.classList.contains('theme-light');
    btnClaro.innerHTML = (isLight ? ICON_MOON : ICON_SUN)
        + '<span>' + (isLight ? 'ESCURO' : 'CLARO') + '</span>';
    btnClaro.setAttribute('aria-label', isLight ? 'Ativar modo escuro' : 'Ativar modo claro');
    btnClaro.setAttribute('title', isLight ? 'Ativar modo escuro' : 'Ativar modo claro');
}

function setHeaderTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme);
    updateThemeButtonLabel();
}

function toggleTheme() {
    const nextTheme = document.body.classList.contains('theme-light') ? 'theme-dark' : 'theme-light';
    setHeaderTheme(nextTheme);
}

// ============================================
// EDIÇÃO DE TEXTO (nomes, rótulos e valores)
// ============================================
// So vale o que esta dentro do palco (.content): o cabecalho e o menu de
// telas ficam de fora da edicao — alem de nao serem conteudo de tela, eles
// nao entram no layout salvo, entao qualquer troca ali se perdia no reload.
const EDITABLE_SELECTORS = [
    '.screen-badge',
    '.screen-title-section h2',
    '.screen-meta',
    '.kpi-label',
    '.kpi-value',
    '.kpi-tag-rotulo',
    '.kpi-label-small',
    '.kpi-value-small',
    '.kpi-breakdown-label',
    '.kpi-breakdown-value',
    '.grao-metric-name',
    '.grao-metric-value',
    '.content-section h3',
    '.flow-section h3',
    '.subsection-title',
    '.data-table th',
    '.data-table td',
    '.flow-btn',
    '.alert-title',
    '.alert-time',
    '.status-item span',
    '.status-label',
    '.status-indicator',
    '.status-value',
    '.summary-number',
    '.summary-label',
    '.progress-label',
    '.moega-name',
    '.moega-cargas-tabela th',
    '.moega-cargas-tabela td',
    '.silo-name',
    '.silo-temp',
    '.silo-volume',
    '.silo-percent',
    '.hour-label',
    '.hour-value',
    '.stack-label',
    '.stack-value',
    '.stack-hint',
    '.legend-item',
    '.forecast-stat-label',
    '.forecast-stat-value',
    '.forecast-cap',
    '.forecast-day',
    '.forecast-yaxis span',
    '.forecast-unit',
    '.kpi-flag',
    '.kpi-meta-ref',
    '.moega-tipo',
    '.moega-cultura',
    '.moega-cargas-total',
    '.moega-dado-label',
    '.moega-dado-sub',
    '.moega-dado-value',
    '.silo-group-name',
    '.silo-group-total',
    '.camera-name',
    '.camera-state',
    '.pv-temp',
    '.pv-cond',
    '.pv-agora-ref',
    '.pv-local-txt b',
    '.pv-local-txt small',
    '.pv-agora-cidade b',
    '.pv-agora-cidade small',
    '.pv-fact',
    '.pv-meteo-h',
    '.pv-meteo-t',
    '.pv-meteo-p',
    '.pv-meteo-mm',
    '.pv-horas-nota',
    '.pv-tag',
    '.pv-tabela td',
    '.pv-acum-item b',
    '.pv-acum-item span',
    '.secador-nome',
    '.secador-tipo',
    '.secador-estado-info',
    '.secador-ponto-nome',
    '.secador-bloco-nome',
    '.secador-col-titulo',
    '.secador-dado b',
    '.secador-dado small',
    '.secador-ponto-nota',
    '.secador-agora-titulo',
    '.secador-cultura',
    '.secador-estado-label',
    '.secador-estado-pill',
    '.secador-setada-tag',
    '.secador-agora-label',
    '.secador-leitura-nome',
    '.secador-leitura-valor',
    '.secador-leitura-ref',
    '.serie-tag',
    '.secador-horas span',
    '.secador-eixo span',
    '.secador-eixo-cap',
    '.serie-legenda-item',
    '.rank-nome',
    '.rank-valor',
    '.donut-nome',
    '.donut-valor',
    '.donut-total',
    '.donut-unidade',
    '.donut-titulo',
    '.nota-texto',
    '.linha-eixo span',
    '.prod-secador-volume',
    '.prod-secador-meta',
    '.prod-secador-percent',
    '.prod-linha-item',
    '.forecast-meta-line span'
];

// Cada informacao tambem anda de lugar: todo texto editavel vira um bloco
// arrastavel proprio. Ficam de fora os que quebrariam a estrutura ou que ja
// se movem por outro caminho.
const TEXTO_NAO_MOVEL = [
    '.data-table th',        // moveria a coluna inteira do lugar
    '.data-table td',        // a linha ja se arrasta inteira
    '.moega-cargas-tabela th',
    '.moega-cargas-tabela td',
    '.forecast-yaxis span',  // eixo e escala, nao informacao solta
    '.linha-eixo span',
    '.forecast-cap',         // vive dentro da barra que se arrasta pelo valor
    '.flow-btn'              // ja tem grupo proprio
];

const TEXTO_MOVEL = EDITABLE_SELECTORS.filter(function (sel) {
    return TEXTO_NAO_MOVEL.indexOf(sel) === -1;
});

// A alca mora dentro do proprio texto; ler ou reescrever o conteudo precisa
// passar por aqui para nao engolir (nem virar texto) o simbolo de arraste.
function textoSemAlca(el) {
    if (!el) return '';
    const acoes = el.querySelector(':scope > .block-actions');
    if (!acoes) return el.textContent;
    return Array.prototype.filter.call(el.childNodes, function (no) {
        return no !== acoes;
    }).map(function (no) {
        return no.textContent;
    }).join('');
}

function escreverTexto(el, texto) {
    if (!el) return;
    const acoes = el.querySelector(':scope > .block-actions');
    el.textContent = texto;
    if (acoes) el.insertBefore(acoes, el.firstChild);
}

// A edicao vive dentro do palco; fora dele nada vira editavel.
function raizEdicao() {
    return document.querySelector('.content');
}

function applyTextEditing(enabled) {
    // limpa sempre no documento inteiro: assim nao sobra campo editavel
    // de um layout antigo nem tabindex preso em botao de verdade.
    document.querySelectorAll('[data-editable]').forEach((element) => {
        element.classList.remove('editable');
        element.removeAttribute('contenteditable');
        element.removeAttribute('spellcheck');
        element.removeAttribute('tabindex');
        element.removeAttribute('data-editable');
    });

    const raiz = enabled ? raizEdicao() : null;
    if (!raiz) return;

    EDITABLE_SELECTORS.forEach((selector) => {
        raiz.querySelectorAll(selector).forEach((element) => {
            if (!(element instanceof HTMLElement)) return;
            if (element.tagName === 'BUTTON' && !element.classList.contains('flow-btn')) return;
            if (element.classList.contains('screen-badge') && element.querySelector('svg')) return;

            element.classList.add('editable');
            element.contentEditable = 'true';
            element.spellcheck = false;
            element.tabIndex = 0;
            element.setAttribute('data-editable', 'true');
        });
    });
}

// ============================================
// EDIÇÃO DE LUGAR (arrastar e soltar)
// ============================================
const DRAG_CONFIG = [
    { selector: '.screen > div:not(.screen-header), .alerts-page > div:not(.screen-header)', group: 'bloco', section: true },
    { selector: '.split-grid > .content-section', group: 'painel' },
    { selector: '.kpi-card', group: 'kpi' },
    { selector: '.kpi-card-small', group: 'kpi-small' },
    { selector: '.secador', group: 'secador' },
    { selector: '.secador-ponto', group: 'secador-dado' },
    { selector: '.secador-bloco', group: 'secador-dado' },
    { selector: '.secador-leitura', group: 'secador-leitura' },
    { selector: '.silo-group', group: 'silo-cultura' },
    { selector: '.silo-item', group: 'silo' },
    { selector: '.moega-item', group: 'moega' },
    { selector: '.weather-day', group: 'previsao-dia' },
    { selector: '.weather-city', group: 'previsao-cidade' },
    { selector: '.hour-item', group: 'hora' },
    { selector: '.alert-item', group: 'alerta' },
    { selector: '.summary-card', group: 'resumo' },
    { selector: '.forecast-stat', group: 'resumo-previsao' },
    { selector: '.status-item', group: 'status' },
    { selector: '.status-row', group: 'status-linha' },
    { selector: '.flow-btn', group: 'fluxo' },
    { selector: '.stack-row', group: 'barra' },
    { selector: '.data-table tbody tr', group: 'linha', inline: true },
    // graficos inteiros e listas: dao para mover e remover como qualquer bloco
    { selector: '.forecast-chart', group: 'grafico' },
    { selector: '.linha-chart', group: 'grafico' },
    { selector: '.secador-chart', group: 'grafico' },
    { selector: '.donut-card', group: 'grafico' },
    { selector: '.table-scroll', group: 'grafico' },
    { selector: '.status-bar', group: 'grafico' },
    { selector: '.rank-list', group: 'grafico' },
    { selector: '.silo-grid', group: 'grafico' },
    { selector: '.secador-list', group: 'grafico' },
    { selector: '.prod-secador-list', group: 'grafico' },
    { selector: '.chart-legend', group: 'grafico' },
    { selector: '.rank-item', group: 'rank' },
    { selector: '.prod-secador', group: 'prod-secador' },
    // pedacos finos: alca compacta para nao cobrir a barra
    { selector: '.forecast-col', group: 'coluna', mini: true },
    { selector: '.hora-col', group: 'coluna', mini: true },
    { selector: '.donut-item', group: 'fatia', mini: true },
    // por ultimo: rotulo, numero e legenda soltos, so com a alca de mover
    { selector: TEXTO_MOVEL.join(', '), group: 'info', texto: true }
];

const DROP_CLASSES = ['drop-h-before', 'drop-h-after', 'drop-v-before', 'drop-v-after'];

let dragged = null;
let dropInfo = null;

function clearDropMarkers() {
    document.querySelectorAll('.' + DROP_CLASSES.join(', .')).forEach((el) => {
        el.classList.remove.apply(el.classList, DROP_CLASSES);
    });
    dropInfo = null;
}

function releaseDraggable() {
    document.querySelectorAll('[draggable="true"]').forEach((el) => el.removeAttribute('draggable'));
}

function criarBotaoBloco(acao, texto, titulo) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'block-btn block-btn--' + acao;
    btn.dataset.blocoAcao = acao;
    btn.textContent = texto;
    btn.title = titulo;
    btn.contentEditable = 'false';
    btn.tabIndex = -1;
    return btn;
}

function setupDragHandles(enabled) {
    document.querySelectorAll('.block-actions').forEach((barra) => barra.remove());
    document.querySelectorAll('.drag-handle').forEach((handle) => handle.remove());
    document.querySelectorAll('[data-drag-group]').forEach((el) => {
        el.removeAttribute('data-drag-group');
        el.removeAttribute('draggable');
        el.classList.remove('is-dragging');
    });
    clearDropMarkers();

    const raiz = enabled ? raizEdicao() : null;
    if (!raiz) return;

    DRAG_CONFIG.forEach((cfg) => {
        raiz.querySelectorAll(cfg.selector).forEach((el) => {
            if (el.dataset.dragGroup) return;
            const host = cfg.inline ? el.querySelector('td, th') : el;
            if (!host) return;

            el.dataset.dragGroup = cfg.group;

            const handle = document.createElement('span');
            handle.className = 'drag-handle'
                + (cfg.section ? ' drag-handle--section' : '')
                + (cfg.inline ? ' drag-handle--inline' : '');
            handle.textContent = '⠿';
            handle.title = cfg.texto ? 'Arraste para mover esta informação' : 'Arraste para mover';
            handle.contentEditable = 'false';

            const acoes = document.createElement('div');
            acoes.className = 'block-actions'
                + (cfg.section ? ' block-actions--section' : '')
                + (cfg.inline ? ' block-actions--inline' : '')
                + (cfg.mini ? ' block-actions--mini' : '')
                + (cfg.texto ? ' block-actions--texto' : '');
            acoes.contentEditable = 'false';
            acoes.appendChild(handle);
            // no texto miúdo só cabe a alça: apagar sai pelo Del e duplicar
            // continua nos botões do bloco que segura a informação.
            if (!cfg.texto) {
                if (el.dataset.comp) {
                    acoes.appendChild(criarBotaoBloco('config', '⚙', 'Configurar este componente'));
                }
                acoes.appendChild(criarBotaoBloco('duplicar', '⧉', 'Duplicar'));
                acoes.appendChild(criarBotaoBloco('remover', '✕', 'Remover'));
            }
            host.insertBefore(acoes, host.firstChild);
        });
    });
}

function isHorizontal(parent) {
    if (!parent) return false;
    const cs = getComputedStyle(parent);
    if (cs.display.indexOf('flex') !== -1) return cs.flexDirection.indexOf('row') === 0;
    if (cs.display.indexOf('grid') !== -1) {
        return cs.gridTemplateColumns.split(' ').filter(Boolean).length > 1;
    }
    return false;
}

function findDropTarget(node) {
    let el = node instanceof Element ? node : null;
    while (el) {
        if (el.dataset && el.dataset.dragGroup && el !== dragged && !dragged.contains(el)) {
            const sameParent = el.parentElement === dragged.parentElement;
            const sameGroup = el.dataset.dragGroup === dragged.dataset.dragGroup;
            if (sameParent || sameGroup) return el;
        }
        el = el.parentElement;
    }
    return null;
}

document.addEventListener('mousedown', (e) => {
    if (!(e.target instanceof Element)) return;
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const block = handle.closest('[data-drag-group]');
    if (block) block.setAttribute('draggable', 'true');
});

document.addEventListener('mouseup', releaseDraggable);

document.addEventListener('dragstart', (e) => {
    if (!isEditing() || !(e.target instanceof Element)) return;
    const block = e.target.closest('[data-drag-group]');
    if (!block || block.getAttribute('draggable') !== 'true') return;

    dragged = block;
    block.classList.add('is-dragging');
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', 'mover');
    }
});

document.addEventListener('dragover', (e) => {
    if (!dragged) return;
    clearDropMarkers();

    const target = findDropTarget(e.target);
    if (!target) return;

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const horizontal = isHorizontal(target.parentElement);
    const rect = target.getBoundingClientRect();
    const before = horizontal
        ? e.clientX < rect.left + rect.width / 2
        : e.clientY < rect.top + rect.height / 2;

    target.classList.add(horizontal
        ? (before ? 'drop-h-before' : 'drop-h-after')
        : (before ? 'drop-v-before' : 'drop-v-after'));

    dropInfo = { target: target, before: before };
});

document.addEventListener('drop', (e) => {
    if (!dragged || !dropInfo) return;
    e.preventDefault();

    const target = dropInfo.target;
    const parent = target.parentElement;
    if (parent) {
        if (dropInfo.before) parent.insertBefore(dragged, target);
        else parent.insertBefore(dragged, target.nextSibling);
    }

    dragged.classList.remove('is-dragging');
    dragged = null;
    clearDropMarkers();
    releaseDraggable();
});

document.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('is-dragging');
    dragged = null;
    clearDropMarkers();
    releaseDraggable();
});

// ============================================
// EDIÇÃO DOS GRÁFICOS (barras, silos e horas)
// ============================================
const BAR_CONFIG = [
    { container: '.progress-bar', fill: '.progress', axis: 'x' },
    { container: '.hour-bar', fill: '.hour-fill', axis: 'y' },
    { container: '.silo-visual', fill: '.silo-fill', axis: 'y' }
];

let activeBar = null;

function barFromEvent(target) {
    if (!(target instanceof Element)) return null;
    for (let i = 0; i < BAR_CONFIG.length; i++) {
        const cfg = BAR_CONFIG[i];
        const container = target.closest(cfg.container);
        if (!container) continue;
        const fill = container.querySelector(cfg.fill);
        if (fill) return { container: container, fill: fill, axis: cfg.axis };
    }
    return null;
}

function syncBarLabel(bar, pct) {
    const siloItem = bar.container.closest('.silo-item');
    if (siloItem) {
        escreverTexto(siloItem.querySelector('.silo-percent'), pct + '%');
        return;
    }
    const label = bar.container.nextElementSibling;
    if (label && label.classList.contains('progress-label')) {
        const sign = label.querySelector('.pct-sign');
        if (sign) {
            const acoes = label.querySelector(':scope > .block-actions');
            label.textContent = '';
            if (acoes) label.appendChild(acoes);
            label.appendChild(document.createTextNode(String(pct)));
            label.appendChild(sign);
            return;
        }
        escreverTexto(label, textoSemAlca(label).replace(/\d+([.,]\d+)?\s*%/, pct + '%'));
    }
}

function setBarValue(bar, clientX, clientY) {
    const rect = bar.container.getBoundingClientRect();
    const ratio = bar.axis === 'x'
        ? (clientX - rect.left) / rect.width
        : (rect.bottom - clientY) / rect.height;
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    bar.fill.style[bar.axis === 'x' ? 'width' : 'height'] = pct + '%';
    syncBarLabel(bar, pct);
}

document.addEventListener('pointerdown', (e) => {
    if (!isEditing() || !(e.target instanceof Element)) return;
    if (e.target.closest('.resize-handle')) return;
    const bar = barFromEvent(e.target);
    if (!bar) return;
    e.preventDefault();
    activeBar = bar;
    setBarValue(bar, e.clientX, e.clientY);
});

document.addEventListener('pointermove', (e) => {
    if (!activeBar) return;
    setBarValue(activeBar, e.clientX, e.clientY);
});

document.addEventListener('pointerup', () => {
    activeBar = null;
});

// ============================================
// EDIÇÃO DE TAMANHO (redimensionar blocos e gráficos)
// ============================================
const RESIZE_CONFIG = [
    { selector: '.screen > div:not(.screen-header), .alerts-page > div:not(.screen-header)', mode: 'min' },
    { selector: '.split-grid > .content-section', mode: 'size' },
    { selector: '.kpi-card', mode: 'size' },
    { selector: '.kpi-card-small', mode: 'size' },
    { selector: '.summary-card', mode: 'size' },
    { selector: '.forecast-stat', mode: 'size' },
    { selector: '.alert-item', mode: 'size' },
    { selector: '.silo-item', mode: 'size' },
    { selector: '.moega-item', mode: 'size' },
    { selector: '.weather-day', mode: 'size' },
    { selector: '.weather-city', mode: 'size' },
    { selector: '.camera-frame', mode: 'size' },
    { selector: '.secador', mode: 'size' },
    { selector: '.hour-item', mode: 'size' },
    { selector: '.flow-btn', mode: 'size' },
    { selector: '.stack-track', mode: 'size' },
    { selector: '.silo-visual', mode: 'size' },
    { selector: '.hour-bar', mode: 'size' },
    { selector: '.progress-bar', mode: 'size' },
    { selector: '.forecast-chart', mode: 'size' },
    { selector: '.linha-chart', mode: 'size' },
    { selector: '.secador-chart', mode: 'size' },
    { selector: '.donut-card', mode: 'size' },
    { selector: '.table-scroll', mode: 'size' },
    { selector: '.rank-list', mode: 'size' },
    { selector: '.status-bar', mode: 'size' },
    // os miudos de dentro: cada faixa, linha ou chip ajusta o proprio tamanho
    { selector: '.status-item', mode: 'size' },
    { selector: '.status-row', mode: 'size' },
    { selector: '.rank-item', mode: 'size' },
    { selector: '.prod-secador', mode: 'size' },
    { selector: '.secador-ponto', mode: 'size' },
    { selector: '.secador-leitura', mode: 'size' },
    { selector: '.silo-group', mode: 'size' },
    { selector: '.stack-row', mode: 'size' },
    { selector: '.donut-item', mode: 'size' }
];

const RESIZE_ZONA_MORTA = 6; // px de folga antes de um eixo comecar a valer

let resizing = null;
let fotoTamanho = null; // como o palco estava antes de mexer no tamanho

function setupResizeHandles(enabled) {
    document.querySelectorAll('.resize-handle').forEach((handle) => handle.remove());
    document.querySelectorAll('[data-resize]').forEach((el) => {
        el.removeAttribute('data-resize');
        el.classList.remove('is-resizing');
    });

    const raiz = enabled ? raizEdicao() : null;
    if (!raiz) return;

    RESIZE_CONFIG.forEach((cfg) => {
        raiz.querySelectorAll(cfg.selector).forEach((el) => {
            if (el.dataset.resize) return;
            el.dataset.resize = cfg.mode;

            // bloco de tela so muda de altura: a largura dele e do layout,
            // entao a alca ja avisa isso no simbolo e no cursor.
            const soAltura = cfg.mode === 'min';

            const handle = document.createElement('span');
            handle.className = 'resize-handle' + (soAltura ? ' resize-handle--altura' : '');
            handle.textContent = soAltura ? '⇕' : '⤡';
            handle.title = soAltura
                ? 'Arraste para mudar a altura (duplo clique restaura)'
                : 'Arraste para redimensionar (duplo clique restaura)';
            handle.contentEditable = 'false';
            el.appendChild(handle);
        });
    });
}

// A tela inteira e escrita em rem e encolhe junto pelo --fit. Gravar px
// aqui prendia o bloco a uma resolucao so: em outro monitor ele ficava
// fora de escala e, pior, o ajuste automatico encolhia todo o resto para
// tentar caber em volta dele. Por isso o tamanho sai daqui em rem.
let baseRem = 16;

function lerBaseRem() {
    const base = parseFloat(getComputedStyle(document.documentElement).fontSize);
    baseRem = base > 0 ? base : 16;
}

function emRem(px) {
    return (px / baseRem).toFixed(3) + 'rem';
}

// Em qual eixo o pai empilha os filhos. Importa porque flex-basis vale
// sempre para o eixo PRINCIPAL: num painel em coluna, gravar a largura no
// flex esticava a ALTURA do bloco — era o que fazia uma faixa de status
// virar uma caixa gigante e vazia ao ser arrastada de lado.
function eixoDoPai(el) {
    const parent = el.parentElement;
    if (!parent) return '';
    const cs = getComputedStyle(parent);
    if (cs.display.indexOf('flex') === -1) return '';
    return cs.flexDirection.indexOf('column') === 0 ? 'vertical' : 'horizontal';
}

// Nenhum bloco passa do espaco que tem: sem teto dava para esticar um
// cartao a varias vezes a altura da tela, e o ajuste automatico entao
// encolhia todo o resto tentando caber em volta dele.
function tetoLargura(el) {
    const parent = el.parentElement;
    const largura = parent ? parent.clientWidth : 0;
    return largura > 0 ? largura : Infinity;
}

function tetoAltura(el) {
    const tela = el.closest('.screen, .alerts-page');
    const altura = tela ? tela.clientHeight : 0;
    return altura > 0 ? altura : Infinity;
}

function applyResizeWidth(el, width) {
    const parent = el.parentElement;
    if (!parent) return;
    // bloco de tela ocupa a linha toda: fixar largura so quebrava o layout
    if (el.dataset.resize === 'min') return;

    const cs = getComputedStyle(parent);
    const w = Math.max(40, Math.min(Math.round(width), tetoLargura(el)));

    if (cs.display.indexOf('grid') !== -1) {
        const cols = cs.gridTemplateColumns.split(' ').filter(Boolean);
        if (cols.length > 1) {
            const gap = parseFloat(cs.columnGap) || 0;
            const total = parent.clientWidth;
            const unit = (total - gap * (cols.length - 1)) / cols.length;
            let span = Math.round((w + gap) / (unit + gap));
            span = Math.max(1, Math.min(cols.length, span));
            el.style.gridColumn = 'span ' + span;
            el.style.width = '';
            return;
        }
    }

    // so trava o flex quando a largura e mesmo o eixo principal do pai
    if (eixoDoPai(el) === 'horizontal') el.style.flex = '0 0 ' + emRem(w);
    el.style.width = emRem(w);
}

function applyResizeHeight(el, height) {
    const h = Math.max(28, Math.min(Math.round(height), tetoAltura(el)));

    if (el.dataset.resize === 'min') {
        el.style.minHeight = emRem(h);
        return;
    }

    // em painel empilhado a altura e o eixo principal: sem travar o flex
    // junto, o bloco voltava a esticar ou encolher sozinho
    if (eixoDoPai(el) === 'vertical') el.style.flex = '0 0 ' + emRem(h);
    el.style.height = emRem(h);
}

function resetSize(el) {
    el.style.width = '';
    el.style.height = '';
    el.style.minHeight = '';
    el.style.flex = '';
    el.style.gridColumn = '';
}

document.addEventListener('pointerdown', (e) => {
    if (!isEditing() || e.button !== 0 || !(e.target instanceof Element)) return;
    const handle = e.target.closest('.resize-handle');
    if (!handle || !handle.parentElement) return;

    e.preventDefault();
    const el = handle.parentElement;
    const rect = el.getBoundingClientRect();
    lerBaseRem();
    fotoTamanho = limparHTML(palco);
    resizing = {
        el: el,
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height,
        // cada eixo so entra em jogo depois de um empurrao de verdade:
        // sem isso, puxar so para baixo tambem congelava a largura
        eixoX: false,
        eixoY: false
    };
    el.classList.add('is-resizing');
    if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
});

document.addEventListener('pointermove', (e) => {
    if (!resizing) return;

    const dx = e.clientX - resizing.startX;
    const dy = e.clientY - resizing.startY;

    if (Math.abs(dx) > RESIZE_ZONA_MORTA) resizing.eixoX = true;
    if (Math.abs(dy) > RESIZE_ZONA_MORTA) resizing.eixoY = true;

    if (resizing.eixoX) applyResizeWidth(resizing.el, resizing.startW + dx);
    if (resizing.eixoY) applyResizeHeight(resizing.el, resizing.startH + dy);
});

document.addEventListener('pointerup', () => {
    if (!resizing) return;
    resizing.el.classList.remove('is-resizing');
    resizing = null;
    registrarSeMudou(fotoTamanho);
    fotoTamanho = null;
    scheduleFit();
});

document.addEventListener('dblclick', (e) => {
    if (!isEditing() || !(e.target instanceof Element)) return;
    const handle = e.target.closest('.resize-handle');
    if (!handle || !handle.parentElement) return;
    e.preventDefault();
    const antes = limparHTML(palco);
    resetSize(handle.parentElement);
    registrarSeMudou(antes);
    scheduleFit();
});

// ============================================
// MODO DE EDIÇÃO
// ============================================
function applyEditMode(enabled) {
    // o recorte por cultura sai antes das alcas entrarem: a edicao mexe no
    // HTML e o salva, entao o layout precisa voltar ao estado inteiro
    if (enabled) {
        limparFiltrosGrao();
        limparFiltrosFluxo();
        limparFiltrosClassificacao();
    }
    applyTextEditing(enabled);
    setupDragHandles(enabled);
    setupResizeHandles(enabled);
    // o editor entra em cena no fim do arquivo; antes disso nao ha barra
    if (editorPronto) sincronizarEditor(enabled);
}

function toggleEditMode() {
    const nextState = !isEditing();

    if (btnEditar) {
        btnEditar.classList.toggle('active', nextState);
        btnEditar.textContent = nextState ? 'CONCLUIR' : 'EDITAR';
    }

    document.body.classList.toggle('edit-mode', nextState);
    applyEditMode(nextState);
    // sair da edicao guarda o layout automaticamente
    if (!nextState && editorPronto) salvarLayout(true);
    scheduleFit();
}

if (btnClaro) {
    btnClaro.addEventListener('click', toggleTheme);
}

if (btnEditar) {
    btnEditar.addEventListener('click', toggleEditMode);
}

if (btnLive) {
    btnLive.addEventListener('click', () => {
        if (isEditing()) {
            toggleEditMode();
        }
        setAlertsPage(false);
        btnLive.classList.add('active');
    });
}

setHeaderTheme('theme-dark');
applyEditMode(false);

const telasIniciais = allScreens();
if (telasIniciais.length > 0 && menuItems.length > 0) {
    menuItems[0].classList.add('active');
    telasIniciais[0].classList.add('active');
}

const firstScreen = telasIniciais[0];
if (firstScreen) {
    const firstFlowButtons = firstScreen.querySelectorAll('.flow-btn');
    if (firstFlowButtons.length > 1) {
        firstFlowButtons[1].classList.add('active');
    }
}
// ============================================
// GRÁFICO: RECEBIDO x PROGRAMADO (7 DIAS)
// ============================================
const FORECAST_MAX = 1800; // topo do eixo Y, em t

function formatTon(value) {
    return Math.round(value).toLocaleString('pt-BR');
}

let vizTooltip = null;

// Cada grao traz realizado e programado do dia; depois vem os totais.
// Como o patio nao recebe mais que dois graos no mesmo dia, as linhas das
// culturas ausentes ficam ocultas em vez de aparecerem zeradas.
const VIZ_SERIES = [
    { chave: 'milho', nome: 'Milho', cor: 'var(--grao-milho)', grao: true },
    { chave: 'sorgo', nome: 'Sorgo', cor: 'var(--grao-sorgo)', grao: true },
    { chave: 'trigo', nome: 'Trigo', cor: 'var(--grao-trigo)', grao: true },
    { chave: 'soja', nome: 'Soja', cor: 'var(--grao-soja)', grao: true },
    { chave: 'recebido', nome: 'Recebido', cor: 'var(--viz-real)', total: true },
    { chave: 'programado', nome: 'Programado', cor: 'var(--viz-prog)' }
];

function buildVizTooltip() {
    const box = document.createElement('div');
    box.className = 'viz-tooltip';
    box.setAttribute('role', 'tooltip');

    const title = document.createElement('span');
    title.className = 'viz-tooltip-title';
    box.appendChild(title);

    const values = {};
    const rows = {};
    const names = {};
    VIZ_SERIES.forEach((serie) => {
        const row = document.createElement('div');
        row.className = 'viz-tooltip-row' + (serie.total ? ' is-total' : '');

        const key = document.createElement('i');
        key.className = 'viz-tooltip-key';
        key.style.background = serie.cor;

        const value = document.createElement('strong');
        value.className = 'viz-tooltip-value';

        const name = document.createElement('span');
        name.className = 'viz-tooltip-name';
        name.textContent = serie.nome;

        row.appendChild(key);
        row.appendChild(value);
        row.appendChild(name);
        box.appendChild(row);
        values[serie.chave] = value;
        rows[serie.chave] = row;
        names[serie.chave] = name;
    });

    document.body.appendChild(box);
    return { box: box, title: title, values: values, rows: rows, names: names };
}

function showVizTooltip(col, clientX, clientY) {
    if (!vizTooltip) vizTooltip = buildVizTooltip();

    // Rótulos vêm de data-attributes: sempre textContent, nunca innerHTML.
    vizTooltip.title.textContent = col.dataset.dia || '';
    // com o filtro de cultura ligado a linha das outras culturas nao entra
    const secao = col.closest('.forecast-section');
    const grao = secao ? graoAtivoDe(secao) : 'todas';
    VIZ_SERIES.forEach((serie) => {
        const dado = col.dataset[serie.chave];
        vizTooltip.values[serie.chave].textContent = dado || '—';
        // a coluna pode renomear a linha (ex.: "Secador 1 · Milho" no grafico de secagem)
        const apelido = col.dataset['nome' + serie.chave.charAt(0).toUpperCase() + serie.chave.slice(1)];
        vizTooltip.names[serie.chave].textContent = apelido || serie.nome;
        if (serie.grao) {
            vizTooltip.rows[serie.chave].hidden = !dado || (grao !== 'todas' && serie.chave !== grao);
        } else if (!serie.total) {
            vizTooltip.rows[serie.chave].hidden = !dado;
        }
    });
    vizTooltip.box.classList.add('is-visible');

    const rect = vizTooltip.box.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - rect.width - 8, clientX + 14));
    const top = Math.max(8, clientY - rect.height - 12);
    vizTooltip.box.style.left = left + 'px';
    vizTooltip.box.style.top = top + 'px';
}

function hideVizTooltip() {
    if (vizTooltip) vizTooltip.box.classList.remove('is-visible');
}

document.addEventListener('pointermove', (e) => {
    const col = e.target instanceof Element ? e.target.closest('.forecast-col, .hora-col[data-dia]') : null;
    if (!col || isEditing()) {
        hideVizTooltip();
        return;
    }
    showVizTooltip(col, e.clientX, e.clientY);
});

document.addEventListener('focusin', (e) => {
    const col = e.target instanceof Element ? e.target.closest('.forecast-col, .hora-col[data-dia]') : null;
    if (!col || isEditing()) return;
    const rect = col.getBoundingClientRect();
    showVizTooltip(col, rect.left + rect.width / 2, rect.top);
});

document.addEventListener('focusout', hideVizTooltip);

// ============================================
// POR QUE ESTA ATRASADO
// O numero sozinho nao explica o desvio. Cada indicador de atraso da
// recepcao carrega a causa em data-attributes e o mouse over abre a conta:
// as parcelas que somam o desvio mais uma nota de contexto.
// Formato de data-motivo-lista: "rotulo::valor::desvio::tom" por item,
// itens separados por "|". Tom aceita ruim | bom | neutro.
// ============================================
let motivoTip = null;
let motivoAtual = null;

function buildMotivoTip() {
    const box = document.createElement('div');
    box.className = 'motivo-tip';
    box.id = 'motivoTip';
    box.setAttribute('role', 'tooltip');

    const titulo = document.createElement('strong');
    titulo.className = 'motivo-tip-titulo';

    const resumo = document.createElement('span');
    resumo.className = 'motivo-tip-resumo';

    const lista = document.createElement('ul');
    lista.className = 'motivo-tip-lista';

    const nota = document.createElement('span');
    nota.className = 'motivo-tip-nota';

    box.appendChild(titulo);
    box.appendChild(resumo);
    box.appendChild(lista);
    box.appendChild(nota);
    document.body.appendChild(box);
    return { box: box, titulo: titulo, resumo: resumo, lista: lista, nota: nota };
}

const MOTIVO_TONS = { ruim: 'is-ruim', bom: 'is-bom' };

// Dentro de uma tela com periodo (data-fluxo-periodo) o balao segue a escolha:
// data-motivo-lista-7d ganha de data-motivo-lista quando "7 dias" esta ativo.
// Sem a versao do periodo, cai no atributo base.
function campoMotivo(alvo, campo) {
    const tela = alvo.closest('[data-fluxo-periodo]');
    const periodo = tela ? tela.dataset.fluxoPeriodo : '';
    if (periodo) {
        const chave = campo + periodo.charAt(0).toUpperCase() + periodo.slice(1);
        if (alvo.dataset[chave]) return alvo.dataset[chave];
    }
    return alvo.dataset[campo] || '';
}

function preencherMotivo(alvo) {
    // Tudo vem de data-attributes: sempre textContent, nunca innerHTML.
    motivoTip.titulo.textContent = campoMotivo(alvo, 'motivoTitulo');
    motivoTip.resumo.textContent = campoMotivo(alvo, 'motivoResumo');
    motivoTip.nota.textContent = campoMotivo(alvo, 'motivoNota');

    motivoTip.lista.textContent = '';
    const bruto = campoMotivo(alvo, 'motivoLista');
    bruto.split('|').forEach(function (linha) {
        const campos = linha.split('::');
        const rotulo = (campos[0] || '').trim();
        if (!rotulo) return;

        const item = document.createElement('li');
        const tom = MOTIVO_TONS[(campos[3] || '').trim()];
        item.className = 'motivo-tip-item' + (tom ? ' ' + tom : '');

        const elRotulo = document.createElement('span');
        elRotulo.className = 'motivo-tip-rotulo';
        elRotulo.textContent = rotulo;

        const elValor = document.createElement('strong');
        elValor.className = 'motivo-tip-valor';
        elValor.textContent = (campos[1] || '').trim();

        const elDesvio = document.createElement('span');
        elDesvio.className = 'motivo-tip-desvio';
        elDesvio.textContent = (campos[2] || '').trim();

        item.appendChild(elRotulo);
        item.appendChild(elValor);
        item.appendChild(elDesvio);
        motivoTip.lista.appendChild(item);
    });
}

// A caixa se ancora no proprio indicador, nao no cursor: assim ela nunca
// cobre o numero que esta explicando e nao balanca junto com o mouse.
function posicionarMotivo(alvo) {
    const base = alvo.getBoundingClientRect();
    const caixa = motivoTip.box.getBoundingClientRect();
    const left = Math.max(8, Math.min(
        window.innerWidth - caixa.width - 8,
        base.left + base.width / 2 - caixa.width / 2
    ));

    // abaixo do indicador; se faltar espaco, sobe para cima dele
    let top = base.bottom + 10;
    if (top + caixa.height > window.innerHeight - 8) {
        const acima = base.top - caixa.height - 10;
        top = acima >= 8 ? acima : Math.max(8, window.innerHeight - caixa.height - 8);
    }

    motivoTip.box.style.left = left + 'px';
    motivoTip.box.style.top = top + 'px';
}

function showMotivo(alvo) {
    if (!motivoTip) motivoTip = buildMotivoTip();
    if (alvo === motivoAtual) return;
    preencherMotivo(alvo);
    motivoAtual = alvo;
    alvo.setAttribute('aria-describedby', 'motivoTip');
    motivoTip.box.classList.add('is-visible');
    posicionarMotivo(alvo);
}

function hideMotivo() {
    if (!motivoTip) return;
    motivoTip.box.classList.remove('is-visible');
    if (motivoAtual) motivoAtual.removeAttribute('aria-describedby');
    motivoAtual = null;
}

document.addEventListener('pointermove', (e) => {
    const alvo = e.target instanceof Element ? e.target.closest('[data-motivo]') : null;
    if (!alvo || isEditing()) {
        hideMotivo();
        return;
    }
    showMotivo(alvo);
});

document.addEventListener('pointerleave', hideMotivo);

document.addEventListener('focusin', (e) => {
    const alvo = e.target instanceof Element ? e.target.closest('[data-motivo]') : null;
    if (!alvo || isEditing()) return;
    showMotivo(alvo);
});

document.addEventListener('focusout', hideMotivo);

document.addEventListener('scroll', hideMotivo, true);

window.addEventListener('resize', hideMotivo);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideMotivo();
});

// Tabela de apoio: os mesmos números sem depender do hover.
// A tela tem altura fixa e os dois mostram o mesmo dado, então a tabela
// entra no lugar do gráfico — empilhados, um esmagava o outro.
document.addEventListener('click', (event) => {
    const btn = event.target instanceof Element
        ? event.target.closest('[data-forecast-toggle]')
        : null;
    if (btn) {
        const target = document.getElementById(btn.getAttribute('aria-controls'));
        if (!target) return;
        const opening = target.hidden;
        target.hidden = !opening;
        btn.setAttribute('aria-expanded', String(opening));
        btn.textContent = opening ? 'GRÁFICO' : 'TABELA';

        const secao = btn.closest('.content-section');
        if (secao) secao.classList.toggle('is-tabela', opening);
        scheduleFit();
    }
});

// Em modo de edição, arrastar a barra ajusta o valor (como nas demais)
let forecastBar = null;

function setForecastValue(bar, clientY) {
    const col = bar.parentElement;
    if (!col) return;

    const rect = col.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    // cada gráfico pode ter seu próprio topo de eixo (data-chart-max)
    const chart = bar.closest('[data-chart-max]');
    const max = chart ? Number(chart.dataset.chartMax) : NaN;
    const tons = ratio * (max > 0 ? max : FORECAST_MAX);

    bar.style.height = (ratio * 100).toFixed(1) + '%';
    bar.classList.toggle('is-empty', ratio === 0);

    const cap = bar.querySelector('.forecast-cap');
    if (cap) cap.textContent = formatTon(tons);

    // barras que representam uma serie propria (ex.: cada secador no grafico por hora)
    // dizem qual linha do tooltip atualizar; as demais caem no total recebido
    const serie = bar.dataset.serie || (bar.classList.contains('forecast-bar--prog') ? 'programado' : 'recebido');
    col.dataset[serie] = formatTon(tons) + ' t';
}

document.addEventListener('pointerdown', (e) => {
    if (!isEditing() || !(e.target instanceof Element)) return;
    if (e.target.closest('.resize-handle') || e.target.closest('.forecast-cap')) return;

    const bar = e.target.closest('.forecast-bar');
    if (!bar) return;

    e.preventDefault();
    forecastBar = bar;
    setForecastValue(bar, e.clientY);
});

document.addEventListener('pointermove', (e) => {
    if (!forecastBar) return;
    setForecastValue(forecastBar, e.clientY);
});

document.addEventListener('pointerup', () => {
    forecastBar = null;
});

// ============================================
// CÂMERAS (uma por tela)
// A moldura fica com o nome da câmera enquanto não houver stream.
// Basta preencher data-cam-src no HTML (MJPEG, snapshot ou qualquer
// URL que o navegador saiba renderizar em <img>) que a imagem entra
// por cima do espaço reservado — e some de novo se o sinal cair.
// ============================================
function mountCameras(root) {
    const escopo = root || document;
    escopo.querySelectorAll('.camera-frame[data-cam-src]').forEach((frame) => {
        const src = (frame.dataset.camSrc || '').trim();
        if (!src || frame.querySelector('.camera-stream')) return;

        const nome = frame.querySelector('.camera-name');
        const img = document.createElement('img');
        img.className = 'camera-stream';
        img.alt = nome ? textoSemAlca(nome).trim() : 'Câmera ao vivo';
        img.addEventListener('error', () => img.remove());
        img.src = src;
        frame.appendChild(img);
    });
}

mountCameras(document);

// ============================================
// PRINT DA TELA ATIVA
// O @media print deixa só a tela em foco na folha.
// ============================================
document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('[data-print]')) return;
    if (isEditing()) return;
    exportarPdf('atual');
});

// ============================================
// EXPORTAR PDF
// Usa a impressao do navegador (destino "Salvar como PDF"): e o unico
// caminho que preserva graficos SVG, fontes e cores sem depender de
// biblioteca externa. O @media print cuida de esconder o cromo; aqui
// so escolhemos o que entra (tela ativa ou todas) e o nome do arquivo.
// ============================================
const btnPdf = document.getElementById('btnPdf');
const pdfMenu = document.getElementById('pdfMenu');
const pdfMenuList = document.getElementById('pdfMenuList');

function tituloDaTela(screen) {
    const h2 = screen && screen.querySelector('.screen-title-section h2');
    return h2 ? h2.textContent.trim() : '';
}

function nomeArquivoPdf(modo) {
    const data = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const carimbo = `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}_${pad(data.getHours())}h${pad(data.getMinutes())}`;
    const tela = modo === 'todas'
        ? 'Todas as telas'
        : (tituloDaTela(document.querySelector('.screen.active')) || 'Tela');
    return `COE - ${tela} - ${carimbo}`;
}

function fecharMenuPdf() {
    if (!pdfMenuList || pdfMenuList.hidden) return;
    pdfMenuList.hidden = true;
    if (btnPdf) btnPdf.setAttribute('aria-expanded', 'false');
}

function abrirMenuPdf() {
    if (!pdfMenuList) return;
    pdfMenuList.hidden = false;
    if (btnPdf) btnPdf.setAttribute('aria-expanded', 'true');
    const primeiro = pdfMenuList.querySelector('[data-pdf]');
    if (primeiro) primeiro.focus();
}

function exportarPdf(modo) {
    fecharMenuPdf();
    if (isEditing()) return;

    const tituloOriginal = document.title;
    // o titulo do documento vira o nome sugerido do arquivo PDF
    document.title = nomeArquivoPdf(modo);
    document.body.classList.toggle('print-all', modo === 'todas');

    const restaurar = () => {
        document.title = tituloOriginal;
        document.body.classList.remove('print-all');
        window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);

    // garante que o layout esteja assentado antes de abrir o dialogo
    requestAnimationFrame(() => {
        window.print();
        // navegadores sem afterprint (ou quando o dialogo e cancelado
        // rapido) ainda voltam ao normal
        setTimeout(restaurar, 1500);
    });
}

if (btnPdf && pdfMenuList) {
    btnPdf.addEventListener('click', (event) => {
        event.stopPropagation();
        if (pdfMenuList.hidden) abrirMenuPdf();
        else fecharMenuPdf();
    });

    pdfMenuList.addEventListener('click', (event) => {
        const opcao = event.target instanceof Element ? event.target.closest('[data-pdf]') : null;
        if (!opcao) return;
        event.stopPropagation();
        exportarPdf(opcao.getAttribute('data-pdf'));
    });

    pdfMenuList.addEventListener('keydown', (event) => {
        const itens = Array.from(pdfMenuList.querySelectorAll('[data-pdf]'));
        const idx = itens.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            itens[(idx + 1) % itens.length].focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            itens[(idx - 1 + itens.length) % itens.length].focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            fecharMenuPdf();
            btnPdf.focus();
        }
    });

    document.addEventListener('click', (event) => {
        if (pdfMenu && event.target instanceof Element && pdfMenu.contains(event.target)) return;
        fecharMenuPdf();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') fecharMenuPdf();
    });
}

// ============================================
// EDITOR DE LAYOUT
// Além de mexer no texto, no lugar e no tamanho (acima), aqui dá para
// tirar bloco, duplicar, criar gráfico novo escolhendo tipo, dados e
// cores — e guardar tudo no navegador para a tela voltar do mesmo jeito.
// `var` de propósito: applyEditMode roda antes deste trecho.
// ============================================
var editorPronto = false;

const LAYOUT_KEY = 'videowall:layout';
// Assinatura do HTML da pagina no momento do salvamento. Sem isto, um layout
// guardado entra no lugar do index.html e qualquer alteracao feita no arquivo
// nunca aparece na tela — a pagina abre sempre com a copia velha do navegador.
const LAYOUT_BASE_KEY = 'videowall:layout:base';
// Copia do layout descartado, para nao perder de vez o que ja tinha sido salvo.
const LAYOUT_BACKUP_KEY = 'videowall:layout:backup';
const HISTORICO_MAX = 40;

const palco = document.querySelector('.content');

// ---- paleta oferecida no painel ----
const PALETA = [
    { id: 'azul', nome: 'Azul', cor: 'var(--viz-real)' },
    { id: 'verde', nome: 'Verde', cor: 'var(--viz-prog)' },
    { id: 'milho', nome: 'Milho', cor: 'var(--grao-milho)' },
    { id: 'sorgo', nome: 'Sorgo', cor: 'var(--grao-sorgo)' },
    { id: 'trigo', nome: 'Trigo', cor: 'var(--grao-trigo)' },
    { id: 'soja', nome: 'Soja', cor: 'var(--grao-soja)' },
    { id: 'ok', nome: 'Ok (verde claro)', cor: 'var(--ok)' },
    { id: 'atencao', nome: 'Atenção (laranja)', cor: 'var(--warn)' },
    { id: 'alerta', nome: 'Alerta (vermelho)', cor: 'var(--danger)' }
];

const OPCOES_COR = PALETA.map((c) => ({ valor: c.id, texto: c.nome }));

// ============================================
// UTILIDADES
// ============================================
function novo(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
}

function lista(valor) {
    return String(valor === undefined || valor === null ? '' : valor)
        .split(/[,;\n]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
}

function paraNumero(texto) {
    const limpo = String(texto === undefined || texto === null ? '' : texto)
        .replace(/[^\d,.-]/g, '')
        .replace(/\.(?=\d{3}\b)/g, '')
        .replace(',', '.');
    const n = Number(limpo);
    return isNaN(n) ? 0 : n;
}

function numeros(valor) {
    return lista(valor).map(paraNumero);
}

function fmtNum(valor) {
    return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function corDe(id) {
    const achado = PALETA.filter((c) => c.id === id)[0];
    return achado ? achado.cor : 'var(--viz-real)';
}

function pct(valor, max) {
    if (!(max > 0)) return 0;
    return Math.max(0, Math.min(100, (valor / max) * 100));
}

// topo do eixo: sempre um número redondo acima do maior valor
function topoEixo(valores, informado) {
    if (informado > 0) return informado;
    const maior = valores.length ? Math.max.apply(null, valores) : 100;
    if (maior <= 0) return 100;
    const grandeza = Math.pow(10, Math.floor(Math.log10(maior)));
    return Math.ceil((maior * 1.12) / (grandeza / 2)) * (grandeza / 2);
}

function eixoY(max, passos) {
    const eixo = novo('div', 'forecast-yaxis');
    for (let i = passos; i >= 0; i--) {
        eixo.appendChild(novo('span', null, fmtNum((max * i) / passos)));
    }
    return eixo;
}

function grade(linhas) {
    const g = novo('div', 'forecast-grid');
    g.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < linhas; i++) g.appendChild(novo('i'));
    return g;
}

function legenda(itens) {
    const box = novo('div', 'chart-legend');
    itens.forEach((item) => {
        const span = novo('span', 'legend-item');
        const dot = novo('i', 'legend-dot');
        dot.style.background = item.cor;
        span.appendChild(dot);
        span.appendChild(document.createTextNode(item.nome));
        box.appendChild(span);
    });
    return box;
}

function secao(titulo) {
    const sec = novo('div', 'content-section');
    if (titulo) sec.appendChild(novo('h3', null, titulo));
    return sec;
}

// ============================================
// AVISOS CURTOS
// ============================================
let avisoTimer = null;

function aviso(texto) {
    let caixa = document.getElementById('editorAviso');
    if (!caixa) {
        caixa = novo('div', 'editor-toast');
        caixa.id = 'editorAviso';
        caixa.setAttribute('role', 'status');
        document.body.appendChild(caixa);
    }
    caixa.textContent = texto;
    caixa.classList.add('is-visible');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => caixa.classList.remove('is-visible'), 2800);
}

// ============================================
// LIMPEZA: o layout salvo não leva as alças da edição
// ============================================
function limparArtefatos(raiz) {
    raiz.querySelectorAll('.block-actions, .drag-handle, .resize-handle, .camera-stream')
        .forEach((el) => el.remove());
    raiz.querySelectorAll('[data-editable]').forEach((el) => {
        el.removeAttribute('data-editable');
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
        el.removeAttribute('tabindex');
        el.classList.remove('editable');
    });
    raiz.querySelectorAll('[data-drag-group]').forEach((el) => {
        el.removeAttribute('data-drag-group');
        el.removeAttribute('draggable');
    });
    raiz.querySelectorAll('[data-resize]').forEach((el) => el.removeAttribute('data-resize'));
    raiz.querySelectorAll('.is-dragging, .is-resizing, .is-selected').forEach((el) => {
        el.classList.remove('is-dragging', 'is-resizing', 'is-selected');
    });
    raiz.querySelectorAll('.' + DROP_CLASSES.join(', .')).forEach((el) => {
        el.classList.remove.apply(el.classList, DROP_CLASSES);
    });
    return raiz;
}

function limparHTML(raiz) {
    return limparArtefatos(raiz.cloneNode(true)).innerHTML;
}

// cópia limpa de um bloco, com ids renomeados para não colidir
let contadorCopia = 0;

function prepararCopia(bloco) {
    limparArtefatos(bloco);
    bloco.removeAttribute('data-drag-group');
    bloco.removeAttribute('data-resize');
    bloco.removeAttribute('draggable');
    bloco.classList.remove('is-selected', 'is-dragging', 'is-resizing');

    bloco.querySelectorAll('[id]').forEach((el) => {
        const antigo = el.id;
        const atual = antigo + '-c' + (++contadorCopia);
        el.id = atual;
        bloco.querySelectorAll('[aria-controls="' + antigo + '"]').forEach((ref) => {
            ref.setAttribute('aria-controls', atual);
        });
    });
    if (bloco.id) bloco.id = bloco.id + '-c' + (++contadorCopia);
    return bloco;
}

// ============================================
// HISTÓRICO (desfazer / refazer)
// ============================================
let historico = [];
let futuro = [];

function registrar() {
    historico.push(limparHTML(palco));
    if (historico.length > HISTORICO_MAX) historico.shift();
    futuro.length = 0;
    atualizarBotoesHistorico();
}

// Guarda a foto anterior so quando o gesto mexeu em alguma coisa: assim
// arrastar sem querer nao enche o DESFAZER de passos vazios.
function registrarSeMudou(antes) {
    if (!antes || antes === limparHTML(palco)) return;
    historico.push(antes);
    if (historico.length > HISTORICO_MAX) historico.shift();
    futuro.length = 0;
    atualizarBotoesHistorico();
}

function aplicarHTML(html) {
    palco.innerHTML = html;
    remontar();
    atualizarBotoesHistorico();
}

function desfazer() {
    if (!historico.length) {
        aviso('Nada para desfazer.');
        return;
    }
    futuro.push(limparHTML(palco));
    aplicarHTML(historico.pop());
    aviso('Alteração desfeita.');
}

function refazer() {
    if (!futuro.length) {
        aviso('Nada para refazer.');
        return;
    }
    historico.push(limparHTML(palco));
    aplicarHTML(futuro.pop());
    aviso('Alteração refeita.');
}

// ============================================
// PERSISTÊNCIA
// ============================================
let layoutOriginal = '';

// hash curto (djb2) so para saber se o index.html mudou desde o salvamento
function assinaturaLayout(html) {
    let h = 5381;
    for (let i = 0; i < html.length; i++) h = ((h * 33) ^ html.charCodeAt(i)) >>> 0;
    return html.length + '-' + h.toString(36);
}

function salvarLayout(silencioso) {
    try {
        localStorage.setItem(LAYOUT_KEY, limparHTML(palco));
        localStorage.setItem(LAYOUT_BASE_KEY, assinaturaLayout(layoutOriginal));
        if (!silencioso) aviso('Layout salvo neste navegador.');
    } catch (err) {
        aviso('Não foi possível salvar: armazenamento indisponível.');
    }
}

function carregarLayout() {
    let salvo = null;
    try {
        salvo = localStorage.getItem(LAYOUT_KEY);
    } catch (err) {
        salvo = null;
    }
    if (!salvo) return false;

    // O index.html mudou depois deste salvamento: aplicar o layout velho
    // esconderia a alteracao. Guarda como backup e abre a pagina nova.
    let base = null;
    try {
        base = localStorage.getItem(LAYOUT_BASE_KEY);
    } catch (err) {
        base = null;
    }
    if (base !== assinaturaLayout(layoutOriginal)) {
        try {
            localStorage.setItem(LAYOUT_BACKUP_KEY, salvo);
            localStorage.removeItem(LAYOUT_KEY);
            localStorage.removeItem(LAYOUT_BASE_KEY);
        } catch (err) {
            /* segue sem backup */
        }
        aviso('A página foi atualizada — o layout salvo anterior foi descartado.');
        return false;
    }

    palco.innerHTML = salvo;
    converterTamanhosParaRem(palco);
    remontar();
    return true;
}

// Layout guardado antes desta correcao pode trazer tamanho em px, que nao
// acompanha o --fit: em outro monitor o bloco saia de escala e o ajuste
// automatico encolhia o resto da tela em volta dele. Converte na entrada.
function converterTamanhosParaRem(raiz) {
    lerBaseRem();
    const PROPS = ['width', 'height', 'minHeight', 'flexBasis'];
    raiz.querySelectorAll('[style]').forEach((el) => {
        PROPS.forEach((prop) => {
            const valor = el.style[prop];
            if (!valor || valor.indexOf('px') === -1) return;
            const n = parseFloat(valor);
            if (!(n > 0)) return;
            el.style[prop] = emRem(n);
        });
        soltarBasisTorto(el);
    });
}

// Em painel empilhado, o tamanho antigo escrevia a largura no flex-basis,
// que ali e a altura: o bloco salvo abria esticado. Quando o basis nao bate
// com a altura do proprio bloco, ele veio desse caminho e sai fora.
function soltarBasisTorto(el) {
    const basis = el.style.flexBasis;
    if (!basis || basis === 'auto') return;
    if (eixoDoPai(el) !== 'vertical') return;
    if (el.style.height && el.style.height === basis) return;
    el.style.flex = '';
}

// ============================================
// EXPLICACAO DO ATRASO EM LAYOUT JA SALVO
// O layout guardado no navegador foi gravado antes das explicacoes existirem
// e entra no lugar do HTML da pagina. Sem isto, quem ja salvou uma vez nunca
// veria o mouse over. Aqui as causas voltam para o indicador correspondente,
// casado por tela + rotulo, e seguem junto no proximo salvamento.
// ============================================
const MOTIVO_ALVOS = '.kpi-card, .forecast-stat';

function chaveDoMotivo(el) {
    const rotulo = el.querySelector('.kpi-label, .kpi-label-small, .forecast-stat-label');
    if (!rotulo) return '';
    const tela = el.closest('.screen');
    return (tela && tela.id ? tela.id : '?') + '|' + rotulo.textContent.trim().toUpperCase();
}

function aplicarMotivo(destino, fonte) {
    Array.prototype.forEach.call(fonte.attributes, function (attr) {
        if (attr.name.indexOf('data-motivo') === 0) destino.setAttribute(attr.name, attr.value);
    });
    if (fonte.classList.contains('kpi-card--motivo')) destino.classList.add('kpi-card--motivo');
    if (fonte.classList.contains('forecast-stat--motivo')) destino.classList.add('forecast-stat--motivo');
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '0');
}

function reidratarMotivos() {
    if (!palco || !layoutOriginal) return;

    const molde = document.createElement('div');
    molde.innerHTML = layoutOriginal;

    const mapa = {};
    molde.querySelectorAll('[data-motivo]').forEach(function (el) {
        const chave = chaveDoMotivo(el);
        if (chave) mapa[chave] = el;
    });

    palco.querySelectorAll(MOTIVO_ALVOS).forEach(function (el) {
        if (el.hasAttribute('data-motivo')) return;
        const fonte = mapa[chaveDoMotivo(el)];
        if (fonte) aplicarMotivo(el, fonte);
    });
}

function restaurarPadrao() {
    if (!window.confirm('Restaurar o layout original? Tudo que foi editado e salvo será perdido.')) return;
    registrar();
    try {
        localStorage.removeItem(LAYOUT_KEY);
        localStorage.removeItem(LAYOUT_BASE_KEY);
    } catch (err) {
        /* segue só em memória */
    }
    aplicarHTML(layoutOriginal);
    aviso('Layout original restaurado.');
}

// ============================================
// REMONTAGEM depois de trocar o conteúdo inteiro
// ============================================
function sincronizarMenuComTela() {
    let ativa = document.querySelector('.screen.active');
    if (!ativa) {
        ativa = allScreens()[0];
        if (ativa) ativa.classList.add('active');
    }
    const chave = ativa ? String(ativa.id).replace('screen-', '') : '';
    menuItems.forEach((item) => {
        item.classList.toggle('active', item.getAttribute('data-screen') === chave);
    });
    const atual = document.querySelector('.menu-item.active');
    if (atual && atual.closest('.menu-group')) openOnlyGroup(atual.closest('.menu-group'));
    marcarTelasAusentes();
    syncMenuGroups();
}

// tela removida no editor deixa o item do menu sem destino: melhor
// mostrar isso do que abrir uma area em branco. Volta sozinho se o
// layout padrao for restaurado.
function marcarTelasAusentes() {
    menuItems.forEach((item) => {
        const alvo = document.getElementById('screen-' + item.getAttribute('data-screen'));
        item.disabled = !alvo;
        item.classList.toggle('is-ausente', !alvo);
        if (alvo) item.removeAttribute('title');
        else item.title = 'Esta tela foi removida no modo de edição.';
    });
}

function remontar() {
    alertsPage = document.getElementById('alertsPage');
    selecionar(null);
    mountCameras(palco);
    refreshAlertsBadge();
    sincronizarMenuComTela();
    desenharRoscas(palco);
    applyEditMode(isEditing());
    scheduleFit();
}

// ============================================
// SELEÇÃO DE BLOCO
// ============================================
let selecionado = null;

function selecionar(el) {
    if (selecionado && selecionado !== el) selecionado.classList.remove('is-selected');
    selecionado = el && el.isConnected ? el : null;
    if (selecionado) selecionado.classList.add('is-selected');
}

document.addEventListener('pointerdown', (e) => {
    if (!isEditing() || !(e.target instanceof Element)) return;
    if (e.target.closest('.editor-bar') || e.target.closest('.editor-modal')) return;
    selecionar(e.target.closest('[data-drag-group]'));
}, true);

// ============================================
// AÇÕES DE BLOCO (remover, duplicar, configurar)
// ============================================
document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const btn = e.target.closest('.block-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const bloco = btn.closest('[data-drag-group]');
    if (!bloco) return;
    const acao = btn.dataset.blocoAcao;

    if (acao === 'remover') {
        registrar();
        if (selecionado === bloco) selecionar(null);
        bloco.remove();
        scheduleFit();
        aviso('Bloco removido — DESFAZER traz de volta.');
        return;
    }

    if (acao === 'duplicar') {
        registrar();
        const copia = prepararCopia(bloco.cloneNode(true));
        if (bloco.parentElement) bloco.parentElement.insertBefore(copia, bloco.nextSibling);
        applyEditMode(true);
        mountCameras(copia);
        desenharRoscas(copia);
        selecionar(copia);
        scheduleFit();
        aviso('Bloco duplicado.');
        return;
    }

    if (acao === 'config') {
        abrirPainel('editar', bloco);
    }
});

// ============================================
// ROSCA (gráfico de pizza vazada)
// O desenho vem dos valores escritos na legenda: editar o número
// no modo de edição já redesenha a fatia.
// ============================================
function desenharRosca(card) {
    const itens = Array.prototype.slice.call(card.querySelectorAll('.donut-item'));
    const valores = itens.map((item) => {
        const alvo = item.querySelector('.donut-valor');
        return Math.max(0, paraNumero(textoSemAlca(alvo)));
    });
    const soma = valores.reduce((a, b) => a + b, 0);
    const total = soma > 0 ? soma : 1;

    let acumulado = 0;
    const paradas = [];
    itens.forEach((item, i) => {
        const cor = item.dataset.cor || 'var(--viz-real)';
        const chave = item.querySelector('.donut-key');
        if (chave) chave.style.background = cor;
        const inicio = (acumulado / total) * 100;
        acumulado += valores[i];
        const fim = (acumulado / total) * 100;
        paradas.push(cor + ' ' + inicio.toFixed(2) + '% ' + fim.toFixed(2) + '%');
        const parte = item.querySelector('.donut-pct');
        if (parte) parte.textContent = (soma > 0 ? ((valores[i] / total) * 100) : 0).toFixed(0) + '%';
    });

    const visual = card.querySelector('.donut-visual');
    if (visual && paradas.length) {
        visual.style.background = 'conic-gradient(' + paradas.join(', ') + ')';
    }
    escreverTexto(card.querySelector('.donut-total'), fmtNum(soma));
}

function desenharRoscas(raiz) {
    (raiz || document).querySelectorAll('.donut-card').forEach(desenharRosca);
}

document.addEventListener('input', (e) => {
    if (!(e.target instanceof Element)) return;
    const card = e.target.closest('.donut-card');
    if (card && e.target.closest('.donut-valor')) desenharRosca(card);
});

// ============================================
// CATÁLOGO DE COMPONENTES
// Cada tipo diz quais campos aparecem no painel e como vira HTML.
// ============================================
const CATALOGO = [
    {
        id: 'barras',
        nome: 'Gráfico de barras',
        icone: '▊',
        resumo: 'Colunas verticais com eixo, grade e valor em cima.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'PRODUÇÃO POR HORA' },
            { nome: 'rotulos', rotulo: 'Rótulos do eixo X', tipo: 'textarea', padrao: '07h, 08h, 09h, 10h, 11h, 12h', dica: 'Separe por vírgula' },
            { nome: 'valores', rotulo: 'Valores', tipo: 'textarea', padrao: '142, 155, 148, 162, 137, 104' },
            { nome: 'max', rotulo: 'Topo do eixo Y (0 = automático)', tipo: 'number', padrao: 0 },
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 'm³' },
            { nome: 'cor', rotulo: 'Cor das barras', tipo: 'select', opcoes: OPCOES_COR, padrao: 'azul' },
            { nome: 'mostrarValores', rotulo: 'Mostrar o valor em cada barra', tipo: 'check', padrao: true },
            { nome: 'mostrarGrade', rotulo: 'Mostrar linhas de grade', tipo: 'check', padrao: true }
        ],
        montar: montarBarras
    },
    {
        id: 'comparativo',
        nome: 'Barras comparativas',
        icone: '▋▊',
        resumo: 'Duas séries lado a lado por dia (realizado x programado).',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'REALIZADO x PROGRAMADO' },
            { nome: 'rotulos', rotulo: 'Rótulos do eixo X', tipo: 'textarea', padrao: 'Seg, Ter, Qua, Qui, Sex' },
            { nome: 'serieA', rotulo: 'Nome da 1ª série', tipo: 'text', padrao: 'Realizado' },
            { nome: 'valoresA', rotulo: 'Valores da 1ª série', tipo: 'textarea', padrao: '1240, 1400, 1160, 1570, 880' },
            { nome: 'corA', rotulo: 'Cor da 1ª série', tipo: 'select', opcoes: OPCOES_COR, padrao: 'azul' },
            { nome: 'serieB', rotulo: 'Nome da 2ª série', tipo: 'text', padrao: 'Programado' },
            { nome: 'valoresB', rotulo: 'Valores da 2ª série', tipo: 'textarea', padrao: '1500, 1450, 1450, 1600, 950' },
            { nome: 'corB', rotulo: 'Cor da 2ª série', tipo: 'select', opcoes: OPCOES_COR, padrao: 'verde' },
            { nome: 'max', rotulo: 'Topo do eixo Y (0 = automático)', tipo: 'number', padrao: 0 },
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 'm³' },
            { nome: 'mostrarValores', rotulo: 'Mostrar o valor da 1ª série', tipo: 'check', padrao: true }
        ],
        montar: montarComparativo
    },
    {
        id: 'linha',
        nome: 'Gráfico de linha',
        icone: '📈',
        resumo: 'Uma ou duas séries ao longo do tempo, com rótulo na ponta.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'TEMPERATURA AO LONGO DO CICLO' },
            { nome: 'rotulos', rotulo: 'Rótulos do eixo X', tipo: 'textarea', padrao: '00:00, 00:30, 01:00, 01:30, 02:00' },
            { nome: 'serieA', rotulo: 'Nome da 1ª série', tipo: 'text', padrao: 'TEMP' },
            { nome: 'valoresA', rotulo: 'Valores da 1ª série', tipo: 'textarea', padrao: '62, 70, 78, 86, 92' },
            { nome: 'corA', rotulo: 'Cor da 1ª série', tipo: 'select', opcoes: OPCOES_COR, padrao: 'trigo' },
            { nome: 'serieB', rotulo: 'Nome da 2ª série (vazio = só uma)', tipo: 'text', padrao: 'UMI' },
            { nome: 'valoresB', rotulo: 'Valores da 2ª série', tipo: 'textarea', padrao: '18, 16, 14, 13, 11' },
            { nome: 'corB', rotulo: 'Cor da 2ª série', tipo: 'select', opcoes: OPCOES_COR, padrao: 'azul' },
            { nome: 'max', rotulo: 'Topo do eixo Y (0 = automático)', tipo: 'number', padrao: 0 },
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: '' }
        ],
        montar: montarLinha
    },
    {
        id: 'ranking',
        nome: 'Barras horizontais',
        icone: '▤',
        resumo: 'Lista com barra de progresso — bom para ranking e ocupação.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'OCUPAÇÃO POR EQUIPAMENTO' },
            { nome: 'rotulos', rotulo: 'Nomes', tipo: 'textarea', padrao: 'Moega 1, Moega 2, Moega 3' },
            { nome: 'valores', rotulo: 'Valores', tipo: 'textarea', padrao: '110, 68, 92' },
            { nome: 'max', rotulo: 'Valor cheio da barra (0 = maior valor)', tipo: 'number', padrao: 120 },
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 'm³' },
            { nome: 'cor', rotulo: 'Cor', tipo: 'select', opcoes: OPCOES_COR, padrao: 'milho' },
            { nome: 'mostrarPercent', rotulo: 'Mostrar percentual ao lado', tipo: 'check', padrao: true }
        ],
        montar: montarRanking
    },
    {
        id: 'empilhada',
        nome: 'Barra empilhada',
        icone: '▬',
        resumo: 'Uma faixa dividida por participação de cada item.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'RECEBIDO NO DIA' },
            { nome: 'rotulos', rotulo: 'Nomes das partes', tipo: 'textarea', padrao: 'Milho, Sorgo, Trigo' },
            { nome: 'valores', rotulo: 'Valores', tipo: 'textarea', padrao: '860, 380, 240' },
            { nome: 'cores', rotulo: 'Cores (uma por parte)', tipo: 'textarea', padrao: 'milho, sorgo, trigo', dica: 'azul, verde, milho, sorgo, trigo, soja, ok, atencao, alerta' },
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 'm³' },
            { nome: 'mostrarLegenda', rotulo: 'Mostrar legenda', tipo: 'check', padrao: true }
        ],
        montar: montarEmpilhada
    },
    {
        id: 'rosca',
        nome: 'Rosca (pizza vazada)',
        icone: '◍',
        resumo: 'Participação de cada item, com total no centro.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'MISTURA DE CULTURAS' },
            { nome: 'rotulos', rotulo: 'Nomes', tipo: 'textarea', padrao: 'Milho, Sorgo, Trigo, Soja' },
            { nome: 'valores', rotulo: 'Valores', tipo: 'textarea', padrao: '860, 380, 240, 160' },
            { nome: 'cores', rotulo: 'Cores', tipo: 'textarea', padrao: 'milho, sorgo, trigo, soja' },
            { nome: 'unidade', rotulo: 'Unidade do total', tipo: 'text', padrao: 'm³' }
        ],
        montar: montarRosca
    },
    {
        id: 'medidores',
        nome: 'Medidores verticais',
        icone: '🛢',
        resumo: 'Silos/tanques com nível arrastável e percentual.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'NÍVEL DOS SILOS' },
            { nome: 'rotulos', rotulo: 'Nomes', tipo: 'textarea', padrao: 'SILO 1, SILO 2, SILO 3' },
            { nome: 'valores', rotulo: 'Percentuais', tipo: 'textarea', padrao: '78, 92, 64' },
            { nome: 'topos', rotulo: 'Texto do canto (temperatura, etc.)', tipo: 'textarea', padrao: '22°C, 21°C, 24°C' },
            { nome: 'volumes', rotulo: 'Texto do rodapé', tipo: 'textarea', padrao: '3.120 m³, 3.680 m³, 2.560 m³' },
            { nome: 'cor', rotulo: 'Cor do preenchimento', tipo: 'select', opcoes: OPCOES_COR, padrao: 'milho' }
        ],
        montar: montarMedidores
    },
    {
        id: 'kpis',
        nome: 'Cartões de indicador',
        icone: '▣',
        resumo: 'Números grandes em cartões lado a lado.',
        campos: [
            { nome: 'titulo', rotulo: 'Título da seção (vazio = sem título)', tipo: 'text', padrao: '' },
            { nome: 'rotulos', rotulo: 'Rótulos', tipo: 'textarea', padrao: 'CAMINHÕES NA FILA, ESPERA MÉDIA, RITMO ATUAL' },
            { nome: 'valores', rotulo: 'Valores', tipo: 'textarea', padrao: '12, 38 min, 82 m³/h' },
            { nome: 'tamanho', rotulo: 'Tamanho', tipo: 'select', padrao: 'grande', opcoes: [
                { valor: 'grande', texto: 'Grande' },
                { valor: 'pequeno', texto: 'Compacto' }
            ] }
        ],
        montar: montarKpis
    },
    {
        id: 'tabela',
        nome: 'Tabela',
        icone: '▦',
        resumo: 'Grade de dados com cabeçalho — células editáveis.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'DETALHAMENTO' },
            { nome: 'colunas', rotulo: 'Colunas', tipo: 'textarea', padrao: 'UNIDADE, PESO, UMIDADE, META' },
            { nome: 'linhas', rotulo: 'Quantidade de linhas', tipo: 'number', padrao: 4 },
            { nome: 'conteudo', rotulo: 'Conteúdo (uma linha por linha da tabela)', tipo: 'textarea', padrao: '', dica: 'Uma linha por vez, células separadas por | — ex.: Avaré | 748 | 16,6 | 432' }
        ],
        montar: montarTabela
    },
    {
        id: 'status',
        nome: 'Faixa de status',
        icone: '●',
        resumo: 'Bolinhas coloridas com texto — ok, atenção e alerta.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'DISTRIBUIÇÃO DE CLASSIFICAÇÃO' },
            { nome: 'rotulos', rotulo: 'Textos', tipo: 'textarea', padrao: 'Dentro do padrão: 98%, Atenção: 1%, Fora do padrão: 1%' },
            { nome: 'estados', rotulo: 'Estados', tipo: 'textarea', padrao: 'ok, atencao, alerta', dica: 'ok, atencao ou alerta — um por texto' }
        ],
        montar: montarStatus
    },
    {
        id: 'texto',
        nome: 'Bloco de texto',
        icone: '¶',
        resumo: 'Título e parágrafo livres para observações.',
        campos: [
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'OBSERVAÇÕES' },
            { nome: 'conteudo', rotulo: 'Texto', tipo: 'textarea', padrao: 'Escreva aqui.' }
        ],
        montar: montarTexto
    },
    {
        id: 'colunas',
        nome: 'Colunas lado a lado',
        icone: '▥',
        resumo: 'Divide o espaço em painéis vazios para receber gráficos.',
        campos: [
            { nome: 'quantidade', rotulo: 'Quantas colunas', tipo: 'number', padrao: 2 },
            { nome: 'titulos', rotulo: 'Títulos das colunas', tipo: 'textarea', padrao: 'PAINEL 1, PAINEL 2' }
        ],
        montar: montarColunas
    }
];

function tipoPorId(id) {
    return CATALOGO.filter((t) => t.id === id)[0] || null;
}

// marca o componente para o botão ⚙ poder reabrir o painel já preenchido
function marcar(el, tipo, opcoes) {
    el.dataset.comp = tipo;
    el.dataset.compOpts = JSON.stringify(opcoes);
    return el;
}

// ============================================
// MONTAGEM DE CADA COMPONENTE
// ============================================
function montarBarras(o) {
    const rotulos = lista(o.rotulos);
    const valores = numeros(o.valores);
    const qtd = Math.max(rotulos.length, valores.length) || 1;
    const max = topoEixo(valores, Number(o.max));

    const sec = secao(o.titulo);
    const chart = novo('div', 'forecast-chart forecast-chart--horas');
    chart.dataset.chartMax = String(max);
    chart.appendChild(eixoY(max, 4));

    const plot = novo('div', 'forecast-plot');
    if (o.mostrarGrade !== false) plot.appendChild(grade(5));

    const cols = novo('div', 'forecast-cols');
    for (let i = 0; i < qtd; i++) {
        const valor = valores[i] || 0;
        const col = novo('div', 'hora-col');
        const barra = novo('div', 'forecast-bar forecast-bar--hora');
        barra.style.height = pct(valor, max).toFixed(1) + '%';
        barra.style.background = corDe(o.cor);
        if (o.mostrarValores !== false) barra.appendChild(novo('span', 'forecast-cap', fmtNum(valor)));
        col.appendChild(barra);
        cols.appendChild(col);
    }
    plot.appendChild(cols);
    chart.appendChild(plot);

    const eixoX = novo('div', 'forecast-xaxis');
    for (let i = 0; i < qtd; i++) {
        eixoX.appendChild(novo('span', 'forecast-day', rotulos[i] || String(i + 1)));
    }
    chart.appendChild(eixoX);
    if (o.unidade) chart.appendChild(novo('span', 'forecast-unit', o.unidade));

    sec.appendChild(chart);
    return sec;
}

function montarComparativo(o) {
    const rotulos = lista(o.rotulos);
    const a = numeros(o.valoresA);
    const b = numeros(o.valoresB);
    const qtd = Math.max(rotulos.length, a.length, b.length) || 1;
    const max = topoEixo(a.concat(b), Number(o.max));
    const corA = corDe(o.corA);
    const corB = corDe(o.corB);
    const nomeA = o.serieA || 'Série A';
    const nomeB = o.serieB || 'Série B';

    const sec = secao(o.titulo);
    sec.appendChild(legenda([{ nome: nomeA, cor: corA }, { nome: nomeB, cor: corB }]));

    const chart = novo('div', 'forecast-chart forecast-chart--dias');
    chart.dataset.chartMax = String(max);
    chart.appendChild(eixoY(max, 3));

    const plot = novo('div', 'forecast-plot');
    plot.appendChild(grade(4));

    const cols = novo('div', 'forecast-cols');
    for (let i = 0; i < qtd; i++) {
        const va = a[i] || 0;
        const vb = b[i] || 0;
        const col = novo('div', 'forecast-col');
        col.tabIndex = 0;
        col.dataset.dia = rotulos[i] || String(i + 1);
        col.dataset.recebido = fmtNum(va) + (o.unidade ? ' ' + o.unidade : '');
        col.dataset.programado = fmtNum(vb) + (o.unidade ? ' ' + o.unidade : '');

        const barA = novo('div', 'forecast-bar forecast-bar--real');
        barA.style.height = pct(va, max).toFixed(1) + '%';
        barA.style.background = corA;
        if (o.mostrarValores !== false) barA.appendChild(novo('span', 'forecast-cap', fmtNum(va)));

        const barB = novo('div', 'forecast-bar forecast-bar--prog');
        barB.style.height = pct(vb, max).toFixed(1) + '%';
        barB.style.background = corB;

        col.appendChild(barA);
        col.appendChild(barB);
        cols.appendChild(col);
    }
    plot.appendChild(cols);
    chart.appendChild(plot);

    const eixoX = novo('div', 'forecast-xaxis');
    for (let i = 0; i < qtd; i++) {
        eixoX.appendChild(novo('span', 'forecast-day', rotulos[i] || String(i + 1)));
    }
    chart.appendChild(eixoX);
    if (o.unidade) chart.appendChild(novo('span', 'forecast-unit', o.unidade));

    sec.appendChild(chart);
    return sec;
}

function pontos(valores, max, largura, altura) {
    const n = valores.length;
    return valores.map((valor, i) => {
        const x = n > 1 ? (i / (n - 1)) * largura : largura / 2;
        const y = altura - (pct(valor, max) / 100) * altura;
        return x.toFixed(2) + ',' + y.toFixed(2);
    }).join(' ');
}

function montarLinha(o) {
    const rotulos = lista(o.rotulos);
    const a = numeros(o.valoresA);
    const b = numeros(o.valoresB);
    const temB = !!(o.serieB && b.length);
    const max = topoEixo(a.concat(temB ? b : []), Number(o.max));

    const sec = secao(o.titulo);
    const chart = novo('div', 'linha-chart');

    const plot = novo('div', 'linha-plot');
    const g = novo('div', 'linha-grid');
    g.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 4; i++) g.appendChild(novo('i'));
    plot.appendChild(g);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'linha-svg');
    svg.setAttribute('viewBox', '0 0 300 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', (o.titulo || 'Gráfico de linha'));

    function serie(valores, cor) {
        const linha = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        linha.setAttribute('class', 'linha-serie');
        linha.setAttribute('points', pontos(valores, max, 300, 100));
        linha.style.stroke = cor;
        return linha;
    }

    if (a.length) svg.appendChild(serie(a, corDe(o.corA)));
    if (temB) svg.appendChild(serie(b, corDe(o.corB)));
    plot.appendChild(svg);

    function etiqueta(nome, valores, cor) {
        const ultimo = valores[valores.length - 1] || 0;
        const tag = novo('span', 'serie-tag');
        tag.style.color = cor;
        tag.style.top = (100 - pct(ultimo, max)).toFixed(1) + '%';
        tag.appendChild(document.createTextNode(nome));
        const forte = novo('b', null, fmtNum(ultimo) + (o.unidade || ''));
        tag.appendChild(forte);
        return tag;
    }

    if (a.length) plot.appendChild(etiqueta(o.serieA || 'A', a, corDe(o.corA)));
    if (temB) plot.appendChild(etiqueta(o.serieB, b, corDe(o.corB)));

    chart.appendChild(plot);

    const eixo = novo('div', 'linha-eixo');
    const passos = Math.max(rotulos.length, a.length) || 1;
    for (let i = 0; i < passos; i++) eixo.appendChild(novo('span', null, rotulos[i] || String(i + 1)));
    chart.appendChild(eixo);

    sec.appendChild(chart);
    return sec;
}

function montarRanking(o) {
    const rotulos = lista(o.rotulos);
    const valores = numeros(o.valores);
    const qtd = Math.max(rotulos.length, valores.length) || 1;
    const informado = Number(o.max);
    const max = informado > 0 ? informado : (valores.length ? Math.max.apply(null, valores) : 100);

    const sec = secao(o.titulo);
    const box = novo('div', 'rank-list');

    for (let i = 0; i < qtd; i++) {
        const valor = valores[i] || 0;
        const parte = pct(valor, max);
        const item = novo('div', 'rank-item');

        const cabeca = novo('div', 'rank-head');
        cabeca.appendChild(novo('span', 'rank-nome', rotulos[i] || ('Item ' + (i + 1))));
        cabeca.appendChild(novo('span', 'rank-valor', fmtNum(valor) + (o.unidade ? ' ' + o.unidade : '')));
        item.appendChild(cabeca);

        const barra = novo('div', 'progress-bar');
        const preenchido = novo('div', 'progress');
        preenchido.style.width = parte.toFixed(1) + '%';
        preenchido.style.background = corDe(o.cor);
        barra.appendChild(preenchido);
        item.appendChild(barra);

        if (o.mostrarPercent !== false) {
            const label = novo('div', 'progress-label', String(Math.round(parte)));
            label.appendChild(novo('span', 'pct-sign', '%'));
            item.appendChild(label);
        }

        box.appendChild(item);
    }

    sec.appendChild(box);
    return sec;
}

function montarEmpilhada(o) {
    const rotulos = lista(o.rotulos);
    const valores = numeros(o.valores);
    const cores = lista(o.cores);
    const soma = valores.reduce((a, b) => a + b, 0) || 1;

    const sec = secao(o.titulo);
    if (o.mostrarLegenda !== false) {
        sec.appendChild(legenda(rotulos.map((nome, i) => ({
            nome: nome,
            cor: corDe(cores[i] || PALETA[i % PALETA.length].id)
        }))));
    }

    const linha = novo('div', 'stack-row');
    const trilho = novo('div', 'stack-track');
    valores.forEach((valor, i) => {
        const seg = novo('div', 'stack-seg');
        seg.style.width = ((valor / soma) * 100).toFixed(1) + '%';
        seg.style.background = corDe(cores[i] || PALETA[i % PALETA.length].id);
        seg.appendChild(novo('span', 'stack-value',
            (rotulos[i] ? rotulos[i] + ' · ' : '') + fmtNum(valor) + (o.unidade ? ' ' + o.unidade : '')));
        trilho.appendChild(seg);
    });
    linha.appendChild(trilho);
    sec.appendChild(linha);
    return sec;
}

function montarRosca(o) {
    const rotulos = lista(o.rotulos);
    const valores = numeros(o.valores);
    const cores = lista(o.cores);

    const sec = secao(o.titulo);
    const card = novo('div', 'donut-card');

    const visual = novo('div', 'donut-visual');
    const buraco = novo('span', 'donut-hole');
    buraco.appendChild(novo('b', 'donut-total', '0'));
    buraco.appendChild(novo('small', 'donut-unidade', o.unidade || ''));
    visual.appendChild(buraco);
    card.appendChild(visual);

    const legendaBox = novo('div', 'donut-legenda');
    rotulos.forEach((nome, i) => {
        const item = novo('div', 'donut-item');
        item.dataset.cor = corDe(cores[i] || PALETA[i % PALETA.length].id);
        item.appendChild(novo('i', 'donut-key'));
        item.appendChild(novo('span', 'donut-nome', nome));
        item.appendChild(novo('b', 'donut-valor', fmtNum(valores[i] || 0)));
        item.appendChild(novo('span', 'donut-pct', '0%'));
        legendaBox.appendChild(item);
    });
    card.appendChild(legendaBox);

    sec.appendChild(card);
    desenharRosca(card);
    return sec;
}

function montarMedidores(o) {
    const rotulos = lista(o.rotulos);
    const valores = numeros(o.valores);
    const topos = lista(o.topos);
    const volumes = lista(o.volumes);
    const qtd = Math.max(rotulos.length, valores.length) || 1;

    const sec = secao(o.titulo);
    const grid = novo('div', 'silo-grid');

    for (let i = 0; i < qtd; i++) {
        const valor = Math.max(0, Math.min(100, valores[i] || 0));
        const item = novo('div', 'silo-item');

        const cabeca = novo('div', 'silo-header');
        cabeca.appendChild(novo('span', 'silo-name', rotulos[i] || ('MEDIDOR ' + (i + 1))));
        cabeca.appendChild(novo('span', 'silo-temp', topos[i] || ''));
        item.appendChild(cabeca);

        const visual = novo('div', 'silo-visual');
        const cheio = novo('div', 'silo-fill');
        cheio.style.height = valor + '%';
        cheio.style.background = corDe(o.cor);
        visual.appendChild(cheio);
        item.appendChild(visual);

        const rodape = novo('div', 'silo-footer');
        rodape.appendChild(novo('span', 'silo-volume', volumes[i] || ''));
        rodape.appendChild(novo('span', 'silo-percent', Math.round(valor) + '%'));
        item.appendChild(rodape);

        grid.appendChild(item);
    }

    sec.appendChild(grid);
    return sec;
}

function montarKpis(o) {
    const rotulos = lista(o.rotulos);
    const valores = lista(o.valores);
    const qtd = Math.max(rotulos.length, valores.length) || 1;
    const pequeno = o.tamanho === 'pequeno';

    const sec = secao(o.titulo);
    const grid = novo('div', pequeno ? 'kpi-grid-small' : 'kpi-grid');
    for (let i = 0; i < qtd; i++) {
        const card = novo('div', pequeno ? 'kpi-card-small' : 'kpi-card');
        card.appendChild(novo('div', pequeno ? 'kpi-label-small' : 'kpi-label', rotulos[i] || ('INDICADOR ' + (i + 1))));
        card.appendChild(novo('div', pequeno ? 'kpi-value-small' : 'kpi-value', valores[i] || '0'));
        grid.appendChild(card);
    }
    sec.appendChild(grid);
    return sec;
}

function montarTabela(o) {
    const colunas = lista(o.colunas);
    const conteudo = String(o.conteudo || '').split('\n').map((l) => l.trim()).filter((l) => l.length);
    const qtdLinhas = Math.max(Number(o.linhas) || 0, conteudo.length) || 1;

    const sec = secao(o.titulo);
    const rolagem = novo('div', 'table-scroll');
    const tabela = novo('table', 'data-table');

    const thead = novo('thead');
    const trh = novo('tr');
    colunas.forEach((nome) => trh.appendChild(novo('th', null, nome)));
    thead.appendChild(trh);
    tabela.appendChild(thead);

    const tbody = novo('tbody');
    for (let i = 0; i < qtdLinhas; i++) {
        const tr = novo('tr');
        const celulas = conteudo[i] ? conteudo[i].split(/\s*;\s*|\s*\|\s*/) : [];
        for (let c = 0; c < colunas.length; c++) {
            tr.appendChild(novo('td', null, celulas[c] !== undefined ? celulas[c] : ''));
        }
        tbody.appendChild(tr);
    }
    tabela.appendChild(tbody);

    rolagem.appendChild(tabela);
    sec.appendChild(rolagem);
    return sec;
}

function montarStatus(o) {
    const rotulos = lista(o.rotulos);
    const estados = lista(o.estados);
    const mapa = { ok: 'ok', atencao: 'warning', alerta: 'alert' };

    const sec = secao(o.titulo);
    const barra = novo('div', 'status-bar');
    rotulos.forEach((texto, i) => {
        const estado = mapa[(estados[i] || 'ok').toLowerCase()] || 'ok';
        const item = novo('div', 'status-item ' + estado);
        item.appendChild(novo('div', 'status-dot'));
        item.appendChild(novo('span', null, texto));
        barra.appendChild(item);
    });
    sec.appendChild(barra);
    return sec;
}

function montarTexto(o) {
    const sec = secao(o.titulo);
    sec.appendChild(novo('p', 'nota-texto', o.conteudo || ''));
    return sec;
}

function montarColunas(o) {
    const qtd = Math.max(2, Math.min(4, Number(o.quantidade) || 2));
    const titulos = lista(o.titulos);
    const grid = novo('div', 'split-grid');
    grid.style.gridTemplateColumns = 'repeat(' + qtd + ', 1fr)';
    for (let i = 0; i < qtd; i++) {
        grid.appendChild(secao(titulos[i] || ('PAINEL ' + (i + 1))));
    }
    return grid;
}

function construir(tipoId, opcoes) {
    const tipo = tipoPorId(tipoId);
    if (!tipo) return null;
    const el = tipo.montar(opcoes);
    // colunas viram recipiente de outros blocos: refazer pelo painel
    // apagaria o que foi colocado dentro, então elas não ganham o ⚙
    return tipoId === 'colunas' ? el : marcar(el, tipoId, opcoes);
}

// ============================================
// PAINEL DE COMPONENTES
// ============================================
let painel = null;
let painelModo = 'novo';
let painelTipo = CATALOGO[0].id;
let painelBloco = null;

function construirPainel() {
    const modal = novo('div', 'editor-modal');
    modal.id = 'editorModal';
    modal.hidden = true;

    const fundo = novo('div', 'editor-modal-backdrop');
    fundo.dataset.fecharPainel = '1';
    modal.appendChild(fundo);

    const caixa = novo('div', 'editor-modal-box');
    caixa.setAttribute('role', 'dialog');
    caixa.setAttribute('aria-modal', 'true');
    caixa.setAttribute('aria-labelledby', 'editorModalTitulo');

    const topo = novo('header', 'editor-modal-head');
    const titulo = novo('strong', 'editor-modal-titulo', 'ADICIONAR COMPONENTE');
    titulo.id = 'editorModalTitulo';
    const fechar = novo('button', 'editor-x', '✕');
    fechar.type = 'button';
    fechar.title = 'Fechar';
    fechar.dataset.fecharPainel = '1';
    topo.appendChild(titulo);
    topo.appendChild(fechar);
    caixa.appendChild(topo);

    const corpo = novo('div', 'editor-modal-body');
    const catalogo = novo('div', 'editor-catalogo');
    const form = novo('div', 'editor-form');
    corpo.appendChild(catalogo);
    corpo.appendChild(form);
    caixa.appendChild(corpo);

    const rodape = novo('footer', 'editor-modal-foot');
    const campoDestino = novo('label', 'editor-campo editor-campo--destino');
    campoDestino.appendChild(novo('span', 'editor-campo-rotulo', 'Onde inserir'));
    const destino = novo('select', 'editor-input');
    campoDestino.appendChild(destino);
    rodape.appendChild(campoDestino);

    const botoes = novo('div', 'editor-foot-btns');
    const cancelar = novo('button', 'editor-btn', 'CANCELAR');
    cancelar.type = 'button';
    cancelar.dataset.fecharPainel = '1';
    const confirmar = novo('button', 'editor-btn editor-btn--primary', 'ADICIONAR');
    confirmar.type = 'button';
    botoes.appendChild(cancelar);
    botoes.appendChild(confirmar);
    rodape.appendChild(botoes);
    caixa.appendChild(rodape);

    modal.appendChild(caixa);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target instanceof Element && e.target.closest('[data-fechar-painel]')) fecharPainel();
    });
    confirmar.addEventListener('click', confirmarPainel);

    return {
        modal: modal,
        titulo: titulo,
        catalogo: catalogo,
        form: form,
        destino: destino,
        campoDestino: campoDestino,
        confirmar: confirmar
    };
}

function desenharCatalogo() {
    painel.catalogo.textContent = '';
    CATALOGO.forEach((tipo) => {
        const item = novo('button', 'editor-tipo' + (tipo.id === painelTipo ? ' is-active' : ''));
        item.type = 'button';
        item.dataset.tipo = tipo.id;
        item.appendChild(novo('span', 'editor-tipo-icone', tipo.icone));
        const texto = novo('span', 'editor-tipo-texto');
        texto.appendChild(novo('strong', null, tipo.nome));
        texto.appendChild(novo('small', null, tipo.resumo));
        item.appendChild(texto);
        item.addEventListener('click', () => {
            painelTipo = tipo.id;
            desenharCatalogo();
            desenharFormulario(null);
        });
        painel.catalogo.appendChild(item);
    });
    painel.catalogo.hidden = painelModo === 'editar';
}

function desenharFormulario(valores) {
    const tipo = tipoPorId(painelTipo);
    painel.form.textContent = '';
    if (!tipo) return;

    painel.form.appendChild(novo('h4', 'editor-form-titulo', tipo.nome));

    tipo.campos.forEach((campo) => {
        const atual = valores && valores[campo.nome] !== undefined ? valores[campo.nome] : campo.padrao;
        const wrap = novo('label', 'editor-campo' + (campo.tipo === 'check' ? ' editor-campo--check' : ''));

        if (campo.tipo !== 'check') wrap.appendChild(novo('span', 'editor-campo-rotulo', campo.rotulo));

        let entrada;
        if (campo.tipo === 'textarea') {
            entrada = novo('textarea', 'editor-input editor-input--area');
            entrada.rows = 2;
            entrada.value = atual === undefined ? '' : String(atual);
        } else if (campo.tipo === 'select') {
            entrada = novo('select', 'editor-input');
            (campo.opcoes || []).forEach((op) => {
                const opt = novo('option', null, op.texto);
                opt.value = op.valor;
                if (op.valor === atual) opt.selected = true;
                entrada.appendChild(opt);
            });
        } else if (campo.tipo === 'check') {
            entrada = document.createElement('input');
            entrada.type = 'checkbox';
            entrada.className = 'editor-check';
            entrada.checked = atual !== false;
        } else {
            entrada = document.createElement('input');
            entrada.type = campo.tipo === 'number' ? 'number' : 'text';
            entrada.className = 'editor-input';
            entrada.value = atual === undefined ? '' : String(atual);
        }

        entrada.dataset.campo = campo.nome;
        entrada.dataset.campoTipo = campo.tipo;
        wrap.appendChild(entrada);

        if (campo.tipo === 'check') wrap.appendChild(novo('span', 'editor-campo-rotulo', campo.rotulo));
        if (campo.dica) wrap.appendChild(novo('small', 'editor-campo-dica', campo.dica));

        painel.form.appendChild(wrap);
    });
}

function lerFormulario() {
    const opcoes = {};
    painel.form.querySelectorAll('[data-campo]').forEach((entrada) => {
        const nome = entrada.dataset.campo;
        if (entrada.dataset.campoTipo === 'check') opcoes[nome] = entrada.checked;
        else if (entrada.dataset.campoTipo === 'number') opcoes[nome] = Number(entrada.value) || 0;
        else opcoes[nome] = entrada.value;
    });
    return opcoes;
}

function telaAtual() {
    if (alertsPageOpen()) return alertsPage;
    return document.querySelector('.screen.active') || allScreens()[0] || null;
}

function desenharDestinos() {
    const destino = painel.destino;
    destino.textContent = '';

    function opcao(valor, texto) {
        const opt = novo('option', null, texto);
        opt.value = valor;
        destino.appendChild(opt);
    }

    if (selecionado) opcao('depois', 'Logo depois do bloco selecionado');
    opcao('fim', 'No fim da tela atual');
    opcao('inicio', 'No começo da tela atual');

    const tela = telaAtual();
    if (tela) {
        tela.querySelectorAll('.content-section, .split-grid').forEach((sec, i) => {
            const h = sec.querySelector('h3');
            opcao('dentro:' + i, 'Dentro de: ' + (h ? textoSemAlca(h).trim().slice(0, 42) : 'painel ' + (i + 1)));
        });
    }
}

function inserirBloco(el, destino) {
    const tela = telaAtual();
    if (!tela) return;

    if (destino === 'depois' && selecionado && selecionado.parentElement && selecionado.isConnected) {
        selecionado.parentElement.insertBefore(el, selecionado.nextSibling);
        return;
    }
    if (destino.indexOf('dentro:') === 0) {
        const alvos = tela.querySelectorAll('.content-section, .split-grid');
        const alvo = alvos[Number(destino.split(':')[1])];
        (alvo || tela).appendChild(el);
        return;
    }
    if (destino === 'inicio') {
        const cabecalho = tela.querySelector('.screen-header');
        tela.insertBefore(el, cabecalho ? cabecalho.nextSibling : tela.firstChild);
        return;
    }
    tela.appendChild(el);
}

function abrirPainel(modo, bloco) {
    if (!painel) painel = construirPainel();

    painelModo = modo === 'editar' ? 'editar' : 'novo';
    painelBloco = painelModo === 'editar' ? bloco : null;

    let valores = null;
    if (painelModo === 'editar' && bloco) {
        painelTipo = bloco.dataset.comp || painelTipo;
        try {
            valores = JSON.parse(bloco.dataset.compOpts || '{}');
        } catch (err) {
            valores = null;
        }
    }

    painel.titulo.textContent = painelModo === 'editar' ? 'CONFIGURAR COMPONENTE' : 'ADICIONAR COMPONENTE';
    painel.confirmar.textContent = painelModo === 'editar' ? 'APLICAR' : 'ADICIONAR';
    painel.campoDestino.hidden = painelModo === 'editar';

    desenharCatalogo();
    desenharFormulario(valores);
    if (painelModo === 'novo') desenharDestinos();

    painel.modal.hidden = false;
    const primeiro = painel.form.querySelector('.editor-input');
    if (primeiro) primeiro.focus();
}

function fecharPainel() {
    if (painel) painel.modal.hidden = true;
    painelBloco = null;
}

function confirmarPainel() {
    const opcoes = lerFormulario();
    const el = construir(painelTipo, opcoes);
    if (!el) return;

    registrar();

    if (painelModo === 'editar' && painelBloco && painelBloco.parentElement) {
        // mantém tamanho ajustado à mão e o lugar exato do bloco antigo
        el.style.cssText = painelBloco.style.cssText;
        painelBloco.parentElement.replaceChild(el, painelBloco);
        aviso('Componente atualizado.');
    } else {
        inserirBloco(el, painel.destino.value || 'fim');
        aviso('Componente adicionado.');
    }

    fecharPainel();
    applyEditMode(true);
    desenharRoscas(palco);
    selecionar(el.closest('[data-drag-group]') || el);
    scheduleFit();
    el.scrollIntoView({ block: 'nearest' });
}

// ============================================
// BARRA DO EDITOR
// ============================================
let barraEditor = null;

function construirBarra() {
    const barra = novo('div', 'editor-bar');
    barra.id = 'editorBar';
    barra.hidden = true;

    barra.appendChild(novo('span', 'editor-bar-tag', 'MODO EDIÇÃO'));

    const acoes = [
        { acao: 'adicionar', texto: '+ ADICIONAR', classe: 'editor-btn editor-btn--primary', titulo: 'Adicionar gráfico, tabela, indicador…' },
        { acao: 'desfazer', texto: 'DESFAZER', classe: 'editor-btn', titulo: 'Desfazer (Ctrl+Z)' },
        { acao: 'refazer', texto: 'REFAZER', classe: 'editor-btn', titulo: 'Refazer (Ctrl+Shift+Z)' },
        { acao: 'salvar', texto: 'SALVAR', classe: 'editor-btn', titulo: 'Guardar o layout neste navegador' },
        { acao: 'restaurar', texto: 'RESTAURAR PADRÃO', classe: 'editor-btn editor-btn--ghost', titulo: 'Voltar ao layout original' }
    ];

    acoes.forEach((item) => {
        const btn = novo('button', item.classe, item.texto);
        btn.type = 'button';
        btn.dataset.editorAcao = item.acao;
        btn.title = item.titulo;
        barra.appendChild(btn);
    });

    barra.appendChild(novo('span', 'editor-bar-dica',
        'clique no texto para editar · ⠿ move o bloco e também cada informação (a alça aparece ao passar o mouse) · ⤡ redimensiona · ⧉ duplica · ✕ remove · Del apaga o selecionado'));

    barra.addEventListener('click', (e) => {
        if (!(e.target instanceof Element)) return;
        const btn = e.target.closest('[data-editor-acao]');
        if (!btn) return;
        const acao = btn.dataset.editorAcao;
        if (acao === 'adicionar') abrirPainel('novo', null);
        else if (acao === 'desfazer') desfazer();
        else if (acao === 'refazer') refazer();
        else if (acao === 'salvar') salvarLayout(false);
        else if (acao === 'restaurar') restaurarPadrao();
    });

    document.body.appendChild(barra);
    return barra;
}

function atualizarBotoesHistorico() {
    if (!barraEditor) return;
    const desfazerBtn = barraEditor.querySelector('[data-editor-acao="desfazer"]');
    const refazerBtn = barraEditor.querySelector('[data-editor-acao="refazer"]');
    if (desfazerBtn) desfazerBtn.disabled = historico.length === 0;
    if (refazerBtn) refazerBtn.disabled = futuro.length === 0;
}

function sincronizarEditor(ativo) {
    if (!barraEditor) barraEditor = construirBarra();
    barraEditor.hidden = !ativo;
    if (!ativo) {
        fecharPainel();
        selecionar(null);
    }
    atualizarBotoesHistorico();
}


// ============================================
// FILTRO DE CULTURA (RECEBIMENTO POR GRAO)
// O grafico empilha ate quatro culturas no mesmo dia. O menu isola uma delas
// e o resto da secao acompanha: resumo, legenda, eixo, tabela e tooltip.
// Nada fica guardado em memoria: cada estado (inclusive TODAS) e reconstruido
// a partir dos data-attributes por cultura das colunas, que sao a fonte.
// ============================================
const GRAO_CHAVES = ['milho', 'sorgo', 'trigo', 'soja'];
const GRAO_VAZIO = '\u2014';

function graoNumero(txt) {
    const limpo = String(txt).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
    const n = parseFloat(limpo);
    return isFinite(n) ? n : 0;
}

// "900 t \u00b7 prog 950 t" ou "\u2014 \u00b7 prog 1.100 t";
// atributo ausente = a cultura nao veio naquele dia
function lerCultura(col, chave) {
    const bruto = col.dataset[chave];
    if (!bruto) return null;
    const partes = String(bruto).split('\u00b7');
    const real = partes[0];
    const prog = partes[1] || '';
    return {
        real: real.indexOf(GRAO_VAZIO) >= 0 ? null : graoNumero(real),
        prog: !prog || prog.indexOf(GRAO_VAZIO) >= 0 ? null : graoNumero(prog)
    };
}

function graoAtivoDe(secao) {
    const btn = secao ? secao.querySelector('.grao-filter-btn.is-active') : null;
    return btn ? btn.dataset.grao : 'todas';
}

// soma das culturas escolhidas na coluna; null = sem dado (dia futuro)
function totaisDaColuna(col, grao) {
    const chaves = grao === 'todas' ? GRAO_CHAVES : [grao];
    const itens = [];
    let real = null;
    let prog = null;
    chaves.forEach((k) => {
        const d = lerCultura(col, k);
        if (!d) return;
        itens.push({ chave: k, real: d.real, prog: d.prog });
        if (d.real != null) real = (real || 0) + d.real;
        if (d.prog != null) prog = (prog || 0) + d.prog;
    });
    return { itens: itens, real: real, prog: prog };
}

function pintarBarra(bar, itens, campo, total, max, comCap) {
    if (!bar) return;

    Array.prototype.slice.call(bar.querySelectorAll('.forecast-seg')).forEach((seg) => seg.remove());

    const cap = bar.querySelector('.forecast-cap');
    const vazia = total == null || total <= 0 || !(max > 0);
    bar.classList.toggle('is-empty', vazia);
    bar.classList.toggle('is-stack', !vazia);
    bar.style.height = vazia ? '0%' : Math.min(100, (total / max) * 100).toFixed(1) + '%';

    if (comCap && !vazia) {
        if (cap) {
            escreverTexto(cap, formatTon(total));
        } else {
            bar.insertBefore(novo('span', 'forecast-cap', formatTon(total)), bar.firstChild);
        }
    } else if (cap) {
        cap.remove();
    }

    if (vazia) return;

    // a pilha desenha de cima para baixo: a ultima cultura da lista fica na base
    itens.slice().reverse().forEach((item) => {
        const valor = item[campo];
        if (valor == null || valor <= 0) return;
        const seg = novo('i', 'forecast-seg forecast-seg--' + item.chave);
        seg.style.height = ((valor / total) * 100).toFixed(1) + '%';
        bar.appendChild(seg);
    });
}

function pintarEixo(chart, max) {
    const spans = chart.querySelectorAll('.forecast-yaxis span');
    chart.dataset.chartMax = String(max);
    const passos = spans.length - 1;
    if (passos < 1) return;
    spans.forEach((span, i) => {
        escreverTexto(span, formatTon(max * (passos - i) / passos));
    });
}

// com uma cultura so, o eixo cheio deixaria as barras rasteiras: a escala
// encolhe em degraus redondos, nunca passando do topo original
function escalaPara(pico, base) {
    if (!(pico > 0)) return base;
    const passo = base / 6;
    const alvo = Math.ceil(pico / passo) * passo;
    return Math.min(base, Math.max(passo, alvo));
}

function atualizarResumoGrao(secao, grao) {
    const stats = secao.querySelectorAll('.forecast-summary .forecast-stat-value');
    if (stats.length < 4) return;

    const hoje = secao.querySelector('.forecast-col.is-today');
    const passados = secao.querySelectorAll('.forecast-col.is-passado');
    const t = hoje ? totaisDaColuna(hoje, grao) : { real: null, prog: null };

    escreverTexto(stats[0], t.real == null ? GRAO_VAZIO : formatTon(t.real) + ' t');
    escreverTexto(stats[1], t.prog == null ? GRAO_VAZIO : formatTon(t.prog) + ' t');
    escreverTexto(stats[2], t.real == null || !(t.prog > 0)
        ? GRAO_VAZIO
        : Math.round((t.real / t.prog) * 100) + '%');

    let soma = 0;
    passados.forEach((col) => {
        soma += totaisDaColuna(col, grao).real || 0;
    });
    escreverTexto(stats[3], passados.length ? formatTon(soma / passados.length) + ' t' : GRAO_VAZIO);
}

function atualizarTabelaGrao(secao, grao) {
    const tabela = secao.querySelector('.forecast-table .data-table');
    if (!tabela) return;

    const cabecalhos = Array.prototype.slice.call(tabela.querySelectorAll('thead th'));
    // a posicao de cada cultura sai do proprio cabecalho, nao de indice fixo
    const escondida = {};
    cabecalhos.forEach((th, i) => {
        const nome = textoSemAlca(th).trim().toLowerCase();
        const cultura = GRAO_CHAVES.filter((k) => nome.indexOf(k) === 0)[0];
        if (cultura) escondida[i] = grao !== 'todas' && cultura !== grao;
        th.classList.toggle('is-oculto', !!escondida[i]);
    });

    const colunas = secao.querySelectorAll('.forecast-col');
    tabela.querySelectorAll('tbody tr').forEach((tr, i) => {
        const celulas = tr.querySelectorAll('td');
        celulas.forEach((td, j) => td.classList.toggle('is-oculto', !!escondida[j]));

        const col = colunas[i];
        if (!col || celulas.length < 3) return;

        const d = totaisDaColuna(col, grao);
        const real = celulas[celulas.length - 3];
        const prog = celulas[celulas.length - 2];
        const pct = celulas[celulas.length - 1];

        escreverTexto(real, d.real == null ? GRAO_VAZIO : formatTon(d.real) + ' t');
        escreverTexto(prog, d.prog == null ? GRAO_VAZIO : formatTon(d.prog) + ' t');
        real.classList.toggle('is-vazio', d.real == null);
        prog.classList.toggle('is-vazio', d.prog == null);

        const temPct = d.real != null && d.prog > 0;
        const valor = temPct ? Math.round((d.real / d.prog) * 100) : 0;
        escreverTexto(pct, temPct ? valor + '%' : GRAO_VAZIO);
        pct.classList.toggle('pct-ok', temPct && valor >= 90);
        pct.classList.toggle('pct-mid', temPct && valor < 90);
    });
}

function aplicarFiltroGrao(secao, grao) {
    const chart = secao.querySelector('.forecast-chart--dias');
    const colunas = secao.querySelectorAll('.forecast-col');
    if (!chart || !colunas.length) return;

    // o topo do eixo de TODAS e a referencia; o filtro so encolhe a escala
    if (!chart.dataset.chartMaxBase) {
        chart.dataset.chartMaxBase = chart.dataset.chartMax || String(FORECAST_MAX);
    }
    const base = Number(chart.dataset.chartMaxBase) || FORECAST_MAX;

    const dados = [];
    let pico = 0;
    colunas.forEach((col) => {
        const d = totaisDaColuna(col, grao);
        dados.push(d);
        pico = Math.max(pico, d.real || 0, d.prog || 0);
    });

    const max = escalaPara(pico, base);
    pintarEixo(chart, max);

    colunas.forEach((col, i) => {
        const d = dados[i];
        const temReal = d.real != null && d.real > 0;
        pintarBarra(col.querySelector('.forecast-bar--real'), d.itens, 'real', d.real, max, true);
        pintarBarra(col.querySelector('.forecast-bar--prog'), d.itens, 'prog', d.prog, max, !temReal);
        col.dataset.recebido = d.real == null ? GRAO_VAZIO : formatTon(d.real) + ' t';
        col.dataset.programado = d.prog == null ? GRAO_VAZIO : formatTon(d.prog) + ' t';
    });

    secao.querySelectorAll('.chart-legend .legend-item').forEach((item) => {
        const texto = textoSemAlca(item).trim().toLowerCase();
        const cultura = GRAO_CHAVES.filter((k) => texto.indexOf(k) >= 0)[0];
        item.classList.toggle('is-oculto', !!cultura && grao !== 'todas' && cultura !== grao);
    });

    atualizarResumoGrao(secao, grao);
    atualizarTabelaGrao(secao, grao);

    // cultura sem nenhum dia na janela: o botao segue clicavel, mas avisa
    secao.querySelectorAll('.grao-filter-btn').forEach((btn) => {
        const k = btn.dataset.grao;
        if (k === 'todas') return;
        let tem = false;
        colunas.forEach((col) => {
            if (col.dataset[k]) tem = true;
        });
        btn.classList.toggle('is-vazia', !tem);
    });
}

// O selo "POR QUE?" saiu dos cartoes: a explicacao continua no mouse over,
// sem o rotulo ocupando espaco. No atingimento do dia a conta saiu inteira,
// porque era do dia todo e nao acompanhava o filtro de cultura. Layout salvo
// antes disso ainda traz as duas coisas, entao elas caem na entrada.
function limparSelosPorQue(raiz) {
    const alvo = raiz || document;
    alvo.querySelectorAll('.motivo-hint').forEach((selo) => selo.remove());
    alvo.querySelectorAll('.forecast-section .forecast-stat').forEach((stat) => {
        stat.classList.remove('forecast-stat--motivo');
        stat.removeAttribute('tabindex');
        Array.prototype.slice.call(stat.attributes).forEach((attr) => {
            if (attr.name.indexOf('data-motivo') === 0) stat.removeAttribute(attr.name);
        });
    });
}

// Layout guardado antes deste menu existir traz a secao sem o filtro: o
// HTML salvo substitui o original inteiro. Em vez de exigir um reset de
// layout, o menu e remontado por cima do que veio do armazenamento.
function garantirFiltroGrao(raiz) {
    const alvo = raiz || document;
    alvo.querySelectorAll('.forecast-section').forEach((secao) => {
        if (!secao.querySelector('.forecast-chart--dias')) return;
        if (secao.querySelector('[data-grao-filter]')) return;

        const cabeca = secao.querySelector('.section-head');
        if (!cabeca) return;

        const menu = novo('div', 'grao-filter');
        menu.dataset.graoFilter = '';
        menu.setAttribute('role', 'group');
        menu.setAttribute('aria-label', 'Filtrar por cultura');
        menu.appendChild(botaoGrao('todas', 'TODAS', true));
        GRAO_CHAVES.forEach((k) => {
            menu.appendChild(botaoGrao(k, k.toUpperCase(), false));
        });

        // o menu divide a barra com o botao de tabela, quando ele existe
        const tabela = cabeca.querySelector('.btn-table-toggle');
        const grupo = novo('div', 'section-head-tools');
        cabeca.appendChild(grupo);
        grupo.appendChild(menu);
        if (tabela) grupo.appendChild(tabela);
    });
}

function botaoGrao(chave, rotulo, ativo) {
    const btn = novo('button', 'grao-filter-btn' + (ativo ? ' is-active' : ''));
    btn.type = 'button';
    btn.dataset.grao = chave;
    btn.setAttribute('aria-pressed', String(ativo));

    if (chave !== 'todas') {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'grao-icon grao-icon--' + chave);
        svg.setAttribute('aria-hidden', 'true');
        const uso = document.createElementNS(NS, 'use');
        uso.setAttribute('href', '#ico-' + chave);
        svg.appendChild(uso);
        btn.appendChild(svg);
    }

    btn.appendChild(document.createTextNode(rotulo));
    return btn;
}

function selecionarGrao(secao, grao) {
    secao.querySelectorAll('.grao-filter-btn').forEach((btn) => {
        const ativo = btn.dataset.grao === grao;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    aplicarFiltroGrao(secao, grao);
    hideVizTooltip();
    hideMotivo();
    scheduleFit();
}

document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.grao-filter-btn') : null;
    if (!btn || isEditing()) return;
    const secao = btn.closest('.forecast-section');
    if (secao) selecionarGrao(secao, btn.dataset.grao || 'todas');
});

// A edicao mexe no HTML e o salva: o layout volta ao estado inteiro antes,
// senao o recorte de uma cultura viraria o dado guardado.
function limparFiltrosGrao() {
    document.querySelectorAll('.forecast-section').forEach((secao) => {
        if (!secao.querySelector('[data-grao-filter]')) return;
        if (graoAtivoDe(secao) !== 'todas') selecionarGrao(secao, 'todas');
    });
}

// ============================================
// FLUXO DE CAMINHOES · FILTRO POR ETAPA
// Os selos de etapa (no cabecalho da tabela e em cada linha) filtram a
// lista: um clique mostra so aquela etapa, outro clique (ou "Todos")
// devolve a lista inteira. Cada linha carrega a etapa em data-etapa.
// ============================================
// As janelas sao encaixadas: uma linha marcada com "hoje" aparece em hoje,
// 7 dias e 30 dias; o CSS esconde as que estao fora da janela escolhida.
const JANELAS_FLUXO = ['turno', 'hoje', '7d', '30d'];

function noPeriodoFluxo(tr, periodo) {
    const linha = JANELAS_FLUXO.indexOf(tr.dataset.janela || 'turno');
    const limite = JANELAS_FLUXO.indexOf(periodo);
    if (linha < 0 || limite < 0) return true;
    return linha <= limite;
}

function filtrarFluxo(secao, etapa) {
    const tela = secao.closest('[data-fluxo-periodo]');
    const periodo = tela ? tela.dataset.fluxoPeriodo || 'hoje' : 'hoje';
    // a cultura e' o outro filtro da tela: entra junto com o periodo, antes
    // da etapa, para que a contagem dos selos ja saia so com o que esta valendo
    const cultura = tela ? tela.dataset.fluxoCultura || 'todas' : 'todas';
    const linhas = secao.querySelectorAll('tbody tr[data-etapa]');
    const contagem = { todos: 0 };
    let visiveis = 0;
    linhas.forEach((tr) => {
        const dentro = noPeriodoFluxo(tr, periodo)
            && (cultura === 'todas' || tr.dataset.cultura === cultura);
        if (dentro) {
            const chave = tr.dataset.etapa || '';
            contagem[chave] = (contagem[chave] || 0) + 1;
            contagem.todos += 1;
        }
        const mostra = dentro && (etapa === 'todos' || tr.dataset.etapa === etapa);
        tr.hidden = !mostra;
        if (mostra) visiveis += 1;
    });
    // o numero de cada selo e' o que sobra na janela do periodo e na cultura
    secao.querySelectorAll('.fluxo-tabela-resumo [data-fluxo-filtro]').forEach((btn) => {
        const chave = btn.dataset.fluxoFiltro || 'todos';
        const ativo = chave === etapa;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
        const conta = btn.querySelector('[data-fluxo-conta]');
        if (conta) conta.textContent = String(contagem[chave] || 0);
    });
    secao.classList.toggle('is-filtrada', etapa !== 'todos');
    secao.dataset.fluxoEtapa = etapa;

    // os cartoes de etapa no topo da tela sao o mesmo filtro dos selos:
    // o cartao escolhido fica marcado e os outros apagam um pouco
    if (tela) {
        tela.classList.toggle('is-etapa-filtrada', etapa !== 'todos');
        tela.querySelectorAll('.fluxo-etapa[data-fluxo-filtro]').forEach((cartao) => {
            const ativo = cartao.dataset.fluxoFiltro === etapa;
            cartao.classList.toggle('is-active', ativo);
            cartao.setAttribute('aria-pressed', String(ativo));
        });
    }

    // sem linha para mostrar (filtro sem resultado ou dado editado): avisa
    // em vez de deixar a tabela vazia, dizendo qual recorte nao tem caminhao
    let vazio = secao.querySelector('.fluxo-vazio');
    if (!visiveis) {
        if (!vazio) {
            vazio = document.createElement('p');
            vazio.className = 'fluxo-vazio';
            const rolagem = secao.querySelector('.table-scroll');
            if (rolagem) rolagem.appendChild(vazio);
        }
        vazio.textContent = cultura === 'todas'
            ? 'Nenhum caminhão nesta etapa agora.'
            : 'Nenhum caminhão de ' + (NOME_CULTURA_FLUXO[cultura] || cultura)
                + (etapa === 'todos' ? ' no período.' : ' nesta etapa agora.');
    } else if (vazio) {
        vazio.remove();
    }
    if (secao.querySelector('.table-scroll')) secao.querySelector('.table-scroll').scrollTop = 0;
}

// a tabela pode estar em outra secao da mesma tela: e' o caso do cartao de
// etapa, que fica no bloco de cima e filtra a lista de baixo
function secaoTabelaFluxo(alvo) {
    const secao = alvo.closest('.content-section');
    if (secao && secao.querySelector('tbody tr[data-etapa]')) return secao;
    const tela = alvo.closest('.screen');
    const linha = tela ? tela.querySelector('tbody tr[data-etapa]') : null;
    return linha ? linha.closest('.content-section') : null;
}

function acionarFiltroFluxo(alvo) {
    const secao = secaoTabelaFluxo(alvo);
    if (!secao) return;
    const pedida = alvo.dataset.fluxoFiltro || 'todos';
    const atual = secao.dataset.fluxoEtapa || 'todos';
    // clicar na etapa ja ativa desfaz o filtro
    filtrarFluxo(secao, pedida !== 'todos' && pedida === atual ? 'todos' : pedida);
}

document.addEventListener('click', (e) => {
    const alvo = e.target instanceof Element ? e.target.closest('[data-fluxo-filtro]') : null;
    if (!alvo || isEditing()) return;
    e.preventDefault();
    acionarFiltroFluxo(alvo);
});

// selo na linha e cartao de etapa nao sao <button>: Enter/Espaco precisam
// fazer o mesmo que o clique (no botao o navegador ja faz isso sozinho)
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const alvo = e.target instanceof Element ? e.target.closest('[data-fluxo-filtro]:not(button)') : null;
    if (!alvo || isEditing()) return;
    e.preventDefault();
    acionarFiltroFluxo(alvo);
});

// o editor salva o HTML como esta: o filtro volta para "todos" antes,
// senao as linhas escondidas virariam o dado guardado.
function limparFiltrosFluxo() {
    // o periodo tambem volta para "hoje": as contagens dos selos sao escritas
    // pelo filtro e o HTML guardado precisa sair com os valores de origem
    const botaoHoje = document.querySelector('#screen-fluxo .fluxo-periodo-btn[data-fluxo-periodo="hoje"]');
    if (botaoHoje && !botaoHoje.classList.contains('is-active')) escolherPeriodoFluxo(botaoHoje);
    // a cultura tambem volta para "todas" pelo mesmo motivo
    const botaoTodas = document.querySelector('#screen-fluxo button[data-fluxo-cultura="todas"]');
    if (botaoTodas && !botaoTodas.classList.contains('is-active')) escolherCulturaFluxo(botaoTodas);
    document.querySelectorAll('.content-section[data-fluxo-etapa]').forEach((secao) => {
        if (secao.dataset.fluxoEtapa !== 'todos') filtrarFluxo(secao, 'todos');
    });
}

// ============================================
// CLASSIFICACAO · FILTRO GERAL DA TELA (CULTURA + PERIODO)
// O periodo e' escolha unica e mora em data-class-periodo. A cultura e'
// marcacao multipla: as quatro nascem marcadas e cada botao desmarca a sua
// (data-cult-milho, data-cult-sorgo, data-cult-trigo, data-cult-soja na
// tela). Tirar uma cultura tira as linhas dela da tabela, o item dela da
// lista do cartao e o peso dela na conta do indicador — a escala do grafico
// e a leitura da tela melhoram quando uma cultura pequena sai de cena.
// O CSS troca o numero de cada indicador (o HTML traz a versao de "todas" e
// a de cada cultura sozinha); um recorte no meio e' contado aqui e escrito
// num span "mistura". O historico mostra uma cultura por vez: fica na
// primeira que estiver marcada.
// ============================================
const NOME_PERIODO_CLASS = { turno: 'turno', hoje: 'hoje', '7d': '7 dias', '30d': '30 dias' };

const CULTURAS_CLASS = ['milho', 'sorgo', 'trigo', 'soja'];
const PERIODOS_CLASS = ['turno', 'hoje', '7d', '30d'];

// data-cult-milho / data-cult-sorgo / ... guardam quem esta marcado; tudo que
// nao estiver escrito "off" conta como marcado (o HTML nasce com as quatro).
function chaveCulturaClass(cultura) {
    return 'cult' + cultura.charAt(0).toUpperCase() + cultura.slice(1);
}

function culturasMarcadasClass(tela) {
    return CULTURAS_CLASS.filter((c) => tela.dataset[chaveCulturaClass(c)] !== 'off');
}

// os numeros da tela sao texto em pt-BR ("2.940", "12,3%", "—"): le como
// numero para poder somar, e devolve nulo no travessao (cultura sem o ensaio)
function numeroClass(texto) {
    const limpo = String(texto).replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = parseFloat(limpo);
    return Number.isFinite(n) ? n : null;
}

// o resultado sai no mesmo desenho do valor de origem: mesmas casas decimais,
// mesmo ponto de milhar e o "%" quando ele existe
function formatarComoClass(modelo, valor) {
    const casas = (String(modelo).match(/,(\d+)/) || ['', ''])[1].length;
    let texto = valor.toFixed(casas).replace('.', ',');
    if (!casas) texto = texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return String(modelo).indexOf('%') >= 0 ? texto + '%' : texto;
}

// Um grupo de valores e' tudo que tem data-class-agg: o cartao inteiro, ou
// uma linha dentro dele (o queimado mora no cartao de avariados). Cada
// elemento pertence ao grupo mais proximo, entao um grupo nunca le o numero
// do outro.
function dentroDoGrupoClass(grupo, seletor) {
    return Array.prototype.filter.call(
        grupo.querySelectorAll(seletor),
        (el) => el.closest('[data-class-agg]') === grupo
    );
}

// o numero de uma cultura num periodo: sai do proprio <span class="class-cult">
// que o HTML ja traz pronto
function fonteClass(grupo, cultura, periodo) {
    const span = dentroDoGrupoClass(grupo, '.class-cult[data-cultura="' + cultura + '"]')[0];
    return span ? span.querySelector('b[data-periodo="' + periodo + '"]') : null;
}

// peso de cada cultura na media: o numero de cargas classificadas naquele
// periodo. Sem o cartao de cargas a media vira simples (peso 1 para todas).
function pesosClass(tela, periodo) {
    const grupo = tela.querySelector('[data-class-agg="soma"]');
    const pesos = {};
    CULTURAS_CLASS.forEach((c) => {
        const b = grupo ? fonteClass(grupo, c, periodo) : null;
        const n = b ? numeroClass(b.textContent) : null;
        pesos[c] = n === null ? 1 : n;
    });
    return pesos;
}

// valor do indicador com mais de uma cultura marcada: soma nas cargas,
// media ponderada pelas cargas no resto (umidade, impureza, queimado...).
// PH e falling number so existem no trigo: as outras entram como "—" e ficam
// de fora da conta.
function valorMisturaClass(grupo, periodo, marcadas, pesos) {
    const soma = grupo.dataset.classAgg === 'soma';
    let acumulado = 0;
    let peso = 0;
    let modelo = '';
    marcadas.forEach((c) => {
        const b = fonteClass(grupo, c, periodo);
        if (!b) return;
        const n = numeroClass(b.textContent);
        if (n === null) return;
        if (!modelo) modelo = b.textContent.trim();
        const p = soma ? 1 : (pesos[c] || 0);
        acumulado += n * p;
        peso += p;
    });
    if (!modelo || !peso) return '—';
    return formatarComoClass(modelo, soma ? acumulado : acumulado / peso);
}

// os indicadores trazem prontos "todas" e cada cultura sozinha; um recorte no
// meio (tres das quatro, por exemplo) nao existe no HTML e e' contado aqui,
// num <span data-cultura="mistura"> que o CSS mostra no lugar do de "todas".
function escreverMisturaClass(tela, marcadas) {
    const mistura = marcadas.length > 1 && marcadas.length < CULTURAS_CLASS.length;
    const pesos = {};
    if (mistura) PERIODOS_CLASS.forEach((p) => { pesos[p] = pesosClass(tela, p); });
    tela.querySelectorAll('[data-class-agg]').forEach((grupo) => {
        const antigo = dentroDoGrupoClass(grupo, '.class-cult[data-cultura="mistura"]')[0];
        if (antigo) antigo.remove();
        if (!mistura) return;
        const irmaos = dentroDoGrupoClass(grupo, '.class-cult');
        const ultimo = irmaos[irmaos.length - 1];
        if (!ultimo) return;
        const span = document.createElement('span');
        span.className = 'class-cult';
        span.dataset.cultura = 'mistura';
        // marca de gerado: o editor salva o HTML como esta e este span sai fora
        span.dataset.gerado = '1';
        PERIODOS_CLASS.forEach((p) => {
            const b = document.createElement('b');
            b.dataset.periodo = p;
            b.textContent = valorMisturaClass(grupo, p, marcadas, pesos[p]);
            span.appendChild(b);
        });
        // entra logo depois das culturas, antes da unidade ("kg/hL", "s")
        ultimo.parentElement.insertBefore(span, ultimo.nextSibling);
    });
}

// "sem soja" quando falta so uma — e' o recorte que mais se pede; nos outros
// casos lista as culturas que ficaram
function nomeRecorteClass(marcadas) {
    if (marcadas.length === CULTURAS_CLASS.length) return '';
    const fora = CULTURAS_CLASS.filter((c) => marcadas.indexOf(c) < 0);
    if (fora.length === 1) return ' · sem ' + fora[0];
    if (marcadas.length === 1) return ' · ' + marcadas[0];
    return ' · ' + marcadas.slice(0, -1).join(', ') + ' e ' + marcadas[marcadas.length - 1];
}

// A quebra por cultura saiu do rosto do cartao e vive no balao do mouse over.
// A lista e' montada dos proprios spans do indicador, no periodo que esta
// valendo e so com as culturas marcadas — refeita a cada troca de filtro.
const ROTULO_CULTURA_CLASS = { milho: 'Milho', sorgo: 'Sorgo', trigo: 'Trigo', soja: 'Soja' };

function escreverMotivoClass(tela, marcadas) {
    if (!tela) return;
    const periodo = tela.dataset.classPeriodo || 'hoje';
    const recorte = nomeRecorteClass(marcadas) || ' · todas as culturas';
    tela.querySelectorAll('[data-class-agg]').forEach((grupo) => {
        const itens = marcadas.map((c) => {
            const b = fonteClass(grupo, c, periodo);
            return ROTULO_CULTURA_CLASS[c] + '::' + (b ? b.textContent.trim() : '—');
        });
        grupo.dataset.motivoLista = itens.join('|');
        grupo.dataset.motivoResumo = (NOME_PERIODO_CLASS[periodo] || periodo) + recorte;
    });
}

// O historico tem filtro proprio, no cabecalho do bloco: ele mostra uma
// cultura por vez (as tres metricas dela lado a lado) e nao acompanha o
// recorte do cabecalho da tela, que pode ter varias culturas de uma vez.
function aplicarCulturaHistorico(historico, cultura) {
    if (!historico || !cultura) return;
    historico.dataset.histCultura = cultura;
    historico.querySelectorAll('.hist-seletor-btn').forEach((btn) => {
        const ativo = btn.dataset.histCultura === cultura;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    historico.querySelectorAll('[data-hist-cultura-nome]').forEach((el) => {
        el.textContent = cultura;
    });
}

function escolherCulturaHistorico(alvo) {
    const historico = alvo.closest('.hist-section');
    if (!historico || alvo.disabled) return;
    aplicarCulturaHistorico(historico, alvo.dataset.histCultura);
    scheduleFit();
}

// cultura desmarcada no cabecalho saiu da tela inteira: o botao dela aqui
// fica fora de alcance e, se era a que estava no ar, o historico anda para a
// primeira que sobrou
function sincronizarHistoricoClass(tela, marcadas) {
    const historico = tela.querySelector('.hist-section');
    if (!historico) return;
    historico.querySelectorAll('.hist-seletor-btn').forEach((btn) => {
        const fora = marcadas.indexOf(btn.dataset.histCultura) < 0;
        btn.disabled = fora;
        btn.classList.toggle('is-off', fora);
        btn.title = fora ? 'Cultura desmarcada no filtro da tela' : '';
    });
    const atual = historico.dataset.histCultura;
    aplicarCulturaHistorico(historico, marcadas.indexOf(atual) >= 0 ? atual : marcadas[0]);
}

function aplicarCulturasClassificacao(tela, marcadas) {
    const lista = CULTURAS_CLASS.filter((c) => marcadas.indexOf(c) >= 0);
    const todas = lista.length === CULTURAS_CLASS.length;
    CULTURAS_CLASS.forEach((c) => {
        tela.dataset[chaveCulturaClass(c)] = lista.indexOf(c) >= 0 ? 'on' : 'off';
    });
    // uma so marcada continua valendo pelo nome dela: o HTML ja traz esse
    // recorte pronto. "mistura" e' o caso contado na hora.
    tela.dataset.classCultura = todas ? 'todas' : (lista.length === 1 ? lista[0] : 'mistura');
    tela.querySelectorAll('button[data-class-cultura]').forEach((btn) => {
        const chave = btn.dataset.classCultura;
        if (chave === 'todas') {
            btn.classList.toggle('is-active', todas);
            btn.setAttribute('aria-pressed', String(todas));
            return;
        }
        const marcada = lista.indexOf(chave) >= 0;
        btn.classList.toggle('is-off', !marcada);
        btn.setAttribute('aria-pressed', String(marcada));
        btn.title = (marcada ? 'Desmarcar ' : 'Marcar ') + chave;
    });
    tela.querySelectorAll('[data-class-cultura-nome]').forEach((el) => {
        el.textContent = nomeRecorteClass(lista);
    });
    escreverMisturaClass(tela, lista);
    escreverMotivoClass(tela, lista);
    // o historico tem seletor proprio: a escolha dele fica de pe, e so muda
    // quando a cultura em cena e' desmarcada la em cima
    sincronizarHistoricoClass(tela, lista);
    scheduleFit();
}

// "Todas" remarca as quatro; cada cultura alterna a sua. A ultima marcada nao
// sai sozinha (a tela ficaria vazia): o clique nela devolve todas.
function escolherCulturaClassificacao(alvo) {
    const tela = alvo.closest('#screen-1');
    const cultura = alvo.dataset.classCultura;
    if (!tela || !cultura) return;
    const marcadas = culturasMarcadasClass(tela);
    let novas;
    if (cultura === 'todas') novas = CULTURAS_CLASS.slice();
    else if (marcadas.indexOf(cultura) < 0) novas = marcadas.concat([cultura]);
    else if (marcadas.length === 1) novas = CULTURAS_CLASS.slice();
    else novas = marcadas.filter((c) => c !== cultura);
    aplicarCulturasClassificacao(tela, novas);
}

function escolherPeriodoClassificacao(alvo) {
    const tela = alvo.closest('#screen-1');
    const periodo = alvo.dataset.classPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.classPeriodo = periodo;
    tela.querySelectorAll('.class-periodo-btn').forEach((btn) => {
        const ativo = btn.dataset.classPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    tela.querySelectorAll('[data-class-periodo-nome]').forEach((el) => {
        el.textContent = NOME_PERIODO_CLASS[periodo] || periodo;
    });
    // o balao mostra a quebra por cultura do periodo que esta valendo
    escreverMotivoClass(tela, culturasMarcadasClass(tela));
    scheduleFit();
}

document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || isEditing()) return;
    const cultura = e.target.closest('button[data-class-cultura]');
    if (cultura) {
        e.preventDefault();
        escolherCulturaClassificacao(cultura);
        return;
    }
    const periodo = e.target.closest('.class-periodo-btn');
    if (periodo) {
        e.preventDefault();
        escolherPeriodoClassificacao(periodo);
        return;
    }
    const doHistorico = e.target.closest('.hist-seletor-btn');
    if (doHistorico) {
        e.preventDefault();
        escolherCulturaHistorico(doHistorico);
    }
});

// primeira carga: o balao de cada indicador nasce com a quebra por cultura
// do periodo que veio no HTML
(function () {
    const tela = document.getElementById('screen-1');
    if (tela) escreverMotivoClass(tela, culturasMarcadasClass(tela));
})();

// o editor salva o HTML como esta: a tela volta ao recorte inteiro antes,
// senao o filtro de uma cultura ou de um periodo viraria o dado guardado
function limparFiltrosClassificacao() {
    const todas = document.querySelector('#screen-1 button[data-class-cultura="todas"]');
    if (todas && !todas.classList.contains('is-active')) escolherCulturaClassificacao(todas);
    const hoje = document.querySelector('#screen-1 .class-periodo-btn[data-class-periodo="hoje"]');
    if (hoje && !hoje.classList.contains('is-active')) escolherPeriodoClassificacao(hoje);
    // o historico tambem volta ao milho: e' a cultura que o HTML guarda
    const historico = document.querySelector('#screen-1 .hist-section');
    if (historico && historico.dataset.histCultura !== 'milho') aplicarCulturaHistorico(historico, 'milho');
}

// ============================================
// MOEGAS · FILTRO
// Período é da tela: a section guarda a escolha em data-moega-periodo e vale
// para as seis moegas de uma vez — o CSS troca o bloco "Saiu", a entrada/saída
// (ao vivo no turno, média nos demais) e as trocas de cultura que entram no
// período. Delegado no documento porque o editor remonta o palco.
// ============================================
function escolherPeriodoMoega(alvo) {
    const tela = alvo.closest('.screen--moegas');
    const periodo = alvo.dataset.moegaPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.moegaPeriodo = periodo;
    tela.querySelectorAll('.moega-periodo-btn').forEach((btn) => {
        const ativo = btn.dataset.moegaPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    scheduleFit();
}

// ============================================
// FLUXO · PERIODO E CULTURA DA TELA
// A section guarda as duas escolhas em data-fluxo-periodo / data-fluxo-cultura.
// O periodo vale para tudo:
// o CSS mostra so o valor daquele periodo em cada etapa (quantidade, fila,
// estado e tempo medio) e esconde as linhas fora da janela; o filtro da
// tabela recalcula a contagem dos selos. Delegado no documento.
// ============================================
const NOME_PERIODO_FLUXO = { turno: 'turno', hoje: 'hoje', '7d': '7 dias', '30d': '30 dias' };
const NOME_CULTURA_FLUXO = { milho: 'milho', sorgo: 'sorgo', trigo: 'trigo', soja: 'soja' };

function escolherPeriodoFluxo(alvo) {
    const tela = alvo.closest('#screen-fluxo');
    const periodo = alvo.dataset.fluxoPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.fluxoPeriodo = periodo;
    tela.querySelectorAll('.fluxo-periodo-btn').forEach((btn) => {
        const ativo = btn.dataset.fluxoPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    tela.querySelectorAll('[data-fluxo-periodo-nome]').forEach((el) => {
        el.textContent = NOME_PERIODO_FLUXO[periodo] || periodo;
    });
    // a tabela e os selos seguem o mesmo periodo: refaz o filtro de etapa
    // dentro da nova janela
    atualizarTabelasFluxo(tela);
    scheduleFit();
}

// A cultura mora na mesma section (data-fluxo-cultura) e vale para a tabela
// e para a contagem dos selos; os cartoes de etapa continuam no periodo, que
// e' a foto da planta inteira. Delegado no documento, como o periodo.
function escolherCulturaFluxo(alvo) {
    const tela = alvo.closest('#screen-fluxo');
    const cultura = alvo.dataset.fluxoCultura;
    if (!tela || !cultura) return;
    tela.dataset.fluxoCultura = cultura;
    tela.querySelectorAll('button[data-fluxo-cultura]').forEach((btn) => {
        const ativo = btn.dataset.fluxoCultura === cultura;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    tela.querySelectorAll('[data-fluxo-cultura-nome]').forEach((el) => {
        el.textContent = cultura === 'todas' ? '' : ' · ' + (NOME_CULTURA_FLUXO[cultura] || cultura);
    });
    atualizarTabelasFluxo(tela);
    scheduleFit();
}

function atualizarTabelasFluxo(tela) {
    (tela || document).querySelectorAll('.fluxo-tabela-resumo').forEach((resumo) => {
        const secao = resumo.closest('.content-section');
        if (secao) filtrarFluxo(secao, secao.dataset.fluxoEtapa || 'todos');
    });
}

// primeira carga: alinha linhas e contagens com o periodo que veio no HTML
atualizarTabelasFluxo(document.getElementById('screen-fluxo'));

// ============================================
// EXPEDICAO · FILTRO GERAL (CULTURA + PERIODO)
// As duas escolhas ficam na tela (data-exp-cultura / data-exp-periodo) e o
// CSS faz o resto: esconde as linhas que nao batem nas duas tabelas e troca
// os blocos .exp-periodo-bloco. A tabela de cargas so segue a cultura.
// ============================================
function escolherCulturaExp(alvo) {
    const tela = alvo.closest('#screen-7');
    const cultura = alvo.dataset.expCultura;
    if (!tela || !cultura) return;
    tela.dataset.expCultura = cultura;
    tela.querySelectorAll('button[data-exp-cultura]').forEach((btn) => {
        const ativo = btn.dataset.expCultura === cultura;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    const contratos = tela.querySelector('.exp-contratos');
    if (contratos) atualizarContratos(contratos);
    scheduleFit();
}

// ============================================
// EXPEDICAO · RITMO POR CONTRATO
// O menu "Contratos" guarda a escolha nos proprios checkboxes; cada linha
// .exp-contrato fica hidden quando o seu nao esta marcado. A cultura do
// filtro geral esconde por CSS, entao a mensagem de vazio considera as duas.
// Delegado no documento porque o editor remonta o palco.
// ============================================
function atualizarContratos(bloco) {
    const tela = bloco.closest('#screen-7');
    const cultura = tela ? tela.dataset.expCultura : 'todas';
    const opcoes = bloco.querySelectorAll('.exp-contrato-opcao input');
    const marcados = new Set();
    opcoes.forEach((input) => {
        if (input.checked) marcados.add(input.value);
    });
    let visiveis = 0;
    bloco.querySelectorAll('.exp-contrato').forEach((linha) => {
        const escolhido = marcados.has(linha.dataset.contrato);
        linha.hidden = !escolhido;
        if (escolhido && (!cultura || cultura === 'todas' || linha.dataset.cultura === cultura)) visiveis++;
    });
    const conta = bloco.querySelector('.exp-contratos-conta');
    if (conta) conta.textContent = marcados.size + ' de ' + opcoes.length;
    const vazio = bloco.querySelector('.exp-contratos-vazio');
    if (vazio) vazio.hidden = visiveis > 0;
    scheduleFit();
}

function abrirMenuContratos(bloco, abrir) {
    const btn = bloco.querySelector('.exp-contratos-btn');
    const lista = bloco.querySelector('.exp-contratos-lista');
    if (!btn || !lista) return;
    lista.hidden = !abrir;
    btn.setAttribute('aria-expanded', String(abrir));
}

function fecharMenusContratos(exceto) {
    document.querySelectorAll('.exp-contratos').forEach((bloco) => {
        if (bloco !== exceto) abrirMenuContratos(bloco, false);
    });
}

document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const bloco = e.target.closest('.exp-contratos');
    if (isEditing()) return;
    fecharMenusContratos(e.target.closest('.exp-contratos-menu') ? bloco : null);
    if (!bloco) return;
    const btn = e.target.closest('.exp-contratos-btn');
    if (btn) {
        abrirMenuContratos(bloco, btn.getAttribute('aria-expanded') !== 'true');
        return;
    }
    const acao = e.target.closest('[data-contratos-acao]');
    if (acao) {
        const tipo = acao.dataset.contratosAcao;
        bloco.querySelectorAll('.exp-contrato-opcao input').forEach((input) => {
            const linha = bloco.querySelector('.exp-contrato[data-contrato="' + input.value + '"]');
            const foraDoRitmo = !!linha && !linha.classList.contains('exp-contrato--ok');
            input.checked = tipo === 'todos' || (tipo === 'atrasados' && foraDoRitmo);
        });
        atualizarContratos(bloco);
    }
});

document.addEventListener('change', (e) => {
    if (!(e.target instanceof Element) || !e.target.matches('.exp-contrato-opcao input')) return;
    const bloco = e.target.closest('.exp-contratos');
    if (bloco) atualizarContratos(bloco);
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const aberto = document.querySelector('.exp-contratos-btn[aria-expanded="true"]');
    if (!aberto) return;
    fecharMenusContratos(null);
    aberto.focus();
});

function escolherPeriodoExp(alvo) {
    const tela = alvo.closest('#screen-7');
    const periodo = alvo.dataset.expPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.expPeriodo = periodo;
    tela.querySelectorAll('button[data-exp-periodo]').forEach((btn) => {
        const ativo = btn.dataset.expPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    scheduleFit();
}

// ============================================
// PRODUTIVIDADE · PERIODO DOS KPIs E CARTOES
// Mesmo mecanismo do fluxo: data-prod-periodo na section, CSS mostra so
// os blocos .prod-periodo-bloco do periodo. O grafico por hora nao muda.
// ============================================
function escolherPeriodoProd(alvo) {
    const tela = alvo.closest('#screen-4');
    const periodo = alvo.dataset.prodPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.prodPeriodo = periodo;
    tela.querySelectorAll('[data-prod-periodo]').forEach((btn) => {
        const ativo = btn.dataset.prodPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    scheduleFit();
}

document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || isEditing()) return;
    const culturaExp = e.target.closest('button[data-exp-cultura]');
    if (culturaExp) {
        e.preventDefault();
        escolherCulturaExp(culturaExp);
        return;
    }
    const periodoExp = e.target.closest('button[data-exp-periodo]');
    if (periodoExp) {
        e.preventDefault();
        escolherPeriodoExp(periodoExp);
        return;
    }
    const periodoProd = e.target.closest('button[data-prod-periodo]');
    if (periodoProd) {
        e.preventDefault();
        escolherPeriodoProd(periodoProd);
        return;
    }
    const periodoFluxo = e.target.closest('.fluxo-periodo-btn');
    if (periodoFluxo) {
        e.preventDefault();
        escolherPeriodoFluxo(periodoFluxo);
        return;
    }
    const culturaFluxo = e.target.closest('button[data-fluxo-cultura]');
    if (culturaFluxo) {
        e.preventDefault();
        escolherCulturaFluxo(culturaFluxo);
        return;
    }
    const periodo = e.target.closest('.moega-periodo-btn');
    if (periodo) {
        e.preventDefault();
        escolherPeriodoMoega(periodo);
    }
});

// ============================================
// ATALHOS
// ============================================
document.addEventListener('keydown', (e) => {
    if (!isEditing()) return;

    if (e.key === 'Escape' && painel && !painel.modal.hidden) {
        e.preventDefault();
        fecharPainel();
        return;
    }

    const digitando = document.activeElement
        && (document.activeElement.isContentEditable
            || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        refazer();
        return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        salvarLayout(false);
        return;
    }
    if (!digitando && (e.key === 'Delete' || e.key === 'Backspace') && selecionado) {
        e.preventDefault();
        registrar();
        const alvo = selecionado;
        selecionar(null);
        alvo.remove();
        scheduleFit();
        aviso('Bloco removido — DESFAZER traz de volta.');
    }
});

// arrastar e soltar também entra no histórico: a foto é tirada no
// começo do arraste e só vira registro quando o bloco realmente muda.
let fotoArraste = null;

document.addEventListener('dragstart', () => {
    if (isEditing()) fotoArraste = limparHTML(palco);
});

document.addEventListener('drop', () => {
    const antes = fotoArraste;
    fotoArraste = null;
    registrarSeMudou(antes);
});

document.addEventListener('dragend', () => {
    fotoArraste = null;
});

// ============================================
// PARTIDA
// ============================================
if (palco) {
    layoutOriginal = limparHTML(palco);
    editorPronto = true;
    if (carregarLayout()) reidratarMotivos();
    limparSelosPorQue(palco);
    garantirFiltroGrao(palco);
    desenharRoscas(palco);
    sincronizarEditor(isEditing());
}

// ============================================
// HORÁRIO DE PONTA (AERAÇÃO)
// ============================================
// A ponta é a janela cara da tarifa: 18h às 21h em dias úteis. A tela da
// aeração precisa responder "estamos dentro dela?" de longe, então o
// cartão, o selo e a régua de 24h são repintados a cada segundo. Os
// alvos são procurados a cada tique porque o editor duplica e recarrega
// telas — guardar referências fixas apontaria para nós já descartados.
const PONTA_INICIO = 18;
const PONTA_FIM = 21;

function ehDiaUtil(data) {
    const dia = data.getDay();
    return dia >= 1 && dia <= 5;
}

function emPonta(agora) {
    const h = agora.getHours();
    return ehDiaUtil(agora) && h >= PONTA_INICIO && h < PONTA_FIM;
}

// Próxima virada: o fim da ponta quando estamos dentro dela, senão a
// próxima abertura de janela (pulando fim de semana).
function proximaViradaPonta(agora) {
    const alvo = new Date(agora);
    alvo.setMinutes(0, 0, 0);
    if (emPonta(agora)) {
        alvo.setHours(PONTA_FIM);
        return alvo;
    }
    if (!ehDiaUtil(agora) || agora.getHours() >= PONTA_FIM) {
        alvo.setDate(alvo.getDate() + 1);
    }
    alvo.setHours(PONTA_INICIO);
    while (!ehDiaUtil(alvo)) {
        alvo.setDate(alvo.getDate() + 1);
    }
    return alvo;
}

function formatarContagem(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const dias = Math.floor(total / 86400);
    const horas = String(Math.floor((total % 86400) / 3600)).padStart(2, '0');
    const minutos = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const segundos = String(total % 60).padStart(2, '0');
    if (dias > 0) return `${dias}d ${horas}:${minutos}`;
    return `${horas}:${minutos}:${segundos}`;
}

function atualizarPonta() {
    const agora = new Date();
    const dentro = emPonta(agora);
    const contagem = formatarContagem(proximaViradaPonta(agora) - agora);
    const minutoDoDia = agora.getHours() * 60 + agora.getMinutes();
    const posicao = (minutoDoDia / 1440) * 100;

    document.querySelectorAll('[data-ponta-card]').forEach((el) => {
        el.classList.toggle('ponta-on', dentro);
    });
    document.querySelectorAll('[data-ponta-tarifa]').forEach((el) => {
        el.textContent = dentro ? 'EM PONTA' : 'FORA DE PONTA';
    });
    document.querySelectorAll('[data-ponta-contagem-label]').forEach((el) => {
        el.textContent = dentro ? 'SAI DA PONTA EM' : 'ENTRA EM PONTA EM';
    });
    document.querySelectorAll('[data-ponta-contagem]').forEach((el) => {
        el.textContent = contagem;
    });
    document.querySelectorAll('[data-ponta-status]').forEach((el) => {
        el.classList.toggle('ponta-on', dentro);
    });
    document.querySelectorAll('[data-ponta-badge]').forEach((el) => {
        el.textContent = dentro ? 'EM PONTA' : 'FORA DE PONTA';
    });
    document.querySelectorAll('[data-ponta-msg]').forEach((el) => {
        el.textContent = dentro
            ? 'Silos ligados em pausa · 30 kW evitados · retorno às 21:00'
            : 'Ventiladores liberados · ponta das 18h às 21h (seg–sex)';
    });
    document.querySelectorAll('[data-ponta-agora]').forEach((el) => {
        el.style.left = `${posicao}%`;
    });
}

setInterval(atualizarPonta, 1000);
atualizarPonta();

// ============================================
// SECAGEM · CONTAGEM ATE A PROXIMA LIMPEZA
// Cada secador guarda a hora da proxima limpeza em data-limpeza (HH:MM).
// Se a hora de hoje ja passou, vale a de amanha. O bloco mostra quanto
// falta e entra em alerta na ultima hora.
// ============================================
function atualizarLimpezas() {
    const agora = new Date();
    document.querySelectorAll('[data-limpeza]').forEach((el) => {
        const partes = String(el.dataset.limpeza || '').split(':');
        const h = Number(partes[0]);
        const m = Number(partes[1]);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return;

        const alvo = new Date(agora);
        alvo.setHours(h, m, 0, 0);
        const amanha = alvo <= agora;
        if (amanha) alvo.setDate(alvo.getDate() + 1);

        const faltam = Math.max(0, Math.round((alvo - agora) / 60000));
        const horas = Math.floor(faltam / 60);
        const minutos = faltam % 60;

        const tempo = el.querySelector('[data-limpeza-tempo]');
        const ref = el.querySelector('[data-limpeza-ref]');
        if (tempo) {
            tempo.textContent = horas
                ? horas + 'h' + String(minutos).padStart(2, '0')
                : minutos + 'min';
        }
        if (ref) {
            ref.textContent = (amanha ? 'amanhã' : 'hoje') + ' às ' + el.dataset.limpeza;
        }

        // o anel esvazia conforme a hora chega: cheio logo apos uma limpeza,
        // vazio na hora da proxima
        const intervalo = Number(el.dataset.limpezaIntervalo) || 720;
        const relogio = el.querySelector('.secador-limpeza-relogio');
        if (relogio) {
            relogio.style.setProperty('--p', Math.max(0, Math.min(1, faltam / intervalo)).toFixed(3));
        }
        el.classList.toggle('is-perto', faltam <= 60);
    });
}

setInterval(atualizarLimpezas, 15000);
atualizarLimpezas();

// ============================================
// SILOS & AERAÇÃO
// ============================================
// Cada cartão de silo traz 24 leituras horárias de temperatura em
// data-temps (a última é a atual) e o estado do ventilador em data-aer.
// A curva segue os blocos de 12h (00–12 e 12–24): mostra o bloco anterior
// inteiro, o atual até agora e a projeção até o fim dele, e só é
// redesenhada quando a hora vira; a taxa em °C/h sai das últimas 3 horas.
// O contador de "ligado há" anda a partir
// do carregamento — na planta o acumulado viria do CLP, aqui ele avança
// sozinho para o cartão não congelar no videowall. Silos com
// data-pausa-ponta param sozinhos das 18h às 21h, acompanhando a faixa
// de ponta no topo da tela.
const SILOS_INICIO = Date.now();
const TAXA_ALERTA = 0.3; // °C/h: acima disso o cartão inteiro avisa

function formatarDuracao(segundos) {
    const total = Math.max(0, Math.floor(segundos));
    const horas = String(Math.floor(total / 3600)).padStart(2, '0');
    const minutos = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const restoSeg = String(total % 60).padStart(2, '0');
    return `${horas}:${minutos}:${restoSeg}`;
}

function formatarTemperatura(valor) {
    return `${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°C`;
}

// Sparkline em viewBox 100x32: uma curva reta ganha meio grau de folga
// para não virar uma linha colada no fundo. O eixo tem sempre dois blocos
// de 12h (ex.: 00:00 · 12:00 · 00:00), com o horário embaixo: linha cheia
// do começo até agora e, dali até o fim do bloco atual, a projeção
// tracejada. Como a série sempre fecha no fim do bloco, cada hora ocupa
// a mesma largura (1/24) e as marcas de 12h ficam paradas.
const SPARK_W = 100;
const SPARK_H = 32;
const SPARK_BLOCO = 12;
const SPARK_SLOTS = SPARK_BLOCO * 2;
const HORA_MS = 3600000;

// Pontos [x, y] da curva no viewBox do sparkline; usados tanto para
// desenhar quanto para pendurar os rótulos de temperatura sobre a linha.
// A série é alinhada pelo fim: se faltar leitura antiga, o começo fica vazio.
function pontosSparkline(temps) {
    const PAD = 2.5;
    let lo = Math.min(...temps);
    let hi = Math.max(...temps);
    if (hi - lo < 0.5) {
        const meio = (hi + lo) / 2;
        lo = meio - 0.25;
        hi = meio + 0.25;
    }
    const vazio = SPARK_SLOTS + 1 - temps.length;
    return temps.map((t, i) => {
        const x = ((vazio + i) / SPARK_SLOTS) * SPARK_W;
        const y = PAD + (1 - (t - lo) / (hi - lo)) * (SPARK_H - PAD * 2);
        return [x, y];
    });
}

function caminho(pontos) {
    return pontos
        .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
        .join(' ');
}

// hist e proj em sequência: o último ponto do histórico é o "agora",
// onde o eixo cheio termina e a linha passa a tracejada. As marcas ficam
// no começo, na virada do bloco (meio) e no fim.
function desenharSparkline(svg, hist, proj) {
    if (!svg || hist.length < 2) return;
    const W = SPARK_W;
    const H = SPARK_H;
    const pontos = pontosSparkline(hist.concat(proj));
    const iAgora = hist.length - 1;
    const antes = pontos.slice(0, iAgora + 1);
    const depois = pontos.slice(iAgora);
    const [ax, ay] = pontos[iAgora];
    const xa = ax.toFixed(2);
    const x0 = pontos[0][0].toFixed(2);
    const marca = (x) => `M${x} ${H - 3} L${x} ${H + 3}`;
    svg.innerHTML =
        `<path class="sa-spark-area" d="${caminho(antes)} L${xa} ${H} L${x0} ${H} Z"></path>` +
        `<path class="sa-spark-eixo" d="M0 ${H} L${xa} ${H} ${marca(0)} ${marca(W / 2)} ${marca(W)}"></path>` +
        (ax < W ? `<path class="sa-spark-eixo-proj" d="M${xa} ${H} L${W} ${H}"></path>` : '') +
        (proj.length ? `<path class="sa-spark-proj" d="${caminho(depois)}"></path>` : '') +
        `<path class="sa-spark-line" d="${caminho(antes)}"></path>` +
        `<circle class="sa-spark-ponto" cx="${xa}" cy="${ay.toFixed(2)}" r="2"></circle>`;
}

// Taxa das últimas 3 horas: leitura atual menos a de 3h atrás, por hora.
function taxaTemperatura(temps) {
    if (temps.length < 4) return 0;
    return (temps[temps.length - 1] - temps[temps.length - 4]) / 3;
}

// Projeção hora a hora até o fim do bloco, a partir da taxa das últimas
// 3h, perdendo força a cada hora (a massa de grão não mantém o ritmo para
// sempre). Silo que para na ponta deixa de esfriar nessas horas e
// esquenta de leve.
function projetarTemperaturas(temps, card, horaAgora, horas) {
    const paraNaPonta = card.dataset.aer === 'on' && card.dataset.pausaPonta === '1';
    let taxa = taxaTemperatura(temps);
    let t = temps[temps.length - 1];
    const proj = [];
    for (let k = 1; k <= horas; k += 1) {
        taxa *= 0.8;
        const inicioHora = new Date(horaAgora.getTime() + (k - 1) * HORA_MS);
        t += paraNaPonta && emPonta(inicioHora) ? 0.05 : taxa;
        proj.push(t);
    }
    return proj;
}

// hora cheia; a meia-noite aparece sempre como 00:00, nas duas pontas
function formatarHora(data) {
    const h = data.getHours();
    return `${String(h).padStart(2, '0')}:00`;
}

function tendenciaDe(taxa) {
    if (taxa >= TAXA_ALERTA) return 'alerta';
    if (taxa > 0.05) return 'sobe';
    if (taxa < -0.05) return 'desce';
    return 'estavel';
}

function formatarTaxa(taxa) {
    const sinal = taxa > 0.05 ? '+' : taxa < -0.05 ? '−' : '';
    const abs = Math.abs(taxa).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${sinal}${abs} °C/h`;
}

function prepararSilo(card) {
    const temps = numeros(card.dataset.temps);
    if (temps.length < 2) return;
    // a última leitura é a da hora cheia atual; a projeção muda com a hora
    // (por causa da ponta), então a curva é redesenhada quando ela vira
    const horaAgora = new Date();
    horaAgora.setMinutes(0, 0, 0);
    // horas já corridas no bloco atual: o histórico pega o bloco anterior
    // inteiro mais essas horas, e a projeção cobre o que falta do bloco
    const corridas = horaAgora.getHours() % SPARK_BLOCO;
    const hist = temps.slice(-(SPARK_BLOCO + corridas + 1));
    const faltam = SPARK_BLOCO - corridas;
    const proj = projetarTemperaturas(temps, card, horaAgora, faltam);
    const chaveHora = String(horaAgora.getTime());
    const svg = card.querySelector('[data-spark]');
    if (svg && (svg.childElementCount === 0 || svg.dataset.hora !== chaveHora)) {
        desenharSparkline(svg, hist, proj);
        svg.dataset.hora = chaveHora;
    }

    const taxa = taxaTemperatura(temps);
    const tendencia = tendenciaDe(taxa);
    escreverTexto(card.querySelector('[data-temp-inicio]'), formatarTemperatura(hist[0]));
    escreverTexto(card.querySelector('[data-temp-atual]'), formatarTemperatura(hist[hist.length - 1]));
    escreverTexto(card.querySelector('[data-temp-proj]'), formatarTemperatura(proj[proj.length - 1]));
    const fimBloco = new Date(horaAgora.getTime() + faltam * HORA_MS);
    const viradaBloco = new Date(fimBloco.getTime() - SPARK_BLOCO * HORA_MS);
    const inicio = new Date(fimBloco.getTime() - SPARK_SLOTS * HORA_MS);
    escreverTexto(card.querySelector('[data-hora-inicio]'), formatarHora(inicio));
    escreverTexto(card.querySelector('[data-hora-meio]'), formatarHora(viradaBloco));
    escreverTexto(card.querySelector('[data-hora-fim]'), formatarHora(fimBloco));
    // rótulos acompanham a altura da curva no início, no agora e no fim do
    // bloco; --x-agora é onde o eixo cheio termina e o tracejado começa.
    // Perto do fim do bloco não cabe o valor projetado ao lado do atual:
    // ele sai e o atual encosta na direita. Na metade final do bloco ele
    // também sai quando ficaria na mesma altura do atual.
    const pontos = pontosSparkline(hist.concat(proj));
    const pct = (v, total) => `${((v / total) * 100).toFixed(1)}%`;
    const yAtual = pontos[hist.length - 1][1];
    const yProj = pontos[pontos.length - 1][1];
    const wrap = card.querySelector('[data-spark-wrap]');
    if (wrap) {
        wrap.style.setProperty('--x-agora', pct(pontos[hist.length - 1][0], SPARK_W));
        wrap.style.setProperty('--y-ini', pct(pontos[0][1], SPARK_H));
        wrap.style.setProperty('--y-fim', pct(yAtual, SPARK_H));
        wrap.style.setProperty('--y-proj', pct(yProj, SPARK_H));
        const perto = faltam <= SPARK_BLOCO / 2 && Math.abs(yAtual - yProj) < SPARK_H * 0.3;
        wrap.dataset.fimBloco = faltam < 3 ? '1' : '0';
        wrap.dataset.semProj = faltam < 3 || perto ? '1' : '0';
    }
    const rate = card.querySelector('[data-temp-taxa]');
    if (rate) {
        escreverTexto(rate, formatarTaxa(taxa));
        rate.dataset.tendencia = tendencia;
        rate.title = tendencia === 'alerta'
            ? 'Temperatura subindo rápido: conferir aeração e umidade'
            : 'Variação média nas últimas 3 horas';
    }
    card.dataset.alerta = tendencia === 'alerta' ? '1' : '0';
}

function atualizarSilosAeracao() {
    const dentroPonta = emPonta(new Date());
    const decorrido = (Date.now() - SILOS_INICIO) / 1000;

    document.querySelectorAll('[data-silo]').forEach((card) => {
        prepararSilo(card);

        const ligado = card.dataset.aer === 'on';
        const pausado = ligado && card.dataset.pausaPonta === '1' && dentroPonta;

        let estado = 'off';
        let selo = 'OFF';
        let info = `desligou às ${card.dataset.aerFim || '--:--'} · rodou ${card.dataset.aerRodou || '--'}`;
        if (pausado) {
            estado = 'pausa';
            selo = 'PAUSA';
            info = `pausado na ponta · volta às ${String(PONTA_FIM).padStart(2, '0')}:00`;
        } else if (ligado) {
            estado = 'on';
            selo = 'ON';
            info = `ligado há ${formatarDuracao(paraNumero(card.dataset.aerDesdeMin) * 60 + decorrido)}`;
        }

        card.dataset.aerEstado = estado;
        escreverTexto(card.querySelector('[data-aer-badge]'), selo);
        escreverTexto(card.querySelector('[data-aer-info]'), info);
    });
}

setInterval(atualizarSilosAeracao, 1000);
atualizarSilosAeracao();
