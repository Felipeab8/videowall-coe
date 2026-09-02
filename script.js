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
const screens = document.querySelectorAll('.screen');
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
        screens.forEach((s) => s.classList.remove('active'));
        item.classList.add('active');
        if (target) {
            target.classList.add('active');
        }
        setAlertsPage(false);
        scheduleFit();
    });
});

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
const alertsPage = document.getElementById('alertsPage');
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

document.querySelectorAll('.flow-btn').forEach((btn) => {
    btn.addEventListener('click', function (event) {
        event.stopPropagation();
        if (isEditing()) return;
        const group = this.parentElement;
        group.querySelectorAll('.flow-btn').forEach((b) => b.classList.remove('active'));
        this.classList.add('active');
    });
});

// ============================================
// TABELA AGRUPADA: recolher / expandir unidade
// ============================================
document.querySelectorAll('.row-toggle').forEach((btn) => {
    btn.addEventListener('click', (event) => {
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
    '.content-section h3',
    '.flow-section h3',
    '.subsection-title',
    '.data-table th',
    '.data-table td',
    '.flow-btn',
    '.alert-badge',
    '.alert-text',
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
    '.forecast-unit'
];

function applyTextEditing(enabled) {
    EDITABLE_SELECTORS.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
            if (!(element instanceof HTMLElement)) return;
            if (element.tagName === 'BUTTON' && !element.classList.contains('flow-btn')) return;
            if (element.classList.contains('screen-badge--alert')) return;

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
    { selector: '.silo-item', group: 'silo' },
    { selector: '.hour-item', group: 'hora' },
    { selector: '.alert-item', group: 'alerta' },
    { selector: '.summary-card', group: 'resumo' },
    { selector: '.forecast-stat', group: 'resumo-previsao' },
    { selector: '.status-item', group: 'status' },
    { selector: '.status-row', group: 'status-linha' },
    { selector: '.flow-btn', group: 'fluxo' },
    { selector: '.stack-row', group: 'barra' },
    { selector: '.menu-item', group: 'menu' },
    { selector: '.data-table tbody tr', group: 'linha', inline: true }
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

function setupDragHandles(enabled) {
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
            host.insertBefore(handle, host.firstChild);
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
    { selector: '.hour-item', mode: 'size' },
    { selector: '.flow-btn', mode: 'size' },
    { selector: '.stack-track', mode: 'size' },
    { selector: '.silo-visual', mode: 'size' },
    { selector: '.hour-bar', mode: 'size' },
    { selector: '.progress-bar', mode: 'size' }
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
}

function toggleEditMode() {
    const nextState = !isEditing();

    if (btnEditar) {
        btnEditar.classList.toggle('active', nextState);
        btnEditar.textContent = nextState ? 'CONCLUIR' : 'EDITAR';
    }

    document.body.classList.toggle('edit-mode', nextState);
    applyEditMode(nextState);
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

if (screens.length > 0 && menuItems.length > 0) {
    menuItems[0].classList.add('active');
    screens[0].classList.add('active');
}

const firstScreen = screens[0];
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

function buildVizTooltip() {
    const box = document.createElement('div');
    box.className = 'viz-tooltip';
    box.setAttribute('role', 'tooltip');

    const title = document.createElement('span');
    title.className = 'viz-tooltip-title';
    box.appendChild(title);

    const values = {};
    [['real', 'Recebido'], ['prog', 'Programado']].forEach((serie) => {
        const row = document.createElement('div');
        row.className = 'viz-tooltip-row';

        const key = document.createElement('i');
        key.className = 'viz-tooltip-key';
        key.style.background = 'var(--viz-' + serie[0] + ')';

        const value = document.createElement('strong');
        value.className = 'viz-tooltip-value';

        const name = document.createElement('span');
        name.className = 'viz-tooltip-name';
        name.textContent = serie[1];

        row.appendChild(key);
        row.appendChild(value);
        row.appendChild(name);
        box.appendChild(row);
        values[serie[0]] = value;
    });

    document.body.appendChild(box);
    return { box: box, title: title, values: values };
}

function showVizTooltip(col, clientX, clientY) {
    if (!vizTooltip) vizTooltip = buildVizTooltip();

    // Rótulos vêm de data-attributes: sempre textContent, nunca innerHTML.
    vizTooltip.title.textContent = col.dataset.dia || '';
    vizTooltip.values.real.textContent = col.dataset.recebido || '—';
    vizTooltip.values.prog.textContent = col.dataset.programado || '—';
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

document.querySelectorAll('.forecast-col').forEach((col) => {
    col.addEventListener('pointermove', (e) => {
        if (isEditing()) return;
        showVizTooltip(col, e.clientX, e.clientY);
    });
    col.addEventListener('pointerleave', hideVizTooltip);
    col.addEventListener('focus', () => {
        if (isEditing()) return;
        const rect = col.getBoundingClientRect();
        showVizTooltip(col, rect.left + rect.width / 2, rect.top);
    });
    col.addEventListener('blur', hideVizTooltip);
});

// Tabela de apoio: os mesmos números sem depender do hover
document.querySelectorAll('[data-forecast-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const target = document.getElementById(btn.getAttribute('aria-controls'));
        if (!target) return;
        const opening = target.hidden;
        target.hidden = !opening;
        btn.setAttribute('aria-expanded', String(opening));
        btn.textContent = opening ? 'OCULTAR' : 'TABELA';
        scheduleFit();
    });
});

// Em modo de edição, arrastar a barra ajusta o valor (como nas demais)
let forecastBar = null;

function setForecastValue(bar, clientY) {
    const col = bar.parentElement;
    if (!col) return;

    const rect = col.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    const tons = ratio * FORECAST_MAX;

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
