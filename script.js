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
        menuItems.forEach((m) => m.classList.remove('active'));
        allScreens().forEach((s) => s.classList.remove('active'));
        item.classList.add('active');
        if (target) {
            target.classList.add('active');
        }
        syncMenuGroups();
        setAlertsPage(false);
        scheduleFit();
    });
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
    return [active, ...active.querySelectorAll('.content-section, .table-scroll, .alerts-list')];
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
// ============================================
const SIDEBAR_STORAGE_KEY = 'videowall:sidebar-collapsed';
const btnSidebarToggle = document.getElementById('btnSidebarToggle');
const btnSidebarReveal = document.getElementById('btnSidebarReveal');

function setSidebarCollapsed(collapsed, persist = true) {
    document.body.classList.toggle('sidebar-collapsed', collapsed);

    if (btnSidebarToggle) {
        btnSidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    }
    if (btnSidebarReveal) {
        btnSidebarReveal.setAttribute('aria-expanded', String(!collapsed));
        btnSidebarReveal.tabIndex = collapsed ? 0 : -1;
    }

    if (!persist) return;
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

document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    if (event.key !== 'b' && event.key !== 'B') return;
    event.preventDefault();
    toggleSidebar();
});

let sidebarStartCollapsed = false;
try {
    sidebarStartCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
} catch (err) {
    sidebarStartCollapsed = false;
}
setSidebarCollapsed(sidebarStartCollapsed, false);

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
const EDITABLE_SELECTORS = [
    '.brand-main',
    '.brand-sub',
    '.sidebar-header',
    '.menu-text',
    '.screen-badge',
    '.screen-title-section h2',
    '.screen-meta',
    '.kpi-label',
    '.kpi-value',
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
    '.moega-tons',
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
    '.moega-stat-label',
    '.moega-stat-value',
    '.silo-group-name',
    '.silo-group-total',
    '.camera-name',
    '.camera-state',
    '.weather-temp',
    '.weather-desc',
    '.weather-fact-label',
    '.weather-fact-value',
    '.weather-day-name',
    '.weather-day-temp',
    '.weather-day-rain',
    '.weather-city-name',
    '.weather-city-temp',
    '.weather-city-rain',
    '.secador-nome',
    '.secador-tipo',
    '.secador-chip-label',
    '.secador-chip-value',
    '.serie-tag',
    '.secador-horas span',
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
    '.prod-secador-percent'
];

