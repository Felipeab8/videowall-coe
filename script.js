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
    // modo TV: o "Atualizado às HH:MM" de cada tela sai desta variável
    document.documentElement.style.setProperty('--tv-hora', `"${hours}:${minutes}"`);
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

// Previsão do tempo: cada cidade de "Avaré e cooperados" filtra a tabela
// dos 6 dias, que traz um tbody por cidade. Delegado pelo mesmo motivo
// acima (o editor remonta o palco).
document.addEventListener('click', (ev) => {
    const linha = ev.target.closest('.pv-tabela--filtro tr[data-pv-cidade]');
    if (!linha || isEditing()) return;
    const tela = linha.closest('.screen');
    const cidade = linha.getAttribute('data-pv-cidade');
    const alvo = tela && tela.querySelector('.pv-tabela--dias tbody[data-pv-cidade="' + cidade + '"]');
    if (!alvo) return;
    tela.querySelectorAll('.pv-tabela--filtro tr[data-pv-cidade]').forEach((tr) => {
        tr.classList.toggle('is-sel', tr === linha);
    });
    tela.querySelectorAll('.pv-tabela--dias tbody[data-pv-cidade]').forEach((tb) => {
        tb.hidden = tb !== alvo;
    });
    escreverTexto(tela.querySelector('[data-pv-dias-cidade]'), cidade.toUpperCase());
    scheduleFit();
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
    syncUnidadeNoCabecalho();
}

// O menu tem duas seções (Avaré e demais unidades): o subtítulo do
// cabeçalho diz de qual delas é a tela no ar.
function syncUnidadeNoCabecalho() {
    const sub = document.querySelector('.brand-sub');
    const ativo = document.querySelector('.menu-item.active');
    const secao = ativo ? ativo.closest('[data-unidade]') : null;
    if (sub && secao) sub.textContent = 'Cooperativa Holambra · ' + secao.getAttribute('data-unidade');
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

// modo TV (ver MODO TV mais abaixo): a classe fica no <html>
function modoTv() {
    return document.documentElement.classList.contains('tv');
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
    // Modo TV: o piso de fonte faz o texto crescer dentro de caixas que
    // cortam caladas (cartões de silo e moega, células, rótulos com
    // reticências). Ali qualquer bloco que corte conteúdo entra na conta,
    // menos o que rola de propósito e os mapas (painéis maiores por natureza).
    if (modoTv()) {
        const cortam = Array.prototype.filter.call(active.querySelectorAll('*'), (el) => {
            const cs = getComputedStyle(el);
            return (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')
                && !el.closest('.table-scroll--livre, .content-section--livre, .leaflet-container');
        });
        return [active, ...cortam];
    }
    // .table-scroll--livre rola por dentro em vez de encolher a tela inteira
    // (lista longa de caminhoes): fica fora da conta. Bloco com overflow
    // visivel tambem sai: o que passa dele ja aparece na medida da tela, e
    // um menu aberto por cima (contratos da expedicao) nao e transbordo.
    // O cartao do secador (produtividade) e o do silo cortam o que passa da
    // fileira deles, sem a secao perceber: entram na conta para nada sumir.
    const blocos = active.querySelectorAll('.content-section:not(.content-section--livre), .table-scroll:not(.table-scroll--livre), .alerts-list, .geral-grid, .prod-secador, .sa-card[data-silo]');
    return [active, ...Array.prototype.filter.call(blocos, (el) => getComputedStyle(el).overflowY !== 'visible')];
}

function fitOverflow(targets) {
    let worst = 0;
    const largura = modoTv();
    for (const el of targets) {
        const over = Math.max(el.scrollHeight - el.clientHeight, largura ? el.scrollWidth - el.clientWidth : 0);
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
// MODO TV (computador ligado na TV por HDMI)
// ?tv=1 liga e ?tv=0 desliga; a escolha fica gravada no aparelho, então
// a TV volta sempre no modo certo. Tecla T alterna; as setas (ou
// PageUp/PageDown do controle) trocam de tela na ordem do menu, que no
// modo TV fica escondido. A aparência toda está no CSS (html.tv).
// ============================================
const TV_STORAGE_KEY = 'videowall:modo-tv';

function tvInicial() {
    const pedido = new URLSearchParams(location.search).get('tv');
    try {
        if (pedido !== null) localStorage.setItem(TV_STORAGE_KEY, pedido === '0' ? '0' : '1');
        return localStorage.getItem(TV_STORAGE_KEY) === '1';
    } catch (err) {
        return pedido !== null && pedido !== '0';
    }
}

function setModoTv(ligado) {
    if (ligado && isEditing()) toggleEditMode();
    document.documentElement.classList.toggle('tv', ligado);
    try {
        localStorage.setItem(TV_STORAGE_KEY, ligado ? '1' : '0');
    } catch (err) {
        // sem armazenamento: vale só para esta visita
    }
    scheduleFit();
}

function irParaTelaVizinha(passo) {
    const itens = Array.prototype.filter.call(
        document.querySelectorAll('.menu-item[data-screen]'),
        (item) => document.getElementById('screen-' + item.getAttribute('data-screen'))
    );
    if (!itens.length) return;
    const atual = itens.findIndex((item) => item.classList.contains('active'));
    itens[(atual + passo + itens.length) % itens.length].click();
}

document.documentElement.classList.toggle('tv', tvInicial());

// Listas longas (caminhões, cargas) rolam por dentro no monitor; na TV
// ninguém rola, então descem sozinhas, devagar, param no fim e voltam ao
// topo. O passo acompanha a altura da tela para ter a mesma velocidade no 4K.
const TV_ROLAGEM_PAUSA = 4000;   // ms parada no topo e no fim
const rolagemTv = new WeakMap();

function rolarListasTv() {
    if (!modoTv()) return;
    const agora = Date.now();
    const passo = Math.max(1, Math.round(window.innerHeight / 1080));
    document.querySelectorAll('.screen.active .table-scroll--livre').forEach((lista) => {
        if (lista.scrollHeight - lista.clientHeight < 2) return;
        let estado = rolagemTv.get(lista);
        if (!estado) {
            estado = { espera: agora + TV_ROLAGEM_PAUSA, voltar: false };
            rolagemTv.set(lista, estado);
        }
        if (agora < estado.espera) return;
        if (estado.voltar) {
            lista.scrollTop = 0;
            estado.voltar = false;
            estado.espera = agora + TV_ROLAGEM_PAUSA;
            return;
        }
        lista.scrollTop += passo;
        if (lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 1) {
            estado.voltar = true;
            estado.espera = agora + TV_ROLAGEM_PAUSA;
        }
    });
}

setInterval(rolarListasTv, 40);

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const alvo = event.target;
    if (alvo instanceof Element && alvo.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 't' || event.key === 'T') {
        setModoTv(!modoTv());
        return;
    }
    if (!modoTv()) return;
    const passo = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[event.key];
    if (!passo) return;
    event.preventDefault();
    irParaTelaVizinha(passo);
});

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
    '.fase-legenda-item',
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
        limparFiltrosMoega();
        limparFiltrosSilo();
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
    const keys = {};
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
        keys[serie.chave] = key;
    });

    document.body.appendChild(box);
    return { box: box, title: title, values: values, rows: rows, names: names, keys: keys };
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
        // a coluna pode renomear a linha (ex.: "Secado" no grafico de cada secador)
        const sufixo = serie.chave.charAt(0).toUpperCase() + serie.chave.slice(1);
        const apelido = col.dataset['nome' + sufixo];
        vizTooltip.names[serie.chave].textContent = apelido || serie.nome;
        // e pintar a chave com uma variavel CSS dela (ex.: --sec, a cor do secador)
        const cor = col.dataset['cor' + sufixo];
        vizTooltip.keys[serie.chave].style.background = (cor && getComputedStyle(col).getPropertyValue(cor).trim()) || serie.cor;
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

    const tabela = document.createElement('table');
    tabela.className = 'motivo-tip-tabela';

    const nota = document.createElement('span');
    nota.className = 'motivo-tip-nota';

    box.appendChild(titulo);
    box.appendChild(resumo);
    box.appendChild(lista);
    box.appendChild(tabela);
    box.appendChild(nota);
    document.body.appendChild(box);
    return { box: box, titulo: titulo, resumo: resumo, lista: lista, tabela: tabela, nota: nota };
}

// data-motivo-tabela: linhas separadas por "|", celulas por "::"; a primeira
// linha e' o cabecalho. Linha que comeca com "*" sai em destaque (ex.: a
// cultura atual no historico do silo).
function preencherTabelaMotivo(tabela, bruto) {
    tabela.textContent = '';
    const linhas = bruto.split('|').map((l) => l.trim()).filter(Boolean);
    if (linhas.length < 2) return;

    const cabeca = document.createElement('thead');
    const trCabeca = document.createElement('tr');
    linhas[0].split('::').forEach((texto) => {
        const th = document.createElement('th');
        th.textContent = texto.trim();
        trCabeca.appendChild(th);
    });
    cabeca.appendChild(trCabeca);

    const corpo = document.createElement('tbody');
    linhas.slice(1).forEach((linha) => {
        const tr = document.createElement('tr');
        if (linha.charAt(0) === '*') {
            tr.className = 'is-destaque';
            linha = linha.slice(1);
        }
        linha.split('::').forEach((texto) => {
            const td = document.createElement('td');
            td.textContent = texto.trim();
            tr.appendChild(td);
        });
        corpo.appendChild(tr);
    });

    tabela.appendChild(cabeca);
    tabela.appendChild(corpo);
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

    preencherTabelaMotivo(motivoTip.tabela, campoMotivo(alvo, 'motivoTabela'));
    motivoTip.box.classList.toggle('tem-tabela', motivoTip.tabela.rows.length > 0);
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
// MAPA DAS DEMAIS UNIDADES
// Mapa real (Leaflet, fundo vetorial do OpenFreeMap) montado por cima do
// SVG esquemático, que continua no HTML como reserva: sem internet, sem
// Leaflet ou sem o fundo do mapa, é ele que aparece. Pinos e rótulos
// saem do próprio SVG (data-latlng, data-lado), então os dados ficam num
// lugar só. O mapa é artefato como o vídeo das
// câmeras: limparArtefatos o tira do HTML salvo e remontar() o põe de volta.
// ============================================
// Fundos gratuitos e sem chave. A página abre direto do disco (file://,
// sem domínio), e por isso CARTO e o servidor do OpenStreetMap recusam os
// blocos; estes dois aceitam:
//   1. OpenFreeMap: mapa vetorial (dados do OpenStreetMap) desenhado pelo
//      MapLibre em WebGL, nítido em qualquer zoom. Livre inclusive para uso
//      comercial, sem cadastro nem limite. "Liberty" no tema claro e
//      "Fiord" (azul-escuro, o tom do painel) no escuro.
//   2. Esri (ArcGIS): blocos de imagem, se faltar WebGL ou o OpenFreeMap
//      não responder.
// Sem nenhum dos dois (sem internet), volta o SVG. Ambos pedem só o crédito
// visível no canto, que o Leaflet mostra.
const MAPA_CREDITO_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MAPA_ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const MAPA_FUNDOS = [
    {
        vetor: true,
        claro: 'https://tiles.openfreemap.org/styles/liberty',
        escuro: 'https://tiles.openfreemap.org/styles/fiord',
        credito: '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> ' + MAPA_CREDITO_OSM
    },
    {
        claro: MAPA_ESRI + 'World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        escuro: MAPA_ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        maxZoom: 16,
        credito: 'Mapa &copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, ' + MAPA_CREDITO_OSM
    }
];

// WebGL existe? Sem ele o MapLibre nem começa: vai direto para os blocos.
function temWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (err) {
        return false;
    }
}

function temaClaro() {
    return document.body.classList.contains('theme-light');
}

let mapasUnidades = [];

function latLngDe(el, atributo) {
    const v = (el.getAttribute(atributo) || '').split(',').map(Number);
    return v.length === 2 && v.every(Number.isFinite) ? L.latLng(v[0], v[1]) : null;
}

// medidas do mapa em rem, para acompanhar o --fit como o resto da tela
function remPx() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function rotuloMapa(principal, apoio) {
    const el = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = principal;
    el.appendChild(b);
    // a segunda linha só existe quando há alerta estratégico
    if (apoio) {
        const span = document.createElement('span');
        span.textContent = apoio;
        el.appendChild(span);
    }
    return el;
}

function mountMapaUnidades(root) {
    // mapas de um palco trocado inteiro (layout salvo, desfazer) saem da memória
    mapasUnidades = mapasUnidades.filter((item) => {
        if (item.el.isConnected) return true;
        item.observador.disconnect();
        item.mapa.remove();
        return false;
    });
    if (!window.L) return;
    const escopo = root || document;
    const secoes = escopo.matches && escopo.matches('.du-mapa')
        ? [escopo]
        : escopo.querySelectorAll('.du-mapa');
    secoes.forEach((secao) => {
        const svg = secao.querySelector('.du-mapa-svg');
        if (svg && !secao.querySelector('.du-mapa-real')) criarMapaUnidades(secao, svg);
    });
}

function criarMapaUnidades(secao, svg) {
    const el = document.createElement('div');
    el.className = 'du-mapa-real';
    svg.before(el);
    secao.classList.add('has-mapa');

    // videowall: mapa parado, sempre enquadrado nas unidades. Sem animações:
    // o esmaecer dos blocos depende de requestAnimationFrame e fica preso
    // (blocos invisíveis) quando o navegador não desenha quadros.
    const mapa = L.map(el, {
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomSnap: 0.25
    });
    mapa.attributionControl.setPrefix(false);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(mapa);

    const item = { el, secao, mapa, limites: null, observador: null };

    const pontos = [];
    svg.querySelectorAll('.du-pin[data-latlng]').forEach((pin) => {
        const pos = latLngDe(pin, 'data-latlng');
        if (!pos) return;
        const ehBase = pin.classList.contains('du-pin--base');
        const status = Array.from(pin.classList).find((c) => c.startsWith('du-st--')) || '';
        const nome = pin.querySelector('.du-pin-nome');
        const info = pin.querySelector('.du-pin-info');
        const destino = pin.getAttribute('data-goto');
        const marca = L.marker(pos, {
            icon: L.divIcon({
                className: 'du-lf-pino ' + (ehBase ? 'du-lf-pino--base' : status),
                html: '<i class="du-lf-halo"></i><i class="du-lf-ponto"></i>',
                iconSize: null
            }),
            interactive: ehBase || !!destino,
            keyboard: false
        });
        marca.bindTooltip(rotuloMapa(nome ? nome.textContent : '', info ? info.textContent : ''), {
            permanent: true,
            direction: pin.getAttribute('data-lado') || 'right',
            className: 'du-lf-rotulo ' + (ehBase ? 'du-lf-rotulo--base' : status),
            opacity: 1
        });
        // Avaré leva às telas dela pelo mesmo clique delegado da visão geral.
        // O ícone só nasce quando o mapa ganha posição: marca no evento add.
        if (destino) {
            marca.on('add', () => {
                const icone = marca.getElement();
                icone.setAttribute('data-goto', destino);
                icone.title = 'Abrir as telas de Avaré';
            });
        }
        marca.addTo(mapa);
        pontos.push(pos);
    });
    if (!pontos.length) {
        desmontarMapaUnidades(item);
        return;
    }
    item.limites = L.latLngBounds(pontos);
    // o fundo vetorial nasce já posicionado: sem centro e zoom o MapLibre
    // não tem por onde começar (o enquadramento fino vem logo abaixo)
    mapa.setView(item.limites.getCenter(), 9, { animate: false });
    montarCamadaMapa(item);

    // o bloco muda de tamanho com o --fit e começa escondido (tela fora do
    // ar): a cada mudança o mapa se reenquadra nas unidades. Temporizador, e
    // não requestAnimationFrame: reenquadrar dentro de um quadro deixava os
    // blocos do mapa sem pintar quando o navegador não desenha quadros.
    let pendente = 0;
    item.observador = new ResizeObserver(() => {
        clearTimeout(pendente);
        pendente = setTimeout(() => enquadrarMapaUnidades(item), 50);
    });
    item.observador.observe(el);
    mapasUnidades.push(item);
    enquadrarMapaUnidades(item);
}