function applyTextEditing(enabled) {
    EDITABLE_SELECTORS.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
            if (!(element instanceof HTMLElement)) return;
            if (element.tagName === 'BUTTON' && !element.classList.contains('flow-btn')) return;
            if (element.classList.contains('screen-badge') && element.querySelector('svg')) return;

            element.classList.toggle('editable', enabled);
            element.contentEditable = enabled ? 'true' : 'false';
            element.spellcheck = false;
            element.tabIndex = enabled ? 0 : -1;
            element.setAttribute('data-editable', String(enabled));
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
    { selector: '.secador-chip', group: 'secador-dado' },
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
    { selector: '.menu-group', group: 'menu-grupo' },
    { selector: '.menu-item', group: 'menu' },
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
    { selector: '.donut-item', group: 'fatia', mini: true }
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

    if (!enabled) return;

    DRAG_CONFIG.forEach((cfg) => {
        document.querySelectorAll(cfg.selector).forEach((el) => {
            if (el.dataset.dragGroup) return;
            const host = cfg.inline ? el.querySelector('td, th') : el;
            if (!host) return;

            el.dataset.dragGroup = cfg.group;

            const handle = document.createElement('span');
            handle.className = 'drag-handle'
                + (cfg.section ? ' drag-handle--section' : '')
                + (cfg.inline ? ' drag-handle--inline' : '');
            handle.textContent = '⠿';
            handle.title = 'Arraste para mover';
            handle.contentEditable = 'false';

            const acoes = document.createElement('div');
            acoes.className = 'block-actions'
                + (cfg.section ? ' block-actions--section' : '')
                + (cfg.inline ? ' block-actions--inline' : '')
                + (cfg.mini ? ' block-actions--mini' : '');
            acoes.contentEditable = 'false';
            acoes.appendChild(handle);
            if (el.dataset.comp) {
                acoes.appendChild(criarBotaoBloco('config', '⚙', 'Configurar este componente'));
            }
            acoes.appendChild(criarBotaoBloco('duplicar', '⧉', 'Duplicar'));
            acoes.appendChild(criarBotaoBloco('remover', '✕', 'Remover'));
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
        const percent = siloItem.querySelector('.silo-percent');
        if (percent) percent.textContent = pct + '%';
        return;
    }
    const label = bar.container.nextElementSibling;
    if (label && label.classList.contains('progress-label')) {
        const sign = label.querySelector('.pct-sign');
        if (sign) {
            label.textContent = '';
            label.appendChild(document.createTextNode(String(pct)));
            label.appendChild(sign);
            return;
        }
        label.textContent = label.textContent.replace(/\d+([.,]\d+)?\s*%/, pct + '%');
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
    { selector: '.status-bar', mode: 'size' }
];

let resizing = null;

function setupResizeHandles(enabled) {
    document.querySelectorAll('.resize-handle').forEach((handle) => handle.remove());
    document.querySelectorAll('[data-resize]').forEach((el) => {
        el.removeAttribute('data-resize');
        el.classList.remove('is-resizing');
    });

    if (!enabled) return;

    RESIZE_CONFIG.forEach((cfg) => {
        document.querySelectorAll(cfg.selector).forEach((el) => {
            if (el.dataset.resize) return;
            el.dataset.resize = cfg.mode;

            const handle = document.createElement('span');
            handle.className = 'resize-handle';
            handle.textContent = '⤡';
            handle.title = 'Arraste para redimensionar (duplo clique restaura)';
            handle.contentEditable = 'false';
            el.appendChild(handle);
        });
    });
}

function applyResizeWidth(el, width) {
    const parent = el.parentElement;
    if (!parent) return;

    const cs = getComputedStyle(parent);
    const w = Math.max(40, Math.round(width));

    if (cs.display.indexOf('grid') !== -1) {
        const cols = cs.gridTemplateColumns.split(' ').filter(Boolean);
        if (cols.length > 1) {
            const gap = parseFloat(cs.columnGap) || 0;
            const total = parent.getBoundingClientRect().width;
            const unit = (total - gap * (cols.length - 1)) / cols.length;
            let span = Math.round((w + gap) / (unit + gap));
            span = Math.max(1, Math.min(cols.length, span));
            el.style.gridColumn = 'span ' + span;
            el.style.width = '';
            return;
        }
    }

    if (cs.display.indexOf('flex') !== -1) {
        el.style.flex = '0 0 ' + w + 'px';
    }
    el.style.width = w + 'px';
}

function applyResizeHeight(el, height) {
    const h = Math.max(28, Math.round(height));
    if (el.dataset.resize === 'min') {
        el.style.minHeight = h + 'px';
    } else {
        el.style.height = h + 'px';
    }
}

function resetSize(el) {
    el.style.width = '';
    el.style.height = '';
    el.style.minHeight = '';
    el.style.flex = '';
    el.style.gridColumn = '';
}

document.addEventListener('pointerdown', (e) => {
    if (!isEditing() || !(e.target instanceof Element)) return;
    const handle = e.target.closest('.resize-handle');
    if (!handle || !handle.parentElement) return;

    e.preventDefault();
    const el = handle.parentElement;
    const rect = el.getBoundingClientRect();
    resizing = {
        el: el,
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height
    };
    el.classList.add('is-resizing');
    if (handle.setPointerCapture) handle.setPointerCapture(e.pointerId);
});

document.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    applyResizeWidth(resizing.el, resizing.startW + (e.clientX - resizing.startX));
    applyResizeHeight(resizing.el, resizing.startH + (e.clientY - resizing.startY));
});

document.addEventListener('pointerup', () => {
    if (!resizing) return;
    resizing.el.classList.remove('is-resizing');
    resizing = null;
});

document.addEventListener('dblclick', (e) => {
    if (!isEditing() || !(e.target instanceof Element)) return;
    const handle = e.target.closest('.resize-handle');
    if (!handle || !handle.parentElement) return;
    e.preventDefault();
    resetSize(handle.parentElement);
});

// ============================================
// MODO DE EDIÇÃO
// ============================================
function applyEditMode(enabled) {
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
const FORECAST_MAX = 1800; // topo do eixo Y, em toneladas

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
    });

    document.body.appendChild(box);
    return { box: box, title: title, values: values, rows: rows };
}