function montarCamadaMapa(item, indice = 0) {
    const fundo = MAPA_FUNDOS[indice];
    // fundo que não serve: tenta o próximo e, sem nenhum, volta para o SVG
    // em vez de deixar um fundo vazio
    const proximo = (camada) => {
        if (item.camada !== camada) return;
        item.camada = null;
        if (camada) item.mapa.removeLayer(camada);
        if (indice + 1 < MAPA_FUNDOS.length) montarCamadaMapa(item, indice + 1);
        else desmontarMapaUnidades(item);
    };
    item.fundo = fundo;
    item.indiceFundo = indice;
    item.urlFundo = temaClaro() ? fundo.claro : fundo.escuro;

    if (fundo.vetor) {
        if (!L.maplibreGL || !window.maplibregl || !temWebGL()) {
            item.camada = null;
            proximo(null);
            return;
        }
        const camada = L.maplibreGL({
            style: item.urlFundo,
            attribution: fundo.credito,
            interactive: false,
            // o botão PDF imprime a tela: sem isso o canvas do mapa sai em branco
            canvasContextAttributes: { preserveDrawingBuffer: true },
            preserveDrawingBuffer: true
        });
        item.camada = camada;
        camada.addTo(item.mapa);
        const gl = camada.getMaplibreMap();
        let estiloOk = false;
        gl.once('styledata', () => { estiloOk = true; });
        // erro antes de o estilo chegar = servidor fora; depois disso são
        // blocos avulsos, que o MapLibre tenta de novo sozinho
        gl.on('error', () => { if (!estiloOk) proximo(camada); });
        gl.on('webglcontextlost', () => proximo(camada));
        return;
    }

    const camada = L.tileLayer(item.urlFundo, {
        maxZoom: fundo.maxZoom,
        maxNativeZoom: fundo.maxZoom,
        className: 'du-lf-fundo',
        attribution: fundo.credito
    }).addTo(item.mapa);
    item.camada = camada;
    let carregados = 0;
    let falhas = 0;
    camada.on('tileload', () => { carregados++; });
    camada.on('tileerror', () => {
        if (++falhas >= 6 && !carregados) proximo(camada);
    });
}

// o botão claro/escuro troca a classe do body: o fundo acompanha
new MutationObserver(() => {
    mapasUnidades.forEach((item) => {
        if (!item.camada || !item.fundo) return;
        const url = temaClaro() ? item.fundo.claro : item.fundo.escuro;
        if (item.urlFundo === url) return;
        item.urlFundo = url;
        if (item.fundo.vetor) {
            item.camada.getMaplibreMap().setStyle(url);
            return;
        }
        // blocos: camada nova em vez de setUrl — o redraw() do Leaflet 1.9.4
        // não arredonda o zoom fracionado (zoomSnap 0.25) e pede blocos que
        // não existem, como .../9.5/409/263
        const antiga = item.camada;
        item.camada = null;
        item.mapa.removeLayer(antiga);
        montarCamadaMapa(item, item.indiceFundo);
    });
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

function enquadrarMapaUnidades(item) {
    if (!item.el.isConnected || !item.el.clientWidth || !item.el.clientHeight) return;
    const rem = remPx();
    item.mapa.invalidateSize(false);
    item.mapa.fitBounds(item.limites, {
        paddingTopLeft: [rem * 1.5, rem * 1.8],
        paddingBottomRight: [rem * 1.5, rem * 2.6],
        animate: false
    });
}

function desmontarMapaUnidades(item) {
    if (item.observador) item.observador.disconnect();
    item.mapa.remove();
    item.el.remove();
    item.secao.classList.remove('has-mapa');
    mapasUnidades = mapasUnidades.filter((m) => m !== item);
}

mountMapaUnidades(document);

// ============================================
// DU 02 · EVOLUÇÃO DA OCUPAÇÃO
// Últimos 90 dias e a projeção nos 90 seguintes, da rede ou da unidade
// escolhida no menu. Os números ficam nas opções do menu (ver o comentário
// no HTML); a rede é a soma das unidades, dia a dia.
// ============================================
const PROJ_HORIZONTE = 90; // dias de projeção depois de hoje
const PROJ_EIXO_PASSO = 30; // marcas do eixo X, em dias

function serieDaOpcao(op) {
    const entrada = Number(op.dataset.entrada) || 0;
    const saida = Number(op.dataset.saida) || 0;
    return {
        cap: Number(op.dataset.cap) || 0,
        entrada: entrada,
        saida: saida,
        ritmo: entrada - saida,
        entressafra: Number(op.dataset.entressafra) || 0,
        hist: (op.dataset.hist || '').split(',').map(Number),
        off: op.dataset.off || ''
    };
}

function serieDaRede(select) {
    const soma = { cap: 0, entrada: 0, saida: 0, ritmo: 0, entressafra: 0, hist: [], off: '' };
    Array.prototype.forEach.call(select.options, (op) => {
        if (!op.dataset.hist) return;
        const s = serieDaOpcao(op);
        ['cap', 'entrada', 'saida', 'ritmo', 'entressafra'].forEach((k) => { soma[k] += s[k]; });
        s.hist.forEach((v, i) => { soma.hist[i] = (soma.hist[i] || 0) + v; });
    });
    return soma;
}

const PROJ_TOPO = 90; // % a partir do qual a unidade começa a desviar caminhões
const PROJ_ALIVIO = 0.3; // quanto a expedição desacelera na entressafra (30%)
const PROJ_ALIVIO_DIAS = 30; // em quantos dias ela desacelera (constante)

// estoque projetado dia a dia, de hoje (0) até `fim`, sem quinas:
// - a colheita vai acabando entre colheita.de e colheita.ate: a entrada cai
//   em curva (cosseno) do ritmo dos últimos 3 dias até a da entressafra;
// - perto do topo a unidade desvia caminhões: acima de PROJ_TOPO a entrada
//   recebida cai até zero em 100%, então a curva arredonda em vez de travar;
// - depois da colheita a saída continua e desacelera aos poucos.
function projetar(s, colheita, fim) {
    const v = [s.hist[s.hist.length - 1]];
    for (let d = 1; d <= fim; d++) {
        const t = d - 0.5;
        const safra = t <= colheita.de ? 1 : (t >= colheita.ate ? 0
            : 0.5 * (1 + Math.cos(Math.PI * (t - colheita.de) / (colheita.ate - colheita.de))));
        const occ = v[d - 1] / s.cap * 100;
        const aceita = occ <= PROJ_TOPO ? 1 : Math.max(0, (100 - occ) / (100 - PROJ_TOPO));
        const entrada = (s.entressafra + (s.entrada - s.entressafra) * safra) * aceita;
        const saida = d <= colheita.ate ? s.saida
            : s.saida * (1 - PROJ_ALIVIO * (1 - Math.exp(-(d - colheita.ate) / PROJ_ALIVIO_DIAS)));
        v.push(Math.min(s.cap, Math.max(0, v[d - 1] + entrada - saida)));
    }
    return v;
}

// saldo com sinal: +4.350 / −1.040
function saldoTxt(v) {
    return (v < 0 ? '−' : '+') + fmtNum(Math.abs(v));
}

function elSvg(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
}

// marca: ponto em (left, top) do gráfico, com rótulo opcional em HTML
function marcaProj(classe, left, top, titulo, rotulo) {
    const m = novo('span', 'du-proj-marca ' + classe);
    m.style.left = left.toFixed(2) + '%';
    m.style.top = top.toFixed(2) + '%';
    m.title = titulo;
    if (rotulo) {
        const r = novo('span');
        r.append(novo('b', null, rotulo[0]), ' ' + rotulo[1]);
        m.appendChild(r);
    }
    return m;
}

function desenharProjecao(secao) {
    const select = secao.querySelector('.du-proj-sel select');
    const graf = secao.querySelector('.du-proj-graf');
    const plot = secao.querySelector('.du-proj-plot');
    const svg = secao.querySelector('.du-proj-svg');
    const eixo = secao.querySelector('.du-proj-eixo');
    if (!select || !graf || !plot || !svg || !eixo) return;

    const op = select.options[select.selectedIndex];
    const s = op && op.dataset.hist ? serieDaOpcao(op) : serieDaRede(select);
    if (!s.cap || s.hist.length < 2) return;
    const nome = op ? op.textContent.trim() : 'Rede';

    const ini = -(s.hist.length - 1);
    const occ = s.hist.map((t) => t / s.cap * 100);
    const agora = occ[occ.length - 1];
    const janela = (select.dataset.colheita || '').split(':').map(Number);
    const colheita = { de: janela[0] || 0, ate: janela[1] || 0 };
    const projeta = !s.off;

    // x vai de ini até PROJ_HORIZONTE dias à frente;
    // y de 10 em 10 pontos, do múltiplo de 10 abaixo do menor valor até 100%
    const fim = PROJ_HORIZONTE;
    const proj = projeta ? projetar(s, colheita, fim).map((t) => t / s.cap * 100) : [];
    const iPico = projeta ? proj.indexOf(Math.max.apply(null, proj)) : 0;
    const base = Math.max(0, Math.floor((Math.min.apply(null, occ.concat(proj)) - 2) / 10) * 10);
    const x = (d) => (d - ini) / (fim - ini) * 300;
    const y = (p) => (100 - p) / (100 - base) * 100;

    // ---- SVG: fundo da previsão, grade, guias, área, linhas ----
    svg.textContent = '';
    svg.appendChild(elSvg('rect', { class: 'du-proj-futuro', x: x(0), y: 0, width: 300 - x(0), height: 100 }));
    let grade = '';
    for (let p = base; p < 100; p += 10) grade += 'M0 ' + y(p).toFixed(2) + ' H300 ';
    svg.appendChild(elSvg('path', { class: 'du-proj-grade', d: grade }));
    svg.appendChild(elSvg('path', { class: 'du-proj-cap', d: 'M0 0 H300' }));
    svg.appendChild(elSvg('path', { class: 'du-proj-guia', d: 'M' + x(0) + ' 0 V100' }));
    const pontos = occ.map((p, i) => x(ini + i).toFixed(1) + ',' + y(p).toFixed(2)).join(' ');
    svg.appendChild(elSvg('polygon', { class: 'du-proj-area', points: x(ini) + ',100 ' + pontos + ' ' + x(0) + ',100' }));
    if (projeta) {
        svg.appendChild(elSvg('polyline', {
            class: 'du-proj-linha du-proj-linha--proj',
            points: proj.map((p, d) => x(d).toFixed(1) + ',' + y(p).toFixed(2)).join(' ')
        }));
    }
    svg.appendChild(elSvg('polyline', { class: 'du-proj-linha', points: pontos }));

    // ---- HTML por cima: escala, rótulos e marcas (left/top em % do gráfico) ----
    plot.querySelectorAll(':scope > :not(svg)').forEach((el) => el.remove());
    for (let p = base; p <= 100; p += 10) {
        const r = novo('span', 'du-proj-y', p + '%');
        r.style.top = y(p).toFixed(2) + '%';
        plot.appendChild(r);
    }
    const canto = novo('div', 'du-proj-nome');
    canto.append(novo('b', null, nome), novo('span', null, 'capacidade · ' + fmtNum(s.cap) + ' m³'));
    plot.appendChild(canto);

    plot.appendChild(marcaProj('du-proj-marca--hoje', x(0) / 3, y(agora),
        (s.off ? 'Última leitura, às ' + s.off : 'Hoje') + ': ' + fmtNum(s.hist[s.hist.length - 1]) + ' m³ de ' + fmtNum(s.cap) + ' m³',
        [Math.round(agora) + '%', s.off ? 'às ' + s.off : 'hoje']));

    const colheitaTxt = 'a colheita do trigo vai acabando entre +' + colheita.de + ' e +' + colheita.ate + ' dias';
    if (projeta && iPico > 0) {
        // pico da projeção: mesmas faixas de cor da ocupação na tabela
        const pico = proj[iPico];
        const faixa = pico >= 97 ? ' is-alerta' : (pico >= 93 ? ' is-atencao' : '');
        plot.appendChild(marcaProj('du-proj-marca--pico' + faixa, x(iPico) / 3, y(pico),
            'Pico de ' + Math.round(pico) + '% em ' + iPico + ' dias: o saldo hoje é ' + saldoTxt(s.ritmo) + ' m³/dia, '
            + colheitaTxt + ' e, acima de ' + PROJ_TOPO + '%, começa o desvio de caminhões',
            [Math.round(pico) + '%', 'pico em +' + iPico]));
    }
    if (projeta) {
        // onde a projeção termina; perto do rodapé o rótulo fica na altura do ponto
        const fimProj = proj[proj.length - 1];
        plot.appendChild(marcaProj('du-proj-marca--fim' + (y(fimProj) > 85 ? ' is-baixo' : ''), x(fim) / 3, y(fimProj),
            'Em +' + fim + ' dias: ' + fmtNum(Math.round(fimProj * s.cap / 1000) * 10) + ' m³. Depois da colheita entram '
            + fmtNum(s.entressafra) + ' m³/dia e a saída (' + fmtNum(s.saida) + ' m³/dia hoje) desacelera aos poucos.',
            [Math.round(fimProj) + '%', 'em +' + fim + ' dias']));
    }

    // ---- eixo X de PROJ_EIXO_PASSO em PROJ_EIXO_PASSO dias ----
    eixo.textContent = '';
    for (let d = ini; d <= fim; d += PROJ_EIXO_PASSO) {
        const t = d === ini ? '−' + (-d) + ' dias' : (d === 0 ? 'hoje' : (d > 0 ? '+' + d : '−' + (-d)));
        const r = novo('span', d === 0 ? 'is-hoje' : null, t);
        r.style.left = (x(d) / 3).toFixed(2) + '%';
        eixo.appendChild(r);
    }

    const ritmo = secao.querySelector('.du-proj-ritmo');
    if (ritmo) {
        ritmo.textContent = projeta
            ? 'projeção: ' + saldoTxt(s.ritmo) + ' m³/dia hoje; ' + colheitaTxt + ' e a saída continua'
            : 'sem comunicação desde ' + s.off + ': sem projeção';
    }
    graf.setAttribute('aria-label', nome + ': ocupação de ' + Math.round(occ[0]) + '% há ' + (-ini) + ' dias e '
        + Math.round(agora) + '% ' + (s.off ? 'na última leitura, às ' + s.off : 'hoje')
        + (projeta ? '; projeção com pico de ' + Math.round(proj[iPico]) + '% em ' + iPico + ' dias e '
            + Math.round(proj[proj.length - 1]) + '% em ' + fim + ' dias.' : '; sem projeção.'));
}

function desenharProjecoes(raiz) {
    (raiz || document).querySelectorAll('.du-proj').forEach(desenharProjecao);
}

document.addEventListener('change', (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('.du-proj-sel')) return;
    const secao = e.target.closest('.du-proj');
    if (secao) desenharProjecao(secao);
});

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
    raiz.querySelectorAll('.block-actions, .drag-handle, .resize-handle, .camera-stream, .du-mapa-real')
        .forEach((el) => el.remove());
    // sem o mapa real, o SVG de reserva volta a aparecer no HTML salvo
    if (raiz.classList && raiz.classList.contains('has-mapa')) raiz.classList.remove('has-mapa');
    raiz.querySelectorAll('.has-mapa').forEach((el) => el.classList.remove('has-mapa'));
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
    mountMapaUnidades(palco);
    refreshAlertsBadge();
    sincronizarMenuComTela();
    desenharRoscas(palco);
    desenharProjecoes(palco);
    // no carregamento o remontar roda antes das constantes do armazém
    // existirem (lá no fim do arquivo): espera o script terminar
    requestAnimationFrame(() => {
        montarArmazens(palco);
        montarSecagem(palco);
        montarProdutividade(palco);
        montarPressao(palco);
        rotularChuva(palco);
    });
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
        mountMapaUnidades(copia);
        desenharRoscas(copia);
        desenharProjecoes(copia);
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
    desenharProjecoes(palco);
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
// Os turnos nao encaixam (o 3o atravessa a meia-noite): cada linha diz em
// data-turno de qual turno e' — duas na troca, que se cruza por 20 minutos.
const JANELAS_FLUXO = ['hoje', '7d', '30d'];
const TURNOS_FLUXO = ['t1', 't2', 't3'];

function noPeriodoFluxo(tr, periodo) {
    if (TURNOS_FLUXO.includes(periodo)) {
        return (tr.dataset.turno || '').split(/\s+/).includes(periodo);
    }
    const linha = JANELAS_FLUXO.indexOf(tr.dataset.janela || 'hoje');
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
    // (vale para as duas telas de fluxo, recepcao e expedicao)
    document.querySelectorAll('.fluxo-periodo-btn[data-fluxo-periodo="hoje"]').forEach((botaoHoje) => {
        if (!botaoHoje.classList.contains('is-active')) escolherPeriodoFluxo(botaoHoje);
    });
    // a cultura tambem volta para "todas" pelo mesmo motivo
    document.querySelectorAll('button[data-fluxo-cultura="todas"]').forEach((botaoTodas) => {
        if (!botaoTodas.classList.contains('is-active')) escolherCulturaFluxo(botaoTodas);
    });
    document.querySelectorAll('.content-section[data-fluxo-etapa]').forEach((secao) => {
        if (secao.dataset.fluxoEtapa !== 'todos') filtrarFluxo(secao, 'todos');
    });
}

// ============================================
// CLASSIFICACAO · FILTRO GERAL DA TELA (CULTURA + TURNO/PERIODO)
// Igual ao da recepcao: a cultura e' escolha unica (Todas ou uma) e o
// periodo mora em data-class-periodo, em turno (t1/t2/t3, a ultima vez que
// cada turno aconteceu) ou janela (hoje/7d/30d). data-cult-milho,
// data-cult-sorgo, data-cult-trigo e data-cult-soja na tela dizem quem esta
// no recorte: as quatro "on" em Todas, so a escolhida nas outras — o CSS
// usa isso para tirar linhas da tabela e zerar o PH/FN sem trigo.
// O CSS troca o numero de cada indicador (o HTML traz a versao de "todas" e
// a de cada cultura sozinha). O historico segue a cultura escolhida.
// ============================================
const NOME_PERIODO_CLASS = {
    t1: '1º turno 07:00–16:20', t2: '2º turno 16:00–22:20', t3: '3º turno 22:00–07:00',
    hoje: 'hoje', '7d': '7 dias', '30d': '30 dias',
};

const CULTURAS_CLASS = ['milho', 'sorgo', 'trigo', 'soja'];
const PERIODOS_CLASS = ['t1', 't2', 't3', 'hoje', '7d', '30d'];

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
// uma linha dentro dele. Cada elemento pertence ao grupo mais proximo, entao
// um grupo nunca le o numero do outro.
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
// media ponderada pelas cargas no resto (umidade, impureza, avariados).
// Valor em "—" (cultura sem o ensaio) fica de fora da conta. PH e falling
// number sairam daqui: ficam no quadro do trigo por tipo, que nao mistura.
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

// limite de cada cultura no padrao da unidade, em data-class-lim do cartao
// ("milho:máx. 14%|sorgo:máx. 13%"): vai na terceira coluna do balao
function limitesClass(grupo) {
    const lim = {};
    (grupo.dataset.classLim || '').split('|').forEach((par) => {
        const i = par.indexOf(':');
        if (i > 0) lim[par.slice(0, i).trim()] = par.slice(i + 1).trim();
    });
    return lim;
}

function escreverMotivoClass(tela, marcadas) {
    if (!tela) return;
    const periodo = tela.dataset.classPeriodo || 'hoje';
    const recorte = nomeRecorteClass(marcadas) || ' · todas as culturas';
    tela.querySelectorAll('[data-class-agg]').forEach((grupo) => {
        const lim = limitesClass(grupo);
        const itens = marcadas.map((c) => {
            const b = fonteClass(grupo, c, periodo);
            return ROTULO_CULTURA_CLASS[c] + '::' + (b ? b.textContent.trim() : '—') + '::' + (lim[c] || '');
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
        const ativo = btn.dataset.classCultura === tela.dataset.classCultura;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
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

// escolha unica, como nas outras telas: "Todas" ou so a cultura clicada
function escolherCulturaClassificacao(alvo) {
    const tela = alvo.closest('#screen-1');
    const cultura = alvo.dataset.classCultura;
    if (!tela || !cultura) return;
    aplicarCulturasClassificacao(tela, cultura === 'todas' ? CULTURAS_CLASS.slice() : [cultura]);
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
// (ao vivo no 1º turno, média nos demais) e as trocas de cultura que entram no
// período. Turnos t1/t2/t3 e hoje/7/30 dias, nos mesmos botões do fluxo.
// Delegado no documento porque o editor remonta o palco.
// ============================================
function escolherPeriodoMoega(alvo) {
    const tela = alvo.closest('.screen--moegas');
    const periodo = alvo.dataset.moegaPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.moegaPeriodo = periodo;
    tela.querySelectorAll('button[data-moega-periodo]').forEach((btn) => {
        const ativo = btn.dataset.moegaPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    scheduleFit();
}

// A cultura tambem e' da tela (data-moega-cultura): o CSS apaga as moegas e os
// pulmoes de outra cultura sem tirar do lugar. O titulo da grade diz a cultura
// e avisa quando nenhuma moega esta nela (a vazia nao conta: so pode receber).
function escolherCulturaMoega(alvo) {
    const tela = alvo.closest('.screen--moegas');
    const cultura = alvo.dataset.moegaCultura;
    if (!tela || !cultura) return;
    tela.dataset.moegaCultura = cultura;
    tela.querySelectorAll('button[data-moega-cultura]').forEach((btn) => {
        const ativo = btn.dataset.moegaCultura === cultura;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    const nome = NOME_CULTURA_FLUXO[cultura] || cultura;
    const temMoega = !!tela.querySelector('.moega-item[data-cultura="' + cultura + '"]');
    tela.querySelectorAll('[data-moega-cultura-nome]').forEach((el) => {
        el.textContent = cultura === 'todas' ? ''
            : ' · ' + (temMoega ? nome : 'nenhuma moega com ' + nome + ' agora');
    });
}

// o editor salva o HTML como esta: a tela volta para todas as culturas antes
function limparFiltrosMoega() {
    const todas = document.querySelector('.screen--moegas button[data-moega-cultura="todas"]');
    if (todas && !todas.classList.contains('is-active')) escolherCulturaMoega(todas);
}

// ============================================
// FLUXO · PERIODO E CULTURA DA TELA
// A section guarda as duas escolhas em data-fluxo-periodo / data-fluxo-cultura.
// O periodo vale para tudo:
// o CSS mostra so o valor daquele periodo em cada etapa (quantidade, fila,
// estado e tempo medio) e esconde as linhas fora da janela; o filtro da
// tabela recalcula a contagem dos selos. Delegado no documento.
// ============================================
const NOME_PERIODO_FLUXO = {
    t1: '1º turno 07:00–16:20', t2: '2º turno 16:00–22:20', t3: '3º turno 22:00–07:00',
    hoje: 'hoje', '7d': '7 dias', '30d': '30 dias',
};
const NOME_CULTURA_FLUXO = { milho: 'milho', sorgo: 'sorgo', trigo: 'trigo', soja: 'soja' };

// as duas telas de fluxo (recepcao e expedicao) usam o mesmo filtro
const TELAS_FLUXO = '#screen-fluxo, #screen-exp-fluxo';

function escolherPeriodoFluxo(alvo) {
    const tela = alvo.closest(TELAS_FLUXO);
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
    const tela = alvo.closest(TELAS_FLUXO);
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
// O menu "Contrato" escolhe UM contrato por vez (radios), para a secao nao
// mudar de tamanho: so a linha escolhida aparece. Se a cultura do filtro
// geral nao for a do escolhido, passa para o primeiro contrato da cultura.
// Delegado no documento porque o editor remonta o palco.
// ============================================
function atualizarContratos(bloco) {
    const tela = bloco.closest('#screen-7');
    const cultura = tela ? tela.dataset.expCultura : 'todas';
    const daCultura = (linha) => !cultura || cultura === 'todas' || linha.dataset.cultura === cultura;
    const opcoes = [...bloco.querySelectorAll('.exp-contrato-opcao input')];
    const linhaDe = (input) => bloco.querySelector('.exp-contrato[data-contrato="' + input.value + '"]');
    let escolhido = opcoes.find((input) => input.checked);
    if (!escolhido || !linhaDe(escolhido) || !daCultura(linhaDe(escolhido))) {
        const primeiro = opcoes.find((input) => linhaDe(input) && daCultura(linhaDe(input)));
        if (primeiro) {
            primeiro.checked = true;
            escolhido = primeiro;
        }
    }
    let visiveis = 0;
    bloco.querySelectorAll('.exp-contrato').forEach((linha) => {
        const mostra = !!escolhido && linha.dataset.contrato === escolhido.value;
        linha.hidden = !mostra;
        if (mostra && daCultura(linha)) visiveis++;
    });
    const conta = bloco.querySelector('.exp-contratos-conta');
    const nome = escolhido && escolhido.closest('.exp-contrato-opcao').querySelector('b');
    if (conta) conta.textContent = nome ? nome.textContent : '—';
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
});

document.addEventListener('change', (e) => {
    if (!(e.target instanceof Element) || !e.target.matches('.exp-contrato-opcao input')) return;
    const bloco = e.target.closest('.exp-contratos');
    if (!bloco) return;
    atualizarContratos(bloco);
    abrirMenuContratos(bloco, false);
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
// os blocos .prod-periodo-bloco do periodo. Turno (t1/t2/t3) tambem leva o
// grafico por hora para aquele turno; hoje/7/30 dias deixam o grafico no
// ultimo turno escolhido.
// ============================================
function escolherPeriodoProd(alvo) {
    const tela = alvo.closest('#screen-4');
    const periodo = alvo.dataset.prodPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.prodPeriodo = periodo;
    tela.querySelectorAll('button[data-prod-periodo]').forEach((btn) => {
        const ativo = btn.dataset.prodPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    if (/^t\d$/.test(periodo)) {
        tela.querySelectorAll('.prod-grafico').forEach((secao) => {
            secao.dataset.prodTurno = periodo;
            montarGraficoProd(secao);
        });
    }
    scheduleFit();
}

// ============================================
// PRODUTIVIDADE · SECAGEM POR HORA, POR TURNO
// Um grafico por secador, dentro do cartao dele ([data-prod-grafico="s1"]),
// mostrando um turno por vez (data-prod-turno na secao, escolhido pelo
// filtro de turno do cabecalho da tela). Monta do JSON em
// [data-prod-dados]: por hora, o secado de cada secador (s1, s2), a meta de
// operacao (m1, m2), a umidade media de entrada da hora (u1, u2, em %; a
// projecao nao tem), os minutos da hora que contam (min, 60 se faltar),
// parada {sec, min, motivo}, agora/futuro. A umidade vai embaixo da hora:
// e' o que explica o secador abaixo do nominal com a temperatura ja no
// maximo (grao mais umido seca mais devagar). Duas linhas no grafico: a
// capacidade nominal (tracejada) e a meta de operacao (cheia, em degraus,
// hora a hora); os dois graficos usam a mesma escala (max). Embaixo de cada
// um, o fim do turno: secado contra o que o nominal permitiria nas horas
// que ja passaram; ate 10% abaixo e' normal, mais que isso alerta com as
// toneladas perdidas.
// ============================================
const PROD_SECADORES = [
    { chave: 's1', meta: 'm1', umi: 'u1' },
    { chave: 's2', meta: 'm2', umi: 'u2' },
];
const PROD_TOLERANCIA = 0.9; // ate 10% abaixo do nominal e' normal

// umidade media da hora, "18,2%"; vazio quando a hora nao tem (projecao)
function umidadeDaHora(hora, s) {
    const u = hora[s.umi];
    return typeof u === 'number' ? `${u.toFixed(1).replace('.', ',')}%` : '';
}


// cada hora e' rotulada pelo inicio: "07h" (das 7h as 8h) vira "7h"
function rotuloHora(hora) {
    return `${parseInt(hora.h, 10)}h`;
}

// intervalo da hora para o tooltip: "das 7h às 8h"; hora que nao conta
// inteira (min < 60) termina antes: "das 16h às 16h20"
function intervaloHora(hora) {
    const ini = parseInt(hora.h, 10);
    const min = hora.min || 60;
    const fim = min < 60 ? `${ini}h${String(min).padStart(2, '0')}` : `${(ini + 1) % 24}h`;
    return `das ${ini}h às ${fim}`;
}

function dadosProd(secao) {
    const fonte = secao.querySelector('[data-prod-dados]');
    if (!fonte) return null;
    try {
        return JSON.parse(fonte.textContent);
    } catch (err) {
        return null;
    }
}

function horasEMinutos(minutos) {
    const h = Math.floor(minutos / 60);
    const m = Math.round(minutos % 60);
    return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

// a parada so entra no grafico do secador que parou
function paradaDoSecador(hora, s) {
    return hora.parada && hora.parada.sec === s.chave ? hora.parada : null;
}

function graficoProd(dados, turno, s) {
    const horas = turno.horas;
    const max = dados.max || 100;
    const pct = (v) => Math.max(0, Math.min(100, (v / max) * 100));
    const n = horas.length;
    const nominal = dados.nominal[s.chave];

    const cols = horas.map((hora) => {
        const min = hora.min || 60;
        const parcial = min < 60 && !hora.futuro;
        const parada = paradaDoSecador(hora, s);
        const v = hora[s.chave];
        let dia = intervaloHora(hora);
        if (hora.futuro) dia += ' · projeção';
        if (parada) dia += ` · parado ${parada.min} min (${parada.motivo})`;
        const umidade = umidadeDaHora(hora, s);
        if (umidade) dia += ` · umidade ${umidade}`;
        // o tooltip pinta as duas linhas na cor do secador (--sec do cartao)
        const attrs = [
            `data-dia="${dia}"`,
            `data-recebido="${v} t"`,
            `data-nome-recebido="${hora.futuro ? 'Projetado' : 'Secado'}"`,
            'data-cor-recebido="--sec"',
            `data-programado="${hora[s.meta]} t"`,
            'data-nome-programado="Meta de operação"',
            'data-cor-programado="--sec"',
        ].join(' ');
        const abaixo = !hora.futuro && v < hora[s.meta] * PROD_TOLERANCIA;
        const barra = ['forecast-bar', 'forecast-bar--hora', 'is-stack'];
        if (parcial) barra.push('is-parcial');
        if (hora.futuro) barra.push('is-projecao');
        if (abaixo) barra.push('is-abaixo');
        const faixa = parada
            ? `<span class="prod-parada" aria-hidden="true"><b>${parada.min} min</b></span>`
            : '';
        const cls = ['hora-col'];
        if (hora.futuro) cls.push('is-futuro');
        if (parcial) cls.push('is-parcial');
        if (parada) cls.push('is-parada');
        return `<div class="${cls.join(' ')}" tabindex="0" ${attrs}>${faixa}`
            + `<div class="${barra.join(' ')}" style="height: ${pct(v).toFixed(1)}%">`
            + `<span class="forecast-cap">${hora.futuro ? '~' : ''}${v}</span>`
            + `<i class="forecast-seg forecast-seg--sec${s.chave.slice(1)}" style="height: 100%"></i></div></div>`;
    }).join('');

    // linhas: nominal reta e tracejada; operacao em degraus, hora a hora
    const y = (v) => (100 - pct(v)).toFixed(2);
    const degraus = horas.map((hora, i) => `${i * 100},${y(hora[s.meta])} ${(i + 1) * 100},${y(hora[s.meta])}`).join(' ');
    const linhas = `<line class="prod-linha-nominal prod-linha--${s.chave}" x1="0" y1="${y(nominal)}" x2="${n * 100}" y2="${y(nominal)}"></line>`
        + `<polyline class="prod-linha-op prod-linha--${s.chave}" points="${degraus}"></polyline>`;
    const rotulo = `<span class="prod-meta-tag prod-meta-tag--${s.chave}" style="bottom: ${pct(nominal).toFixed(1)}%">`
        + `nominal<b>${nominal} t/h</b></span>`;

    // embaixo de cada hora so a hora e a umidade, sempre nas
    // mesmas linhas; parada com motivo, hora parcial e projecao vao para a
    // linha de ocorrencias do secador (eventosProd)
    const eixoX = horas.map((hora) => {
        const cls = ['forecast-day'];
        if (hora.agora) cls.push('is-agora');
        if (hora.futuro) cls.push('is-futuro');
        const umidade = umidadeDaHora(hora, s);
        const umi = umidade ? `<small class="prod-umi" title="Umidade média de entrada na hora">${umidade}</small>` : '';
        return `<span class="${cls.join(' ')}"><span class="prod-hora">${rotuloHora(hora)}</span>${umi}</span>`;
    }).join('');

    return `<div class="forecast-chart forecast-chart--horas forecast-chart--turno" style="--chart-cols: ${n}" data-chart-max="${max}">`
        + `<div class="forecast-yaxis"><span>${max}</span><span>${max * 0.75}</span><span>${max / 2}</span><span>${max / 4}</span><span>0</span></div>`
        + '<div class="forecast-plot">'
        + '<div class="forecast-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>'
        + `<div class="forecast-cols">${cols}</div>`
        + `<svg class="prod-linhas" viewBox="0 0 ${n * 100} 100" preserveAspectRatio="none" aria-hidden="true">${linhas}</svg>`
        + rotulo
        + '</div>'
        + `<div class="forecast-xaxis">${eixoX}</div>`
        + '<span class="forecast-unit">t/h<small class="prod-umi-rotulo">umid. média</small></span>'
        + '</div>';
}

// ocorrencias do turno de um secador, numa linha propria entre o grafico e o
// fim do turno: cada parada com o motivo (o que mais importa achar na
// tela), a hora parcial ou em andamento e as horas projetadas. Cada selo
// leva a mesma marca da legenda do grafico
function eventosProd(turno, s) {
    const itens = [];
    const paradas = turno.horas.filter((hora) => paradaDoSecador(hora, s));
    if (!paradas.length) {
        itens.push('<span class="prod-evento prod-evento--ok"><b>Sem paradas</b> no turno</span>');
    }
    paradas.forEach((hora) => {
        const parada = paradaDoSecador(hora, s);
        itens.push('<span class="prod-evento prod-evento--parada"><i class="prod-leg-parada" aria-hidden="true"></i>'
            + `<b>${rotuloHora(hora)} · parado ${parada.min} min</b> ${parada.motivo}</span>`);
    });
    const parcial = turno.horas.find((hora) => !hora.futuro && (hora.min || 60) < 60);
    if (parcial) {
        itens.push('<span class="prod-evento"><i class="prod-evento-parcial" aria-hidden="true"></i>'
            + `<b>${rotuloHora(parcial)}</b> ${parcial.agora ? 'em andamento' : 'parcial'} · ${parcial.min} min</span>`);
    }
    const futuras = turno.horas.filter((hora) => hora.futuro);
    if (futuras.length) {
        const ini = rotuloHora(futuras[0]);
        const faixa = futuras.length > 1 ? `${ini}–${rotuloHora(futuras[futuras.length - 1])}` : ini;
        itens.push('<span class="prod-evento"><i class="legend-dot legend-dot--proj-key" aria-hidden="true"></i>'
            + `<b>${faixa}</b> projeção</span>`);
    }
    return itens.join('');
}

// fim do turno de um secador: o que secou contra o que o nominal permitiria
// nas horas que ja passaram (as projetadas ficam de fora). O t/h com o
// secador rodando nao entra: o cartao ja mostra na produtividade por cultura
function fimDoTurnoProd(dados, turno, s) {
    const feitas = turno.horas.filter((hora) => !hora.futuro);
    const minutos = feitas.reduce((a, hora) => a + (hora.min || 60), 0);
    const titulo = turno.emAndamento
        ? `Até agora · ${horasEMinutos(minutos)} de turno`
        : `Fim do turno · ${horasEMinutos(minutos)}`;
    const secado = feitas.reduce((a, hora) => a + hora[s.chave], 0);
    const possivel = Math.round((dados.nominal[s.chave] * minutos) / 60);
    const fator = possivel ? secado / possivel : 0;
    const normal = fator >= PROD_TOLERANCIA;
    const status = normal
        ? `<span class="class-status class-status--ok">normal · até 10% abaixo</span>`
        : `<span class="class-status class-status--fora">perdeu ${(possivel - secado).toLocaleString('pt-BR')} t</span>`;
    // "do possivel", nao "do nominal": conta o tempo parado, entao nao bate
    // com o % do nominal da produtividade por cultura no mesmo cartao
    const html = `<span class="prod-fim-titulo">${titulo}</span>`
        + `<span class="prod-fim-conta">secou <b>${secado.toLocaleString('pt-BR')} t</b> de <b>${possivel.toLocaleString('pt-BR')} t</b> possíveis no nominal</span>`
        + `<span class="prod-fim-pct"><b>${Math.round(fator * 100)}%</b> do possível</span>`
        + status;
    return { html, normal };
}

function montarGraficoProd(secao) {
    const dados = dadosProd(secao);
    if (!dados) return;
    const chave = secao.dataset.prodTurno || 't1';
    const turno = dados.turnos[chave];
    if (!turno) return;
    PROD_SECADORES.forEach((s) => {
        const alvo = secao.querySelector(`[data-prod-grafico="${s.chave}"]`);
        const fim = secao.querySelector(`[data-prod-fim="${s.chave}"]`);
        const eventos = secao.querySelector(`[data-prod-eventos="${s.chave}"]`);
        if (alvo) alvo.innerHTML = graficoProd(dados, turno, s);
        if (eventos) eventos.innerHTML = eventosProd(turno, s);
        if (fim) {
            const resumo = fimDoTurnoProd(dados, turno, s);
            fim.innerHTML = resumo.html;
            fim.classList.toggle('is-alerta', !resumo.normal);
        }
    });
    secao.querySelectorAll('[data-prod-turno-nome]').forEach((el) => {
        el.textContent = `${turno.nome} · ${turno.quando}`;
    });
}

function montarProdutividade(raiz) {
    (raiz || document).querySelectorAll('.prod-grafico').forEach(montarGraficoProd);
}

montarProdutividade();

// ============================================
// PRESSAO DOS SECADORES · DEPRESSAO POR PONTO
// Um cartao por secador com o desenho da torre de cavaletes, no estilo da
// especificacao de engenharia (EE-206 · Medicao em Secadores): camara de ar
// quente em escada (ar de secagem), cavaletes (secagem), camara de ar
// saturado com o ventilador no topo e o resfriamento embaixo (ar ambiente).
// Cada ponto de pressao fica marcado no lugar da medicao e ligado a um quadro
// com o local, o valor da ultima hora, a media do turno e a curva do turno.
// Monta do JSON em [data-pressao-dados]: secadores {s1, s2: nome, tipo,
// cultura}, pontos [{id, local}], horas [{h, s1, s2, min?, agora?}] com
// s1/s2 = [P1..P5] em mmH2O, e paradas [{sec, h, min, motivo}].
// O desenho e' SVG em coordenadas fixas (800 x 640); os quadros e rotulos
// sao HTML posicionados em % dessas coordenadas, para a letra nao escalar
// com o desenho e seguir o piso de fonte do modo TV.
// ============================================
const PRESSAO_SECADORES = ['s1', 's2'];
const PRESSAO_DESENHO = { w: 800, h: 640, quadroEsq: 195, quadroDir: 595 };
// lugar de cada ponto no desenho (marca) e altura do quadro dele; os da
// camara de ar quente e da fornalha ficam a esquerda, os outros a direita
const PRESSAO_LUGARES = [
    { x: 315, y: 120, lado: 'esq', qy: 110 },   // P1 camara de ar quente, topo
    { x: 222, y: 440, lado: 'esq', qy: 315 },   // P2 camara de ar quente, base
    { x: 497, y: 150, lado: 'dir', qy: 180 },   // P3 camara de ar saturado (exaustao)
    { x: 400, y: 518, lado: 'dir', qy: 470 },   // P4 resfriamento
    { x: 255, y: 530, lado: 'esq', qy: 530 },   // P5 duto de ar quente, saida da fornalha
];

// mmH2O com o sinal de menos tipografico: "−32"
function formatarPressao(v) {
    return String(Math.round(v)).replace('-', '−');
}

function dadosPressao(secao) {
    const fonte = secao.querySelector('[data-pressao-dados]');
    if (!fonte) return null;
    try {
        return JSON.parse(fonte.textContent);
    } catch (err) {
        return null;
    }
}

function setaPressao(x1, y1, x2, y2, tipo, sufixo) {
    return `<line class="pr-d-seta pr-d-seta--${tipo}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#pr-ponta-${tipo}-${sufixo})"></line>`;
}

// torre de cavaletes: o ar quente sai da fornalha, sobe pela camara em
// escada, atravessa os cavaletes, cai na camara de ar saturado e sai pelo
// ventilador no topo; embaixo o resfriamento puxa ar ambiente. "por cima"
// entra por ultimo no SVG (marcas dos pontos e guias)
function desenhoCavaletes(sufixo, porCima) {
    const tipos = ['quente', 'secagem', 'saturado', 'ambiente'];
    const pontas = tipos.map((t) => `<marker id="pr-ponta-${t}-${sufixo}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path class="pr-d-ponta pr-d-ponta--${t}" d="M0,0 L10,5 L0,10 z"></path></marker>`).join('');
    const partes = [];
    // fornalha e duto de ar quente ate a camara
    partes.push('<rect class="pr-d-fornalha" x="197" y="580" width="136" height="44" rx="6"></rect>');
    partes.push('<rect class="pr-d-zona pr-d-zona--quente" x="230" y="470" width="50" height="110"></rect>');
    partes.push(setaPressao(255, 572, 255, 482, 'quente', sufixo));
    // camara de ar quente em escada, mais larga embaixo
    partes.push('<polygon class="pr-d-zona pr-d-zona--quente" points="330,80 305,80 305,160 280,160 280,240 255,240 255,320 230,320 230,400 205,400 205,470 330,470"></polygon>');
    [[120, 305], [200, 280], [280, 255], [360, 230], [440, 205]].forEach(([y, x]) => {
        partes.push(setaPressao(x + 10, y, 324, y, 'quente', sufixo));
    });
    // torre com os cavaletes (ar de secagem atravessando o grao)
    partes.push('<polygon class="pr-d-torre" points="322,60 400,24 478,60"></polygon>');
    partes.push('<rect class="pr-d-torre" x="330" y="60" width="140" height="500"></rect>');
    for (let y = 82; y <= 460; y += 27) partes.push(setaPressao(342, y, 456, y, 'secagem', sufixo));
    // resfriamento: ar ambiente entra por baixo e atravessa o grao
    partes.push('<rect class="pr-d-zona pr-d-zona--ambiente" x="331" y="478" width="138" height="81"></rect>');
    [496, 540].forEach((y) => partes.push(setaPressao(288, y, 324, y, 'ambiente', sufixo)));
    [496, 518, 540].forEach((y) => partes.push(setaPressao(342, y, 456, y, 'ambiente', sufixo)));
    // camara de ar saturado e ventilador no topo
    partes.push('<rect class="pr-d-zona pr-d-zona--saturado" x="470" y="60" width="55" height="499"></rect>');
    partes.push(setaPressao(497, 545, 497, 78, 'saturado', sufixo));
    partes.push('<circle class="pr-d-vent" cx="497" cy="40" r="14"></circle>');
    partes.push(setaPressao(497, 24, 497, 4, 'saturado', sufixo));
    return `<svg class="pr-d" viewBox="0 0 ${PRESSAO_DESENHO.w} ${PRESSAO_DESENHO.h}" aria-hidden="true">`
        + `<defs>${pontas}</defs>${partes.join('')}${porCima || ''}</svg>`;
}

// curva do turno no quadro do ponto, na escala do proprio ponto
function curvaPressao(serie) {
    const min = Math.min(...serie);
    const max = Math.max(...serie);
    const faixa = max - min || 1;
    const pts = serie.map((v, k) => {
        const x = serie.length > 1 ? (k / (serie.length - 1)) * 100 : 50;
        const y = 2 + ((max - v) / faixa) * 16;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="pr-curva" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"></polyline></svg>`;
}

function cartaoPressao(dados, sec) {
    const meta = (dados.secadores && dados.secadores[sec]) || { nome: sec.toUpperCase() };
    const horas = dados.horas;
    const n = horas.length;
    const pct = (v, total) => `${((v / total) * 100).toFixed(2)}%`;
    const { w, h } = PRESSAO_DESENHO;

    // marcas no desenho e guias ate o quadro de cada ponto
    const marcas = PRESSAO_LUGARES.map((l) => {
        const ax = l.lado === 'esq' ? PRESSAO_DESENHO.quadroEsq : PRESSAO_DESENHO.quadroDir;
        return `<line class="pr-d-guia" x1="${l.x}" y1="${l.y}" x2="${ax}" y2="${l.qy}"></line>`
            + `<circle class="pr-d-marca" cx="${l.x}" cy="${l.y}" r="10"></circle>`;
    }).join('');

    const quadros = dados.pontos.map((ponto, i) => {
        const l = PRESSAO_LUGARES[i];
        if (!l) return '';
        const serie = horas.map((hora) => hora[sec][i]);
        const media = serie.reduce((a, v) => a + v, 0) / serie.length;
        const lado = l.lado === 'esq'
            ? `left: 0; width: ${pct(PRESSAO_DESENHO.quadroEsq, w)}`
            : `right: 0; width: ${pct(w - PRESSAO_DESENHO.quadroDir, w)}`;
        const turno = horas.map((hora, k) => `${rotuloHora(hora)} ${formatarPressao(serie[k])}`).join(' · ');
        return `<div class="pr-quadro pr-quadro--${l.lado}" style="${lado}; top: ${pct(l.qy, h)}" title="${ponto.id} · ${ponto.local} · ${turno} mmH₂O">`
            + `<div class="pr-quadro-head"><span class="pr-quadro-id">${ponto.id}</span><span class="pr-quadro-local">${ponto.local}</span></div>`
            + `<div class="pr-quadro-valor"><b>${formatarPressao(serie[n - 1])}</b><small>mmH₂O</small></div>`
            + `<div class="pr-quadro-sub">${curvaPressao(serie)}<span>média ${formatarPressao(media)}</span></div>`
            + '</div>';
    }).join('');

    const rotulos = `<span class="pr-d-rotulo" style="left: ${pct(265, w)}; top: ${pct(602, h)}">Fornalha</span>`
        + `<span class="pr-d-rotulo pr-d-rotulo--esq" style="left: ${pct(518, w)}; top: ${pct(40, h)}">Ventilador</span>`;

    const detalhe = [meta.tipo && `secador de ${meta.tipo}`, meta.cultura].filter(Boolean).join(' · ');
    return `<article class="pr-sec pr-sec--${sec}">`
        + `<div class="pr-sec-head"><i class="pr-leg pr-leg--${sec}" aria-hidden="true"></i>`
        + `<span class="pr-sec-nome">${meta.nome}</span><span class="pr-sec-meta">${detalhe}</span></div>`
        + `<div class="pr-corpo"><div class="pr-desenho">${desenhoCavaletes(sec, marcas)}${rotulos}${quadros}</div></div>`
        + '</article>';
}

// ocorrencias do turno, com as mesmas marcas e selos da produtividade
function eventosPressao(dados) {
    const itens = [];
    const paradas = dados.paradas || [];
    if (!paradas.length) {
        itens.push('<span class="prod-evento prod-evento--ok"><b>Sem paradas</b> no turno</span>');
    }
    paradas.forEach((p) => {
        const meta = (dados.secadores && dados.secadores[p.sec]) || { nome: p.sec };
        itens.push('<span class="prod-evento prod-evento--parada"><i class="prod-leg-parada" aria-hidden="true"></i>'
            + `<b>${meta.nome} · ${parseInt(p.h, 10)}h · parado ${p.min} min</b> ${p.motivo} · a depressão cai com o secador parado</span>`);
    });
    const agora = dados.horas.find((hora) => hora.agora);
    if (agora) {
        itens.push('<span class="prod-evento"><i class="prod-evento-parcial" aria-hidden="true"></i>'
            + `<b>${rotuloHora(agora)}</b> em andamento${agora.min ? ` · ${agora.min} min` : ''} · valores da hora atual</span>`);
    }
    return itens.join('');
}

function montarPressao(raiz) {
    (raiz || document).querySelectorAll('.pr-section').forEach((secao) => {
        const dados = dadosPressao(secao);
        const alvo = secao.querySelector('[data-pressao-secadores]');
        if (!dados || !alvo || !dados.horas.length) return;
        alvo.innerHTML = PRESSAO_SECADORES.map((sec) => cartaoPressao(dados, sec)).join('');
        const eventos = secao.querySelector('[data-pressao-eventos]');
        if (eventos) eventos.innerHTML = eventosPressao(dados);
        secao.querySelectorAll('[data-pressao-turno]').forEach((el) => {
            el.textContent = `${dados.turno} · ${dados.quando}`;
        });
    });
}

montarPressao();

// ============================================
// DEMAIS UNIDADES · PERIODO DO RECEBIDO POR CULTURA
// Vale so para a secao dos botoes: a tabela traz um tbody por periodo
// (data-du-periodo) e fica visivel o do botao escolhido.
// ============================================
const NOME_PERIODO_DU = { hoje: 'HOJE', '7d': '7 DIAS', '30d': '30 DIAS' };

function escolherPeriodoDu(alvo) {
    const secao = alvo.closest('.du-section');
    const periodo = alvo.dataset.duPeriodo;
    if (!secao || !periodo) return;
    secao.querySelectorAll('button[data-du-periodo]').forEach((btn) => {
        const ativo = btn.dataset.duPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    secao.querySelectorAll('tbody[data-du-periodo]').forEach((tb) => {
        tb.hidden = tb.dataset.duPeriodo !== periodo;
    });
    escreverTexto(secao.querySelector('[data-du-periodo-nome]'), NOME_PERIODO_DU[periodo] || periodo);
    scheduleFit();
}

document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element) || isEditing()) return;
    const periodoDu = e.target.closest('button[data-du-periodo]');
    if (periodoDu) {
        e.preventDefault();
        escolherPeriodoDu(periodoDu);
        return;
    }
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
    // a vista do grafico de chuva tambem usa a pilula do fluxo
    const vistaChuva = e.target.closest('button[data-pv-chuva]');
    if (vistaChuva) {
        e.preventDefault();
        escolherVistaChuva(vistaChuva);
        return;
    }
    // os botoes de periodo dos silos usam a pilula do fluxo: vem antes dela
    const periodoSilo = e.target.closest('button[data-silo-periodo]');
    if (periodoSilo) {
        e.preventDefault();
        escolherPeriodoSilo(periodoSilo);
        return;
    }
    // os das moegas tambem
    const periodoMoega = e.target.closest('button[data-moega-periodo]');
    if (periodoMoega) {
        e.preventDefault();
        escolherPeriodoMoega(periodoMoega);
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
    const culturaMoega = e.target.closest('button[data-moega-cultura]');
    if (culturaMoega) {
        e.preventDefault();
        escolherCulturaMoega(culturaMoega);
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
    desenharProjecoes(palco);
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
// SECAGEM · GRAFICOS, ALARMES E LIMPEZA
// Cada [data-secador] traz as series do turno (data-forn, data-ar e
// data-saida de 5 em 5 min; data-umi de 15 em 15 min, a partir de
// data-inicio) e o script monta os quatro graficos pequenos, um por
// indicador, todos no mesmo eixo de horas (data-inicio a data-fim) e cada
// um na propria escala:
//   fornalha  0–1.000 °C, tracejado no minimo e no maximo da faixa
//   ar        0 até um pouco acima do limite da cultura, tracejado no limite
//             e pontilhado na desejada (o operador define)
//   saida     0–60 °C, tracejado no limite (50); acima dele o cartao alarma
//   umidade   12–20 %
// Os numeros do cartao saem da ultima leitura, entao nunca brigam com o
// grafico. Monta uma vez; os dados de demonstracao sao fixos em 14h50.
// ============================================
const SEC_PASSO_TEMP = 5; // min entre leituras de temperatura
const SEC_PASSO_UMI = 15; // min entre leituras de umidade

function minutosDoDia(hhmm) {
    const [h, m] = String(hhmm || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function grau(v) {
    return `${Math.round(v)}°C`;
}

function umidade(v) {
    return `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Queda de umidade em pontos por hora: a cada leitura (15 min), a de 1 h
// atras menos a atual; so entra quando as cinco leituras sao da mesma
// secagem (nenhuma subida, que seria grao novo entrando). Media das que
// cairam nas ultimas 3 h.
function quedaUmidade(umi) {
    const porHora = 60 / SEC_PASSO_UMI;
    const janela = (3 * 60) / SEC_PASSO_UMI;
    const quedas = [];
    for (let k = umi.length - 1; k >= porHora && k > umi.length - 1 - janela; k -= 1) {
        let mesmaSecagem = true;
        for (let j = k - porHora + 1; j <= k; j += 1) {
            if (umi[j] - umi[j - 1] > 0.15) mesmaSecagem = false;
        }
        const queda = umi[k - porHora] - umi[k];
        if (mesmaSecagem && queda > 0) quedas.push(queda);
    }
    return quedas.length ? quedas.reduce((a, b) => a + b, 0) / quedas.length : null;
}

function graficoSecador({ nome, cls, serie, passo, total, lo, hi, linhas, valor, alarme }) {
    const y = (v) => Math.max(0, Math.min(100, (1 - (v - lo) / (hi - lo)) * 100));
    const x = (i) => ((i * passo) / total) * 1000;
    const pontos = serie.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const refs = linhas.map((l) =>
        `<line class="sec-ref sec-ref--${l.tipo}" x1="0" y1="${y(l.v).toFixed(1)}" x2="1000" y2="${y(l.v).toFixed(1)}"></line>`).join('');
    const tags = linhas.map((l) =>
        `<span class="sec-ref-tag sec-ref-tag--${l.tipo}" style="top: ${y(l.v).toFixed(1)}%">${l.rotulo}</span>`).join('');
    return `<div class="sec-faixa sec-faixa--${cls}${alarme ? ' is-alarme' : ''}">`
        + `<span class="sec-faixa-nome">${nome} <b>${valor}</b></span>`
        + '<div class="sec-faixa-plot">'
        + `<svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">${refs}`
        + `<polyline class="sec-linha" points="${pontos}"></polyline></svg>${tags}`
        + '</div></div>';
}

function montarSecador(card) {
    const alvo = card.querySelector('[data-sec-graficos]');
    if (!alvo) return;
    const total = minutosDoDia(card.dataset.fim) - minutosDoDia(card.dataset.inicio);
    const forn = numeros(card.dataset.forn);
    const ar = numeros(card.dataset.ar);
    const saida = numeros(card.dataset.saida);
    const umi = numeros(card.dataset.umi);
    const ultimo = (s) => s[s.length - 1];
    const fornMin = paraNumero(card.dataset.fornMin);
    const fornMax = paraNumero(card.dataset.fornMax);
    const arMax = paraNumero(card.dataset.arMax);
    const arDesejada = paraNumero(card.dataset.arDesejada);
    const saidaMax = paraNumero(card.dataset.saidaMax) || 50;
    const saidaAlarme = saida.length > 0 && ultimo(saida) > saidaMax;
    const arAcima = ar.length > 0 && ultimo(ar) > arMax;

    alvo.innerHTML = [
        graficoSecador({
            nome: 'Fornalha', cls: 'fornalha', serie: forn, passo: SEC_PASSO_TEMP, total, lo: 0, hi: 1000,
            valor: forn.length ? grau(ultimo(forn)) : '--',
            linhas: [
                { v: fornMax, tipo: 'limite', rotulo: `máx. ${fornMax}` },
                { v: fornMin, tipo: 'limite', rotulo: `mín. ${fornMin}` },
            ],
        }),
        graficoSecador({
            nome: 'Ar do secador', cls: 'ar', serie: ar, passo: SEC_PASSO_TEMP, total, lo: 0, hi: Math.ceil((arMax + 15) / 10) * 10,
            valor: ar.length ? grau(ultimo(ar)) : '--', alarme: arAcima,
            linhas: [
                { v: arMax, tipo: 'limite', rotulo: `limite ${arMax}` },
                { v: arDesejada, tipo: 'desejada', rotulo: `desejada ${arDesejada}` },
            ],
        }),
        graficoSecador({
            nome: 'Saída do ar', cls: 'saida', serie: saida, passo: SEC_PASSO_TEMP, total, lo: 0, hi: 60,
            valor: saida.length ? grau(ultimo(saida)) : '--', alarme: saidaAlarme,
            linhas: [{ v: saidaMax, tipo: 'limite', rotulo: `limite ${saidaMax}` }],
        }),
        graficoSecador({
            nome: 'Umidade', cls: 'umi', serie: umi, passo: SEC_PASSO_UMI, total, lo: 12, hi: 20,
            valor: umi.length ? umidade(ultimo(umi)) : '--', linhas: [],
        }),
    ].join('');

    // valores do cartao = ultima leitura de cada serie
    const escreve = (chave, texto) => {
        const el = card.querySelector(`[data-sec-val="${chave}"]`);
        if (el) el.textContent = texto;
    };
    if (forn.length) escreve('forn', grau(ultimo(forn)));
    if (ar.length) escreve('ar', grau(ultimo(ar)));
    if (saida.length) escreve('saida', grau(ultimo(saida)));
    if (umi.length) escreve('umi', umidade(ultimo(umi)));
    const queda = quedaUmidade(umi);
    const elQueda = card.querySelector('[data-sec-queda]');
    if (elQueda) {
        elQueda.textContent = queda === null ? '--'
            : `${queda.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${queda >= 2 ? 'pontos' : 'ponto'}`;
    }

    // saida do ar acima do limite: o secador desarma e ha risco de incendio
    card.classList.toggle('is-alarme', saidaAlarme);
    const dadoSaida = card.querySelector('[data-sec-saida]');
    if (dadoSaida) dadoSaida.classList.toggle('is-alarme', saidaAlarme);
    const dadoAr = card.querySelector('.secador-dado--ar');
    if (dadoAr) dadoAr.classList.toggle('is-acima', arAcima);
    const alarme = card.querySelector('[data-sec-alarme]');
    if (alarme) {
        alarme.hidden = !saidaAlarme;
        alarme.textContent = saidaAlarme ? `Saída do ar ${grau(ultimo(saida))} · risco de incêndio` : '';
    }

    // limpeza: ciclo de horas trabalhadas; passou, pisca em vermelho
    const ciclo = paraNumero(card.dataset.limpezaCiclo) || 72;
    const trab = paraNumero(card.dataset.limpezaTrab);
    const falta = ciclo - trab;
    const limpeza = card.querySelector('[data-sec-limpeza]');
    if (limpeza) {
        limpeza.classList.toggle('is-vencida', falta < 0);
        limpeza.classList.toggle('is-perto', falta >= 0 && falta <= 8);
        const b = limpeza.querySelector('[data-sec-limpeza-falta]');
        const rotulo = limpeza.querySelector('[data-sec-limpeza-rotulo]');
        if (b) b.textContent = falta < 0 ? `passou ${-falta} h` : `faltam ${falta} h`;
        if (rotulo) rotulo.textContent = falta < 0 ? 'do ciclo · limpar já' : 'trabalhadas até a limpeza';
        const barra = limpeza.querySelector('[data-sec-limpeza-barra]');
        if (barra) barra.style.width = `${Math.min(100, (trab / ciclo) * 100).toFixed(1)}%`;
    }
}

function montarSecagem(raiz) {
    (raiz || document).querySelectorAll('[data-secador]').forEach(montarSecador);
}

montarSecagem();

// ============================================
// SILOS & AERAÇÃO
// ============================================
// Cada cartão de silo traz 24 leituras horárias de temperatura em
// data-temps (a última é a atual) e o estado do ventilador em data-aer.
// A curva segue as contagens de 12h (00–12 e 12–24): mostra a última
// contagem fechada e a projeção do bloco seguinte, e só é redesenhada
// quando fecha outra contagem; a taxa em °C/h sai das últimas 3 horas.
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
// na primeira metade (a última contagem fechada) e projeção tracejada na
// segunda. Cada hora ocupa a mesma largura (1/24) e as marcas de 12h
// ficam paradas.
const SPARK_W = 100;
const SPARK_H = 32;
const SPARK_BLOCO = 12;
const SPARK_SLOTS = SPARK_BLOCO * 2;
const HORA_MS = 3600000;

// Pontos [x, y] da curva no viewBox do sparkline; usados tanto para
// desenhar quanto para pendurar os rótulos de temperatura sobre a linha.
// A série é alinhada pelo fim: se faltar leitura antiga, o começo fica vazio.
function pontosSparkline(temps, slots = SPARK_SLOTS) {
    const PAD = 2.5;
    let lo = Math.min(...temps);
    let hi = Math.max(...temps);
    if (hi - lo < 0.5) {
        const meio = (hi + lo) / 2;
        lo = meio - 0.25;
        hi = meio + 0.25;
    }
    const vazio = slots + 1 - temps.length;
    return temps.map((t, i) => {
        const x = ((vazio + i) / slots) * SPARK_W;
        const y = PAD + (1 - (t - lo) / (hi - lo)) * (SPARK_H - PAD * 2);
        return [x, y];
    });
}

function caminho(pontos) {
    return pontos
        .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`)
        .join(' ');
}

// hist e proj em sequência: o último ponto do histórico é o fechamento da
// contagem, onde o eixo cheio termina e a linha passa a tracejada. As
// marcas ficam no começo, na virada do bloco (meio) e no fim.
function desenharSparkline(svg, hist, proj, slots = SPARK_SLOTS) {
    if (!svg || hist.length < 2) return;
    const W = SPARK_W;
    const H = SPARK_H;
    const pontos = pontosSparkline(hist.concat(proj), slots);
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

// Projeção hora a hora a partir do fechamento da contagem, pela taxa das
// 3 últimas horas dela, perdendo força a cada hora (a massa de grão não mantém o ritmo para
// sempre). Silo que para na ponta deixa de esfriar nessas horas e
// esquenta de leve.
function projetarTemperaturas(temps, card, inicio, horas) {
    const paraNaPonta = card.dataset.aer === 'on' && card.dataset.pausaPonta === '1';
    let taxa = taxaTemperatura(temps);
    let t = temps[temps.length - 1];
    const proj = [];
    for (let k = 1; k <= horas; k += 1) {
        taxa *= 0.8;
        const inicioHora = new Date(inicio.getTime() + (k - 1) * HORA_MS);
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

// Curva com histórico (linha cheia) e projeção (tracejada) dentro de alvo,
// que tem os mesmos [data-spark], [data-temp-*] e [data-hora-*] do cartão
// de silo. O svg só é redesenhado quando muda a chave (nova contagem).
// Os rótulos acompanham a altura da curva no início, no fechamento
// (--x-agora, onde o eixo cheio termina e o tracejado começa) e no fim
// da projeção.
function desenharCurvaProjecao(alvo, hist, proj, slots, rotulos, chave) {
    const svg = alvo.querySelector('[data-spark]');
    if (svg && (svg.childElementCount === 0 || svg.dataset.bloco !== chave)) {
        desenharSparkline(svg, hist, proj, slots);
        svg.dataset.bloco = chave;
    }
    escreverTexto(alvo.querySelector('[data-temp-inicio]'), formatarTemperatura(hist[0]));
    escreverTexto(alvo.querySelector('[data-temp-atual]'), formatarTemperatura(hist[hist.length - 1]));
    escreverTexto(alvo.querySelector('[data-temp-proj]'), proj.length ? formatarTemperatura(proj[proj.length - 1]) : '');
    escreverTexto(alvo.querySelector('[data-hora-inicio]'), rotulos[0]);
    escreverTexto(alvo.querySelector('[data-hora-meio]'), rotulos[1]);
    escreverTexto(alvo.querySelector('[data-hora-fim]'), rotulos[2]);
    const pontos = pontosSparkline(hist.concat(proj), slots);
    const pct = (v, total) => `${((v / total) * 100).toFixed(1)}%`;
    const wrap = alvo.querySelector('[data-spark-wrap]');
    if (wrap) {
        wrap.style.setProperty('--x-agora', pct(pontos[hist.length - 1][0], SPARK_W));
        wrap.style.setProperty('--y-ini', pct(pontos[0][1], SPARK_H));
        wrap.style.setProperty('--y-fim', pct(pontos[hist.length - 1][1], SPARK_H));
        wrap.style.setProperty('--y-proj', pct(pontos[pontos.length - 1][1], SPARK_H));
    }
}

// A contagem fecha a cada 12h (00:00 e 12:00): a linha cheia é a última
// contagem fechada, da virada anterior até a última (ex.: 00:00 → 12:00),
// e não passa dela. Dali até o fim do bloco (ex.: 12:00 → 00:00) é só
// projeção tracejada, feita a partir do fechamento. As leituras de
// data-temps depois da virada ainda não entraram em contagem. card é quem
// tem data-aer / data-pausa-ponta (a projeção para na ponta).
function curvaBlocos24h(alvo, temps, card) {
    const horaAgora = new Date();
    horaAgora.setMinutes(0, 0, 0);
    const corridas = horaAgora.getHours() % SPARK_BLOCO;
    const viradaBloco = new Date(horaAgora.getTime() - corridas * HORA_MS);
    const fimContagem = temps.length - corridas;
    const hist = temps.slice(Math.max(0, fimContagem - SPARK_BLOCO - 1), fimContagem);
    if (hist.length < 2) return false;
    const proj = projetarTemperaturas(hist, card, viradaBloco, SPARK_BLOCO);
    const inicio = new Date(viradaBloco.getTime() - SPARK_BLOCO * HORA_MS);
    const fimBloco = new Date(viradaBloco.getTime() + SPARK_BLOCO * HORA_MS);
    // a projeção só muda quando fecha uma nova contagem
    desenharCurvaProjecao(alvo, hist, proj, SPARK_SLOTS,
        [formatarHora(inicio), formatarHora(viradaBloco), formatarHora(fimBloco)], String(viradaBloco.getTime()));
    return true;
}

// ============================================
// SILOS · MEDIÇÕES A CADA 12 H (00h e 12h)
// A termometria do silo mede às 00h e às 12h. Todos os períodos usam o
// mesmo gráfico: linha + área, sem bolinhas, só um marcador no valor atual.
//   24 h / turnos  3 medições (00h · 12h · 00h) com o valor em cima e uma
//                  guia tracejada até o eixo em cada medição
//   7 / 30 dias    todas as medições de data-temps-dia (2 por dia), com o
//                  eixo fixo na janela; silo que encheu há menos tempo
//                  começa a curva no meio do eixo
// data-temps aceita só as 3 medições (ex.: "23.6,23.1,22.4") ou a série
// horária (24 ou mais valores, o último é a hora atual; com 36 a medição
// mais antiga das 24 h não cai na primeira leitura).
// ============================================
const INTERVALO_MEDICAO_H = 12;
const MEDICOES_POR_DIA = 24 / INTERVALO_MEDICAO_H;
const PONTOS_24H = 3;
const DIAS_SILO = { '7d': 7, '30d': 30 };
const MARCAR_ATUAL = true; // false = sem nenhum marcador no gráfico

function periodoDoSilo(card) {
    const tela = card.closest('[data-silo-periodo]');
    return tela ? tela.dataset.siloPeriodo : '24h';
}

// 1 casa decimal: medições iguais ficam exatamente na mesma altura
function arred1(v) {
    return Math.round(v * 10) / 10;
}

function ultimaMedicao(agora) {
    const m = new Date(agora);
    m.setMinutes(0, 0, 0);
    m.setHours(m.getHours() - (m.getHours() % INTERVALO_MEDICAO_H));
    return m;
}

// as 3 últimas medições: [{ v, rotulo, hora, slot }]
function medicoesDoDia(card, agora) {
    const temps = numeros(card.dataset.temps).map(arred1);
    if (!temps.length) return [];
    const ultima = ultimaMedicao(agora);
    const desdeUltima = Math.round((new Date(agora).setMinutes(0, 0, 0) - ultima) / HORA_MS);
    let valores;
    if (temps.length <= PONTOS_24H) {
        valores = temps;
    } else {
        const fim = temps.length - 1 - desdeUltima;
        valores = [];
        for (let k = PONTOS_24H - 1; k >= 0; k -= 1) {
            // série curta (24 valores): a medição mais antiga usa a primeira leitura
            const i = Math.min(temps.length - 1, Math.max(0, fim - k * INTERVALO_MEDICAO_H));
            valores.push(temps[i]);
        }
    }
    const n = valores.length;
    return valores.map((v, i) => {
        const m = new Date(ultima.getTime() - (n - 1 - i) * INTERVALO_MEDICAO_H * HORA_MS);
        return { v, rotulo: formatarHora(m), hora: m.getHours(), slot: PONTOS_24H - n + i };
    });
}

// medições do período (2 por dia) na janela fixa de 7 ou 30 dias
function medicoesDoPeriodo(card, periodo, agora) {
    const slots = (DIAS_SILO[periodo] || 7) * MEDICOES_POR_DIA + 1;
    const serie = numeros(card.dataset.tempsDia).map(arred1).slice(-slots);
    const n = serie.length;
    return serie.map((v, i) => ({ v, slot: slots - n + i }));
}

function eixoDoPeriodo(periodo, agora) {
    const dias = DIAS_SILO[periodo] || 7;
    const fim = ultimaMedicao(agora);
    const dia = 24 * HORA_MS;
    return {
        slots: dias * MEDICOES_POR_DIA + 1,
        rotulos: [
            formatarData(new Date(fim.getTime() - dias * dia)),
            formatarData(new Date(fim.getTime() - (dias / 2) * dia)),
            formatarData(fim),
        ],
    };
}

// °C/h entre as duas últimas medições (12 h de intervalo)
function taxaEntreMedicoes(pontos) {
    const n = pontos.length;
    return n < 2 ? 0 : (pontos[n - 1].v - pontos[n - 2].v) / INTERVALO_MEDICAO_H;
}

function desenharSilo3(card, pontos, opcoes) {
    const svg = card.querySelector('[data-spark]');
    const wrap = card.querySelector('[data-spark-wrap]');
    if (!svg || !wrap || !pontos.length) return;
    const W = SPARK_W;
    const H = SPARK_H;
    const n = pontos.length;
    const vals = pontos.map((p) => p.v);

    // escala mínima de 1 °C: 0,1 °C de diferença não vira degrau
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < 1) {
        const meio = (hi + lo) / 2;
        lo = meio - 0.5;
        hi = meio + 0.5;
    }
    const MX = 4;
    const TOPO = 7;
    const BASE = 4;
    const slots = opcoes.slots;
    const xs = pontos.map((p) => (slots <= 1 ? W / 2 : MX + (p.slot * (W - 2 * MX)) / (slots - 1)));
    const ys = vals.map((v) => TOPO + (1 - (v - lo) / (hi - lo)) * (H - TOPO - BASE));
    const f = (v) => v.toFixed(2);

    // 24 h: depois da medição do meio a curva é projeção (tracejada, sem área)
    const corte = !opcoes.longo && n > 1 ? n - 2 : n - 1;
    const pares = xs.map((x, i) => [x, ys[i]]);
    const linha = caminho(pares.slice(0, corte + 1));
    const proj = corte < n - 1 ? caminho(pares.slice(corte)) : '';
    const area = `${linha} L${f(xs[corte])} ${H} L${f(xs[0])} ${H} Z`;
    const marcasX = [MX, W / 2, W - MX];
    const marcas = marcasX.map((x) => `M${f(x)} ${H - 3} L${f(x)} ${H + 3}`).join(' ');
    // guias tracejadas do ponto até o eixo, só nas 3 medições do dia
    const guias = opcoes.longo ? '' : xs.map((x, i) =>
        `<path class="sa-spark-eixo" d="M${f(x)} ${f(ys[i])} L${f(x)} ${H}" `
        + 'style="stroke-dasharray:1.5 1.5;opacity:.45" vector-effect="non-scaling-stroke"></path>'
    ).join('');
    // a base acompanha a curva: cheia ate a medicao do meio e pontilhada na
    // projecao (as marcas das tres medicoes continuam cheias)
    const baseFim = proj ? xs[corte] : W;
    const baseProj = proj ? `<path class="sa-spark-eixo-proj" d="M${f(baseFim)} ${H} L${W} ${H}"></path>` : '';
    svg.innerHTML =
        `<path class="sa-spark-area" d="${area}"></path>` +
        `<path class="sa-spark-eixo" d="M0 ${H} L${f(baseFim)} ${H} ${marcas}"></path>` +
        baseProj +
        guias +
        (proj ? `<path class="sa-spark-proj" d="${proj}"></path>` : '') +
        `<path class="sa-spark-line" d="${linha}" style="stroke-linejoin:round;stroke-linecap:round"></path>`;
    svg.dataset.bloco = '';

    // os rótulos antigos (início / atual / projeção) saem de cena
    ['[data-temp-inicio]', '[data-temp-atual]', '[data-temp-proj]'].forEach((sel) => {
        const el = wrap.querySelector(sel);
        if (el) el.style.display = 'none';
    });

    // eixo: sempre 3 rótulos no início, meio e fim
    const rot = opcoes.rotulosEixo;
    escreverTexto(card.querySelector('[data-hora-inicio]'), rot[0]);
    escreverTexto(card.querySelector('[data-hora-meio]'), rot[1]);
    escreverTexto(card.querySelector('[data-hora-fim]'), rot[2]);

    // valores em cima da curva: as 3 medições (24 h) ou primeira e atual (7 / 30 dias)
    let camada = wrap.querySelector('.sa-rotulos3');
    if (!camada) {
        camada = document.createElement('div');
        camada.className = 'sa-rotulos3';
        camada.setAttribute('aria-hidden', 'true');
        wrap.appendChild(camada);
    }
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    camada.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    const rw = wrap.getBoundingClientRect();
    const rs = svg.getBoundingClientRect();
    if (!rw.width || !rs.width || !rs.height) return; // tela fora do ar: escreve no próximo segundo
    const indices = opcoes.longo ? (n > 1 ? [0, n - 1] : [0]) : xs.map((_, i) => i);
    const posX = (i) => ((rs.left - rw.left + (xs[i] / W) * rs.width) / rw.width) * 100;
    const posY = (i) => ((rs.top - rw.top + (ys[i] / H) * rs.height) / rw.height) * 100;
    // marcador do valor atual em HTML: fica redondo mesmo com o SVG esticado
    const cor = getComputedStyle(svg.querySelector('.sa-spark-line')).stroke || '#fff';
    const marcador = MARCAR_ATUAL
        ? `<i style="position:absolute;left:${posX(n - 1).toFixed(2)}%;top:${posY(n - 1).toFixed(2)}%;`
          + `width:7px;height:7px;border-radius:50%;background:${cor};transform:translate(-50%,-50%);`
          + `box-shadow:0 0 0 3px color-mix(in srgb, ${cor} 30%, transparent);"></i>`
        : '';
    camada.innerHTML = marcador + indices.map((i) => {
        const left = posX(i);
        const top = posY(i);
        const tx = xs[i] < W * 0.2 ? '-12%' : xs[i] > W * 0.8 ? '-88%' : '-50%';
        return `<b class="sa-temp-ponto sa-temp-ponto--3" style="display:block;position:absolute;`
            + `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;right:auto;bottom:auto;margin:0;`
            + `transform:translate(${tx},-150%);white-space:nowrap;">${formatarTemperatura(vals[i])}</b>`;
    }).join('');
}

function prepararSilo(card) {
    const agora = new Date();
    const periodo = periodoDoSilo(card);
    const longo = !!DIAS_SILO[periodo];
    const doDia = medicoesDoDia(card, agora);
    const taxaDia = taxaEntreMedicoes(doDia);

    // o alerta do cartão é sempre pelas medições do dia
    card.dataset.alerta = tendenciaDe(taxaDia) === 'alerta' ? '1' : '0';
    const wrap = card.querySelector('[data-spark-wrap]');
    if (wrap) wrap.dataset.modo = 'serie';

    // nas 24 h o último trecho é projeção (tracejado)
    const secao = card.closest('.sa-section');
    const dica = secao && secao.querySelector('.stack-hint');
    if (dica) escreverTexto(dica, longo ? '' : 'tracejado = projeção');

    let pontos;
    let taxa;
    let unidade;
    let opcoes;
    if (longo) {
        pontos = medicoesDoPeriodo(card, periodo, agora);
        const eixo = eixoDoPeriodo(periodo, agora);
        const n = pontos.length;
        taxa = n > 1 ? (pontos[n - 1].v - pontos[0].v) / ((n - 1) / MEDICOES_POR_DIA) : 0;
        unidade = 'dia';
        opcoes = { longo, slots: eixo.slots, rotulosEixo: eixo.rotulos };
    } else {
        pontos = doDia;
        taxa = taxaDia;
        unidade = 'h';
        const ultima = ultimaMedicao(agora);
        const rotulos = [2, 1, 0].map((k) =>
            formatarHora(new Date(ultima.getTime() - k * INTERVALO_MEDICAO_H * HORA_MS)));
        opcoes = { longo, slots: PONTOS_24H, rotulosEixo: rotulos };
    }
    if (!pontos.length) return;
    desenharSilo3(card, pontos, opcoes);

    const tendencia = unidade === 'dia'
        ? (taxa >= 1 ? 'alerta' : taxa > 0.1 ? 'sobe' : taxa < -0.1 ? 'desce' : 'estavel')
        : tendenciaDe(taxa);
    const rate = card.querySelector('[data-temp-taxa]');
    if (rate) {
        escreverTexto(rate, formatarTaxa(taxa).replace('°C/h', `°C/${unidade}`));
        rate.dataset.tendencia = tendencia;
        rate.title = unidade === 'dia'
            ? 'Variação média por dia no período (medições das 00h e 12h)'
            : 'Variação por hora entre as duas últimas medições (00h e 12h)';
    }
}

// ---- Periodos fora das 24 h: a curva e' so o historico, sem projecao,
// esticada na largura toda. Turno recorta as leituras horarias do ultimo
// turno (o 1o pode estar em andamento); 7 e 30 dias usam as leituras das
// 06h e 18h (data-temps-dia), com a taxa em °C por dia. Silo que encheu
// ha menos tempo que a janela comeca a curva no meio do eixo.
const TURNOS_SILO = { t1: [7, 16], t2: [16, 22], t3: [22, 7] };
const LEITURAS_SILO = { '7d': 14, '30d': 60 };

function noTurno(hora, [ini, fim]) {
    return ini < fim ? hora >= ini && hora <= fim : hora >= ini || hora <= fim;
}

// indices (no fim de data-temps) da ultima vez que o turno aconteceu
function recorteTurno(temps, turno, agora) {
    const faixa = TURNOS_SILO[turno];
    const horaDe = (i) => new Date(agora.getTime() - (temps.length - 1 - i) * HORA_MS).getHours();
    let fim = temps.length - 1;
    while (fim >= 0 && !noTurno(horaDe(fim), faixa)) fim -= 1;
    let ini = fim;
    while (ini > 0 && noTurno(horaDe(ini - 1), faixa)) ini -= 1;
    return { ini, fim, horaDe };
}

function formatarData(data) {
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================
// SILOS · CLIMA DA AERACAO E UMIDADE DE EQUILIBRIO
// O cartao traz as leituras da estacao (a cada 15 min) do periodo em que a
// aeracao ficou ligada: o de agora, ou o da ultima vez quando esta
// desligada (data-aer-clima "t/ur,t/ur,..."). A media de temperatura e
// umidade relativa entra na tabela higroscopica da cultura e sai a umidade
// de equilibrio do grao; contra a umidade do silo (data-umidade) diz se o
// ar esta secando ou umedecendo o produto (ate 0,3 ponto: neutro).
// TABELA DE EXEMPLO (Henderson modificado, ASAE D245, calibrada para o
// exemplo da unidade: milho a 28 °C e 45% de UR = 12,8%; sorgo = milho -0,4;
// trigo = milho -0,2):
// trocar pela tabela higroscopica que a unidade usa.
// ============================================
const TABELA_HIGROSCOPICA = {
    temps: [10, 15, 20, 25, 30, 35],
    urs: [30, 40, 50, 60, 70, 80, 90],
    milho: [
        [11.6, 13.3, 15.0, 16.7, 18.5, 20.7, 23.7],
        [11.3, 12.9, 14.5, 16.2, 17.9, 20.1, 23.0],
        [11.0, 12.6, 14.1, 15.7, 17.4, 19.5, 22.3],
        [10.7, 12.2, 13.7, 15.3, 17.0, 19.0, 21.8],
        [10.5, 12.0, 13.4, 14.9, 16.6, 18.5, 21.2],
        [10.2, 11.7, 13.1, 14.6, 16.2, 18.1, 20.7],
    ],
    sorgo: [
        [11.2, 12.9, 14.6, 16.3, 18.1, 20.3, 23.3],
        [10.9, 12.5, 14.1, 15.8, 17.5, 19.7, 22.6],
        [10.6, 12.2, 13.7, 15.3, 17.0, 19.1, 21.9],
        [10.3, 11.8, 13.3, 14.9, 16.6, 18.6, 21.4],
        [10.1, 11.6, 13.0, 14.5, 16.2, 18.1, 20.8],
        [9.8, 11.3, 12.7, 14.2, 15.8, 17.7, 20.3],
    ],
    trigo: [
        [11.4, 13.1, 14.8, 16.5, 18.3, 20.5, 23.5],
        [11.1, 12.7, 14.3, 16.0, 17.7, 19.9, 22.8],
        [10.8, 12.4, 13.9, 15.5, 17.2, 19.3, 22.1],
        [10.5, 12.0, 13.5, 15.1, 16.8, 18.8, 21.6],
        [10.3, 11.8, 13.2, 14.7, 16.4, 18.3, 21.0],
        [10.0, 11.5, 12.9, 14.4, 16.0, 17.9, 20.5],
    ],
    soja: [
        [8.1, 9.8, 11.6, 13.6, 16.0, 19.0, 23.4],
        [8.0, 9.6, 11.4, 13.4, 15.7, 18.6, 22.9],
        [7.8, 9.4, 11.2, 13.1, 15.4, 18.2, 22.5],
        [7.7, 9.3, 11.0, 12.9, 15.1, 17.9, 22.1],
        [7.6, 9.1, 10.8, 12.6, 14.8, 17.6, 21.7],
        [7.5, 9.0, 10.6, 12.4, 14.6, 17.3, 21.3],
    ],
};
const EQUILIBRIO_NEUTRO = 0.3; // pontos de umidade: ate aqui o ar nem seca nem umedece

// posicao de um valor numa escala crescente: indice de baixo e a fracao ate o de cima
function posicaoNaEscala(escala, valor) {
    const v = Math.min(Math.max(valor, escala[0]), escala[escala.length - 1]);
    let i = 0;
    while (i < escala.length - 2 && v > escala[i + 1]) i += 1;
    return [i, (v - escala[i]) / (escala[i + 1] - escala[i])];
}

// umidade de equilibrio (% base umida) por interpolacao bilinear na tabela
function umidadeEquilibrio(cultura, temp, ur) {
    const tabela = TABELA_HIGROSCOPICA[cultura];
    if (!tabela) return null;
    const [it, ft] = posicaoNaEscala(TABELA_HIGROSCOPICA.temps, temp);
    const [iu, fu] = posicaoNaEscala(TABELA_HIGROSCOPICA.urs, ur);
    const linha = (i) => tabela[i][iu] + (tabela[i][iu + 1] - tabela[i][iu]) * fu;
    return linha(it) + (linha(it + 1) - linha(it)) * ft;
}

const umPonto = (v) => v.toFixed(1).replace('.', ',');

// ---- Aeracao de conservacao: quando ligar, com o ar de agora ----
// Diretrizes do Manejo da Aeracao (ABRAPOS) e do Guia de Secagem e
// Armazenagem do RS:
// - a massa de graos o mais fria possivel: ideal abaixo de 16 °C, bom
//   abaixo de 20 °C; em clima tropical, 17 a 22 °C para ciclos longos;
// - o ar ambiente pelo menos 3 °C (ideal 5 °C) abaixo da temperatura do
//   grao, para resfriar;
// - a UR do ar em equilibrio com a umidade do grao: o ar insuflado (o
//   ambiente aquecido pelo ventilador) nao pode umedecer o grao.
// Da leitura da estacao sai a umidade absoluta do ar de agora; cada
// temperatura ambiente tem a sua UR (Magnus), aquecida pelo ventilador vira
// a UR do ar insuflado, e a tabela higroscopica da a umidade de equilibrio.
//   MAX    temperatura do grao - 3 °C: acima, o ar nao resfria
//   IDEAL  ate a temperatura do grao - 5 °C
//   MIN    abaixo, o ar insuflado umedece o grao (equilibrio acima da
//          umidade do grao alem do neutro)
// Minima acima da maxima: com o ar de agora nao da para resfriar sem molhar.
const AERACAO = {
    resfriaMin: 3,     // °C abaixo do grao para resfriar
    resfriaIdeal: 5,   // °C abaixo do grao para resfriar bem
    aquecimento: 6,    // °C que o ventilador soma ao ar ambiente
    massa: { ideal: 16, bom: 20, tropical: 22 },
    passo: 0.1,
    piso: -10,
};

function pressaoSaturacao(t) {
    return 6.112 * Math.exp((17.62 * t) / (243.12 + t));
}

function janelaAeracao(cultura, grao, tGrao, tAgora, urAgora) {
    const vapor = (urAgora / 100) * pressaoSaturacao(tAgora);
    // pontos de umidade que o ar insuflado poe no grao (positivo = umedece)
    const umedece = (tAmb) => {
        const tIns = tAmb + AERACAO.aquecimento;
        const ur = Math.min(100, (vapor / pressaoSaturacao(tIns)) * 100);
        const eq = umidadeEquilibrio(cultura, tIns, ur);
        return eq === null ? null : eq - grao;
    };
    const max = tGrao - AERACAO.resfriaMin;
    let min = null;
    for (let t = AERACAO.piso; t <= max + 10; t += AERACAO.passo) {
        const u = umedece(t);
        if (u !== null && u <= EQUILIBRIO_NEUTRO) {
            min = t;
            break;
        }
    }
    return { min, idealAte: tGrao - AERACAO.resfriaIdeal, max, aberta: min !== null && min <= max };
}

// situacao do ar de agora na janela: icone + texto, nunca so a cor
function estadoAeracao(t, j) {
    if (t > j.max) return { estado: 'quente', icone: '▲', texto: 'não resfria' };
    if (j.min === null || t < j.min) return { estado: 'umido', icone: '▼', texto: 'umedece o grão' };
    if (t <= j.idealAte) return { estado: 'ideal', icone: '●', texto: 'pode aerar' };
    return { estado: 'pouco', icone: '●', texto: 'resfria pouco' };
}

// temperatura da massa contra as faixas das diretrizes
function estadoMassa(t) {
    const m = AERACAO.massa;
    if (t <= m.ideal) return { estado: 'ideal', icone: '●', texto: 'ideal' };
    if (t <= m.bom) return { estado: 'bom', icone: '●', texto: 'bom' };
    if (t <= m.tropical) return { estado: 'tropical', icone: '●', texto: 'aceitável' };
    return { estado: 'quente', icone: '▲', texto: 'quente' };
}

function escreverAeracao(card) {
    const alvo = card.querySelector('[data-ar-janela]');
    const tela = card.closest('.screen');
    const estacao = tela && tela.querySelector('[data-estacao-temp]');
    if (!alvo || !estacao) return;
    const tAgora = paraNumero(estacao.dataset.estacaoTemp);
    const urAgora = paraNumero(estacao.dataset.estacaoUr);
    const grao = paraNumero(card.dataset.umidade);
    const temps = numeros(card.dataset.temps);
    const tGrao = temps.length ? temps[temps.length - 1] : NaN; // a ultima leitura e' a atual
    const chave = [card.dataset.cultura, grao, tGrao, tAgora, urAgora].join('|');
    if (alvo.dataset.chave === chave) return; // so refaz quando o ar ou o grao mudam
    alvo.dataset.chave = chave;
    if (![tAgora, urAgora, grao, tGrao].every(Number.isFinite)) {
        alvo.innerHTML = '';
        return;
    }
    const j = janelaAeracao(card.dataset.cultura, grao, tGrao, tAgora, urAgora);
    const grau = (v) => String(Math.round(v));
    const ar = estadoAeracao(tAgora, j);
    const massa = estadoMassa(tGrao);
    let ref;
    if (!j.aberta) {
        ref = `janela fechada · máx ${grau(j.max)} °C`;
    } else if (j.min <= j.idealAte) {
        ref = `mín ${grau(j.min)} · ideal ${grau(j.min)}–${grau(j.idealAte)} · máx ${grau(j.max)} °C`;
    } else {
        ref = `mín ${grau(j.min)} · máx ${grau(j.max)} °C`;
    }

    // regua do ar ambiente: umedece | ideal | resfria pouco | nao resfria,
    // com o ar de agora (traco) e o grao (anel)
    const ini = Math.min(j.min === null ? tAgora : j.min, tAgora, tGrao - 10) - 2;
    const fim = Math.max(tAgora, tGrao) + 2;
    const pos = (v) => `${(((Math.min(Math.max(v, ini), fim) - ini) / (fim - ini)) * 100).toFixed(1)}%`;
    const trecho = (a, b, cls) => (b <= a ? ''
        : `<i class="sa-ar-faixa sa-ar-faixa--${cls}" style="left: ${pos(a)}; width: calc(${pos(b)} - ${pos(a)})"></i>`);
    const corteUmido = j.min === null ? fim : Math.min(j.min, j.max);
    const regua = trecho(ini, corteUmido, 'umido')
        + (j.aberta ? trecho(j.min, Math.min(j.idealAte, j.max), 'ideal') + trecho(Math.max(j.min, j.idealAte), j.max, 'pouco') : '')
        + trecho(j.max, fim, 'quente')
        + `<i class="sa-ar-grao" style="left: ${pos(tGrao)}" title="grão ${umPonto(tGrao)} °C"></i>`
        + `<i class="sa-ar-agora" style="left: ${pos(tAgora)}"></i>`;

    alvo.title = `Quando aerar este silo com o ar de agora (estação: ${umPonto(tAgora)} °C, UR ${Math.round(urAgora)}%). `
        + `Grão a ${umPonto(tGrao)} °C com ${umPonto(grao)}% de umidade. Máx: o ar ${AERACAO.resfriaMin} °C abaixo do grão `
        + `(ideal ${AERACAO.resfriaIdeal} °C abaixo); mín: abaixo dela o ar, aquecido ${AERACAO.aquecimento} °C pelo ventilador, `
        + `umedece o grão. Massa: ideal até ${AERACAO.massa.ideal} °C, bom até ${AERACAO.massa.bom} °C, aceitável até ${AERACAO.massa.tropical} °C. `
        + 'Diretrizes do Manejo da Aeração (ABRAPOS) e do Guia de Secagem e Armazenagem do RS.';
    alvo.innerHTML = '<div class="sa-ar-head"><span class="sa-ar-tit">Quando aerar</span>'
        + `<span class="sa-ar-ref">${ref}</span></div>`
        + `<div class="sa-ar-regua" aria-hidden="true">${regua}</div>`
        + `<div class="sa-ar-status" data-estado="${ar.estado}"><b>${ar.icone}</b> ar ${umPonto(tAgora)} °C · ${ar.texto}</div>`
        + `<div class="sa-ar-status" data-estado="${massa.estado}"><b>${massa.icone}</b> massa ${umPonto(tGrao)} °C · ${massa.texto}</div>`;
}

function escreverClimaAeracao(card, ligado) {
    const leituras = (card.dataset.aerClima || '').split(',')
        .map((par) => par.split('/').map(Number))
        .filter(([t, ur]) => Number.isFinite(t) && Number.isFinite(ur));
    if (!leituras.length) return;
    const temp = leituras.reduce((s, [t]) => s + t, 0) / leituras.length;
    const ur = leituras.reduce((s, [, u]) => s + u, 0) / leituras.length;
    const duracao = (leituras.length - 1) * 15;
    const tempo = `${Math.floor(duracao / 60)}h${String(duracao % 60).padStart(2, '0')}`;
    escreverTexto(card.querySelector('[data-clima-rotulo]'), ligado
        ? `média desde que ligou · ${tempo}`
        : `média da última aeração · ${card.dataset.aerRodou || tempo}`);
    escreverTexto(card.querySelector('[data-clima-valor]'), `${umPonto(temp)} °C · UR ${Math.round(ur)}%`);

    const equilibrio = umidadeEquilibrio(card.dataset.cultura, temp, ur);
    const grao = paraNumero(card.dataset.umidade);
    const alvoEfeito = card.querySelector('[data-clima-efeito]');
    if (equilibrio === null || !Number.isFinite(grao)) {
        escreverTexto(alvoEfeito, '');
        return;
    }
    const diferenca = equilibrio - grao;
    const efeito = diferenca < -EQUILIBRIO_NEUTRO ? 'secando' : diferenca > EQUILIBRIO_NEUTRO ? 'umedecendo' : 'neutro';
    escreverTexto(alvoEfeito, efeito);
    // no cartao fica so o selo; equilibrio e grao vao no tooltip dele
    if (alvoEfeito) {
        alvoEfeito.dataset.efeito = efeito;
        alvoEfeito.title = `equilíbrio ${umPonto(equilibrio)}% · grão ${umPonto(grao)}%`;
    }
}

function atualizarSilosAeracao() {
    const dentroPonta = emPonta(new Date());
    const decorrido = (Date.now() - SILOS_INICIO) / 1000;

    document.querySelectorAll('[data-silo]').forEach((card) => {
        prepararSilo(card);
        escreverAeracao(card);

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
        escreverClimaAeracao(card, ligado);

        // horas na cultura atual (zera na troca), total do silo e o consumo
        // da cultura; ligado, os tres andam junto com o "ligado há"
        if (card.dataset.aerCulturaMin) {
            const extra = ligado ? decorrido / 60 : 0;
            const cultura = paraNumero(card.dataset.aerCulturaMin) + extra;
            const total = paraNumero(card.dataset.aerTotalMin) + extra;
            const kwh = Math.round((cultura / 60) * paraNumero(card.dataset.aerKw));
            escreverTexto(card.querySelector('[data-aer-cultura]'), `${Math.floor(cultura / 60)}h`);
            escreverTexto(card.querySelector('[data-aer-total]'), `${Math.floor(total / 60).toLocaleString('pt-BR')}h`);
            escreverTexto(card.querySelector('[data-aer-kwh]'), kwh.toLocaleString('pt-BR'));
        }
    });
}

// ============================================
// SILOS · PERIODO DA TELA
// data-silo-periodo na section: t1/t2/t3 (ultimo turno), 24h, 7d ou 30d.
// Troca a curva e a taxa de cada silo e o saldo da volumetria (o CSS
// mostra o .sa-per do periodo).
// ============================================
function escolherPeriodoSilo(alvo) {
    const tela = alvo.closest('.screen--silos');
    const periodo = alvo.dataset.siloPeriodo;
    if (!tela || !periodo) return;
    tela.dataset.siloPeriodo = periodo;
    tela.querySelectorAll('button[data-silo-periodo]').forEach((btn) => {
        const ativo = btn.dataset.siloPeriodo === periodo;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
    tela.querySelectorAll('[data-silo]').forEach(prepararSilo);
    scheduleFit();
}

// Previsao do tempo: o grafico de chuva troca de vista (7 dias, mes, ano)
// pelo data-pv-chuva-vista da secao; o CSS mostra so o grafico escolhido.
function escolherVistaChuva(alvo) {
    const secao = alvo.closest('.pv-acum');
    const vista = alvo.dataset.pvChuva;
    if (!secao || !vista) return;
    secao.dataset.pvChuvaVista = vista;
    secao.querySelectorAll('button[data-pv-chuva]').forEach((btn) => {
        const ativo = btn.dataset.pvChuva === vista;
        btn.classList.toggle('is-active', ativo);
        btn.setAttribute('aria-pressed', String(ativo));
    });
}

// Previsao do tempo: o mm de cada barra do grafico de chuva, escrito em cima
// dela. Sai do title da barra ("8 mm caídos", "18 mm previstos", "48 mm caídos
// + 30 mm previstos"); previsto leva "~", como as projecoes do resto do site.
// O editor salva o HTML como esta, entao o rotulo e' atualizado, nunca somado.
const MM_CAIDO = /([\d.,]+) mm caídos/;
const MM_PREVISTO = /([\d.,]+) mm previstos/;

function rotularChuva(raiz) {
    (raiz || document).querySelectorAll('.pv-chuva-col').forEach((col) => {
        const barra = col.querySelector('.pv-chuva-barra');
        if (!barra) return;
        const titulo = col.getAttribute('title') || '';
        const caido = MM_CAIDO.test(titulo) ? paraNumero(titulo.match(MM_CAIDO)[1]) : 0;
        const previsto = MM_PREVISTO.test(titulo) ? paraNumero(titulo.match(MM_PREVISTO)[1]) : 0;
        let rotulo = barra.querySelector('.pv-chuva-mm');
        if (!caido && !previsto) {
            if (rotulo) rotulo.remove();
            return;
        }
        if (!rotulo) {
            rotulo = document.createElement('b');
            rotulo.className = 'pv-chuva-mm';
            barra.appendChild(rotulo);
        }
        const fmt = (v) => v.toLocaleString('pt-BR');
        rotulo.textContent = caido && previsto ? `${fmt(caido)}+${fmt(previsto)}` : caido ? fmt(caido) : `~${fmt(previsto)}`;
        rotulo.classList.toggle('is-previsto', !caido);
    });
}

rotularChuva();

// o editor salva o HTML como esta: a tela volta para o padrao (24 h)
function limparFiltrosSilo() {
    const padrao = document.querySelector('.screen--silos button[data-silo-periodo="24h"]');
    if (padrao && !padrao.classList.contains('is-active')) escolherPeriodoSilo(padrao);
}


// ============================================
// ARMAZÉM · PLANTA POR CANALETA
// Cada cartão [data-armazem] vira um tabuleiro: um quadradinho por cabo de
// termometria, o túnel central separando o lado A (em cima) do lado B
// (embaixo) e os motores de aeração na parede de cada lado, alinhados com
// os quadradinhos que atendem. Os quadradinhos são agrupados por canaleta de
// aeração (no código, "setor"), com média, máxima e motores ligados no topo. Os atributos estão
// descritos no comentário da tela 6, no index.html. A planta é montada uma
// vez; a cada segundo só mudam o estado da aeração e as tendências (estas
// só são redesenhadas quando vira a hora ou a leitura das 06h/18h).
// ============================================
const ARM_ATENCAO = 28; // °C: mesmas faixas da termometria das demais unidades
const ARM_ALERTA = 32;

// faixa da cor do quadradinho: abaixo de 28 °C a cor só ganha força com a
// temperatura (1 a 5, de 2 em 2 °C a partir de 20); acima disso, aviso
function faixaArmazem(t) {
    if (t === null) return 'fora';
    if (t >= ARM_ALERTA) return 'alerta';
    if (t >= ARM_ATENCAO) return 'atencao';
    return String(Math.min(5, Math.max(1, Math.floor((t - 20) / 2) + 2)));
}

function formatarGrau(t) {
    return Number(t).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// "A7-A13,B2" -> Set { A7, A8, ..., A13, B2 }
function motoresLigados(texto) {
    const ligados = new Set();
    (texto || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((parte) => {
        const m = parte.match(/^([AB])(\d+)(?:\s*-\s*[AB]?(\d+))?$/i);
        if (!m) return;
        const lado = m[1].toUpperCase();
        const ini = Number(m[2]);
        const fim = m[3] ? Number(m[3]) : ini;
        for (let n = Math.min(ini, fim); n <= Math.max(ini, fim); n += 1) ligados.add(`${lado}${n}`);
    });
    return ligados;
}

// linhas separadas por ";" e valores por ","; cada cabo vira { t, vazio }:
// "22.4" = com produto, "v26.8" = sem produto (o cabo le o ar acima do grao),
// "-" (ou vazio) = sem produto e sem leitura
function celulasArmazem(texto) {
    return (texto || '').split(';').map((linha) => linha.split(',').map((v) => {
        const bruto = v.trim();
        const vazio = /^v/i.test(bruto) || bruto === '-' || bruto === '';
        const n = Number.parseFloat(bruto.replace(/^v/i, ''));
        return { t: Number.isFinite(n) ? n : null, vazio };
    }));
}

function media(valores) {
    return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
}

function montarArmazem(card) {
    const mapa = card.querySelector('[data-arm-mapa]');
    if (!mapa) return;
    const motores = Math.max(1, paraNumero(card.dataset.armMotores) || 1);
    const cpm = Math.max(1, paraNumero(card.dataset.armColsPorMotor) || 1);
    const linhas = Math.max(1, paraNumero(card.dataset.armLinhas) || 1);
    const ligados = motoresLigados(card.dataset.armMotoresOn);
    const celulas = celulasArmazem(card.dataset.armCelulas);
    const valor = (linha, col) => (celulas[linha] && celulas[linha][col] !== undefined
        ? celulas[linha][col] : { t: null, vazio: true });

    // canaletas ("setores" no codigo) em posições de motor; se a soma não fecha, a última absorve a diferença
    const setores = numeros(card.dataset.armSetores).filter((n) => n > 0);
    if (!setores.length) setores.push(motores);
    const soma = setores.reduce((a, b) => a + b, 0);
    setores[setores.length - 1] = Math.max(1, setores[setores.length - 1] + motores - soma);

    const todas = [];
    let html = '<div class="arm-lados" aria-hidden="true"><span></span><span>A</span><span class="arm-lado-cel">lado A</span>'
        + '<span class="arm-lado-tunel">túnel</span><span class="arm-lado-cel">lado B</span><span>B</span></div>';
    let pos = 0; // primeira posição de motor do setor
    setores.forEach((qtd, s) => {
        const c0 = pos * cpm;
        const cols = qtd * cpm;
        const doSetor = [];
        const motor = (lado) => {
            let h = '';
            for (let k = 0; k < qtd; k += 1) {
                const id = `${lado}${pos + k + 1}`;
                const on = ligados.has(id);
                h += `<i class="arm-motor" data-motor="${on ? 'on' : 'off'}" style="grid-column: span ${cpm}" title="Motor ${id} · ${on ? 'ligado' : 'desligado'}">${id}</i>`;
            }
            return `<div class="arm-motores">${h}</div>`;
        };
        const lado = (de, ate, nomeLado) => {
            let h = '';
            for (let l = de; l < ate; l += 1) {
                for (let c = c0; c < c0 + cols; c += 1) {
                    const { t, vazio } = valor(l, c);
                    // so o cabo com produto entra na media e na maxima: o vazio le o ar
                    if (!vazio && t !== null) doSetor.push(t);
                    const cabo = `cabo ${l + 1}.${c + 1}`;
                    const motorDe = `${nomeLado}${Math.floor(c / cpm) + 1}`;
                    if (vazio) {
                        const ar = t === null ? 'sem leitura' : `temperatura do ar ${formatarGrau(t)} °C`;
                        h += `<i class="arm-cel arm-cel--vazio" data-faixa="fora" title="Canaleta ${s + 1} · ${cabo} · sem produto (cabo vazio) · ${ar}">`
                            + `<small>vazio</small>${t === null ? '' : formatarGrau(t)}</i>`;
                    } else {
                        h += `<i class="arm-cel" data-faixa="${faixaArmazem(t)}" title="Canaleta ${s + 1} · com produto · lado ${nomeLado} · ${cabo} · motor ${motorDe} · ${formatarGrau(t)} °C">${formatarGrau(t)}</i>`;
                    }
                }
            }
            return `<div class="arm-celulas">${h}</div>`;
        };
        const corpo = motor('A') + lado(0, linhas, 'A') + '<div class="arm-tunel"></div>' + lado(linhas, linhas * 2, 'B') + motor('B');
        const m = media(doSetor);
        const max = doSetor.length ? Math.max(...doSetor) : null;
        let on = 0;
        for (let k = 1; k <= qtd; k += 1) on += (ligados.has(`A${pos + k}`) ? 1 : 0) + (ligados.has(`B${pos + k}`) ? 1 : 0);
        todas.push(...doSetor);
        html += `<div class="arm-setor" style="--cols: ${cols}; flex-grow: ${cols}" data-ligados="${on}">`
            + '<div class="arm-setor-head">'
            + `<span class="arm-setor-nome">CANALETA ${s + 1}</span>`
            + `<span class="arm-setor-motores" title="Motores ligados na canaleta (lados A e B)">${on}/${qtd * 2} motores</span>`
            + `<b class="arm-setor-media" data-faixa="${m === null ? 'fora' : faixaArmazem(m)}" title="Média dos cabos com produto da canaleta">${m === null ? '--' : `${formatarGrau(m)}°`}</b>`
            + `<span class="arm-setor-max" title="Cabo mais quente da canaleta">máx ${max === null ? '--' : `${formatarGrau(max)}°`}</span>`
            + '</div>'
            + `<div class="arm-setor-corpo" style="--linhas: ${linhas}">${corpo}</div>`
            + '</div>';
        pos += qtd;
    });
    mapa.innerHTML = `<div class="arm-planta">${html}</div>`;

    const total = motores * 2;
    escreverTexto(card.querySelector('[data-arm-motores-total]'), `${ligados.size}/${total} motores`);
    const m = media(todas);
    escreverTexto(card.querySelector('[data-arm-media]'), m === null ? '--' : formatarTemperatura(m));
    card.dataset.armMax = todas.length ? String(Math.max(...todas)) : '';
    mapa.setAttribute('aria-label', `${mapa.getAttribute('aria-label').split(':')[0]}: ${setores.length} canaletas, `
        + `${ligados.size} de ${total} motores ligados, média ${m === null ? '--' : formatarTemperatura(m)}`);
}

// Tendências fixas do armazém (24 h, 7 dias, 30 dias), iguais à curva dos
// silos: linha cheia no histórico e projeção tracejada. 24 h é a mesma
// curva dos silos (última contagem de 12 h + 12 h projetadas, taxa das
// últimas 3 h); 7 e 30 dias usam as leituras das 06h e 18h: o eixo tem a
// janela inteira de histórico e, depois de "agora", outra janela igual de
// projeção, com a taxa em °C por dia.
function projetarLeituras(serie, passos) {
    const n = serie.length;
    // por leitura (12 h), das 3 últimas; perde força a cada passo
    let taxa = n >= 4 ? (serie[n - 1] - serie[n - 4]) / 3 : 0;
    let t = serie[n - 1];
    const proj = [];
    for (let k = 0; k < passos; k += 1) {
        taxa *= 0.85;
        t += taxa;
        proj.push(t);
    }
    return proj;
}

function escreverTaxaArmazem(item, taxa, unidade) {
    const tendencia = unidade === 'dia'
        ? (taxa >= 1 ? 'alerta' : taxa > 0.1 ? 'sobe' : taxa < -0.1 ? 'desce' : 'estavel')
        : tendenciaDe(taxa);
    const rate = item.querySelector('[data-temp-taxa]');
    if (rate) {
        escreverTexto(rate, formatarTaxa(taxa).replace('°C/h', `°C/${unidade}`));
        rate.dataset.tendencia = tendencia;
        rate.title = unidade === 'dia'
            ? 'Variação média por dia no período (leituras das 06h e 18h)'
            : 'Variação por hora entre as duas últimas medições (00h e 12h)';
    }
    return tendencia;
}

function tendenciasArmazem(card) {
    const agora = new Date();
    const dia = numeros(card.dataset.tempsDia);
    let alerta = false;
    card.querySelectorAll('[data-arm-tend]').forEach((item) => {
        const periodo = item.dataset.armTend;
        let tendencia = 'estavel';
        if (periodo === '24h') {
            // igual aos silos: so as tres medicoes (00h, 12h, 00h), com o valor
            // em cada uma e a projecao tracejada depois da do meio
            const pontos = medicoesDoDia(card, agora);
            if (!pontos.length) return;
            const ultima = ultimaMedicao(agora);
            const rotulos = [2, 1, 0].map((k) =>
                formatarHora(new Date(ultima.getTime() - k * INTERVALO_MEDICAO_H * HORA_MS)));
            const wrap = item.querySelector('[data-spark-wrap]');
            if (wrap) wrap.dataset.modo = 'serie';
            desenharSilo3(item, pontos, { longo: false, slots: PONTOS_24H, rotulosEixo: rotulos });
            tendencia = escreverTaxaArmazem(item, taxaEntreMedicoes(pontos), 'h');
        } else {
            const passos = LEITURAS_SILO[periodo] || 14;
            const hist = dia.slice(-(passos + 1));
            if (hist.length < 2) return;
            const proj = projetarLeituras(hist, passos);
            const ultima = new Date(agora);
            ultima.setMinutes(0, 0, 0);
            ultima.setHours(agora.getHours() >= 18 ? 18 : agora.getHours() >= 6 ? 6 : -6);
            const leitura = (k) => formatarData(new Date(ultima.getTime() + k * 12 * HORA_MS));
            const rotulos = [leitura(-passos), leitura(0), leitura(passos)];
            desenharCurvaProjecao(item, hist, proj, passos * 2, rotulos, `${periodo}:${rotulos.join('|')}`);
            tendencia = escreverTaxaArmazem(item, (hist[hist.length - 1] - hist[0]) / ((hist.length - 1) / 2), 'dia');
        }
        if (tendencia === 'alerta') alerta = true;
    });
    return alerta;
}

function montarArmazens(raiz) {
    (raiz || document).querySelectorAll('[data-armazem]').forEach(montarArmazem);
    atualizarArmazens();
}

function atualizarArmazens() {
    const dentroPonta = emPonta(new Date());
    const decorrido = (Date.now() - SILOS_INICIO) / 1000;
    document.querySelectorAll('[data-armazem]').forEach((card) => {
        const subindo = tendenciasArmazem(card);
        const quente = paraNumero(card.dataset.armMax) >= ARM_ALERTA;
        card.dataset.alerta = subindo || quente ? '1' : '0';

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


// ============================================
// PULMÕES · AERAÇÃO
// Os pulmões não têm termometria, mas têm ventilador. O acumulado é da
// cultura: não zera quando o ventilador desliga, só quando o pulmão troca
// de cultura (no CLP, a cada descarga com cultura nova). Cada cartão traz
// em minutos data-aer-desde-min (ligado há), data-aer-dia-min (rodou nas
// últimas 24 h) e data-aer-acum-min (acumulado na cultura); com o
// ventilador ligado os três andam a partir do carregamento, como nos silos.
// Embaixo da coluna, a soma do acumulado por cultura nos dois pulmões.
// ============================================
function formatarHoras(minutos) {
    const total = Math.max(0, Math.floor(minutos));
    return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

function atualizarPulmoesAeracao() {
    const decorridoMin = (Date.now() - SILOS_INICIO) / 60000;
    const somaPorCultura = new Map();

    document.querySelectorAll('[data-pulmao]').forEach((card) => {
        const ligado = card.dataset.aer === 'on';
        const extra = ligado ? decorridoMin : 0;
        const acum = paraNumero(card.dataset.aerAcumMin) + extra;
        const em24h = Math.min(24 * 60, paraNumero(card.dataset.aerDiaMin) + extra);

        card.dataset.aerEstado = ligado ? 'on' : 'off';
        escreverTexto(card.querySelector('[data-aer-badge]'), ligado ? 'ON' : 'OFF');
        escreverTexto(card.querySelector('[data-aer-info]'), ligado
            ? `ligado há ${formatarDuracao(paraNumero(card.dataset.aerDesdeMin) * 60 + decorridoMin * 60)}`
            : `desligou às ${card.dataset.aerFim || '--:--'}`);
        escreverTexto(card.querySelector('[data-aer-24h]'), formatarHoras(em24h));
        escreverTexto(card.querySelector('[data-aer-acum]'), formatarHoras(acum));

        const cultura = card.dataset.cultura;
        if (cultura && cultura !== 'vazia') {
            somaPorCultura.set(cultura, (somaPorCultura.get(cultura) || 0) + acum);
        }
    });

    document.querySelectorAll('[data-pulmao-soma]').forEach((lista) => {
        const html = [...somaPorCultura].map(([cultura, minutos]) =>
            `<span class="pulmao-soma-item" data-cultura="${cultura}"><i class="legend-dot legend-dot--${cultura}"></i>`
            + `${NOME_CULTURA_FLUXO[cultura] || cultura}<b>${formatarHoras(minutos)}</b></span>`).join('');
        if (lista.innerHTML !== html) lista.innerHTML = html;
    });
}

setInterval(() => { atualizarSilosAeracao(); atualizarPulmoesAeracao(); atualizarArmazens(); }, 1000);
atualizarSilosAeracao();
atualizarPulmoesAeracao();
montarArmazens();