function showVizTooltip(col, clientX, clientY) {
    if (!vizTooltip) vizTooltip = buildVizTooltip();

    // Rótulos vêm de data-attributes: sempre textContent, nunca innerHTML.
    vizTooltip.title.textContent = col.dataset.dia || '';
    VIZ_SERIES.forEach((serie) => {
        const dado = col.dataset[serie.chave];
        vizTooltip.values[serie.chave].textContent = dado || '—';
        if (serie.grao) vizTooltip.rows[serie.chave].hidden = !dado;
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
    const col = e.target instanceof Element ? e.target.closest('.forecast-col') : null;
    if (!col || isEditing()) {
        hideVizTooltip();
        return;
    }
    showVizTooltip(col, e.clientX, e.clientY);
});

document.addEventListener('focusin', (e) => {
    const col = e.target instanceof Element ? e.target.closest('.forecast-col') : null;
    if (!col || isEditing()) return;
    const rect = col.getBoundingClientRect();
    showVizTooltip(col, rect.left + rect.width / 2, rect.top);
});

document.addEventListener('focusout', hideVizTooltip);

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

    const serie = bar.classList.contains('forecast-bar--prog') ? 'programado' : 'recebido';
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
        img.alt = nome ? nome.textContent : 'Câmera ao vivo';
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
    window.print();
});

// ============================================
// EDITOR DE LAYOUT
// Além de mexer no texto, no lugar e no tamanho (acima), aqui dá para
// tirar bloco, duplicar, criar gráfico novo escolhendo tipo, dados e
// cores — e guardar tudo no navegador para a tela voltar do mesmo jeito.
// `var` de propósito: applyEditMode roda antes deste trecho.
// ============================================
var editorPronto = false;

const LAYOUT_KEY = 'videowall:layout';
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

function salvarLayout(silencioso) {
    try {
        localStorage.setItem(LAYOUT_KEY, limparHTML(palco));
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
    palco.innerHTML = salvo;
    remontar();
    return true;
}

function restaurarPadrao() {
    if (!window.confirm('Restaurar o layout original? Tudo que foi editado e salvo será perdido.')) return;
    registrar();
    try {
        localStorage.removeItem(LAYOUT_KEY);
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
    syncMenuGroups();
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
        return Math.max(0, paraNumero(alvo ? alvo.textContent : '0'));
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
    const totalEl = card.querySelector('.donut-total');
    if (totalEl) totalEl.textContent = fmtNum(soma);
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
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 't' },
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
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 't' },
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
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 't' },
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
            { nome: 'unidade', rotulo: 'Unidade', tipo: 'text', padrao: 't' },
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
            { nome: 'unidade', rotulo: 'Unidade do total', tipo: 'text', padrao: 't' }
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
            { nome: 'volumes', rotulo: 'Texto do rodapé', tipo: 'textarea', padrao: '3.120 t, 3.680 t, 2.560 t' },
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
            { nome: 'valores', rotulo: 'Valores', tipo: 'textarea', padrao: '12, 38 min, 82 t/h' },
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
            { nome: 'titulo', rotulo: 'Título', tipo: 'text', padrao: 'DISTRIBUIÇÃO DE QUALIDADE' },
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
            opcao('dentro:' + i, 'Dentro de: ' + (h ? h.textContent.trim().slice(0, 42) : 'painel ' + (i + 1)));
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
        'clique no texto para editar · ⠿ move · ⤡ redimensiona · ⧉ duplica · ✕ remove · Del apaga o selecionado'));

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
    if (!fotoArraste) return;
    const antes = fotoArraste;
    fotoArraste = null;
    if (antes === limparHTML(palco)) return;
    historico.push(antes);
    if (historico.length > HISTORICO_MAX) historico.shift();
    futuro.length = 0;
    atualizarBotoesHistorico();
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
    carregarLayout();
    desenharRoscas(palco);
    sincronizarEditor(isEditing());
}
