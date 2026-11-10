// ============================================
// TELAS ESTRATÉGICAS (est-*)
// Os mesmos assuntos das telas táticas de Avaré, olhando para trás em
// anos e para a frente com a projeção. Todas as telas têm a mesma
// moldura, desenhada aqui a partir de EST_TELAS:
//   - filtro de tempo (período, agrupamento, projeção e comparação), que
//     vale para todas as telas estratégicas de uma vez;
//   - filtros da própria tela (cultura, secador, silo, cliente...);
//   - KPIs do período, com a variação e um cartão da projeção;
//   - gráfico longo: linha do tempo ou os anos sobrepostos (jan–dez);
//   - recorte do período (por cultura, moega, silo, cliente...) e a
//     tabela ano a ano, com a linha do ano projetado.
// Base: uma série DIÁRIA por indicador, de 01/01/2022 até o último dia
// fechado (30/09/2026). Enquanto a base histórica não chega, as séries
// saem de perfis mensais de safra × o porte de cada ano, com variação
// fixa por dia (sem sorteio: a tela é a mesma a cada carga). Ligar a base
// real é trocar gerarDados(): o resto lê só o catálogo M.
// Projeção: cada dia futuro repete o mesmo dia das 3 safras anteriores,
// cada uma ajustada ao ritmo dos últimos 12 meses (× nas somas, + nas
// médias). O valor projetado é a média desses 3 cenários; a faixa vai do
// cenário mais fraco ao mais forte e abre um pouco a cada mês à frente.
// ============================================
(function () {
    'use strict';

    // ---------- calendário ----------
    const DIA_MS = 86400000;
    const ANO0 = 2022;
    const T0 = Date.UTC(ANO0, 0, 1);
    const ULT = { ano: 2026, mes: 8, dia: 30 };            // último dia fechado
    const NH = Math.round((Date.UTC(ULT.ano, ULT.mes, ULT.dia) - T0) / DIA_MS) + 1;
    const NT = Math.round((Date.UTC(ULT.ano + 1, ULT.mes, ULT.dia) - T0) / DIA_MS) + 1;
    const KM_ULT = (ULT.ano - ANO0) * 12 + ULT.mes;          // último mês fechado (meses desde jan/22)
    const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const ANOS = [];
    for (let a = ANO0; a <= ULT.ano; a++) ANOS.push(a);

    const CAL = {
        ano: new Int16Array(NT), mes: new Int8Array(NT), dia: new Int8Array(NT), dow: new Int8Array(NT),
        doy: new Int16Array(NT), km: new Int16Array(NT), dm: new Int8Array(NT),
    };
    for (let d = 0; d < NT; d++) {
        const dt = new Date(T0 + d * DIA_MS);
        const a = dt.getUTCFullYear();
        const m = dt.getUTCMonth();
        CAL.ano[d] = a;
        CAL.mes[d] = m;
        CAL.dia[d] = dt.getUTCDate();
        CAL.dow[d] = dt.getUTCDay();
        CAL.doy[d] = Math.round((Date.UTC(a, m, dt.getUTCDate()) - Date.UTC(a, 0, 1)) / DIA_MS);
        CAL.km[d] = (a - ANO0) * 12 + m;
        CAL.dm[d] = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
    }

    function diaDe(a, m, di) {
        return Math.round((Date.UTC(a, m, di) - T0) / DIA_MS);
    }

    function iniMes(km) {
        return diaDe(ANO0 + Math.floor(km / 12), km % 12, 1);
    }

    function fimMes(km) {
        return iniMes(km + 1) - 1;
    }

    // o mesmo dia j anos antes (29/02 vira 28/02); -1 antes do início da base
    const ANTES = [null, new Int32Array(NT), new Int32Array(NT), new Int32Array(NT)];
    for (let j = 1; j <= 3; j++) {
        for (let d = 0; d < NT; d++) {
            const a = CAL.ano[d] - j;
            const m = CAL.mes[d];
            const di = Math.min(CAL.dia[d], new Date(Date.UTC(a, m + 1, 0)).getUTCDate());
            const r = diaDe(a, m, di);
            ANTES[j][d] = r >= 0 ? r : -1;
        }
    }

    const pad2 = (n) => String(n).padStart(2, '0');
    const rotMes = (km) => MESES[km % 12] + '/' + String(ANO0 + Math.floor(km / 12)).slice(2);
    const rotDia = (d) => pad2(CAL.dia[d]) + '/' + pad2(CAL.mes[d] + 1) + '/' + String(CAL.ano[d]).slice(2);
    const ULT_ROT = rotDia(NH - 1);

    // ---------- ruído fixo e perfis ----------
    function ruido(i, s) {
        const x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453;
        return (x - Math.floor(x)) * 2 - 1;
    }

    // parte do mês (uma safra difere da outra) + parte do dia
    function ruidoDia(d, s) {
        return 0.6 * ruido(CAL.km[d] + 97, s) + 0.4 * ruido(d, s + 0.37);
    }

    function u01(d, s) {
        return (ruido(d, s + 0.11) + 1) / 2;
    }

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    // valor do perfil mensal no dia d, interpolado entre os meios dos meses
    function perfilNoDia(p, d) {
        const m = CAL.mes[d];
        const pos = (CAL.dia[d] - 0.5) / CAL.dm[d];
        if (pos < 0.5) {
            const ant = p[(m + 11) % 12];
            return ant + (p[m] - ant) * (pos + 0.5);
        }
        const prox = p[(m + 1) % 12];
        return p[m] + (prox - p[m]) * (pos - 0.5);
    }

    function gerar(fn) {
        const a = new Float64Array(NH);
        for (let d = 0; d < NH; d++) a[d] = fn(d);
        return a;
    }

    const doAno = (v, d) => v[CAL.ano[d] - ANO0];

    function somaArr(lista) {
        return gerar((d) => lista.reduce((s, a) => s + a[d], 0));
    }

    function semanaNormalizada(p) {
        const media = p.reduce((s, v) => s + v, 0) / 7;
        return p.map((v) => v / media);
    }

    // perfil de t/mês → t/dia, × porte do ano, × dia da semana
    function fluxo(perfil, porte, s, amp, semana) {
        return gerar((d) => Math.max(0, perfilNoDia(perfil, d) / CAL.dm[d] * doAno(porte, d)
            * (1 + amp * ruidoDia(d, s)) * (semana ? semana[CAL.dow[d]] : 1)));
    }

    function nivel(perfil, ajuste, s, amp) {
        return gerar((d) => perfilNoDia(perfil, d) * (ajuste ? doAno(ajuste, d) : 1) * (1 + amp * ruidoDia(d, s)));
    }

    // contagem inteira por dia a partir de uma taxa esperada
    function eventos(taxa, s) {
        return gerar((d) => {
            const e = Math.max(0, taxa(d));
            const base = Math.floor(e);
            return base + (u01(d, s) < e - base ? 1 : 0);
        });
    }

    function mediaPond(comp, pesos) {
        const chaves = Object.keys(comp);
        return gerar((d) => {
            let a = 0;
            let b = 0;
            chaves.forEach((k) => {
                const w = pesos[k][d];
                a += comp[k][d] * w;
                b += w;
            });
            if (b > 1e-9) return a / b;
            return chaves.reduce((s, k) => s + comp[k][d], 0) / chaves.length;
        });
    }

    function mediaMovel(a, janela) {
        const out = new Float64Array(NH);
        let s = 0;
        for (let d = 0; d < NH; d++) {
            s += a[d];
            if (d >= janela) s -= a[d - janela];
            out[d] = s / Math.min(d + 1, janela);
        }
        return out;
    }

    // ---------- dimensões (os filtros de cada tela) ----------
    const COR = (i) => (i < 8 ? 'var(--est-c' + (i + 1) + ')' : 'var(--est-c-outros)');
    const lista = (arr) => arr.map((x, i) => Object.assign({ cor: COR(i) }, x));

    const DIMS = {
        cultura: { rotulo: 'Cultura', todos: 'Todas', valores: [
            { v: 'milho', n: 'Milho', cor: 'var(--grao-milho)', icone: 'milho' },
            { v: 'sorgo', n: 'Sorgo', cor: 'var(--grao-sorgo)', icone: 'sorgo' },
            { v: 'trigo', n: 'Trigo', cor: 'var(--grao-trigo)', icone: 'trigo' },
            { v: 'soja', n: 'Soja', cor: 'var(--grao-soja)', icone: 'soja' },
        ] },
        tag: { rotulo: 'Cadastro', todos: 'Todos', valores: lista([{ v: 'com', n: 'Com tag' }, { v: 'sem', n: 'Sem tag' }]) },
        turno: { rotulo: 'Turno', todos: 'Todos', valores: lista([{ v: 't1', n: '07:00–16:20' }, { v: 't2', n: '16:00–22:20' }, { v: 't3', n: '22:00–07:00' }]) },
        etapaRec: { rotulo: 'Etapa', todos: 'Todas', valores: lista([
            { v: 'fila', n: 'Fila' }, { v: 'pes1', n: '1ª pesagem' }, { v: 'class', n: 'Classificação' },
            { v: 'desc', n: 'Descarga' }, { v: 'pes2', n: '2ª pesagem' },
        ]) },
        etapaExp: { rotulo: 'Etapa', todos: 'Todas', valores: lista([
            { v: 'fila', n: 'Fila' }, { v: 'pes1', n: '1ª pesagem' }, { v: 'carreg', n: 'Carregamento' },
            { v: 'class', n: 'Classificação' }, { v: 'pes2', n: '2ª pesagem' },
        ]) },
        moega: { rotulo: 'Moega', todos: 'Todas', valores: lista([
            { v: 'm1', n: 'Moega 1', sub: 'Graneleiro · Tombador' }, { v: 'm2', n: 'Moega 2', sub: 'Graneleiro · Tombador' },
            { v: 'm3', n: 'Moega 3', sub: 'Basculante' }, { v: 'm4', n: 'Moega 4', sub: 'Basculante' },
            { v: 'm5', n: 'Moega 5', sub: 'Basculante' }, { v: 'm6', n: 'Moega 6', sub: 'Basculante' },
        ]) },
        pulmao: { rotulo: 'Pulmão', todos: 'Todos', valores: lista([{ v: 'p1', n: 'Pulmão 1' }, { v: 'p2', n: 'Pulmão 2' }]) },
        secador: { rotulo: 'Secador', todos: 'Todos', valores: lista([{ v: 's1', n: 'Secador 1', sub: '80 t/h nominal' }, { v: 's2', n: 'Secador 2', sub: '60 t/h nominal' }]) },
        motivo: { rotulo: 'Motivo', todos: 'Todos', valores: lista([
            { v: 'programada', n: 'Manutenção programada' }, { v: 'corretiva', n: 'Manutenção corretiva' },
            { v: 'faltaGrao', n: 'Falta de grão' }, { v: 'troca', n: 'Troca de cultura' }, { v: 'eletrica', n: 'Falha elétrica' },
        ]) },
        zona: { rotulo: 'Zona', semTodos: true, padrao: 'secagem', valores: lista([
            { v: 'quente', n: 'Quente', min: 2, max: 6 }, { v: 'secagem', n: 'Secagem', min: 18, max: 23 },
            { v: 'saturado', n: 'Saturado', min: 20, max: 25 }, { v: 'recirculacao', n: 'Recirculação', min: 0, max: 10 },
            { v: 'ambiente', n: 'Ambiente', min: 36, max: 43 },
        ]) },
        unidadeArm: { rotulo: 'Silo / armazém', todos: 'Todos', valores: lista([
            { v: 's1', n: 'Silo 1' }, { v: 's2', n: 'Silo 2' }, { v: 's3', n: 'Silo 3' }, { v: 's4', n: 'Silo 4' },
            { v: 's5', n: 'Silo 5' }, { v: 's6', n: 'Silo 6' }, { v: 's7', n: 'Silo 7' }, { v: 's8', n: 'Silo 8' },
            { v: 'a1', n: 'Armazém · área 1' }, { v: 'a2', n: 'Armazém · área 2' },
        ]) },
        tipoTrigo: { rotulo: 'Tipo', todos: 'Todos', valores: lista([
            { v: 'superior', n: 'Superior', faixa: 'PH ≥ 78 · FN ≥ 250' }, { v: 'intermediario', n: 'Intermediário', faixa: 'PH 72–77 · FN 170–249' },
            { v: 'ap', n: 'AP', faixa: 'PH 68–71 · FN 150–169' }, { v: 'triguilho', n: 'Triguilho', faixa: 'abaixo do AP' },
        ]) },
        prelimpeza: { rotulo: 'Pré-limpeza', todos: 'Todas', valores: lista([{ v: 'pl1', n: 'Pré-limpeza 1' }, { v: 'pl2', n: 'Pré-limpeza 2' }, { v: 'pl3', n: 'Pré-limpeza 3' }]) },
        cooperado: { rotulo: 'Cooperado', todos: 'Todos', valores: lista([
            ['Faz. Santa Rita', 14, 0.03, -0.4], ['Faz. Três Lagoas', 12, 0.05, -0.2], ['Faz. Palmeiras', 11, -0.04, 0.9],
            ['Sítio Boa Vista', 9.5, 0.02, 0.1], ['Faz. Bela Vista', 9, 0.06, -0.6], ['Faz. São João', 8.5, -0.02, 0.3],
            ['Sítio Recanto', 7.5, 0.08, -0.1], ['Faz. Água Limpa', 7, -0.06, 0.5], ['Faz. Esperança', 6, 0.04, -0.3],
            ['Sítio Santo Antônio', 5.5, 0.01, 0.7], ['Faz. Primavera', 5, 0.1, -0.5], ['Faz. Ouro Verde', 5, -0.03, 0.2],
        ].map(([n, peso, tend, q], i) => ({ v: 'c' + (i + 1), n, peso, tend, q }))) },
        cliente: { rotulo: 'Cliente', todos: 'Todos', valores: lista([
            { v: 'atlantica', n: 'Atlântica Grains', cultura: 'milho', peso: 0.42, sub: 'Porto de Santos' },
            { v: 'sulbrasil', n: 'Sulbrasil Trading', cultura: 'milho', peso: 0.33, sub: 'Porto de Paranaguá' },
            { v: 'holambra', n: 'Cooperativa Holambra', cultura: 'milho', peso: 0.25, sub: 'mercado interno' },
            { v: 'aurora', n: 'Frigorífico Aurora', cultura: 'sorgo', peso: 0.55, sub: 'sorgo' },
            { v: 'nutriave', n: 'Nutriave Rações', cultura: 'sorgo', peso: 0.45, sub: 'sorgo' },
            { v: 'moinho', n: 'Moinho Sul Alimentos', cultura: 'trigo', peso: 1, sub: 'trigo' },
            { v: 'rioverde', n: 'Rio Verde Commodities', cultura: 'soja', peso: 1, sub: 'Porto de Santos' },
        ]) },
        localidade: { rotulo: 'Localidade', todos: 'Avaré', semTodos: true, padrao: 'avare', valores: lista([
            ['avare', 'Avaré', 1, 0], ['itai', 'Itaí', 1.08, 0.6], ['paranapanema', 'Paranapanema', 0.95, 0.4],
            ['cerqueira', 'Cerqueira César', 1.05, -0.3], ['taquarituba', 'Taquarituba', 1.12, 0.2],
            ['itatinga', 'Itatinga', 0.92, -0.8], ['manduri', 'Manduri', 1, -0.4],
        ].map(([v, n, chuva, temp]) => ({ v, n, chuva, temp }))) },
    };

    // ---------- catálogo de indicadores ----------
    // agreg: soma | media (ponderada por peso) | max | ultimo (saldo no fim) |
    // acima (dias com a série "de" acima do limiar) | razao (num/den × fator) | dif (a − b)
    // dims[dim][valor]: { f } multiplica a série (cota ou fator) ou { o } soma (desvio)
    const M = {};

    function def(id, cfg) {
        M[id] = Object.assign({ id, casas: 0, unidade: '', agreg: 'soma', dims: {} }, cfg);
        return M[id];
    }

    function partes(comp, total) {
        const r = {};
        Object.keys(comp).forEach((v) => { r[v] = { f: gerar((d) => (total[d] > 1e-9 ? comp[v][d] / total[d] : 0)) }; });
        return r;
    }

    function desvios(comp, base) {
        const r = {};
        Object.keys(comp).forEach((v) => { r[v] = { o: gerar((d) => comp[v][d] - base[d]) }; });
        return r;
    }

    function cotas(chaves, pesoFn, s, amp) {
        const arrs = chaves.map(() => new Float64Array(NH));
        for (let d = 0; d < NH; d++) {
            let t = 0;
            chaves.forEach((c, i) => {
                const w = Math.max(0.001, pesoFn(i, d) * (1 + amp * ruidoDia(d, s + i * 1.7)));
                arrs[i][d] = w;
                t += w;
            });
            chaves.forEach((c, i) => { arrs[i][d] /= t; });
        }
        const r = {};
        chaves.forEach((c, i) => { r[c] = { f: arrs[i] }; });
        return r;
    }

    function fatores(map) {
        const r = {};
        Object.keys(map).forEach((v) => { r[v] = { f: map[v] }; });
        return r;
    }

    function somas(map) {
        const r = {};
        Object.keys(map).forEach((v) => { r[v] = { o: map[v] }; });
        return r;
    }

    const valoresDe = (dim) => DIMS[dim].valores.map((x) => x.v);

    function gerarDados() {
        const CULT = valoresDe('cultura');
        const PORTE = [0.84, 0.91, 0.96, 1, 1.06];
        const MELHORA = [1.12, 1.07, 1.03, 1, 0.93];        // espera, ciclo e paradas caindo ano a ano
        const melhora = (d) => doAno(MELHORA, d);

        // ---- clima: vem antes, a secagem e a aeração leem o tempo ----
        const CHUVA_P = [230, 190, 140, 70, 75, 50, 40, 35, 75, 120, 135, 200];
        const TEMP_P = [24, 24.2, 23.5, 21.5, 19, 18, 17.8, 19.5, 21, 22.5, 23, 23.6];
        const UR_P = [80, 79, 78, 74, 72, 70, 63, 57, 60, 68, 72, 78];
        const chuva = gerar((d) => {
            const m = CAL.mes[d];
            const fm = Math.max(0.15, 1 + 0.45 * ruido(CAL.km[d], 15));
            const total = CHUVA_P[m] * fm;
            const dias = clamp(Math.round(total / 11), 1, 24);
            return u01(d, 170) < dias / CAL.dm[d] ? total / dias * (0.25 + 1.5 * u01(d, 171)) : 0;
        });
        const temp = gerar((d) => perfilNoDia(TEMP_P, d) + 0.8 * ruido(CAL.km[d], 16) + 1.8 * ruido(d, 17) - (chuva[d] > 5 ? 0.8 : 0));
        const ur = gerar((d) => clamp(perfilNoDia(UR_P, d) + (chuva[d] > 0 ? 14 : 0) + 6 * ruido(d, 18), 25, 99));
        const LOC = DIMS.localidade.valores;
        const dLocChuva = {};
        LOC.forEach((l, i) => { dLocChuva[l.v] = { f: i === 0 ? 1 : gerar((d) => l.chuva * (0.55 + 0.9 * u01(d, 180 + i))) }; });
        const dLocTemp = {};
        LOC.forEach((l, i) => { dLocTemp[l.v] = { o: i === 0 ? 0 : gerar((d) => l.temp + 0.4 * ruido(d, 190 + i)) }; });
        def('chuva', { rotulo: 'Chuva', unidade: 'mm', base: chuva, dims: { localidade: dLocChuva } });
        def('diasChuva', { rotulo: 'Dias de chuva', unidade: 'dias', agreg: 'acima', de: 'chuva', limiar: 1 });
        def('temp', { rotulo: 'Temperatura média', unidade: '°C', casas: 1, agreg: 'media', base: temp, dims: { localidade: dLocTemp } });
        def('tMax', { rotulo: 'Máxima média', unidade: '°C', casas: 1, agreg: 'media', base: gerar((d) => temp[d] + 5.5 + 1.5 * ruido(d, 19) - (chuva[d] > 5 ? 2 : 0)), dims: { localidade: dLocTemp } });
        def('tMin', { rotulo: 'Mínima média', unidade: '°C', casas: 1, agreg: 'media', base: gerar((d) => temp[d] - 6 + 1.2 * ruido(d, 20) + (chuva[d] > 5 ? 1.5 : 0)), dims: { localidade: dLocTemp } });
        def('ur', { rotulo: 'Umidade relativa', unidade: '%', agreg: 'media', base: ur, limite: [0, 100], dims: { localidade: somas({ avare: 0, itai: 1.5, paranapanema: 2, cerqueira: -1, taquarituba: 3, itatinga: -2, manduri: 0.5 }) } });

        // ---- recepção ----
        const PERFIL_REC = {
            milho: [1500, 5000, 8000, 3000, 1000, 3000, 9000, 15000, 19000, 16000, 4000, 800],
            sorgo: [0, 0, 0, 300, 800, 2000, 4000, 6000, 7000, 6000, 1500, 0],
            trigo: [0, 0, 0, 0, 0, 0, 0, 200, 1800, 2600, 900, 100],
            soja: [600, 4000, 7000, 3000, 300, 0, 0, 0, 0, 0, 0, 0],
        };
        const semRec = semanaNormalizada([0.35, 1.12, 1.12, 1.1, 1.1, 1.08, 0.8]);
        const rec = {};
        CULT.forEach((c, i) => { rec[c] = fluxo(PERFIL_REC[c], PORTE, 1 + i, 0.16, semRec); });
        const recTotal = somaArr(CULT.map((c) => rec[c]));
        const carga = gerar((d) => recTotal[d] / 900);          // ~1 no pico da safra
        const ativas = gerar((d) => CULT.filter((c) => rec[c][d] > 40).length);

        const dCultRec = partes(rec, recTotal);
        const shareTag = gerar((d) => clamp(doAno([0.62, 0.7, 0.78, 0.84, 0.88], d) + 0.04 * ruidoDia(d, 31), 0.3, 0.97));
        const dTag = { com: { f: shareTag }, sem: { f: gerar((d) => 1 - shareTag[d]) } };
        const dTurnoRec = cotas(['t1', 't2', 't3'], (i, d) => [0.55 - 0.08 * carga[d], 0.3, 0.15 + 0.08 * carga[d]][i], 33, 0.1);
        const COOP = DIMS.cooperado.valores;
        const dCoop = cotas(COOP.map((c) => c.v), (i, d) => COOP[i].peso * (1 + COOP[i].tend * (CAL.ano[d] - 2024)), 41, 0.2);
        const coopO = (k) => somas(Object.fromEntries(COOP.map((c) => [c.v, c.q * k])));
        const MOEGAS = valoresDe('moega');
        const dMoega = cotas(MOEGAS, (i, d) => [0.2, 0.19, 0.16, 0.15, 0.15, 0.15][i] * (i < 2 ? 1 + 0.15 * carga[d] : 1), 51, 0.15);
        const dimsRec = { cultura: dCultRec, tag: dTag, turno: dTurnoRec, cooperado: dCoop, moega: dMoega };

        def('rec', { rotulo: 'Recebido', unidade: 't', melhor: 'maior', base: recTotal, dims: dimsRec });
        def('cam', { rotulo: 'Caminhões', unidade: 'cam.', melhor: 'maior', base: gerar((d) => recTotal[d] / 27.5), dims: dimsRec });
        def('recTagPct', { rotulo: 'Com tag', unidade: '%', casas: 1, agreg: 'razao', num: 'rec', den: 'rec', fix: { tag: 'com' }, fator: 100, melhor: 'maior', limite: [0, 100] });

        const espera = gerar((d) => (5 + 14 * carga[d]) * melhora(d) * (1 + 0.1 * ruidoDia(d, 8)));
        def('espera', {
            rotulo: 'Espera média', unidade: 'min', agreg: 'media', peso: 'cam', melhor: 'menor', base: espera,
            dims: { cultura: somas({ milho: 1.5, sorgo: -2, trigo: -1, soja: 0.5 }), turno: somas({ t1: 0, t2: 2.5, t3: -3 }), tag: somas({ com: -1, sem: 3.5 }) },
        });
        const filaMed = gerar((d) => (1 + 8 * Math.pow(carga[d], 1.5)) * melhora(d) * (1 + 0.14 * ruidoDia(d, 9)) * (CAL.dow[d] === 0 ? 0.3 : 1));
        const dimsFila = { cultura: dCultRec, turno: fatores({ t1: 1.1, t2: 1, t3: 0.7 }), tag: dTag };
        def('filaMedia', { rotulo: 'Fila média', unidade: 'cam.', casas: 1, agreg: 'media', melhor: 'menor', base: filaMed, dims: dimsFila });
        def('filaPico', { rotulo: 'Pico de fila', unidade: 'cam.', agreg: 'max', melhor: 'menor', base: gerar((d) => filaMed[d] * (1.8 + 0.4 * (ruido(d, 10) + 1))), dims: dimsFila });
        def('diasEspera20', { rotulo: 'Dias com espera acima de 20 min', unidade: 'dias', agreg: 'acima', de: 'espera', limiar: 20, melhor: 'menor' });

        const etRec = {
            fila: espera,
            pes1: gerar((d) => (3 + 5 * carga[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 61))),
            class: gerar((d) => (5 + 6 * carga[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 62))),
            desc: gerar((d) => (8 + 9 * carga[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 63))),
            pes2: gerar((d) => (3 + 4 * carga[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 64))),
        };
        const ciclo = somaArr(Object.values(etRec));
        def('ciclo', {
            rotulo: 'Ciclo médio', unidade: 'min', agreg: 'media', peso: 'cam', melhor: 'menor', empilha: 'etapaRec', base: ciclo,
            dims: { etapaRec: desvios(etRec, ciclo), cultura: somas({ milho: 3, sorgo: -4, trigo: -2, soja: 1.5 }), turno: somas({ t1: 0, t2: 3, t3: -4 }) },
        });
        def('diasCiclo60', { rotulo: 'Dias com ciclo acima de 60 min', unidade: 'dias', agreg: 'acima', de: 'ciclo', limiar: 60, melhor: 'menor' });

        // ---- classificação ----
        const UMID_MILHO = [14.6, 16.8, 17.9, 16.2, 14.9, 15.4, 16.6, 17.4, 18.1, 17.7, 15.8, 14.5];
        const umid = {
            milho: nivel(UMID_MILHO, null, 5, 0.03),
            sorgo: nivel(UMID_MILHO.map((v) => v - 0.8), null, 6, 0.03),
            trigo: nivel([13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.6, 13.8, 14.2, 14.6, 14, 13.6], null, 7, 0.025),
            soja: nivel([13.4, 14.8, 15.4, 14.3, 13.6, 13.4, 13.4, 13.4, 13.4, 13.4, 13.4, 13.4], null, 8, 0.025),
        };
        const umidTotal = mediaPond(umid, rec);
        def('umidade', {
            rotulo: 'Umidade média', unidade: '%', casas: 1, agreg: 'media', peso: 'rec', melhor: 'menor', base: umidTotal,
            dims: { cultura: desvios(umid, umidTotal), cooperado: coopO(0.8) },
        });
        const IMP_P = [0.8, 0.95, 1.05, 0.9, 0.8, 0.85, 0.95, 1.05, 1.1, 1, 0.85, 0.8];
        const FIMP = { milho: 1, sorgo: 1.25, trigo: 0.9, soja: 0.85 };
        const imp = {};
        CULT.forEach((c, i) => { imp[c] = nivel(IMP_P.map((v) => v * FIMP[c]), [1.06, 1.03, 1, 0.98, 0.95], 20 + i, 0.08); });
        const impTotal = mediaPond(imp, rec);
        def('impureza', {
            rotulo: 'Impureza média', unidade: '%', casas: 2, agreg: 'media', peso: 'rec', melhor: 'menor', base: impTotal,
            dims: { cultura: desvios(imp, impTotal), cooperado: coopO(0.2) },
        });
        const AV_P = [2.6, 3.2, 3.8, 3.3, 2.8, 2.9, 3.4, 3.9, 4.2, 3.8, 3, 2.7];
        const FAV = { milho: 1, sorgo: 1.1, trigo: 0.6, soja: 0.9 };
        const avar = {};
        CULT.forEach((c, i) => { avar[c] = nivel(AV_P.map((v) => v * FAV[c]), [1.08, 1.04, 1, 0.97, 0.94], 24 + i, 0.08); });
        const avarTotal = mediaPond(avar, rec);
        def('avariados', {
            rotulo: 'Avariados', unidade: '%', casas: 1, agreg: 'media', peso: 'rec', melhor: 'menor', base: avarTotal,
            dims: { cultura: desvios(avar, avarTotal), cooperado: coopO(1.1) },
        });
        const fora = {};
        CULT.forEach((c, i) => { fora[c] = gerar((d) => clamp(3 + Math.max(0, umid[c][d] - 16) * 5 + Math.max(0, avar[c][d] - 4.5) * 6 + 1.2 * ruidoDia(d, 30 + i), 0.5, 40)); });
        const foraTotal = mediaPond(fora, rec);
        def('foraPadrao', {
            rotulo: 'Fora do padrão', unidade: '%', casas: 1, agreg: 'media', peso: 'cam', melhor: 'menor', base: foraTotal,
            dims: { cultura: desvios(fora, foraTotal), cooperado: coopO(2.5) },
        });
        const desc = {};
        CULT.forEach((c) => { desc[c] = gerar((d) => rec[c][d] * (Math.max(0, umid[c][d] - 14) * 0.0125 + imp[c][d] * 0.006)); });
        const descTotal = somaArr(CULT.map((c) => desc[c]));
        def('descontado', { rotulo: 'Desconto total', unidade: 't', melhor: 'menor', base: descTotal, dims: { cultura: partes(desc, descTotal), cooperado: dCoop } });

        // trigo: cargas por tipo e as três medidas
        const trigoCargas = gerar((d) => rec.trigo[d] / 27.5);
        const TIPO_ANO = [[0.55, 0.3, 0.1, 0.05], [0.58, 0.28, 0.1, 0.04], [0.6, 0.28, 0.09, 0.03], [0.62, 0.27, 0.08, 0.03], [0.66, 0.25, 0.07, 0.02]];
        const TIPOS = valoresDe('tipoTrigo');
        const dTipo = cotas(TIPOS, (i, d) => doAno(TIPO_ANO, d)[i], 81, 0.2);
        const cotaTipo = Object.fromEntries(TIPOS.map((t) => [t, dTipo[t].f]));
        def('trigoCargas', { rotulo: 'Cargas de trigo', unidade: 'cargas', melhor: 'maior', base: trigoCargas, dims: { tipoTrigo: dTipo } });
        const porTipo = (niveis, s, amp) => Object.fromEntries(TIPOS.map((t, i) => [t, gerar((d) => niveis[i] * (1 + amp * ruidoDia(d, s + i)))]));
        const phT = porTipo([79.6, 75.6, 70.4, 66.8], 82, 0.006);
        const fnT = porTipo([268, 228, 160, 142], 86, 0.03);
        const germT = porTipo([0.3, 0.9, 1.9, 3.6], 90, 0.18);
        const phB = mediaPond(phT, cotaTipo);
        const fnB = mediaPond(fnT, cotaTipo);
        const germB = mediaPond(germT, cotaTipo);
        def('ph', { rotulo: 'PH médio', unidade: 'kg/hl', casas: 1, agreg: 'media', peso: 'trigoCargas', melhor: 'maior', base: phB, dims: { tipoTrigo: desvios(phT, phB) } });
        def('fn', { rotulo: 'Falling number', unidade: 's', agreg: 'media', peso: 'trigoCargas', melhor: 'maior', base: fnB, dims: { tipoTrigo: desvios(fnT, fnB) } });
        def('germinado', { rotulo: 'Germinado', unidade: '%', casas: 1, agreg: 'media', peso: 'trigoCargas', melhor: 'menor', base: germB, dims: { tipoTrigo: desvios(germT, germB) } });
        def('superiorPct', { rotulo: 'Tipo superior', unidade: '%', casas: 1, agreg: 'razao', num: 'trigoCargas', den: 'trigoCargas', fix: { tipoTrigo: 'superior' }, fator: 100, melhor: 'maior', limite: [0, 100] });

        // pré-limpeza: impureza pesada na caçamba × o que foi descontado do cooperado
        const impC = Object.fromEntries(CULT.map((c) => [c, gerar((d) => rec[c][d] * imp[c][d])]));
        const dCultImp = partes(impC, somaArr(CULT.map((c) => impC[c])));
        const plPes = gerar((d) => recTotal[d] * impTotal[d] / 100 * (1 + 0.05 * ruidoDia(d, 93)));
        const plDes = gerar((d) => recTotal[d] * impTotal[d] / 100 * 0.97);
        const PL = valoresDe('prelimpeza');
        def('plPesado', { rotulo: 'Impureza retirada', unidade: 't', casas: 1, base: plPes, dims: { prelimpeza: cotas(PL, (i) => [0.36, 0.33, 0.31][i], 91, 0.1), cultura: dCultImp } });
        def('plDesc', { rotulo: 'Descontado de impureza', unidade: 't', casas: 1, base: plDes, dims: { prelimpeza: cotas(PL, (i) => [0.35, 0.335, 0.315][i], 92, 0.1), cultura: dCultImp } });
        def('plDif', { rotulo: 'Diferença', unidade: 't', casas: 1, agreg: 'dif', a: 'plPesado', b: 'plDesc' });
        def('plCacambas', { rotulo: 'Caçambas', unidade: 'caçambas', base: gerar((d) => plPes[d] / 7.5), dims: M.plPesado.dims });

        // ---- secagem ----
        const sec = {};
        CULT.forEach((c) => { sec[c] = gerar((d) => rec[c][d] * Math.min(0.95, 0.5 + Math.max(0, umid[c][d] - 14) * 0.11)); });
        const secado = somaArr(CULT.map((c) => sec[c]));
        const dSecador = cotas(['s1', 's2'], (i) => [0.57, 0.43][i], 101, 0.08);
        const dTurnoSec = cotas(['t1', 't2', 't3'], (i) => [0.42, 0.32, 0.26][i], 102, 0.08);
        const dCultSec = partes(sec, secado);
        def('secado', { rotulo: 'Secado', unidade: 't', melhor: 'maior', base: secado, dims: { secador: dSecador, cultura: dCultSec, turno: dTurnoSec } });
        def('secadoM3', { rotulo: 'Volume secado', unidade: 'm³', base: gerar((d) => secado[d] / 0.72), dims: M.secado.dims });

        const umidEntC = Object.fromEntries(CULT.map((c) => [c, gerar((d) => umid[c][d] + 0.5)]));
        const umidEnt = mediaPond(umidEntC, sec);
        def('umidEnt', { rotulo: 'Umidade de entrada', unidade: '%', casas: 1, agreg: 'media', peso: 'secado', base: umidEnt, dims: { cultura: desvios(umidEntC, umidEnt), secador: somas({ s1: 0.15, s2: -0.2 }) } });
        const ALVO = { milho: 13, sorgo: 12.6, trigo: 12.8, soja: 12.4 };
        const umidSaiC = Object.fromEntries(CULT.map((c, i) => [c, gerar((d) => ALVO[c] + 0.12 + 0.15 * ruidoDia(d, 110 + i) + 0.1 * Math.max(0, umidEntC[c][d] - 17))]));
        const umidSai = mediaPond(umidSaiC, sec);
        def('umidSai', { rotulo: 'Umidade de saída', unidade: '%', casas: 1, agreg: 'media', peso: 'secado', melhor: 'menor', base: umidSai, dims: { cultura: desvios(umidSaiC, umidSai), secador: somas({ s1: -0.05, s2: 0.12 }) } });
        const pontosC = Object.fromEntries(CULT.map((c) => [c, gerar((d) => umidEntC[c][d] - umidSaiC[c][d])]));
        const pontos = gerar((d) => umidEnt[d] - umidSai[d]);
        def('pontos', { rotulo: 'Pontos retirados', unidade: 'p.p.', casas: 1, agreg: 'media', peso: 'secado', base: pontos, dims: { cultura: desvios(pontosC, pontos), secador: somas({ s1: 0.2, s2: -0.32 }) } });

        const ritmoS = {
            s1: gerar((d) => (42 - 2 * Math.max(0, umidEnt[d] - 14)) / melhora(d) * (1 + 0.03 * ruidoDia(d, 103))),
            s2: gerar((d) => (33 - 1.6 * Math.max(0, umidEnt[d] - 14)) / melhora(d) * (1 + 0.03 * ruidoDia(d, 104))),
        };
        const ritmoB = gerar((d) => ritmoS.s1[d] * dSecador.s1.f[d] + ritmoS.s2[d] * dSecador.s2.f[d]);
        def('ritmo', {
            rotulo: 'Ritmo médio', unidade: 't/h', casas: 1, agreg: 'media', peso: 'secado', melhor: 'maior', base: ritmoB,
            dims: { secador: desvios(ritmoS, ritmoB), cultura: somas({ milho: 0, sorgo: 2, trigo: 5, soja: 4 }), turno: somas({ t1: 1, t2: 0, t3: -1.5 }) },
        });
        const horas = {
            s1: gerar((d) => secado[d] * dSecador.s1.f[d] / ritmoS.s1[d]),
            s2: gerar((d) => secado[d] * dSecador.s2.f[d] / ritmoS.s2[d]),
        };
        const horasTot = somaArr([horas.s1, horas.s2]);
        def('horasSec', { rotulo: 'Horas secando', unidade: 'h', base: horasTot, dims: { secador: partes(horas, horasTot), cultura: dCultSec, turno: dTurnoSec } });

        const SETP = { milho: 100, sorgo: 95, trigo: 80, soja: 85 };
        const tempArC = Object.fromEntries(CULT.map((c, i) => [c, gerar((d) => SETP[c] - 4 + 2.5 * carga[d] + 1.2 * ruidoDia(d, 120 + i))]));
        const tempArB = mediaPond(tempArC, sec);
        def('tempAr', { rotulo: 'Temperatura do ar', unidade: '°C', agreg: 'media', peso: 'secado', base: tempArB, dims: { cultura: desvios(tempArC, tempArB), secador: somas({ s1: 1.5, s2: -2 }) } });
        def('arSaida', { rotulo: 'Ar de saída', unidade: '°C', casas: 1, agreg: 'media', peso: 'secado', melhor: 'menor', base: gerar((d) => 39 + 4 * carga[d] + (temp[d] - 21) * 0.45 + 0.8 * ruidoDia(d, 125)), dims: { secador: somas({ s1: -0.8, s2: 1.4 }) } });
        def('foraFaixa', {
            rotulo: 'Tempo fora da faixa', unidade: '%', casas: 1, agreg: 'media', peso: 'secado', melhor: 'menor',
            base: gerar((d) => Math.max(0.2, (2 + 4 * carga[d] * carga[d]) * melhora(d) * (1 + 0.25 * ruidoDia(d, 126)))),
            dims: { secador: somas({ s1: -0.4, s2: 0.7 }), cultura: somas({ milho: 0.3, sorgo: 0.6, trigo: -0.8, soja: -0.5 }) },
        });

        // cavaco: consumo por m³ secado, entregas no pátio e o estoque
        const fatorCav = [1.05, 1.03, 1.01, 1, 0.97];
        const kgS1 = gerar((d) => (15.2 + Math.max(0, umidEnt[d] - 14) * 0.95) * doAno(fatorCav, d) * (1 + 0.03 * ruidoDia(d, 130)));
        const cavS = {
            s1: gerar((d) => secado[d] * dSecador.s1.f[d] / 0.72 * kgS1[d] / 1000),
            s2: gerar((d) => secado[d] * dSecador.s2.f[d] / 0.72 * kgS1[d] * 1.06 / 1000),
        };
        const cavTot = somaArr([cavS.s1, cavS.s2]);
        def('cavacoT', { rotulo: 'Cavaco consumido', unidade: 't', melhor: 'menor', base: cavTot, dims: { secador: partes(cavS, cavTot) } });
        def('cavacoKgM3', { rotulo: 'Cavaco por m³ secado', unidade: 'kg/m³', casas: 1, agreg: 'razao', num: 'cavacoT', den: 'secadoM3', fator: 1000, melhor: 'menor' });
        const cavRec = new Float64Array(NH);
        const cavEst = new Float64Array(NH);
        let estoque = 1800;
        for (let d = 0; d < NH; d++) {
            let fut = 0;
            let n = 0;
            for (let k = d; k < Math.min(NH, d + 30); k++) { fut += cavTot[k]; n++; }
            let r = fut / n + (1600 - estoque) * 0.04;
            r *= (CAL.dow[d] === 0 ? 0 : 7 / 6) * (1 + 0.25 * ruido(d, 131));
            r = Math.max(0, r);
            cavRec[d] = r;
            estoque = Math.max(150, estoque + r - cavTot[d]);
            cavEst[d] = estoque;
        }
        def('cavacoRec', { rotulo: 'Cavaco recebido', unidade: 't', base: cavRec });
        def('cavacoEst', { rotulo: 'Estoque de cavaco', unidade: 't', agreg: 'ultimo', base: cavEst });

        // paradas por secador e motivo (no máximo 24 h no dia)
        const MOT = valoresDe('motivo');
        const parS = {};
        ['s1', 's2'].forEach((s, si) => {
            const p = {
                programada: gerar((d) => Math.max(0, perfilNoDia([40, 10, 4, 8, 30, 20, 4, 0, 0, 2, 18, 48], d) / CAL.dm[d] * (1 + 0.5 * ruidoDia(d, 140 + si)))),
                corretiva: gerar((d) => (u01(d, 142 + si) < (0.05 + 0.07 * carga[d]) * melhora(d) ? 2 + 7 * u01(d, 144 + si) : 0)),
                faltaGrao: gerar((d) => Math.max(0, 1 - carga[d] / 0.35) * 14 * (1 + 0.2 * ruidoDia(d, 146 + si))),
                troca: gerar((d) => (ativas[d] >= 2 ? 0.35 * (ativas[d] - 1) * (1 + 0.4 * ruido(d, 148 + si)) : 0)),
                eletrica: gerar((d) => (u01(d, 150 + si) < 0.015 + (chuva[d] > 20 ? 0.22 : 0) ? 1 + 3 * u01(d, 152 + si) : 0)),
            };
            for (let d = 0; d < NH; d++) {
                const t = MOT.reduce((sm, mo) => sm + p[mo][d], 0);
                if (t > 24) MOT.forEach((mo) => { p[mo][d] *= 24 / t; });
            }
            parS[s] = p;
        });
        const parSec = { s1: somaArr(MOT.map((mo) => parS.s1[mo])), s2: somaArr(MOT.map((mo) => parS.s2[mo])) };
        const parTot = somaArr([parSec.s1, parSec.s2]);
        const parMot = Object.fromEntries(MOT.map((mo) => [mo, somaArr([parS.s1[mo], parS.s2[mo]])]));
        def('paradas', { rotulo: 'Horas paradas', unidade: 'h', melhor: 'menor', base: parTot, dims: { secador: partes(parSec, parTot), motivo: partes(parMot, parTot) } });
        const dispS = Object.fromEntries(['s1', 's2'].map((s) => [s, gerar((d) => 100 * (24 - parS[s].programada[d] - parS[s].corretiva[d] - parS[s].eletrica[d]) / 24)]));
        const dispB = gerar((d) => (dispS.s1[d] + dispS.s2[d]) / 2);
        def('dispo', { rotulo: 'Disponibilidade física', unidade: '%', casas: 1, agreg: 'media', melhor: 'maior', limite: [0, 100], base: dispB, dims: { secador: desvios(dispS, dispB) } });

        // pressão: a depressão sobe em dente de serra (filtros sujam no mês)
        const ZONAS = DIMS.zona.valores;
        const serra = gerar((d) => (CAL.dia[d] - 1) / CAL.dm[d]);
        const dep = {};
        const foraZ = {};
        ZONAS.forEach((z, i) => {
            const meio = (z.min + z.max) / 2;
            const amp = (z.max - z.min) / 2;
            dep[z.v] = gerar((d) => meio + amp * ((-0.45 + 1.1 * serra[d] * (0.6 + 0.6 * carga[d])) * melhora(d) + 0.35 * ruidoDia(d, 160 + i)));
            foraZ[z.v] = gerar((d) => clamp(1.5 + 22 * Math.max(0, Math.abs((dep[z.v][d] - meio) / amp) - 0.55) + 1.5 * ruido(d, 165 + i), 0.2, 60));
        });
        const depB = dep.secagem;
        const foraB = gerar((d) => ZONAS.reduce((s, z) => s + foraZ[z.v][d], 0) / ZONAS.length);
        def('pressDep', { rotulo: 'Depressão média', unidade: 'mmca', casas: 1, agreg: 'media', base: depB, dims: { zona: desvios(dep, depB), secador: somas({ s1: -0.3, s2: 0.5 }) } });
        def('pressFora', { rotulo: 'Leituras fora da faixa', unidade: '%', casas: 1, agreg: 'media', melhor: 'menor', base: foraB, dims: { zona: desvios(foraZ, foraB), secador: somas({ s1: -0.5, s2: 0.9 }) } });
        def('pressDias10', { rotulo: 'Dias com mais de 10% fora', unidade: 'dias', agreg: 'acima', de: 'pressFora', limiar: 10, melhor: 'menor' });

        // ---- expedição (sai do recebido depois de 2 a 3 meses no silo) ----
        const semExp = semanaNormalizada([0.15, 1.1, 1.12, 1.12, 1.1, 1.08, 0.6]);
        const exp = {};
        CULT.forEach((c, i) => {
            const r = rec[c];
            exp[c] = gerar((d) => {
                let s = 0;
                for (let k = 55; k <= 95; k += 5) {
                    const x = d - k;
                    s += x >= 0 ? r[x] : r[x + 365] * 0.92;
                }
                return s / 9 * 0.97 * semExp[CAL.dow[d]] * (1 + 0.08 * ruidoDia(d, 250 + i));
            });
        });
        const expTotal = somaArr(CULT.map((c) => exp[c]));
        const dCultExp = partes(exp, expTotal);
        const CLI = DIMS.cliente.valores;
        const dCliente = {};
        CULT.forEach((c, ci) => {
            const doGrupo = CLI.filter((x) => x.cultura === c);
            const cot = cotas(doGrupo.map((x) => x.v), (i) => doGrupo[i].peso, 300 + ci * 7, 0.18);
            doGrupo.forEach((x) => { dCliente[x.v] = { f: gerar((d) => dCultExp[c].f[d] * cot[x.v].f[d]) }; });
        });
        const IGNORA_CULT = { cliente: ['cultura'] };
        const dimsExp = { cultura: dCultExp, cliente: dCliente };
        def('exp', { rotulo: 'Expedido', unidade: 't', melhor: 'maior', base: expTotal, dims: dimsExp, ignora: IGNORA_CULT });
        const expCamC = Object.fromEntries(CULT.map((c) => [c, gerar((d) => exp[c][d] / 37)]));
        const expCam = gerar((d) => expTotal[d] / 37);
        def('expCam', { rotulo: 'Caminhões', unidade: 'cam.', melhor: 'maior', base: expCam, dims: dimsExp, ignora: IGNORA_CULT });
        const REP_P = [1.4, 1.8, 2.2, 1.9, 1.5, 1.6, 1.9, 2.3, 2.5, 2.2, 1.7, 1.4];
        const FREP = { milho: 1, sorgo: 0.8, trigo: 1.3, soja: 0.9 };
        const repC = Object.fromEntries(CULT.map((c, i) => [c, nivel(REP_P.map((v) => v * FREP[c]), [1.15, 1.08, 1.02, 1, 0.9], 255 + i, 0.12)]));
        const repB = mediaPond(repC, expCamC);
        def('reprovasPct', { rotulo: 'Reprovas', unidade: '%', casas: 1, agreg: 'media', peso: 'expCam', melhor: 'menor', base: repB, dims: { cultura: desvios(repC, repB) } });
        const reprC = Object.fromEntries(CULT.map((c, i) => [c, eventos((d) => expCamC[c][d] * repC[c][d] / 100, 258 + i)]));
        const reprT = somaArr(CULT.map((c) => reprC[c]));
        def('reprovadas', { rotulo: 'Cargas reprovadas', unidade: 'cargas', melhor: 'menor', base: reprT, dims: { cultura: partes(reprC, reprT) } });

        const DOS_ANO = [76, 80, 83, 86, 88];
        const dosC = Object.fromEntries(CULT.map((c, i) => [c, gerar((d) => clamp(doAno(DOS_ANO, d) + { milho: 0, sorgo: 2, trigo: 5, soja: -9 }[c] + 2 * ruidoDia(d, 262 + i), 40, 99.5))]));
        const dosB = mediaPond(dosC, exp);
        def('dosado', { rotulo: 'Volume dosado', unidade: '%', casas: 1, agreg: 'media', peso: 'exp', melhor: 'maior', limite: [0, 100], base: dosB, dims: { cultura: desvios(dosC, dosB) } });
        const qualExp = (niveis, s, amp, sazonal) => Object.fromEntries(CULT.map((c, i) => [c, gerar((d) => niveis[c] * (sazonal ? perfilNoDia(sazonal, d) : 1) * (1 + amp * ruidoDia(d, s + i)))]));
        const AV_SAZ = AV_P.map((v) => v / 3.3);
        const eU = qualExp({ milho: 13.1, sorgo: 12.8, trigo: 12.9, soja: 12.6 }, 266, 0.012);
        const eI = qualExp({ milho: 0.7, sorgo: 0.9, trigo: 0.6, soja: 0.6 }, 270, 0.1);
        const eA = qualExp({ milho: 3.6, sorgo: 3.2, trigo: 1.8, soja: 3 }, 274, 0.08, AV_SAZ);
        const eUB = mediaPond(eU, exp);
        const eIB = mediaPond(eI, exp);
        const eAB = mediaPond(eA, exp);
        def('expUmid', { rotulo: 'Umidade', unidade: '%', casas: 1, agreg: 'media', peso: 'exp', melhor: 'menor', base: eUB, dims: { cultura: desvios(eU, eUB) } });
        def('expImp', { rotulo: 'Impureza', unidade: '%', casas: 2, agreg: 'media', peso: 'exp', melhor: 'menor', base: eIB, dims: { cultura: desvios(eI, eIB) } });
        def('expAvar', { rotulo: 'Avariados', unidade: '%', casas: 1, agreg: 'media', peso: 'exp', melhor: 'menor', base: eAB, dims: { cultura: desvios(eA, eAB) } });
        def('expPh', { rotulo: 'PH (trigo)', unidade: 'kg/hl', casas: 1, agreg: 'media', peso: 'exp', soCultura: 'trigo', melhor: 'maior', base: gerar((d) => 77.9 + 0.7 * ruidoDia(d, 278)) });
        def('expFn', { rotulo: 'Falling number (trigo)', unidade: 's', agreg: 'media', peso: 'exp', soCultura: 'trigo', melhor: 'maior', base: gerar((d) => 256 + 14 * ruidoDia(d, 279)) });

        const cargaExp = gerar((d) => expTotal[d] / 1000);
        const etExp = {
            fila: gerar((d) => (6 + 12 * cargaExp[d]) * melhora(d) * (1 + 0.1 * ruidoDia(d, 281))),
            pes1: gerar((d) => (3 + 3 * cargaExp[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 282))),
            carreg: gerar((d) => (14 + 10 * cargaExp[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 283))),
            class: gerar((d) => (6 + 4 * cargaExp[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 284))),
            pes2: gerar((d) => (3 + 3 * cargaExp[d]) * melhora(d) * (1 + 0.08 * ruidoDia(d, 285))),
        };
        const cicloExp = somaArr(Object.values(etExp));
        def('cicloExp', {
            rotulo: 'Tempo na unidade', unidade: 'min', agreg: 'media', peso: 'expCam', melhor: 'menor', empilha: 'etapaExp', base: cicloExp,
            dims: { etapaExp: desvios(etExp, cicloExp), cultura: somas({ milho: 0, sorgo: -3, trigo: 4, soja: 2 }), turno: somas({ t1: 0, t2: 2, t3: -5 }) },
        });
        def('diasCiclo75', { rotulo: 'Dias com ciclo acima de 75 min', unidade: 'dias', agreg: 'acima', de: 'cicloExp', limiar: 75, melhor: 'menor' });

        // contratos: entregas por cliente, contratos encerrados e os atrasados
        const TAM = { milho: 3500, sorgo: 1600, trigo: 800, soja: 2000 };
        const encC = {};
        const atrC = {};
        CLI.forEach((x, i) => {
            const ent = gerar((d) => expTotal[d] * dCliente[x.v].f[d]);
            encC[x.v] = eventos((d) => ent[d] / TAM[x.cultura], 310 + i);
            atrC[x.v] = gerar((d) => {
                const p = clamp(0.28 - 0.04 * (CAL.ano[d] - ANO0) + 0.15 * carga[d], 0.03, 0.6);
                return encC[x.v][d] > 0 && u01(d, 320 + i) < p ? 1 : 0;
            });
        });
        const somaPor = (obj) => somaArr(Object.values(obj));
        const porCultura = (obj) => Object.fromEntries(CULT.map((c) => [c, somaArr(CLI.filter((x) => x.cultura === c).map((x) => obj[x.v]))]));
        const encT = somaPor(encC);
        const atrT = somaPor(atrC);
        const okC = Object.fromEntries(CLI.map((x) => [x.v, gerar((d) => encC[x.v][d] - atrC[x.v][d])]));
        const okT = somaPor(okC);
        def('entregue', { rotulo: 'Entregue', unidade: 't', melhor: 'maior', base: expTotal, dims: dimsExp, ignora: IGNORA_CULT });
        def('contratos', { rotulo: 'Contratos encerrados', unidade: 'contratos', base: encT, dims: { cliente: partes(encC, encT), cultura: partes(porCultura(encC), encT) }, ignora: IGNORA_CULT });
        def('atrasados', { rotulo: 'Encerrados com atraso', unidade: 'contratos', melhor: 'menor', base: atrT, dims: { cliente: partes(atrC, atrT), cultura: partes(porCultura(atrC), atrT) }, ignora: IGNORA_CULT });
        def('noPrazoN', { rotulo: 'No prazo', unidade: 'contratos', base: okT, dims: { cliente: partes(okC, okT), cultura: partes(porCultura(okC), okT) }, ignora: IGNORA_CULT });
        def('noPrazo', { rotulo: 'No prazo', unidade: '%', agreg: 'razao', num: 'noPrazoN', den: 'contratos', fator: 100, melhor: 'maior', limite: [0, 100] });
        def('ritmoContr', { rotulo: 'Ritmo médio', unidade: 't/dia', agreg: 'razao', num: 'entregue', den: 'dias', melhor: 'maior' });

        // retornos do porto: cargas expedidas que o terminal não recebeu como estavam
        const qual = gerar((d) => 1 + Math.max(0, eAB[d] - 3.5) * 0.6);
        const retC = Object.fromEntries(CULT.map((c, i) => [c, eventos((d) => expCamC[c][d] * 0.0028 * qual[d], 260 + i)]));
        const dpC = Object.fromEntries(CULT.map((c, i) => [c, eventos((d) => expCamC[c][d] * 0.0065 * qual[d], 270 + i)]));
        const retT = somaPor(retC);
        const dpT = somaPor(dpC);
        const custoC = Object.fromEntries(CULT.map((c, i) => [c, gerar((d) => retC[c][d] * (4200 + 1400 * u01(d, 280 + i)))]));
        const custoT = somaPor(custoC);
        const tdC = Object.fromEntries(CULT.map((c, i) => [c, gerar((d) => dpC[c][d] * (0.4 + 0.5 * u01(d, 290 + i)))]));
        const tdT = somaPor(tdC);
        def('retornos', { rotulo: 'Cargas retornadas', unidade: 'cargas', melhor: 'menor', base: retT, dims: { cultura: partes(retC, retT) } });
        def('descPorto', { rotulo: 'Aceitas com desconto', unidade: 'cargas', melhor: 'menor', base: dpT, dims: { cultura: partes(dpC, dpT) } });
        def('custoRetorno', { rotulo: 'Frete de retorno', unidade: 'R$', melhor: 'menor', base: custoT, dims: { cultura: partes(custoC, custoT) } });
        def('tDescPorto', { rotulo: 'Descontado no porto', unidade: 't', casas: 1, melhor: 'menor', base: tdT, dims: { cultura: partes(tdC, tdT) } });
        def('cargasPorRetorno', { rotulo: 'Cargas por retorno', unidade: 'cargas', agreg: 'razao', num: 'expCam', den: 'retornos', melhor: 'maior' });

        // ---- moegas e pulmões ----
        def('vazao', {
            rotulo: 'Vazão média', unidade: 't/h', agreg: 'media', peso: 'rec', melhor: 'maior',
            base: gerar((d) => (97 - 9 * carga[d]) / melhora(d) * (1 + 0.025 * ruidoDia(d, 9))),
            dims: { moega: somas({ m1: 14, m2: 12, m3: -5, m4: -6, m5: -6, m6: -8 }), cultura: somas({ milho: 0, sorgo: 3, trigo: 5, soja: 2 }) },
        });
        def('trocas', { rotulo: 'Trocas de cultura', unidade: 'trocas', melhor: 'menor', base: eventos((d) => (ativas[d] >= 2 ? 0.55 * (ativas[d] - 1) : 0.04), 71), dims: { moega: dMoega } });
        def('moegaParada', {
            rotulo: 'Moega parada', unidade: 'h', melhor: 'menor',
            base: gerar((d) => Math.max(0, perfilNoDia([30, 8, 6, 10, 24, 12, 6, 4, 3, 5, 16, 36], d) / CAL.dm[d] * 6 * melhora(d) * (1 + 0.3 * ruidoDia(d, 10)))),
            dims: { moega: cotas(MOEGAS, () => 1, 72, 0.3) },
        });
        const dPulmao = cotas(['p1', 'p2'], (i) => [0.52, 0.48][i], 401, 0.1);
        def('pulmaoEnt', { rotulo: 'Passou pelos pulmões', unidade: 't', melhor: 'maior', base: secado, dims: { pulmao: dPulmao } });
        def('perman', { rotulo: 'Permanência média', unidade: 'h', casas: 1, agreg: 'media', peso: 'pulmaoEnt', melhor: 'menor', base: gerar((d) => (4 + 9 * carga[d]) * (1 + 0.1 * ruidoDia(d, 402))), dims: { pulmao: somas({ p1: 0.4, p2: -0.4 }) } });
        def('pulmaoOcup', { rotulo: 'Ocupação média', unidade: '%', agreg: 'media', limite: [0, 100], base: gerar((d) => clamp((25 + 55 * Math.pow(carga[d], 0.8)) * (1 + 0.08 * ruidoDia(d, 403)), 3, 99)), dims: { pulmao: somas({ p1: 3, p2: -3 }) } });
        def('pulmaoCheio', { rotulo: 'Dias acima de 90%', unidade: 'dias', agreg: 'acima', de: 'pulmaoOcup', limiar: 90, melhor: 'menor' });

        // ---- silos e armazém ----
        const UNI = valoresDe('unidadeArm');
        const CAP_UNI = 2400;
        const OC_P = [58, 63, 76, 80, 72, 64, 70, 82, 91, 92, 81, 66];
        const ocupTot = gerar((d) => clamp(perfilNoDia(OC_P, d) * doAno([0.9, 0.94, 0.97, 1, 1.02], d) * (1 + 0.04 * ruidoDia(d, 13)), 5, 99));
        const oc = Object.fromEntries(UNI.map((u, i) => [u, gerar((d) => clamp(ocupTot[d] + 10 * ruido(i, 200) + 9 * Math.sin(2 * Math.PI * (CAL.doy[d] / 365 + i / 10)) + 3 * ruidoDia(d, 201 + i), 3, 100))]));
        const ocB = gerar((d) => UNI.reduce((s, u) => s + oc[u][d], 0) / UNI.length);
        const dOc = desvios(oc, ocB);
        def('ocup', { rotulo: 'Ocupação média', unidade: '%', agreg: 'media', limite: [0, 100], base: ocB, dims: { unidadeArm: dOc } });
        def('ocupPico', { rotulo: 'Pico de ocupação', unidade: '%', agreg: 'max', limite: [0, 100], base: ocB, dims: { unidadeArm: dOc } });
        def('ocupDias90', { rotulo: 'Dias acima de 90%', unidade: 'dias', agreg: 'acima', de: 'ocup', limiar: 90, melhor: 'menor' });
        const estB = gerar((d) => ocB[d] * UNI.length * CAP_UNI / 100);
        const estU = Object.fromEntries(UNI.map((u) => [u, gerar((d) => oc[u][d] * CAP_UNI / 100)]));
        def('estoque', { rotulo: 'Estoque', unidade: 't', agreg: 'ultimo', base: estB, dims: { unidadeArm: desvios(estU, estB) } });
        def('entradas', { rotulo: 'Entradas', unidade: 't', base: recTotal, dims: { unidadeArm: cotas(UNI, (i, d) => 1 + 0.6 * Math.sin(2 * Math.PI * (CAL.doy[d] / 365 + i / 10) + 1), 210, 0.3) } });
        def('saidas', { rotulo: 'Saídas', unidade: 't', base: expTotal, dims: { unidadeArm: cotas(UNI, (i, d) => 1 + 0.6 * Math.sin(2 * Math.PI * (CAL.doy[d] / 365 + i / 10) - 0.6), 211, 0.3) } });
        def('giro', { rotulo: 'Giro do estoque', unidade: '×', casas: 2, agreg: 'razao', num: 'saidas', denConst: (f) => (f.unidadeArm && f.unidadeArm !== '*' ? CAP_UNI : CAP_UNI * UNI.length), melhor: 'maior' });

        const amb30 = mediaMovel(temp, 30);
        const tm = Object.fromEntries(UNI.map((u, i) => [u, gerar((d) => 0.55 * amb30[d] + 0.45 * 27 + 1.5 * ruido(i, 220) + (oc[u][d] > 85 ? 0.8 : 0) + 0.6 * ruidoDia(d, 221 + i))]));
        const tmx = Object.fromEntries(UNI.map((u, i) => [u, gerar((d) => tm[u][d] + 3 + 3 * u01(d, 230 + i))]));
        const tmB = gerar((d) => UNI.reduce((s, u) => s + tm[u][d], 0) / UNI.length);
        const tmxB = gerar((d) => Math.max(...UNI.map((u) => tmx[u][d])));
        const focU = Object.fromEntries(UNI.map((u, i) => [u, eventos((d) => 0.002 + 0.012 * Math.max(0, tmx[u][d] - 29), 240 + i)]));
        const focT = somaPor(focU);
        const aerU = Object.fromEntries(UNI.map((u) => [u, gerar((d) => (oc[u][d] < 12 ? 0 : clamp((tm[u][d] - temp[d] + 2) * 1.4 * (ur[d] < 85 ? 1 : 0.3), 0, 16)))]));
        const aerT = somaPor(aerU);
        def('tempMassa', { rotulo: 'Temperatura média', unidade: '°C', casas: 1, agreg: 'media', melhor: 'menor', base: tmB, dims: { unidadeArm: desvios(tm, tmB) } });
        def('tempMax', { rotulo: 'Máxima registrada', unidade: '°C', casas: 1, agreg: 'max', melhor: 'menor', base: tmxB, dims: { unidadeArm: desvios(tmx, tmxB) } });
        def('tempMaxMed', { rotulo: 'Máxima média', unidade: '°C', casas: 1, agreg: 'media', melhor: 'menor', base: tmxB, dims: { unidadeArm: desvios(tmx, tmxB) } });
        def('focos', { rotulo: 'Focos quentes', unidade: 'focos', melhor: 'menor', base: focT, dims: { unidadeArm: partes(focU, focT) } });
        def('aeracao', { rotulo: 'Horas de aeração', unidade: 'h', base: aerT, dims: { unidadeArm: partes(aerU, aerT) } });

        def('diasParados', { rotulo: 'Recepção parada por chuva', unidade: 'dias', melhor: 'menor', base: gerar((d) => (chuva[d] > 18 && carga[d] > 0.25 ? 1 : 0)) });
    }

    gerarDados();

    // ---------- séries filtradas, cenários e agregação ----------
    const ZEROS = new Float64Array(NT);
    const cacheSerie = new Map();
    const cacheCen = new Map();

    function filtrosEfetivos(m, f) {
        const out = {};
        Object.keys(m.dims).forEach((dim) => {
            if (f[dim] && f[dim] !== '*') out[dim] = f[dim];
        });
        if (m.ignora) {
            Object.keys(m.ignora).forEach((dim) => {
                if (out[dim]) m.ignora[dim].forEach((outra) => { delete out[outra]; });
            });
        }
        return out;
    }

    const chaveDe = (fe) => Object.keys(fe).sort().map((k) => k + '=' + fe[k]).join('&');
    const valorDe = (x, d) => (typeof x === 'number' ? x : x[d]);

    function serie(m, f) {
        const fe = filtrosEfetivos(m, f || {});
        const k = m.id + '|' + chaveDe(fe);
        let s = cacheSerie.get(k);
        if (s) return s;
        const dims = Object.keys(fe);
        if (!dims.length) {
            s = m.base;
        } else {
            s = new Float64Array(NH);
            for (let d = 0; d < NH; d++) {
                let v = m.base[d];
                dims.forEach((dim) => {
                    const x = m.dims[dim][fe[dim]];
                    if (!x) return;
                    if (x.f !== undefined) v *= valorDe(x.f, d);
                    else v += valorDe(x.o, d);
                });
                s[d] = v;
            }
        }
        cacheSerie.set(k, s);
        return s;
    }

    // peso da média: a série de peso com os mesmos filtros (ou dia a dia, igual)
    function pesoDe(m, f, j) {
        if (!m.peso) return null;
        const ff = Object.assign({}, f);
        if (m.soCultura) {
            if (ff.cultura && ff.cultura !== '*' && ff.cultura !== m.soCultura) return ZEROS;
            ff.cultura = m.soCultura;
        }
        return j ? cenario(M[m.peso], ff, j) : serie(M[m.peso], ff);
    }

    // série até o fim do horizonte: real até NH-1 e, depois, o cenário j
    // (o mesmo dia j anos antes, no ritmo dos últimos 12 meses)
    function cenario(m, f, j) {
        const fe = filtrosEfetivos(m, f || {});
        const k = m.id + '|' + chaveDe(fe) + '|' + j;
        let out = cacheCen.get(k);
        if (out) return out;
        const h = serie(m, f);
        out = new Float64Array(NT);
        out.set(h);
        const w0 = NH - 365;
        let ajuste;
        const mult = m.agreg === 'soma';
        if (mult) {
            let a = 0;
            let b = 0;
            for (let d = w0; d < NH; d++) {
                a += h[d];
                const s = ANTES[j][d];
                if (s >= 0) b += h[s];
            }
            ajuste = b > 1e-9 ? clamp(a / b, 0.6, 1.6) : 1;
        } else {
            const p = pesoDe(m, f, 0);
            let a = 0;
            let wa = 0;
            let b = 0;
            let wb = 0;
            for (let d = w0; d < NH; d++) {
                const s = ANTES[j][d];
                const w = p ? p[d] : 1;
                a += h[d] * w;
                wa += w;
                if (s >= 0) {
                    const ws = p ? p[s] : 1;
                    b += h[s] * ws;
                    wb += ws;
                }
            }
            ajuste = wa > 1e-9 && wb > 1e-9 ? a / wa - b / wb : 0;
        }
        for (let d = NH; d < NT; d++) {
            const s = ANTES[j][d];
            const v = s >= 0 ? out[s] : 0;
            out[d] = mult ? v * ajuste : v + ajuste;
        }
        if (m.limite) for (let d = NH; d < NT; d++) out[d] = clamp(out[d], m.limite[0], m.limite[1]);
        cacheCen.set(k, out);
        return out;
    }

    function agregarJ(m, f, ini, fim, j) {
        ini = Math.max(0, ini);
        fim = Math.min(fim, j ? NT - 1 : NH - 1);
        if (fim < ini) return null;
        const S = (mm, ff) => (j ? cenario(mm, ff, j) : serie(mm, ff));
        switch (m.agreg) {
            case 'soma': {
                const s = S(m, f);
                let t = 0;
                for (let d = ini; d <= fim; d++) t += s[d];
                return t;
            }
            case 'media': {
                const s = S(m, f);
                const p = pesoDe(m, f, j);
                let a = 0;
                let b = 0;
                for (let d = ini; d <= fim; d++) {
                    const w = p ? p[d] : 1;
                    a += s[d] * w;
                    b += w;
                }
                return b > 1e-6 ? a / b : null;
            }
            case 'max': {
                const s = S(m, f);
                let x = -Infinity;
                for (let d = ini; d <= fim; d++) if (s[d] > x) x = s[d];
                return x;
            }
            case 'ultimo':
                return S(m, f)[fim];
            case 'acima': {
                const src = M[m.de];
                const s = S(src, f);
                const p = pesoDe(src, f, j);
                let n = 0;
                for (let d = ini; d <= fim; d++) if (s[d] > m.limiar && (!p || p[d] > 1e-6)) n++;
                return n;
            }
            case 'razao': {
                const fNum = Object.assign({}, f, m.fix || {});
                const fDen = Object.assign({}, f);
                if (m.fix) Object.keys(m.fix).forEach((k) => { delete fDen[k]; });
                const num = agregarJ(M[m.num], fNum, ini, fim, j);
                let den;
                if (m.den === 'dias') den = fim - ini + 1;
                else if (m.denConst) den = m.denConst(f);
                else den = agregarJ(M[m.den], fDen, ini, fim, j);
                if (num == null || !den) return null;
                const v = num / den * (m.fator || 1);
                // parte de um todo: projetadas em separado, as duas somas
                // podem dar mais de 100% (ou menos de 0)
                return m.limite ? clamp(v, m.limite[0], m.limite[1]) : v;
            }
            case 'dif': {
                const a = agregarJ(M[m.a], f, ini, fim, j);
                const b = agregarJ(M[m.b], f, ini, fim, j);
                return a == null || b == null ? null : a - b;
            }
            default:
                return null;
        }
    }

    function agregar(m, f, ini, fim) {
        return agregarJ(m, f, ini, Math.min(fim, NH - 1), 0);
    }

    // { c, lo, hi, proj }: real quando o trecho acaba antes de hoje; senão
    // a média dos 3 cenários, com a faixa do mais fraco ao mais forte
    function agregarP(m, f, ini, fim) {
        if (fim < NH) {
            const v = agregarJ(m, f, ini, fim, 0);
            return v == null ? null : { c: v, lo: v, hi: v, proj: false };
        }
        const vals = [1, 2, 3].map((j) => agregarJ(m, f, ini, fim, j)).filter((v) => v != null && isFinite(v));
        if (!vals.length) return null;
        const c = vals.reduce((s, v) => s + v, 0) / vals.length;
        // a faixa abre com a distância: nas somas em % do valor; nas médias
        // (umidade, PH, ocupação...) bem menos, o nível delas varia pouco
        const meses = (fim - (NH - 1)) / 30.4;
        const volume = m.agreg === 'soma' || m.agreg === 'acima' || m.agreg === 'dif' || (m.agreg === 'razao' && m.unidade !== '%');
        const e = Math.abs(c) * (volume ? 0.015 + 0.006 * meses : 0.002 + 0.0015 * meses);
        let lo = Math.min(...vals) - e;
        let hi = Math.max(...vals) + e;
        if (m.agreg !== 'dif') lo = Math.max(0, lo);
        if (m.limite) {
            lo = clamp(lo, m.limite[0], m.limite[1]);
            hi = clamp(hi, m.limite[0], m.limite[1]);
        }
        return { c, lo, hi, proj: true };
    }

    // ---------- períodos e agrupamento ----------
    const PERIODOS = [
        { v: '12m', n: '12 meses', meses: 12 },
        { v: '24m', n: '24 meses', meses: 24 },
        { v: '36m', n: '36 meses', meses: 36 },
        { v: 'tudo', n: 'Tudo', meses: KM_ULT + 1 },
        { v: 'custom', n: 'De / até' },
    ];
    const AGRUPAR = [{ v: 'semana', n: 'Semana' }, { v: 'mes', n: 'Mês' }, { v: 'trimestre', n: 'Trimestre' }, { v: 'ano', n: 'Ano' }];
    const PROJECOES = [{ v: 'off', n: 'Sem' }, { v: 'dez', n: 'Até dez/' + String(ULT.ano).slice(2) }, { v: '12m', n: '+12 meses' }];
    const COMPARAR = [{ v: 'ano', n: 'Ano anterior' }, { v: 'media', n: 'Média 3 anos' }, { v: 'tendencia', n: 'Tendência' }];

    const EST_KEY = 'videowall:est-filtros';
    const PADRAO = { periodo: 'tudo', de: KM_ULT - 23, ate: KM_ULT, agrupar: 'mes', projecao: 'dez', comparar: 'ano', modo: 'linha', telas: {} };

    function carregarEstado() {
        let s = null;
        try {
            s = JSON.parse(localStorage.getItem(EST_KEY));
        } catch (err) {
            s = null;
        }
        const e = Object.assign({}, PADRAO, s && typeof s === 'object' ? s : {});
        if (!PERIODOS.some((x) => x.v === e.periodo)) e.periodo = PADRAO.periodo;
        if (!AGRUPAR.some((x) => x.v === e.agrupar)) e.agrupar = PADRAO.agrupar;
        if (!PROJECOES.some((x) => x.v === e.projecao)) e.projecao = PADRAO.projecao;
        if (!COMPARAR.some((x) => x.v === e.comparar)) e.comparar = PADRAO.comparar;
        if (e.modo !== 'anos') e.modo = 'linha';
        e.de = clamp(Math.round(Number(e.de)) || 0, 0, KM_ULT);
        e.ate = clamp(Math.round(Number(e.ate)) || KM_ULT, 0, KM_ULT);
        if (!e.telas || typeof e.telas !== 'object') e.telas = {};
        return e;
    }

    const ESTADO = carregarEstado();

    function gravarEstado() {
        try {
            localStorage.setItem(EST_KEY, JSON.stringify(ESTADO));
        } catch (err) {
            // sem armazenamento: vale só para esta visita
        }
    }

    function periodo() {
        const e = ESTADO;
        let kmIni;
        let kmFim = KM_ULT;
        if (e.periodo === 'custom') {
            kmIni = Math.min(e.de, e.ate);
            kmFim = Math.max(e.de, e.ate);
        } else {
            kmIni = Math.max(0, KM_ULT - PERIODOS.find((x) => x.v === e.periodo).meses + 1);
        }
        if (e.agrupar === 'trimestre') kmIni -= kmIni % 3;
        if (e.agrupar === 'ano') kmIni -= kmIni % 12;
        const ini = iniMes(kmIni);
        const fim = fimMes(kmFim);
        const comProj = e.projecao !== 'off' && kmFim === KM_ULT;
        let fimProj = fim;
        if (comProj) fimProj = e.projecao === 'dez' ? diaDe(ULT.ano, 11, 31) : NT - 1;
        return { ini, fim, fimProj, comProj, kmIni, kmFim, meses: kmFim - kmIni + 1, rot: rotMes(kmIni) + '–' + rotMes(kmFim) };
    }

    function chaveBucket(g, d) {
        if (g === 'semana') return Math.floor((d + 5) / 7);      // semanas de segunda a domingo
        if (g === 'mes') return CAL.km[d];
        if (g === 'trimestre') return (CAL.ano[d] - ANO0) * 4 + Math.floor(CAL.mes[d] / 3);
        return CAL.ano[d];
    }

    const TRI = ['1º tri', '2º tri', '3º tri', '4º tri'];

    function buckets(g, ini, fim) {
        const out = [];
        let cur = null;
        for (let d = ini; d <= fim; d++) {
            const k = chaveBucket(g, d);
            if (!cur || cur.k !== k) {
                cur = { k, ini: d, fim: d };
                out.push(cur);
            } else {
                cur.fim = d;
            }
        }
        out.forEach((b) => {
            const a = CAL.ano[b.ini];
            const m = CAL.mes[b.ini];
            b.ano = a;
            b.proj = b.fim >= NH;
            b.misto = b.proj && b.ini < NH;
            b.inicioAno = false;
            if (g === 'semana') {
                // a semana que tem o dia 1 leva o nome do mês no eixo
                const dia1 = CAL.dia[b.ini] === 1 ? b.ini : (CAL.mes[b.fim] !== m ? b.fim - CAL.dia[b.fim] + 1 : -1);
                b.rot = 'semana de ' + rotDia(b.ini);
                b.marca = dia1 >= 0;
                b.kmEixo = dia1 >= 0 ? CAL.km[dia1] : CAL.km[b.ini];
                b.curto = dia1 >= 0 ? MESES[CAL.mes[dia1]] : '';
                b.pos = Math.min(52, Math.floor(CAL.doy[b.ini] / 7));
            } else if (g === 'mes') {
                b.rot = rotMes(CAL.km[b.ini]);
                b.curto = MESES[m];
                b.pos = m;
                b.marca = true;
            } else if (g === 'trimestre') {
                b.rot = TRI[Math.floor(m / 3)] + '/' + String(a).slice(2);
                b.curto = TRI[Math.floor(m / 3)];
                b.pos = Math.floor(m / 3);
                b.marca = true;
            } else {
                const parcial = b.fim < diaDe(a, 11, 31) && !b.proj;
                b.rot = String(a) + (parcial ? ' (até ' + rotDia(b.fim) + ')' : '');
                b.curto = String(a);
                b.pos = 0;
                b.marca = true;
            }
        });
        out.forEach((b, i) => { b.inicioAno = i === 0 || out[i - 1].ano !== b.ano; });
        return out;
    }

    // ---------- números ----------
    function fmt(v, casas) {
        if (v == null || !isFinite(v)) return '—';
        return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    }

    // "1 dia", "2 dias"
    function unidadeDe(m, v) {
        if (m.unidade === 'dias' && v != null && Math.abs(Math.round(v)) === 1) return 'dia';
        return m.unidade;
    }

    function fmtM(m, v, casas) {
        const c = casas == null ? m.casas : casas;
        if (m.unidade === 'R$') return 'R$ ' + fmt(v, c);
        const u = unidadeDe(m, v);
        return fmt(v, c) + (u ? ' ' + u : '');
    }

    function valorHtml(m, v) {
        if (m.unidade === 'R$') return `<span class="kpi-value-unit">R$</span> ${fmt(v, m.casas)}`;
        return `${fmt(v, m.casas)} <span class="kpi-value-unit">${unidadeDe(m, v)}</span>`;
    }

    function abrev(v, passo) {
        const a = Math.abs(v);
        if (a >= 1e6) return fmt(v / 1e6, passo >= 1e6 ? 0 : 1) + ' mi';
        if (a >= 1e4 || (a >= 1000 && passo >= 1000)) return fmt(v / 1000, passo >= 1000 ? 0 : 1) + ' mil';
        if (a >= 1000) return fmt(v / 1000, 1) + ' mil';
        return fmt(v, passo < 1 ? (passo < 0.1 ? 2 : 1) : 0);
    }

    function faixaTxt(m, r) {
        if (!r || !r.proj) return '';
        if (m.unidade === 'R$') return 'R$ ' + abrev(r.lo, 1000) + ' a ' + abrev(r.hi, 1000);
        const big = Math.abs(r.hi) >= 10000;
        const f = (v) => (big ? abrev(v, 1000) : fmt(v, m.casas));
        const u = unidadeDe(m, Math.max(Math.abs(r.lo), Math.abs(r.hi)) < 1.5 ? 1 : 2);
        return f(r.lo) + ' a ' + f(r.hi) + (u ? ' ' + u : '');
    }

    // a faixa sem a unidade, para a célula de tabela (a unidade já está no
    // cabeçalho da coluna): "134 a 145 mil", "13 a 14"
    function faixaCurta(m, r) {
        if (!r || !r.proj) return '';
        const topo = Math.max(Math.abs(r.lo), Math.abs(r.hi));
        if (topo >= 1e6) return fmt(r.lo / 1e6, 1) + ' a ' + fmt(r.hi / 1e6, 1) + ' mi';
        if (topo >= 10000) return fmt(r.lo / 1000, 0) + ' a ' + fmt(r.hi / 1000, 0) + ' mil';
        return fmt(r.lo, m.casas) + ' a ' + fmt(r.hi, m.casas);
    }

    // variação: % nas somas, diferença nas médias (p.p. quando é %)
    function delta(m, atual, ref) {
        if (atual == null || ref == null || !isFinite(atual) || !isFinite(ref)) return null;
        const porcento = m.agreg === 'soma' || (m.agreg === 'razao' && m.unidade !== '%' && m.unidade !== '×');
        if (porcento && Math.abs(ref) < 1e-9) return { txt: atual ? 'sem base' : 'estável', classe: 'is-neutro', seta: '' };
        const diff = porcento ? (atual - ref) / Math.abs(ref) * 100 : atual - ref;
        const casas = porcento ? 1 : m.casas;
        if (Math.abs(diff) < 0.5 * 10 ** -casas) return { txt: 'estável', classe: 'is-neutro', seta: '=' };
        let unidade = porcento ? '%' : (m.unidade === '%' ? ' p.p.' : ' ' + unidadeDe(m, diff));
        if (!porcento && m.unidade === 'R$') unidade = '';
        const subiu = diff > 0;
        const classe = !m.melhor ? 'is-neutro' : (subiu === (m.melhor === 'maior') ? 'is-bom' : 'is-ruim');
        return { txt: (m.unidade === 'R$' && !porcento ? 'R$ ' : '') + fmt(Math.abs(diff), casas) + unidade, classe, seta: subiu ? '▲' : '▼' };
    }

    function deltaHtml(dl, sufixo) {
        if (!dl) return `<span class="est-delta is-neutro"><span>${sufixo || ''}</span></span>`;
        return `<span class="est-delta ${dl.classe}"><b>${dl.seta} ${dl.txt}</b>${sufixo ? ' <span>' + sufixo + '</span>' : ''}</span>`;
    }

    // o mesmo trecho deslocado j anos (null se cai antes da base)
    function deslocado(m, f, ini, fim, j) {
        const a = ANTES[j][ini];
        const b = ANTES[j][Math.min(fim, NT - 1)];
        if (a < 0 || b < 0) return null;
        return agregar(m, f, a, b);
    }

    function referencia(m, f, ini, fim, modo) {
        if (modo === 'media') {
            const vals = [1, 2, 3].map((j) => deslocado(m, f, ini, fim, j)).filter((v) => v != null);
            return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
        }
        return deslocado(m, f, ini, fim, 1);
    }

    const rotuloComparacao = (modo) => ({ ano: 'mesmo período, ano anterior', media: 'média dos 3 anos anteriores', tendencia: 'tendência do período' }[modo]);

    // rodapé do KPI: contra o ano anterior / a média, ou a tendência por ano
    function rodapeKpi(m, f, P, valor) {
        let modo = ESTADO.comparar;
        if (modo === 'tendencia' && P.meses < 24) modo = 'ano';
        if (modo !== 'tendencia') {
            const ref = referencia(m, f, P.ini, P.fim, modo);
            if (ref != null) return deltaHtml(delta(m, valor, ref), modo === 'media' ? 'vs média de 3 anos' : 'vs ano anterior');
            modo = 'tendencia';
        }
        if (P.meses < 24) return deltaHtml(null, 'sem histórico para comparar');
        const v1 = agregar(m, f, iniMes(P.kmIni), fimMes(P.kmIni + 11));
        const v2 = agregar(m, f, iniMes(P.kmFim - 11), fimMes(P.kmFim));
        const anos = (P.meses - 12) / 12;
        if (v1 == null || v2 == null) return deltaHtml(null, '');
        const porcento = m.agreg === 'soma' || (m.agreg === 'razao' && m.unidade !== '%' && m.unidade !== '×');
        let alvo = v2;
        if (porcento && v1 > 0) alvo = v1 * (1 + ((v2 / v1) ** (1 / anos) - 1));
        else if (!porcento) alvo = v1 + (v2 - v1) / anos;
        const dl = delta(m, alvo, v1);
        return deltaHtml(dl, 'por ano · tendência');
    }

    // ---------- telas ----------
    const PILHA_MAX = 8;   // as 8 cores da paleta; acima disso, as 5 maiores + "demais"

    const EST_TELAS = [
        { id: 'est-geral', tipo: 'painel', codigo: 'AVR-E0A' },
        { id: 'est-projecao', tipo: 'projecao', codigo: 'AVR-E0B', tempo: false, dims: [] },

        // Cada tela tem a grade que mostra melhor o seu dado (ver "blocos das
        // telas"). Sem "grade", vale a GRADE_PADRAO: a = bloco grande à
        // esquerda, d = embaixo dele, b = alto à direita, c = direita embaixo.
        // Quando nenhum bloco atravessa as colunas, cada coluna vira uma pilha
        // (ver colunasDe): as linhas da grade dão o peso de cada bloco, menos o
        // da tabela do recorte, que fica do tamanho das suas linhas.

        // ---- recepção ----
        {
            // volume: linha do tempo, a mistura das culturas ano a ano e o mapa
            // ano × mês (a safra de cada ano lado a lado)
            id: 'est-recepcao', codigo: 'AVR-E1A', dims: ['cultura', 'tag', 'turno'],
            kpis: [
                { metrica: 'rec' }, { metrica: 'cam' }, { metrica: 'recTagPct', rotulo: 'Cadastro com tag' }, { metrica: 'rec', modo: 'pico' },
            ],
            seletor: [
                { v: 't', n: 'Toneladas', grafico: { tipo: 'barras', metrica: 'rec', pilha: 'cultura', titulo: 'Recebido por período' } },
                { v: 'cam', n: 'Caminhões', grafico: { tipo: 'barras', metrica: 'cam', pilha: 'cultura', titulo: 'Caminhões recebidos' } },
                { v: 'tag', n: 'Com tag', grafico: { tipo: 'linha', metrica: 'recTagPct', titulo: 'Recebido com tag', escala: { min: 0, max: 100, passo: 25 } } },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'composicao', metrica: 'rec', dim: 'cultura', modo: 'pct', titulo: 'Mistura de culturas por ano' },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'rec', barra: true }, { metrica: 'cam' }, { metrica: 'recTagPct', rotulo: 'Com tag' }, { metrica: 'espera', rotulo: 'Espera' }] },
                { area: 'd', tipo: 'mapa', modo: 'anoMes', metrica: 'rec', titulo: 'Recebido por mês e ano' },
            ],
        },
        {
            // fila: o dia a dia importa (picos e dias ruins), então um calendário
            id: 'est-rec-fila', codigo: 'AVR-E1B', dims: ['cultura', 'turno', 'tag'],
            kpis: [{ metrica: 'espera' }, { metrica: 'filaMedia' }, { metrica: 'filaPico' }, { metrica: 'diasEspera20', rotulo: 'Dias com espera > 20 min' }],
            seletor: [
                { v: 'espera', n: 'Espera', grafico: { tipo: 'linha', metrica: 'espera', titulo: 'Espera média', refs: [{ valor: 20, rotulo: 'limite 20 min' }] } },
                { v: 'fila', n: 'Fila', grafico: { tipo: 'linha', titulo: 'Fila de caminhões', series: [{ metrica: 'filaPico', nome: 'Pico do período', cor: 'var(--est-c2)' }, { metrica: 'filaMedia', nome: 'Fila média', cor: 'var(--est-c1)' }] } },
                { v: 'turno', n: 'Espera por turno', grafico: { tipo: 'linha', metrica: 'espera', pilha: 'turno', titulo: 'Espera média por turno' } },
            ],
            grade: { areas: ['a b', 'a c', 'd c'], cols: '1.55fr 1fr', rows: '0.85fr 0.45fr 1.1fr' },
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'turno', colunas: [{ metrica: 'espera', barra: true }, { metrica: 'filaMedia' }, { metrica: 'filaPico' }, { metrica: 'rec' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'espera', rotulo: 'Espera', barra: true }, { metrica: 'filaMedia', rotulo: 'Fila média' }, { metrica: 'filaPico', rotulo: 'Pico' }, { metrica: 'diasEspera20', rotulo: 'Dias > 20 min' }] },
                { area: 'd', tipo: 'calendario', metrica: 'espera', limiar: 20, rotuloLimiar: 'espera acima de 20 min', titulo: 'Espera média, dia a dia' },
            ],
        },
        {
            // ciclo: a soma das etapas, então barras empilhadas e a composição de cada ano
            id: 'est-rec-ciclo', codigo: 'AVR-E1C', dims: ['etapaRec', 'cultura', 'turno'],
            kpis: [
                { metrica: 'ciclo' }, { metrica: 'ciclo', modo: 'topDim', dim: 'etapaRec', rotulo: 'Etapa mais longa' },
                { metrica: 'ciclo', fix: { etapaRec: 'desc' }, rotulo: 'Descarga média' }, { metrica: 'diasCiclo60', rotulo: 'Dias com ciclo > 60 min' },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', grafico: { tipo: 'barras', metrica: 'ciclo', pilha: 'etapaRec', titulo: 'Tempo de ciclo por etapa' } },
                { area: 'b', tipo: 'recorte', dim: 'etapaRec', colunas: [{ metrica: 'ciclo', rotulo: 'Tempo médio', barra: true }, { share: true, rotulo: 'Do ciclo' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'ciclo', rotulo: 'Ciclo', barra: true }, { metrica: 'ciclo', fix: { etapaRec: 'fila' }, rotulo: 'Fila' }, { metrica: 'ciclo', fix: { etapaRec: 'desc' }, rotulo: 'Descarga' }, { metrica: 'diasCiclo60', rotulo: 'Dias > 60 min' }] },
                { area: 'd', tipo: 'composicao', metrica: 'ciclo', dim: 'etapaRec', modo: 'abs', titulo: 'Ciclo de cada ano, por etapa' },
            ],
        },
        {
            // retornos: poucos e caros; o que pesa é o gasto acumulado no ano
            id: 'est-rec-porto', codigo: 'AVR-E1D', dims: ['cultura'],
            kpis: [{ metrica: 'retornos' }, { metrica: 'descPorto' }, { metrica: 'custoRetorno' }, { metrica: 'cargasPorRetorno', rotulo: 'Uma volta a cada' }],
            kpiProj: 'custoRetorno',
            seletor: [
                { v: 'ret', n: 'Retornadas', grafico: { tipo: 'barras', metrica: 'retornos', pilha: 'cultura', titulo: 'Cargas retornadas do porto' } },
                { v: 'desc', n: 'Com desconto', grafico: { tipo: 'barras', metrica: 'descPorto', pilha: 'cultura', titulo: 'Cargas aceitas com desconto' } },
                { v: 'custo', n: 'Frete de retorno', grafico: { tipo: 'barras', metrica: 'custoRetorno', pilha: 'cultura', titulo: 'Gasto com frete de retorno' } },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'cultura', colunas: [{ metrica: 'retornos', rotulo: 'Retornadas', barra: true }, { metrica: 'descPorto', rotulo: 'Com desconto' }, { metrica: 'custoRetorno', rotulo: 'Frete' }, { metrica: 'tDescPorto', rotulo: 'Descontado' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'retornos', rotulo: 'Retornadas', barra: true }, { metrica: 'descPorto', rotulo: 'Com desconto' }, { metrica: 'custoRetorno', rotulo: 'Frete' }, { metrica: 'tDescPorto', rotulo: 'Descontado' }] },
                { area: 'd', tipo: 'acumulado', metrica: 'custoRetorno', titulo: 'Frete de retorno acumulado no ano' },
            ],
        },

        // ---- classificação ----
        {
            // qualidade: cada cultura no seu gráfico (as linhas se cruzam juntas)
            // e o mapa ano × mês mostra a umidade de cada safra
            id: 'est-classificacao', codigo: 'AVR-E2A', dims: ['cultura', 'cooperado'],
            kpis: [{ metrica: 'umidade' }, { metrica: 'impureza' }, { metrica: 'avariados' }, { metrica: 'foraPadrao', rotulo: 'Cargas fora do padrão' }],
            seletor: [
                { v: 'umid', n: 'Umidade', grafico: { tipo: 'linha', metrica: 'umidade', titulo: 'Umidade média na chegada', refs: [{ valor: 14, rotulo: 'base 14%' }] } },
                { v: 'imp', n: 'Impureza', grafico: { tipo: 'linha', metrica: 'impureza', titulo: 'Impureza média', refs: [{ valor: 1, rotulo: 'máx. 1%' }] } },
                { v: 'avar', n: 'Avariados', grafico: { tipo: 'linha', metrica: 'avariados', titulo: 'Total de avariados', refs: [{ valor: 6, rotulo: 'máx. 6%' }] } },
                { v: 'fora', n: 'Fora do padrão', grafico: { tipo: 'linha', metrica: 'foraPadrao', titulo: 'Cargas fora do padrão' } },
            ],
            blocos: [
                { area: 'a', tipo: 'multiplos', porDim: 'cultura', seletor: true, colunas: 2 },
                { area: 'b', tipo: 'recorte', dim: 'cultura', colunas: [{ metrica: 'cam', rotulo: 'Cargas', barra: true }, { metrica: 'umidade', rotulo: 'Umid.' }, { metrica: 'impureza', rotulo: 'Imp.' }, { metrica: 'avariados', rotulo: 'Avar.' }, { metrica: 'foraPadrao', rotulo: 'Fora' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'umidade', rotulo: 'Umidade' }, { metrica: 'impureza', rotulo: 'Impureza' }, { metrica: 'avariados', rotulo: 'Avariados' }, { metrica: 'descontado', rotulo: 'Descontado', barra: true }] },
                { area: 'd', tipo: 'mapa', modo: 'anoMes', seletor: true },
            ],
        },
        {
            // trigo: só chega de ago a nov, então a leitura é por safra (tipo × ano)
            id: 'est-cla-trigo', codigo: 'AVR-E2B', dims: ['tipoTrigo'],
            kpis: [{ metrica: 'trigoCargas' }, { metrica: 'superiorPct' }, { metrica: 'ph' }, { metrica: 'fn' }],
            seletor: [
                { v: 'ph', n: 'PH', grafico: { metrica: 'ph', titulo: 'PH médio por tipo e safra' } },
                { v: 'fn', n: 'Falling number', grafico: { metrica: 'fn', titulo: 'Falling number por tipo e safra' } },
                { v: 'germ', n: 'Germinado', grafico: { metrica: 'germinado', titulo: 'Germinado por tipo e safra' } },
                { v: 'cargas', n: 'Cargas', grafico: { metrica: 'trigoCargas', titulo: 'Cargas por tipo e safra' } },
            ],
            blocos: [
                { area: 'a', tipo: 'mapa', modo: 'dimAno', dim: 'tipoTrigo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'tipoTrigo', colunas: [{ metrica: 'trigoCargas', rotulo: 'Cargas', barra: true }, { share: true, rotulo: 'Do total' }, { metrica: 'ph', rotulo: 'PH' }, { metrica: 'fn', rotulo: 'FN' }, { metrica: 'germinado', rotulo: 'Germ.' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'trigoCargas', rotulo: 'Cargas', barra: true }, { metrica: 'superiorPct', rotulo: 'Superior' }, { metrica: 'ph', rotulo: 'PH' }, { metrica: 'fn', rotulo: 'FN' }, { metrica: 'germinado', rotulo: 'Germ.' }] },
                { area: 'd', tipo: 'composicao', metrica: 'trigoCargas', dim: 'tipoTrigo', modo: 'pct', titulo: 'Cargas de cada safra por tipo' },
            ],
            nota: 'O trigo chega de ago a nov: cada coluna do mapa é a safra do ano.',
        },
        {
            // pré-limpeza: pesado × descontado e a diferença acima/abaixo de zero
            id: 'est-cla-prelimpeza', codigo: 'AVR-E2C', dims: ['prelimpeza', 'cultura'],
            kpis: [{ metrica: 'plPesado' }, { metrica: 'plDesc' }, { metrica: 'plDif', rotulo: 'Diferença da conciliação' }, { metrica: 'descontado' }],
            kpiProj: 'plPesado',
            grade: { areas: ['a b', 'a c', 'd c'], cols: '1.55fr 1fr', rows: '0.8fr 0.5fr 1fr' },
            blocos: [
                { area: 'a', tipo: 'tempo', grafico: { tipo: 'linha', titulo: 'Conciliação da pré-limpeza', series: [{ metrica: 'plPesado', nome: 'Pesado na caçamba', cor: 'var(--est-c1)' }, { metrica: 'plDesc', nome: 'Descontado do cooperado', cor: 'var(--est-c2)' }] } },
                { area: 'b', tipo: 'recorte', dim: 'prelimpeza', colunas: [{ metrica: 'plPesado', rotulo: 'Pesado', barra: true }, { metrica: 'plDif', rotulo: 'Diferença' }, { metrica: 'plCacambas', rotulo: 'Caçambas' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'plPesado', rotulo: 'Pesado', barra: true }, { metrica: 'plDesc', rotulo: 'Descontado' }, { metrica: 'plDif', rotulo: 'Diferença' }, { metrica: 'descontado', rotulo: 'Desconto total' }] },
                { area: 'd', tipo: 'tempo', grafico: { tipo: 'barras', metrica: 'plDif', titulo: 'Diferença: pesado − descontado', divergente: [{ rotulo: 'pesou mais do que descontou', cor: 'var(--est-c1)' }, { rotulo: 'pesou menos', cor: 'var(--est-c2)' }] } },
            ],
        },
        {
            // cooperados: ranking, volume × qualidade e quem cresceu ano a ano
            id: 'est-cla-cooperados', codigo: 'AVR-E2D', dims: ['cooperado', 'cultura'],
            kpis: [
                { metrica: 'rec', rotulo: 'Entregue' }, { metrica: 'rec', modo: 'contagem', dim: 'cooperado', rotulo: 'Cooperados que entregaram' },
                { metrica: 'rec', modo: 'concentracao', dim: 'cooperado', rotulo: 'Os 5 maiores entregaram' }, { metrica: 'foraPadrao', rotulo: 'Cargas fora do padrão' },
            ],
            grade: { areas: ['r d', 'r m'], cols: '1fr 1.15fr', rows: '1fr 1fr' },
            blocos: [
                { area: 'r', tipo: 'recorte', dim: 'cooperado', ordenar: true, titulo: 'Ranking de cooperados', colunas: [{ metrica: 'rec', rotulo: 'Entregue', barra: true }, { share: true, rotulo: 'Part.' }, { metrica: 'umidade', rotulo: 'Umid.' }, { metrica: 'avariados', rotulo: 'Avar.' }, { metrica: 'foraPadrao', rotulo: 'Fora' }] },
                { area: 'd', tipo: 'dispersao', por: 'dim', dim: 'cooperado', x: 'rec', y: 'foraPadrao', titulo: 'Volume entregue × cargas fora do padrão' },
                { area: 'm', tipo: 'mapa', modo: 'dimAno', dim: 'cooperado', metrica: 'rec', titulo: 'Entregue por cooperado e ano' },
            ],
        },

        // ---- moegas ----
        {
            // seis moegas: o mapa moega × período compara todas de uma vez
            id: 'est-moegas', codigo: 'AVR-E3A', dims: ['moega', 'cultura'],
            kpis: [{ metrica: 'rec', rotulo: 'Descarregado' }, { metrica: 'cam', rotulo: 'Cargas' }, { metrica: 'vazao' }, { metrica: 'trocas' }],
            seletor: [
                { v: 't', n: 'Toneladas', grafico: { tipo: 'barras', metrica: 'rec', pilha: 'moega', titulo: 'Descarregado por moega' } },
                { v: 'vazao', n: 'Vazão', grafico: { tipo: 'linha', metrica: 'vazao', pilha: 'moega', titulo: 'Vazão média de descarga', refs: [{ valor: 95, rotulo: 'meta 95 t/h' }] } },
                { v: 'trocas', n: 'Trocas de cultura', grafico: { tipo: 'barras', metrica: 'trocas', pilha: 'moega', titulo: 'Trocas de cultura' } },
                { v: 'parada', n: 'Horas paradas', grafico: { tipo: 'barras', metrica: 'moegaParada', pilha: 'moega', titulo: 'Moega parada' } },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'moega', colunas: [{ metrica: 'rec', rotulo: 'Toneladas', barra: true }, { metrica: 'cam', rotulo: 'Cargas' }, { metrica: 'vazao', rotulo: 'Vazão' }, { metrica: 'trocas', rotulo: 'Trocas' }, { metrica: 'moegaParada', rotulo: 'Parada' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'rec', rotulo: 'Toneladas', barra: true }, { metrica: 'vazao', rotulo: 'Vazão' }, { metrica: 'trocas', rotulo: 'Trocas' }, { metrica: 'moegaParada', rotulo: 'Parada' }] },
                { area: 'd', tipo: 'mapa', modo: 'dim', dim: 'moega', seletor: true },
            ],
        },
        {
            id: 'est-moe-pulmao', codigo: 'AVR-E3B', dims: ['pulmao'],
            kpis: [{ metrica: 'pulmaoEnt' }, { metrica: 'perman' }, { metrica: 'pulmaoOcup' }, { metrica: 'pulmaoCheio' }],
            seletor: [
                { v: 't', n: 'Volume', grafico: { tipo: 'barras', metrica: 'pulmaoEnt', pilha: 'pulmao', titulo: 'Trânsito para a secagem' } },
                { v: 'perm', n: 'Permanência', grafico: { tipo: 'linha', metrica: 'perman', pilha: 'pulmao', titulo: 'Permanência média no pulmão' } },
                { v: 'ocup', n: 'Ocupação', grafico: { tipo: 'linha', metrica: 'pulmaoOcup', pilha: 'pulmao', titulo: 'Ocupação média', escala: { min: 0, max: 100, passo: 25 }, refs: [{ valor: 90, rotulo: 'limite 90%' }] } },
            ],
            grade: { areas: ['a b', 'a c', 'd c'], cols: '1.55fr 1fr', rows: '0.9fr 0.4fr 1fr' },
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'pulmao', colunas: [{ metrica: 'pulmaoEnt', rotulo: 'Volume', barra: true }, { metrica: 'perman', rotulo: 'Perman.' }, { metrica: 'pulmaoOcup', rotulo: 'Ocup.' }, { metrica: 'pulmaoCheio', rotulo: 'Dias > 90%' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'pulmaoEnt', rotulo: 'Volume', barra: true }, { metrica: 'perman', rotulo: 'Permanência' }, { metrica: 'pulmaoOcup', rotulo: 'Ocupação' }, { metrica: 'pulmaoCheio', rotulo: 'Dias > 90%' }] },
                { area: 'd', tipo: 'calendario', metrica: 'pulmaoOcup', limiar: 90, rotuloLimiar: 'acima de 90%', titulo: 'Ocupação dos pulmões, dia a dia' },
            ],
        },

        // ---- secagem ----
        {
            // secado: volume no tempo e a relação ritmo × umidade (grão úmido seca devagar)
            id: 'est-secagem', codigo: 'AVR-E4A', dims: ['secador', 'cultura', 'turno'],
            kpis: [{ metrica: 'secado' }, { metrica: 'ritmo' }, { metrica: 'horasSec' }, { metrica: 'secado', modo: 'pico' }],
            seletor: [
                { v: 't', n: 'Toneladas', grafico: { tipo: 'barras', metrica: 'secado', pilha: 'cultura', titulo: 'Secado por período' } },
                { v: 'sec', n: 'Por secador', grafico: { tipo: 'barras', metrica: 'secado', pilha: 'secador', titulo: 'Secado por secador' } },
                { v: 'ritmo', n: 'Ritmo', grafico: { tipo: 'linha', metrica: 'ritmo', pilha: 'secador', titulo: 'Ritmo médio por secador' } },
            ],
            // a dispersão leva quase metade da coluna: com menos altura os pontos se amontoam
            grade: { areas: ['a b', 'a c', 'd c'], cols: '1.55fr 1fr', rows: '0.8fr 0.5fr 1.2fr' },
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'secador', colunas: [{ metrica: 'secado', rotulo: 'Secado', barra: true }, { metrica: 'ritmo', rotulo: 'Ritmo' }, { metrica: 'horasSec', rotulo: 'Horas' }, { metrica: 'cavacoKgM3', rotulo: 'Cavaco/m³' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'secado', rotulo: 'Secado', barra: true }, { metrica: 'ritmo', rotulo: 'Ritmo' }, { metrica: 'horasSec', rotulo: 'Horas' }, { metrica: 'cavacoT', rotulo: 'Cavaco' }] },
                { area: 'd', tipo: 'dispersao', por: 'mes', x: 'umidEnt', y: 'ritmo', minimo: { metrica: 'secado', valor: 1500 }, xLeitura: 'p.p. de umidade', yLeitura: 'o ritmo', titulo: 'Ritmo × umidade de entrada, mês a mês' },
            ],
        },
        {
            // temperatura e umidade: quatro indicadores, cada um no seu gráfico
            id: 'est-sec-temperatura', codigo: 'AVR-E4B', dims: ['secador', 'cultura'],
            kpis: [{ metrica: 'umidEnt' }, { metrica: 'umidSai' }, { metrica: 'tempAr' }, { metrica: 'foraFaixa' }],
            grade: { areas: ['m b', 'm c'], cols: '1.55fr 1fr', rows: '0.7fr 1.3fr' },
            blocos: [
                {
                    area: 'm', tipo: 'multiplos', colunas: 2, titulo: 'Indicadores dos secadores',
                    itens: [
                        { nome: 'Umidade do grão (%)', series: [{ metrica: 'umidEnt', nome: 'entrada', cor: 'var(--est-c2)' }, { metrica: 'umidSai', nome: 'saída', cor: 'var(--est-c1)' }] },
                        { metrica: 'tempAr', nome: 'Temperatura do ar (°C)' },
                        { metrica: 'arSaida', nome: 'Ar de saída (°C)', refs: [{ valor: 50, rotulo: 'limite 50 °C' }] },
                        { metrica: 'foraFaixa', nome: 'Tempo fora da faixa (%)' },
                    ],
                },
                { area: 'b', tipo: 'recorte', dim: 'secador', colunas: [{ metrica: 'umidEnt', rotulo: 'Entrada' }, { metrica: 'umidSai', rotulo: 'Saída' }, { metrica: 'tempAr', rotulo: 'Ar' }, { metrica: 'arSaida', rotulo: 'Saída ar' }, { metrica: 'foraFaixa', rotulo: 'Fora', barra: true }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'umidEnt', rotulo: 'Entrada' }, { metrica: 'umidSai', rotulo: 'Saída' }, { metrica: 'pontos', rotulo: 'Pontos' }, { metrica: 'tempAr', rotulo: 'Ar' }, { metrica: 'foraFaixa', rotulo: 'Fora', barra: true }] },
            ],
        },
        {
            id: 'est-sec-cavaco', codigo: 'AVR-E4C', dims: ['secador'],
            kpis: [{ metrica: 'cavacoT' }, { metrica: 'cavacoRec' }, { metrica: 'cavacoKgM3' }, { metrica: 'cavacoEst', rotulo: 'Estoque no pátio' }],
            blocos: [
                { area: 'a', tipo: 'tempo', grafico: { tipo: 'linha', titulo: 'Cavaco consumido e recebido', series: [{ metrica: 'cavacoT', nome: 'Consumido', cor: 'var(--est-c2)' }, { metrica: 'cavacoRec', nome: 'Recebido', cor: 'var(--est-c1)' }] } },
                { area: 'b', tipo: 'recorte', dim: 'secador', colunas: [{ metrica: 'cavacoT', rotulo: 'Consumido', barra: true }, { metrica: 'cavacoKgM3', rotulo: 'kg/m³' }, { metrica: 'secado', rotulo: 'Secado' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'cavacoT', rotulo: 'Consumido', barra: true }, { metrica: 'cavacoRec', rotulo: 'Recebido' }, { metrica: 'cavacoKgM3', rotulo: 'kg/m³' }, { metrica: 'cavacoEst', rotulo: 'Estoque' }] },
                { area: 'd', tipo: 'multiplos', colunas: 2, titulo: 'Eficiência e estoque', itens: [{ metrica: 'cavacoKgM3', nome: 'kg de cavaco por m³ secado' }, { metrica: 'cavacoEst', nome: 'Estoque no pátio (fim do período, t)' }] },
            ],
        },
        {
            // paradas: o Pareto diz onde agir; o mapa diz quando cada motivo pesa
            id: 'est-sec-paradas', codigo: 'AVR-E4D', dims: ['secador', 'motivo'],
            kpis: [
                { metrica: 'paradas' }, { metrica: 'dispo' }, { metrica: 'paradas', modo: 'topDim', dim: 'motivo', rotulo: 'Maior motivo' },
                { metrica: 'paradas', fix: { motivo: 'corretiva' }, rotulo: 'Manutenção corretiva' },
            ],
            seletor: [
                { v: 'h', n: 'Horas paradas', grafico: { tipo: 'barras', metrica: 'paradas', pilha: 'motivo', titulo: 'Horas paradas por motivo' } },
                { v: 'disp', n: 'Disponibilidade', grafico: { tipo: 'linha', metrica: 'dispo', pilha: 'secador', titulo: 'Disponibilidade física', refs: [{ valor: 90, rotulo: 'meta 90%' }] } },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'pareto', metrica: 'paradas', dim: 'motivo', titulo: 'Motivos de parada' },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'paradas', rotulo: 'Paradas', barra: true }, { metrica: 'dispo', rotulo: 'Disponib.' }, { metrica: 'paradas', fix: { motivo: 'corretiva' }, rotulo: 'Corretiva' }, { metrica: 'paradas', fix: { motivo: 'faltaGrao' }, rotulo: 'Falta de grão' }] },
                { area: 'd', tipo: 'mapa', modo: 'dim', dim: 'motivo', metrica: 'paradas', escalaPorLinha: true, titulo: 'Quando cada motivo pesa' },
            ],
        },
        {
            // pressão: cada zona tem a sua faixa, então um gráfico por zona com a faixa pintada
            id: 'est-sec-pressao', codigo: 'AVR-E4E', dims: ['zona', 'secador'],
            kpis: [{ metrica: 'pressDep' }, { metrica: 'pressFora' }, { metrica: 'pressDias10' }, { metrica: 'pressFora', modo: 'topDim', dim: 'zona', rotulo: 'Zona com mais leituras fora' }],
            kpiProj: false,
            grade: { areas: ['m m', 'h c'], cols: '1.55fr 1fr', rows: '0.85fr 1.15fr' },
            blocos: [
                { area: 'm', tipo: 'multiplos', porDim: 'zona', metrica: 'pressDep', faixaDim: true, colunas: 5, titulo: 'Depressão média por zona' },
                { area: 'h', tipo: 'mapa', modo: 'dim', dim: 'zona', metrica: 'pressFora', titulo: 'Leituras fora da faixa por zona' },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'pressDep', rotulo: 'Depressão' }, { metrica: 'pressFora', rotulo: 'Fora', barra: true }, { metrica: 'pressDias10', rotulo: 'Dias > 10%' }] },
            ],
            nota: 'Faixas da Tabela 12 (SanTec), leitura a cada 15 min. A zona escolhida no filtro vale para os indicadores e o ano a ano.',
        },

        // ---- silos e armazém ----
        {
            // dez unidades: o mapa silo × período é a leitura principal
            id: 'est-armazenagem', codigo: 'AVR-E5A', dims: ['unidadeArm'],
            kpis: [{ metrica: 'ocup' }, { metrica: 'ocupPico' }, { metrica: 'ocupDias90' }, { metrica: 'giro' }],
            seletor: [
                { v: 'ocup', n: 'Ocupação', grafico: { tipo: 'linha', metrica: 'ocup', titulo: 'Ocupação média', escala: { min: 0, max: 100, passo: 25 }, refs: [{ valor: 90, rotulo: 'limite 90%' }] } },
                { v: 'es', n: 'Entradas × saídas', grafico: { tipo: 'linha', titulo: 'Entradas e saídas', series: [{ metrica: 'entradas', nome: 'Entradas', cor: 'var(--est-c1)' }, { metrica: 'saidas', nome: 'Saídas', cor: 'var(--est-c2)' }] } },
                { v: 'estoque', n: 'Estoque', grafico: { tipo: 'barras', metrica: 'estoque', titulo: 'Estoque no fim do período' } },
            ],
            blocos: [
                { area: 'a', tipo: 'mapa', modo: 'dim', dim: 'unidadeArm', metrica: 'ocup', titulo: 'Ocupação média por silo e período' },
                { area: 'b', tipo: 'recorte', dim: 'unidadeArm', colunas: [{ metrica: 'ocup', rotulo: 'Ocupação', barra: true }, { metrica: 'ocupPico', rotulo: 'Pico' }, { metrica: 'entradas', rotulo: 'Entradas' }, { metrica: 'saidas', rotulo: 'Saídas' }, { metrica: 'giro', rotulo: 'Giro' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'ocup', rotulo: 'Ocupação', barra: true }, { metrica: 'ocupPico', rotulo: 'Pico' }, { metrica: 'ocupDias90', rotulo: 'Dias > 90%' }, { metrica: 'giro', rotulo: 'Giro' }] },
                { area: 'd', tipo: 'tempo', seletor: true },
            ],
        },
        {
            id: 'est-arm-temperatura', codigo: 'AVR-E5B', dims: ['unidadeArm'],
            kpis: [{ metrica: 'tempMassa' }, { metrica: 'tempMax' }, { metrica: 'focos' }, { metrica: 'aeracao' }],
            seletor: [
                { v: 'temp', n: 'Temperatura', grafico: { tipo: 'linha', titulo: 'Temperatura da massa de grãos', series: [{ metrica: 'tempMaxMed', nome: 'Máxima média', cor: 'var(--est-c2)' }, { metrica: 'tempMassa', nome: 'Média', cor: 'var(--est-c1)' }], refs: [{ valor: 30, rotulo: 'alerta 30 °C' }] } },
                { v: 'aer', n: 'Aeração', grafico: { tipo: 'barras', metrica: 'aeracao', titulo: 'Horas de aeração' } },
                { v: 'focos', n: 'Focos quentes', grafico: { tipo: 'barras', metrica: 'focos', titulo: 'Focos quentes' } },
            ],
            blocos: [
                { area: 'a', tipo: 'mapa', modo: 'dim', dim: 'unidadeArm', metrica: 'tempMassa', titulo: 'Temperatura média por silo e período' },
                { area: 'b', tipo: 'recorte', dim: 'unidadeArm', colunas: [{ metrica: 'tempMassa', rotulo: 'Média', barra: true }, { metrica: 'tempMax', rotulo: 'Máxima' }, { metrica: 'focos', rotulo: 'Focos' }, { metrica: 'aeracao', rotulo: 'Aeração' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'tempMassa', rotulo: 'Média' }, { metrica: 'tempMax', rotulo: 'Máxima' }, { metrica: 'focos', rotulo: 'Focos', barra: true }, { metrica: 'aeracao', rotulo: 'Aeração' }] },
                { area: 'd', tipo: 'tempo', seletor: true },
            ],
        },

        // ---- expedição ----
        {
            id: 'est-expedicao', codigo: 'AVR-E6A', dims: ['cultura'],
            kpis: [{ metrica: 'exp' }, { metrica: 'expCam' }, { metrica: 'reprovadas' }, { metrica: 'exp', modo: 'pico' }],
            seletor: [
                { v: 't', n: 'Toneladas', grafico: { tipo: 'barras', metrica: 'exp', pilha: 'cultura', titulo: 'Expedido por período' } },
                { v: 'cam', n: 'Caminhões', grafico: { tipo: 'barras', metrica: 'expCam', pilha: 'cultura', titulo: 'Caminhões carregados' } },
                { v: 'rep', n: 'Reprovas', grafico: { tipo: 'linha', metrica: 'reprovasPct', pilha: 'cultura', titulo: 'Cargas reprovadas' } },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'composicao', metrica: 'exp', dim: 'cultura', modo: 'pct', titulo: 'Mistura de culturas por ano' },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'exp', rotulo: 'Expedido', barra: true }, { metrica: 'expCam', rotulo: 'Caminhões' }, { metrica: 'reprovadas', rotulo: 'Reprovadas' }, { metrica: 'reprovasPct', rotulo: 'Reprova' }] },
                { area: 'd', tipo: 'mapa', modo: 'anoMes', metrica: 'exp', titulo: 'Expedido por mês e ano' },
            ],
        },
        {
            // qualidade da carga: seis indicadores, cada um com o seu limite
            id: 'est-exp-qualidade', codigo: 'AVR-E6B', dims: ['cultura'],
            kpis: [{ metrica: 'dosado' }, { metrica: 'expUmid', rotulo: 'Umidade média' }, { metrica: 'expImp', rotulo: 'Impureza média' }, { metrica: 'expAvar', rotulo: 'Avariados' }],
            grade: { areas: ['m b', 'm c'], cols: '1.55fr 1fr', rows: '0.7fr 1.3fr' },
            blocos: [
                {
                    area: 'm', tipo: 'multiplos', colunas: 3, titulo: 'Qualidade das cargas expedidas',
                    itens: [
                        { metrica: 'dosado', nome: 'Volume dosado (%)' },
                        { metrica: 'expUmid', nome: 'Umidade (%)' },
                        { metrica: 'expImp', nome: 'Impureza (%)' },
                        { metrica: 'expAvar', nome: 'Avariados (%)', refs: [{ valor: 5, rotulo: 'exportação até 5%' }] },
                        { metrica: 'expPh', nome: 'PH do trigo (kg/hl)', refs: [{ valor: 78, rotulo: 'superior ≥ 78' }] },
                        { metrica: 'expFn', nome: 'Falling number do trigo (s)', refs: [{ valor: 250, rotulo: '≥ 250 s' }] },
                    ],
                },
                { area: 'b', tipo: 'recorte', dim: 'cultura', colunas: [{ metrica: 'dosado', rotulo: 'Dosado', barra: true }, { metrica: 'expUmid', rotulo: 'Umid.' }, { metrica: 'expImp', rotulo: 'Imp.' }, { metrica: 'expAvar', rotulo: 'Avar.' }, { metrica: 'reprovasPct', rotulo: 'Reprova' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'dosado', rotulo: 'Dosado', barra: true }, { metrica: 'expUmid', rotulo: 'Umid.' }, { metrica: 'expImp', rotulo: 'Imp.' }, { metrica: 'expAvar', rotulo: 'Avar.' }, { metrica: 'reprovasPct', rotulo: 'Reprova' }] },
            ],
        },
        {
            id: 'est-exp-ciclo', codigo: 'AVR-E6C', dims: ['etapaExp', 'cultura', 'turno'],
            kpis: [
                { metrica: 'cicloExp' }, { metrica: 'cicloExp', fix: { etapaExp: 'fila' }, rotulo: 'Fila média' },
                { metrica: 'cicloExp', fix: { etapaExp: 'carreg' }, rotulo: 'Carregamento médio' }, { metrica: 'diasCiclo75', rotulo: 'Dias com ciclo > 75 min' },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', grafico: { tipo: 'barras', metrica: 'cicloExp', pilha: 'etapaExp', titulo: 'Tempo na unidade por etapa' } },
                { area: 'b', tipo: 'recorte', dim: 'etapaExp', colunas: [{ metrica: 'cicloExp', rotulo: 'Tempo médio', barra: true }, { share: true, rotulo: 'Do ciclo' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'cicloExp', rotulo: 'Ciclo', barra: true }, { metrica: 'cicloExp', fix: { etapaExp: 'fila' }, rotulo: 'Fila' }, { metrica: 'cicloExp', fix: { etapaExp: 'carreg' }, rotulo: 'Carreg.' }, { metrica: 'diasCiclo75', rotulo: 'Dias > 75 min' }] },
                { area: 'd', tipo: 'composicao', metrica: 'cicloExp', dim: 'etapaExp', modo: 'abs', titulo: 'Tempo na unidade de cada ano, por etapa' },
            ],
        },
        {
            // contratos: ranking dos clientes e o cumprimento de prazo de cada um, ano a ano
            id: 'est-exp-contratos', codigo: 'AVR-E6D', dims: ['cliente', 'cultura'],
            kpis: [{ metrica: 'entregue' }, { metrica: 'contratos' }, { metrica: 'noPrazo', rotulo: 'Encerrados no prazo' }, { metrica: 'ritmoContr' }],
            seletor: [
                { v: 't', n: 'Entregue', grafico: { tipo: 'barras', metrica: 'entregue', pilha: 'cliente', titulo: 'Entregue por cliente' } },
                { v: 'n', n: 'Contratos', grafico: { tipo: 'barras', metrica: 'contratos', pilha: 'cliente', titulo: 'Contratos encerrados' } },
                { v: 'prazo', n: 'No prazo', grafico: { tipo: 'linha', metrica: 'noPrazo', titulo: 'Contratos encerrados no prazo', escala: { min: 0, max: 100, passo: 25 }, refs: [{ valor: 90, rotulo: 'meta 90%' }] } },
            ],
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'cliente', ordenar: true, colunas: [{ metrica: 'entregue', rotulo: 'Entregue', barra: true }, { share: true, rotulo: 'Part.' }, { metrica: 'contratos', rotulo: 'Contr.' }, { metrica: 'noPrazo', rotulo: 'No prazo' }, { metrica: 'ritmoContr', rotulo: 't/dia' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'entregue', rotulo: 'Entregue', barra: true }, { metrica: 'contratos', rotulo: 'Contratos' }, { metrica: 'noPrazo', rotulo: 'No prazo' }, { metrica: 'atrasados', rotulo: 'Atrasados' }] },
                { area: 'd', tipo: 'mapa', modo: 'dimAno', dim: 'cliente', metrica: 'noPrazo', titulo: 'Contratos no prazo por cliente e ano' },
            ],
        },

        // ---- clima ----
        {
            // clima: a chuva abre a tela (é ela que trava a recepção) e ganha o
            // dia a dia, que mostra as semanas paradas. Temperatura e umidade
            // do ar entram no "Mostrar", no mesmo gráfico grande: os três
            // juntos na coluna ficavam espremidos, com o eixo ilegível.
            id: 'est-clima', codigo: 'AVR-E7A', dims: ['localidade'],
            kpis: [{ metrica: 'chuva' }, { metrica: 'diasChuva' }, { metrica: 'temp' }, { metrica: 'diasParados' }],
            seletor: [
                { v: 'chuva', n: 'Chuva', grafico: { tipo: 'barras', metrica: 'chuva', titulo: 'Chuva acumulada' } },
                { v: 'temp', n: 'Temperatura', grafico: { tipo: 'linha', titulo: 'Temperatura', series: [{ metrica: 'tMax', nome: 'Máxima média', cor: 'var(--est-c2)' }, { metrica: 'temp', nome: 'Média', cor: 'var(--est-c4)' }, { metrica: 'tMin', nome: 'Mínima média', cor: 'var(--est-c1)' }] } },
                { v: 'ur', n: 'Umidade do ar', grafico: { tipo: 'linha', metrica: 'ur', titulo: 'Umidade relativa do ar' } },
            ],
            grade: { areas: ['a b', 'a c', 'd c'], cols: '1.55fr 1fr', rows: '0.9fr 0.5fr 1fr' },
            blocos: [
                { area: 'a', tipo: 'tempo', seletor: true },
                { area: 'b', tipo: 'recorte', dim: 'localidade', colunas: [{ metrica: 'chuva', rotulo: 'Chuva', barra: true }, { metrica: 'diasChuva', rotulo: 'Dias' }, { metrica: 'temp', rotulo: 'Média' }, { metrica: 'tMax', rotulo: 'Máx.' }, { metrica: 'tMin', rotulo: 'Mín.' }, { metrica: 'ur', rotulo: 'UR' }] },
                { area: 'c', tipo: 'anos', colunas: [{ metrica: 'chuva', rotulo: 'Chuva', barra: true }, { metrica: 'diasChuva', rotulo: 'Dias de chuva' }, { metrica: 'temp', rotulo: 'Temp. média' }, { metrica: 'diasParados', rotulo: 'Parada' }] },
                { area: 'd', tipo: 'calendario', metrica: 'chuva', titulo: 'Chuva dia a dia' },
            ],
            nota: 'Estação da unidade (Avaré) e cooperados; a recepção parada só conta Avaré.',
        },
    ];
    const TELA = Object.fromEntries(EST_TELAS.map((t) => [t.id, t]));

    function estadoTela(tela) {
        let t = ESTADO.telas[tela.id];
        if (!t || typeof t !== 'object') t = ESTADO.telas[tela.id] = { dims: {}, sel: null };
        if (!t.dims || typeof t.dims !== 'object') t.dims = {};
        (tela.dims || []).forEach((dim) => {
            const D = DIMS[dim];
            const v = t.dims[dim];
            const ok = v === '*' ? !D.semTodos : D.valores.some((x) => x.v === v);
            if (!ok) t.dims[dim] = D.semTodos ? D.padrao : '*';
        });
        if (tela.seletor && !tela.seletor.some((o) => o.v === t.sel)) t.sel = tela.seletor[0].v;
        return t;
    }

    function cfgGrafico(tela, t) {
        if (tela.seletor) return tela.seletor.find((o) => o.v === t.sel).grafico;
        return tela.grafico;
    }

    const rotuloDe = (c) => c.rotulo || M[c.metrica].rotulo;
    const nomeDim = (dim, v) => {
        const x = DIMS[dim].valores.find((y) => y.v === v);
        return x ? x.n : DIMS[dim].todos;
    };

    // ---------- filtros ----------
    function pill(attr, v, rot, ativo, extra) {
        return `<button type="button" class="fluxo-periodo-btn${ativo ? ' is-active' : ''}" ${attr}="${v}" aria-pressed="${ativo}"${extra || ''}>${rot}</button>`;
    }

    function grupo(rot, inner, cls) {
        return `<div class="class-filtro est-fgrupo${cls ? ' ' + cls : ''}" role="group" aria-label="${rot}"><span class="class-filtro-rotulo">${rot}</span>${inner}</div>`;
    }

    function opcoesMes(sel) {
        let h = '';
        for (let km = 0; km <= KM_ULT; km++) h += `<option value="${km}"${km === sel ? ' selected' : ''}>${rotMes(km)}</option>`;
        return h;
    }

    function icone(x) {
        return x.icone ? `<svg class="grao-icon grao-icon--${x.icone} grao-icon--dot" aria-hidden="true"><use href="#ico-${x.icone}"></use></svg>` : '';
    }

    function htmlFiltros(tela, t) {
        const e = ESTADO;
        let tempo = '';
        if (tela.tempo !== false) {
            const per = PERIODOS.map((p) => pill('data-est-periodo', p.v, p.n, e.periodo === p.v)).join('')
                + (e.periodo === 'custom'
                    ? `<span class="est-custom"><select class="est-select" data-est-de aria-label="Do mês">${opcoesMes(e.de)}</select><span>até</span><select class="est-select" data-est-ate aria-label="Até o mês">${opcoesMes(e.ate)}</select></span>`
                    : '');
            tempo = grupo('Período', per)
                + grupo('Agrupar', AGRUPAR.map((p) => pill('data-est-agrupar', p.v, p.n, e.agrupar === p.v)).join(''))
                + grupo('Projeção', PROJECOES.map((p) => pill('data-est-projecao', p.v, p.n, e.projecao === p.v)).join(''))
                + grupo('Comparar', COMPARAR.map((p) => pill('data-est-comparar', p.v, p.n, e.comparar === p.v)).join(''));
        }
        let proprios = '';
        (tela.dims || []).forEach((dim) => {
            const D = DIMS[dim];
            const v = t.dims[dim];
            // até 4 opções, botões; mais que isso, lista (a barra cabe numa linha)
            if (D.valores.length <= 4) {
                const todos = D.semTodos ? '' : pill('data-est-dim="' + dim + '" data-v', '*', D.todos, v === '*');
                proprios += grupo(D.rotulo, todos + D.valores.map((x) => pill('data-est-dim="' + dim + '" data-v', x.v, icone(x) + x.n, v === x.v)).join(''));
            } else {
                const opts = (D.semTodos ? '' : `<option value="*"${v === '*' ? ' selected' : ''}>${D.todos}</option>`)
                    + D.valores.map((x) => `<option value="${x.v}"${v === x.v ? ' selected' : ''}>${x.n}</option>`).join('');
                proprios += grupo(D.rotulo, `<select class="est-select" data-est-dimsel="${dim}" aria-label="${D.rotulo}">${opts}</select>`);
            }
        });
        if (tela.seletor) proprios += grupo('Mostrar', tela.seletor.map((o) => pill('data-est-sel', o.v, o.n, t.sel === o.v)).join(''), 'est-fgrupo--mostrar');
        // tudo numa faixa só, que quebra onde precisar; os filtros da tela
        // começam depois de um separador
        const sep = tempo && proprios ? '<span class="est-fsep" aria-hidden="true"></span>' : '';
        return `<div class="est-filtros"><div class="est-filtros-linha">${tempo}${sep}${proprios}</div></div>`;
    }

    // ---------- KPIs ----------
    function kpiCard(codigo, rot, valor, rodape, cls) {
        return `<div data-codigo="${codigo}" class="kpi-card est-kpi${cls ? ' ' + cls : ''}">
            <div class="kpi-label">${rot}</div>
            <div class="kpi-value">${valor}</div>
            ${rodape}
        </div>`;
    }

    function kpiHtml(k, tela, f, P) {
        const m = M[k.metrica];
        const ff = Object.assign({}, f, k.fix || {});
        const cod = tela.codigo + '-A';
        const rot = k.rotulo || m.rotulo;
        if (k.modo === 'pico') {
            const bs = buckets(ESTADO.agrupar, P.ini, P.fim);
            let melhor = null;
            bs.forEach((b) => {
                const v = agregar(m, ff, b.ini, b.fim);
                if (v != null && (!melhor || v > melhor.v)) melhor = { v, b };
            });
            const nomeG = { semana: 'Maior semana', mes: 'Maior mês', trimestre: 'Maior trimestre', ano: 'Maior ano' }[ESTADO.agrupar];
            return kpiCard(cod, nomeG + ' · ' + m.rotulo.toLowerCase(), melhor ? valorHtml(m, melhor.v) : '—',
                `<span class="est-delta is-neutro"><b>${melhor ? melhor.b.rot : ''}</b> <span>no período</span></span>`);
        }
        if (k.modo === 'topDim' || k.modo === 'contagem' || k.modo === 'concentracao') {
            const vals = DIMS[k.dim].valores.map((x) => ({ x, v: agregar(m, Object.assign({}, ff, { [k.dim]: x.v }), P.ini, P.fim) }))
                .filter((r) => r.v != null);
            vals.sort((a, b) => b.v - a.v);
            if (k.modo === 'topDim') {
                const top = vals[0];
                return kpiCard(cod, rot, top ? `<span class="est-kpi-nome">${top.x.n}</span>` : '—',
                    `<span class="est-delta is-neutro"><b>${top ? fmtM(m, top.v) : ''}</b> <span>no período</span></span>`);
            }
            if (k.modo === 'contagem') {
                const n = vals.filter((r) => r.v > 0.5).length;
                return kpiCard(cod, rot, `${n} <span class="kpi-value-unit">de ${DIMS[k.dim].valores.length}</span>`,
                    `<span class="est-delta is-neutro"><span>com entrega no período</span></span>`);
            }
            const total = vals.reduce((s, r) => s + r.v, 0);
            const top5 = vals.slice(0, 5).reduce((s, r) => s + r.v, 0);
            return kpiCard(cod, rot, `${fmt(total ? top5 / total * 100 : 0, 1)} <span class="kpi-value-unit">%</span>`,
                `<span class="est-delta is-neutro"><span>do volume do período</span></span>`);
        }
        const v = agregar(m, ff, P.ini, P.fim);
        return kpiCard(cod, rot, valorHtml(m, v), rodapeKpi(m, ff, P, v));
    }

    // cartão da projeção: fechamento do ano ou os próximos 12 meses
    function kpiProjecao(tela, f, P) {
        if (tela.kpiProj === false || ESTADO.projecao === 'off') return '';
        const id = tela.kpiProj || tela.kpis[0].metrica;
        const k0 = tela.kpis.find((k) => k.metrica === id && !k.modo) || { metrica: id };
        const m = M[id];
        const ff = Object.assign({}, f, k0.fix || {});
        let r;
        let ref;
        // o alcance da projeção vai no selo ("Projeção 2026", "Próx. 12 meses"):
        // no título ele estourava a largura do cartão e sumia nas reticências
        const rot = k0.rotulo || m.rotulo;
        let selo;
        let vs;
        if (ESTADO.projecao === 'dez') {
            r = agregarP(m, ff, diaDe(ULT.ano, 0, 1), diaDe(ULT.ano, 11, 31));
            ref = agregar(m, ff, diaDe(ULT.ano - 1, 0, 1), diaDe(ULT.ano - 1, 11, 31));
            selo = 'Projeção ' + ULT.ano;
            vs = 'vs ' + (ULT.ano - 1);
        } else {
            r = agregarP(m, ff, NH, NT - 1);
            ref = agregar(m, ff, NH - 365, NH - 1);
            selo = 'Próx. 12 meses';
            vs = 'vs 12 meses antes';
        }
        if (!r) return '';
        return kpiCard(tela.codigo + '-A', '<span class="est-tag-proj">' + selo + '</span> ' + rot, valorHtml(m, r.c), rodapeProj(m, r, ref, vs), 'est-kpi--proj');
    }

    // faixa e variação numa linha só (o cartão fica da altura dos outros)
    function rodapeProj(m, r, ref, vs) {
        const dl = r ? delta(m, r.c, ref) : null;
        return `<span class="est-delta ${dl ? dl.classe : 'is-neutro'}">`
            + (dl ? `<b>${dl.seta} ${dl.txt}</b> <span>${vs}</span>` : '')
            + `<span class="est-faixa-txt"> · faixa ${r ? faixaTxt(m, r) : '—'}</span></span>`;
    }

    // ---------- gráfico ----------
    function escala(valores, desdeZero, fixa) {
        if (fixa) return fixa;
        const vs = valores.filter((v) => v != null && isFinite(v));
        if (!vs.length) return { min: 0, max: 1, passo: 0.25 };
        let min = desdeZero ? 0 : Math.min(...vs);
        let max = Math.max(...vs);
        if (desdeZero && min > 0) min = 0;
        // folga de 6% nas linhas: a referência e os picos não colam na borda
        // (sem passar para baixo de zero quando tudo é positivo)
        if (!desdeZero) {
            const folga = (max - min) * 0.06 || Math.abs(max) * 0.02 || 1;
            const positivo = min >= 0;
            min -= folga;
            max += folga;
            if (positivo && min < 0) min = 0;
        }
        const bruto = (max - min) / 4 || Math.abs(max) / 4 || 1;
        const mag = 10 ** Math.floor(Math.log10(bruto));
        const passo = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((p) => p >= bruto);
        min = desdeZero ? 0 : Math.floor(min / passo) * passo;
        max = Math.ceil(max / passo) * passo;
        if (max <= min) max = min + passo;
        return { min, max, passo };
    }

    // as séries do gráfico com os filtros da tela
    function seriesDoGrafico(cfg, f, P) {
        if (cfg.series) {
            return { modo: 'multi', lista: cfg.series.map((s) => ({ m: M[s.metrica], f: Object.assign({}, f, s.fix || {}), nome: s.nome, cor: s.cor })) };
        }
        const m = M[cfg.metrica];
        const dim = cfg.pilha;
        if (dim && f[dim] === '*' && m.dims[dim]) {
            const empilhar = cfg.tipo === 'barras' && (m.agreg === 'soma' || m.empilha === dim);
            let vals = DIMS[dim].valores.map((x) => ({ x, f: Object.assign({}, f, { [dim]: x.v }) }));
            let resto = false;
            if (vals.length > PILHA_MAX) {
                vals.forEach((r) => { r.tot = agregar(m, r.f, P.ini, P.fim) || 0; });
                vals = vals.slice().sort((a, b) => b.tot - a.tot).slice(0, 5);
                resto = empilhar;
            }
            const lista = vals.map((r) => ({ m, f: r.f, nome: r.x.n, cor: r.x.cor, icone: r.x.icone }));
            return { modo: empilhar ? 'pilha' : 'multi', lista, resto, total: { m, f } };
        }
        let cor = 'var(--viz-real)';
        if (dim && f[dim] && f[dim] !== '*') {
            const x = DIMS[dim].valores.find((y) => y.v === f[dim]);
            if (x) cor = x.cor;
        }
        return { modo: 'simples', lista: [{ m, f, nome: m.rotulo, cor }], total: { m, f } };
    }

    function refsDo(cfg, f) {
        if (cfg.refsZona) {
            const z = DIMS.zona.valores.find((x) => x.v === f.zona);
            return z ? [{ valor: z.min, rotulo: 'faixa ' + z.min + '–' + z.max + ' mmca' }, { valor: z.max, rotulo: '' }] : [];
        }
        return cfg.refs || [];
    }

    const TIP = {};

    function cabecalhoGrafico(cfg, m, legenda) {
        const anosOk = ESTADO.agrupar !== 'ano';
        const modo = ESTADO.modo === 'anos' && anosOk ? 'anos' : 'linha';
        const bt = (v, rot, dis) => `<button type="button" class="fluxo-periodo-btn${modo === v ? ' is-active' : ''}" data-est-modo="${v}" aria-pressed="${modo === v}"${dis ? ' disabled title="Escolha semana, mês ou trimestre para sobrepor os anos"' : ''}>${rot}</button>`;
        return `<div class="section-head est-graf-head">
            <h3>${cfg.titulo.toUpperCase()} · ${m.unidade.toUpperCase()}</h3>
            <span class="du-legenda">${legenda}</span>
            <div class="class-filtro est-modo" role="group" aria-label="Forma do gráfico">${bt('linha', 'Linha do tempo')}${bt('anos', 'Sobrepor anos', !anosOk)}</div>
        </div>`;
    }

    const legItem = (cls, txt, cor) => `<span><i class="est-leg ${cls}"${cor ? ` style="--c: ${cor}"` : ''}></i>${txt}</span>`;

    // op: { key, codigo, area } — onde o gráfico entra na grade da tela e a
    // chave da dica (uma tela pode ter mais de um gráfico)
    function graficoTempo(tela, cfg, f, P, op) {
        const g = ESTADO.agrupar;
        const bs = buckets(g, P.ini, P.fimProj);
        const n = bs.length;
        const S = seriesDoGrafico(cfg, f, P);
        const barras = cfg.tipo === 'barras';
        const diverg = barras && cfg.divergente && S.modo === 'simples';
        S.lista.forEach((s) => { s.v = bs.map((b) => agregarP(s.m, s.f, b.ini, b.fim)); });
        const T = S.total ? bs.map((b) => agregarP(S.total.m, S.total.f, b.ini, b.fim)) : null;
        if (S.resto && T) {
            S.lista.push({
                nome: 'Demais', cor: 'var(--est-c-outros)', m: S.total.m,
                v: bs.map((b, i) => {
                    const t = T[i];
                    if (!t) return null;
                    const usado = S.lista.reduce((s, x) => s + ((x.v && x.v[i] && x.v[i].c) || 0), 0);
                    const c = Math.max(0, t.c - usado);
                    return { c, lo: c, hi: c, proj: t.proj };
                }),
            });
        }
        const mP = S.total ? S.total.m : S.lista[0].m;
        const fP = S.total ? S.total.f : S.lista[0].f;
        const comparar = ESTADO.comparar;
        const C = S.modo !== 'multi' && comparar !== 'tendencia' && !diverg
            ? bs.map((b) => referencia(mP, fP, b.ini, Math.min(b.fim, NT - 1), comparar))
            : null;
        const principal = S.modo === 'pilha' ? T : S.lista[0].v;

        const valores = [];
        if (S.modo === 'pilha') T.forEach((r) => { if (r) valores.push(r.c, r.hi); });
        else S.lista.forEach((s) => s.v.forEach((r) => { if (r) valores.push(r.c, S.modo === 'simples' ? r.hi : r.c, S.modo === 'simples' ? r.lo : r.c); }));
        if (C) C.forEach((v) => valores.push(v));
        const refs = refsDo(cfg, f);
        refs.forEach((r) => valores.push(r.valor));
        if (diverg) valores.push(0);
        const esc = escala(valores, barras && !diverg, cfg.escala);
        const yv = (v) => clamp((v - esc.min) / (esc.max - esc.min), 0, 1);
        const y = (v) => yv(v).toFixed(4);
        const X = (i) => ((i + 0.5) / n * 100).toFixed(3);
        const Y = (v) => (100 - yv(v) * 100).toFixed(3);

        let grade = '';
        let eixoY = '';
        for (let v = esc.min; v <= esc.max + esc.passo / 1000; v += esc.passo) {
            grade += `<i class="est-grade" style="--y: ${y(v)}"></i>`;
            eixoY += `<span style="--y: ${y(v)}">${abrev(Math.abs(v) < esc.passo / 1000 ? 0 : v, esc.passo)}</span>`;
        }
        const refHtml = refs.map((r) => `<i class="est-ref" style="--y: ${y(r.valor)}"></i>`).join('')
            + (diverg ? `<i class="est-ref est-ref--zero" style="--y: ${y(0)}"></i>` : '');

        const i0 = bs.findIndex((b) => b.proj);
        const projArea = i0 >= 0 ? `<div class="est-proj-area" style="--x0: ${(i0 / n * 100).toFixed(3)}%"><span>${(n - i0) / n < 0.12 ? 'proj.' : 'projeção'}</span></div>` : '';

        // linhas: real cheia, projetada tracejada, faixa sombreada
        let svg = '';
        const linhas = barras ? [] : S.lista;
        linhas.forEach((s) => {
            let seg = [];
            const segs = [];
            let ultimoReal = -1;
            s.v.forEach((r, i) => {
                if (!r || r.proj) {
                    if (seg.length) segs.push(seg);
                    seg = [];
                    return;
                }
                seg.push(X(i) + ',' + Y(r.c));
                ultimoReal = i;
            });
            if (seg.length) segs.push(seg);
            segs.forEach((pts) => {
                svg += pts.length > 1
                    ? `<polyline class="est-l" style="--c: ${s.cor}" points="${pts.join(' ')}"></polyline>`
                    : `<circle class="est-l-ponto" style="--c: ${s.cor}" cx="${pts[0].split(',')[0]}" cy="${pts[0].split(',')[1]}" r="0.6"></circle>`;
            });
            if (i0 >= 0) {
                const pts = [];
                const alto = [];
                const baixo = [];
                if (ultimoReal >= 0 && ultimoReal === i0 - 1) {
                    const r = s.v[ultimoReal];
                    pts.push(X(ultimoReal) + ',' + Y(r.c));
                    alto.push(X(ultimoReal) + ',' + Y(r.c));
                    baixo.push(X(ultimoReal) + ',' + Y(r.c));
                }
                for (let i = i0; i < n; i++) {
                    const r = s.v[i];
                    if (!r) continue;
                    pts.push(X(i) + ',' + Y(r.c));
                    alto.push(X(i) + ',' + Y(r.hi));
                    baixo.push(X(i) + ',' + Y(r.lo));
                }
                if (S.modo === 'simples' && alto.length > 1) svg = `<polygon class="est-banda" style="--c: ${s.cor}" points="${alto.concat(baixo.slice().reverse()).join(' ')}"></polygon>` + svg;
                if (pts.length > 1) svg += `<polyline class="est-l est-l--proj" style="--c: ${s.cor}" points="${pts.join(' ')}"></polyline>`;
            }
        });
        // comparação: tracejado apagado (linhas e barras densas)
        if (C && (!barras || n > 80)) {
            let seg = [];
            const segs = [];
            C.forEach((v, i) => {
                if (v == null) {
                    if (seg.length) segs.push(seg);
                    seg = [];
                    return;
                }
                seg.push(X(i) + ',' + Y(v));
            });
            if (seg.length) segs.push(seg);
            segs.forEach((pts) => { if (pts.length > 1) svg += `<polyline class="est-l-ant" points="${pts.join(' ')}"></polyline>`; });
        }
        // tendência do período (mínimos quadrados sobre o real)
        let tend = null;
        if (comparar === 'tendencia' && principal) {
            const pts = principal.map((r, i) => (r && !r.proj ? [i, r.c] : null)).filter(Boolean);
            if (pts.length > 2) {
                const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
                const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
                const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
                const sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
                const b = sxx ? sxy / sxx : 0;
                const a = my - b * mx;
                const x1 = pts[0][0];
                const x2 = pts[pts.length - 1][0];
                tend = { a, b };
                svg += `<polyline class="est-tend" points="${X(x1)},${Y(a + b * x1)} ${X(x2)},${Y(a + b * x2)}"></polyline>`;
            }
        }
        const svgHtml = svg ? `<svg class="est-linhas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>` : '';

        const cols = bs.map((b, i) => {
            const cls = ['est-col'];
            if (b.inicioAno && i > 0) cls.push('is-jan');
            if (b.proj) cls.push('is-proj');
            let marca = '';
            if (diverg) {
                // barra a partir do zero: acima em uma cor, abaixo em outra
                const r = S.lista[0].v[i];
                if (r) {
                    const a = Math.min(yv(r.c), yv(0));
                    const h = Math.abs(yv(r.c) - yv(0));
                    marca += `<span class="est-barra est-barra--div${r.proj ? ' is-proj' : ''}" style="--b: ${a.toFixed(4)}; --h: ${h.toFixed(4)}"><i style="flex-grow: 1; --c: ${r.c >= 0 ? cfg.divergente[0].cor : cfg.divergente[1].cor}"></i></span>`;
                    if (r.proj) marca += `<span class="est-whisker" style="--lo: ${y(r.lo)}; --hi: ${y(r.hi)}"></span>`;
                }
            } else if (barras) {
                const tot = S.modo === 'pilha' ? T[i] : S.lista[0].v[i];
                if (tot) {
                    const partesB = S.modo === 'pilha'
                        ? S.lista.map((s) => [s.v[i] ? s.v[i].c : 0, s.cor]).filter(([v]) => v > 0)
                        : [[tot.c, S.lista[0].cor]];
                    marca += `<span class="est-barra${tot.proj ? ' is-proj' : ''}" style="--h: ${y(tot.c)}">`
                        + partesB.map(([v, cor]) => `<i style="flex-grow: ${v.toFixed(3)}; --c: ${cor}"></i>`).join('')
                        + `</span>`;
                    if (tot.proj) marca += `<span class="est-whisker" style="--lo: ${y(tot.lo)}; --hi: ${y(tot.hi)}"></span>`;
                }
                if (C && C[i] != null && n <= 80) marca += `<span class="est-ant" style="--h: ${y(C[i])}"></span>`;
            } else if (S.modo === 'simples' && n <= 40) {
                const r = S.lista[0].v[i];
                if (r) marca += `<span class="est-ponto${r.proj ? ' is-proj' : ''}" style="--h: ${y(r.c)}; --c: ${S.lista[0].cor}"></span>`;
            }
            return `<div class="${cls.join(' ')}" data-est-k="${i}">${marca}</div>`;
        }).join('');

        const mostrar = rotulosEixo(bs, g, op.larg && op.larg < 0.45 ? 12 : 24);
        const eixoX = bs.map((b, i) => {
            const txt = mostrar.has(i) ? b.curto : '';
            const ano = b.inicioAno && g !== 'ano' ? `<b>${b.ano}</b>` : '';
            return `<span>${txt}${ano}</span>`;
        }).join('');

        // legenda
        let leg = '';
        if (S.modo !== 'simples') leg += S.lista.map((s) => `<span><i class="du-dot" style="--du-c: ${s.cor}"></i>${s.nome}</span>`).join('');
        else if (diverg) leg += cfg.divergente.map((x) => legItem('est-leg--barra', x.rotulo, x.cor)).join('');
        else leg += legItem(barras ? 'est-leg--barra' : 'est-leg--linha', barras ? 'período' : 'média do período', S.lista[0].cor);
        if (i0 >= 0) leg += legItem('est-leg--proj', S.modo === 'simples' || barras ? 'projeção e faixa provável' : 'projeção', S.lista[0].cor);
        if (C) leg += legItem(barras && n <= 80 ? 'est-leg--ant' : 'est-leg--linha-ant', rotuloComparacao(comparar));
        if (tend) leg += legItem('est-leg--tend', rotuloComparacao('tendencia'));
        refs.filter((r) => r.rotulo).forEach((r) => { leg += legItem('est-leg--ref', r.rotulo); });

        TIP[op.key] = { tipo: 'tempo', bs, S, T, C, mP, comparar };
        const ariaFim = bs[n - 1] ? bs[n - 1].rot : '';
        return `<div data-codigo="${op.codigo}" class="content-section du-section est-section est-section--grafico" style="${op.estilo}" data-est-tipid="${op.key}">
            ${cabecalhoGrafico(cfg, mP, leg)}
            <div class="est-graf${n > 80 ? ' is-denso' : ''}" style="--n: ${n}">
                <div class="est-eixo-y" aria-hidden="true">${eixoY}</div>
                <div class="est-plot" role="img" aria-label="${cfg.titulo}, de ${bs[0] ? bs[0].rot : ''} a ${ariaFim}">
                    ${grade}${refHtml}${projArea}${svgHtml}
                    <div class="est-cols">${cols}</div>
                </div>
                <div class="est-eixo-x" aria-hidden="true">${eixoX}</div>
            </div>
        </div>`;
    }

    // anos sobrepostos: eixo jan–dez, uma linha por ano; o ano corrente
    // segue tracejado pela projeção, com a faixa
    function graficoAnos(tela, cfg, f, P, op) {
        const g = ESTADO.agrupar;
        const nPos = { semana: 53, mes: 12, trimestre: 4 }[g];
        const S = seriesDoGrafico(cfg, f, P);
        const mP = S.total ? S.total.m : S.lista[0].m;
        const fP = S.total ? S.total.f : S.lista[0].f;
        const bs = buckets(g, P.ini, P.fimProj);
        const porAno = new Map();
        bs.forEach((b) => {
            if (!porAno.has(b.ano)) porAno.set(b.ano, new Array(nPos).fill(null));
            porAno.get(b.ano)[b.pos] = { r: agregarP(mP, fP, b.ini, b.fim), b };
        });
        const anos = Array.from(porAno.keys()).sort();
        const valores = [];
        porAno.forEach((arr) => arr.forEach((x) => { if (x && x.r) valores.push(x.r.c, x.r.hi, x.r.lo); }));
        const refs = refsDo(cfg, f);
        refs.forEach((r) => valores.push(r.valor));
        const esc = escala(valores, cfg.tipo === 'barras', cfg.escala);
        const yv = (v) => clamp((v - esc.min) / (esc.max - esc.min), 0, 1);
        const y = (v) => yv(v).toFixed(4);
        const X = (i) => ((i + 0.5) / nPos * 100).toFixed(3);
        const Y = (v) => (100 - yv(v) * 100).toFixed(3);
        const corAno = (a) => {
            if (a > ULT.ano) return 'var(--est-c7)';      // o ano seguinte, todo projetado
            if (a === ULT.ano) return 'var(--viz-real)';
            if (a === ULT.ano - 1) return 'var(--muted)';
            return 'var(--faint)';
        };
        let grade = '';
        let eixoY = '';
        for (let v = esc.min; v <= esc.max + esc.passo / 1000; v += esc.passo) {
            grade += `<i class="est-grade" style="--y: ${y(v)}"></i>`;
            eixoY += `<span style="--y: ${y(v)}">${abrev(v, esc.passo)}</span>`;
        }
        let svg = '';
        let rotulos = '';
        anos.forEach((a) => {
            const arr = porAno.get(a);
            const cor = corAno(a);
            const cls = a >= ULT.ano ? ' est-l--forte' : (a === ULT.ano - 1 ? '' : ' est-l--fraca');
            const real = [];
            const proj = [];
            const alto = [];
            const baixo = [];
            let ult = null;
            arr.forEach((x, i) => {
                if (!x || !x.r) return;
                const p = X(i) + ',' + Y(x.r.c);
                if (!x.r.proj) {
                    real.push(p);
                    ult = { i, x };
                } else {
                    if (!proj.length && ult && ult.i === i - 1) {
                        proj.push(X(ult.i) + ',' + Y(ult.x.r.c));
                        alto.push(X(ult.i) + ',' + Y(ult.x.r.c));
                        baixo.push(X(ult.i) + ',' + Y(ult.x.r.c));
                    }
                    proj.push(p);
                    alto.push(X(i) + ',' + Y(x.r.hi));
                    baixo.push(X(i) + ',' + Y(x.r.lo));
                    ult = { i, x };
                }
            });
            if (alto.length > 1) svg += `<polygon class="est-banda" style="--c: ${cor}" points="${alto.concat(baixo.reverse()).join(' ')}"></polygon>`;
            if (real.length > 1) svg += `<polyline class="est-l${cls}" style="--c: ${cor}" points="${real.join(' ')}"></polyline>`;
            if (proj.length > 1) svg += `<polyline class="est-l est-l--proj${cls}" style="--c: ${cor}" points="${proj.join(' ')}"></polyline>`;
            if (ult) {
                rotulos += `<span class="est-rotulo-ano${a >= ULT.ano ? ' is-atual' : ''}" style="left: ${X(ult.i)}%; bottom: ${(yv(ult.x.r.c) * 100).toFixed(2)}%; --c: ${cor}">${a}${ult.x.r.proj ? '*' : ''}</span>`;
            }
        });
        const refHtml = refs.map((r) => `<i class="est-ref" style="--y: ${y(r.valor)}"></i>`).join('');
        const cols = Array.from({ length: nPos }, (_, i) => `<div class="est-col" data-est-pos="${i}"></div>`).join('');
        const eixoX = Array.from({ length: nPos }, (_, i) => {
            let txt = '';
            if (g === 'mes') txt = MESES[i];
            else if (g === 'trimestre') txt = TRI[i];
            else if (i % 4 === 0) txt = 'sem ' + (i + 1);
            return `<span>${txt}</span>`;
        }).join('');
        let leg = anos.length > 1
            ? (anos.includes(ULT.ano + 1) ? legItem('est-leg--linha', String(ULT.ano + 1), 'var(--est-c7)') : '')
                + legItem('est-leg--linha', anos.includes(ULT.ano) ? String(ULT.ano) : String(anos[anos.length - 1]), 'var(--viz-real)')
                + (anos.includes(ULT.ano - 1) ? legItem('est-leg--linha', String(ULT.ano - 1), 'var(--muted)') : '')
                + (anos.some((a) => a < ULT.ano - 1) ? legItem('est-leg--linha', 'anos anteriores', 'var(--faint)') : '')
            : '';
        if (P.comProj) leg += legItem('est-leg--proj', 'projeção (*) e faixa provável', 'var(--viz-real)');
        refs.filter((r) => r.rotulo).forEach((r) => { leg += legItem('est-leg--ref', r.rotulo); });
        TIP[op.key] = { tipo: 'anos', porAno, anos, mP, g };
        return `<div data-codigo="${op.codigo}" class="content-section du-section est-section est-section--grafico" style="${op.estilo}" data-est-tipid="${op.key}">
            ${cabecalhoGrafico(cfg, mP, leg)}
            <div class="est-graf est-graf--rotulos" style="--n: ${nPos}">
                <div class="est-eixo-y" aria-hidden="true">${eixoY}</div>
                <div class="est-plot" role="img" aria-label="${cfg.titulo}, anos sobrepostos">
                    ${grade}${refHtml}
                    <svg class="est-linhas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>
                    ${rotulos}
                    <div class="est-cols">${cols}</div>
                </div>
                <div class="est-eixo-x" aria-hidden="true">${eixoX}</div>
            </div>
        </div>`;
    }

    function grafico(tela, cfg, f, P, op) {
        if (ESTADO.modo === 'anos' && ESTADO.agrupar !== 'ano' && !cfg.divergente) return graficoAnos(tela, cfg, f, P, op);
        return graficoTempo(tela, cfg, f, P, op);
    }

    // rótulos do eixo X: até ~max, alinhados (mês a mês, trimestres,
    // semestres ou janeiros)
    function rotulosEixo(bs, g, max) {
        const marcados = bs.map((b, i) => (b.marca ? i : -1)).filter((i) => i >= 0);
        const chaveEixo = (b) => {
            if (g === 'semana') return b.kmEixo;
            if (g === 'mes') return CAL.km[b.ini];
            if (g === 'trimestre') return (b.ano - ANO0) * 4 + Math.floor(CAL.mes[b.ini] / 3);
            return b.ano;
        };
        const passos = g === 'trimestre' ? [1, 2, 4] : (g === 'ano' ? [1, 2, 5] : [1, 2, 3, 6, 12]);
        const passo = passos.find((p) => marcados.length / p <= max) || passos[passos.length - 1];
        return new Set(marcados.filter((i) => chaveEixo(bs[i]) % passo === 0));
    }

    // ---------- recorte do período ----------
    function celula(m, v, barra, maxv, dl) {
        const dh = dl ? deltaHtml(dl, '') : '';
        if (barra) {
            return `<td><div class="du-medidor" style="--p: ${maxv > 0 && v != null ? clamp(v / maxv, 0, 1).toFixed(3) : 0}"><span class="du-medidor-trilho"><i></i></span><b>${fmt(v, m.casas)}</b>${dh}</div></td>`;
        }
        return `<td class="num">${m.unidade === 'R$' ? 'R$ ' : ''}${fmt(v, m.casas)}${dh}</td>`;
    }

    function thDe(c) {
        if (c.share) return `<th class="num">${c.rotulo}<small>%</small></th>`;
        if (c.faixaZona) return `<th class="num">${c.rotulo}<small>mmca</small></th>`;
        const m = M[c.metrica];
        return `<th class="num">${rotuloDe(c)}<small>${m.unidade === 'R$' ? 'R$' : m.unidade}</small></th>`;
    }

    function recorte(tela, f, P, op, R) {
        const D = DIMS[R.dim];
        const comp = ESTADO.comparar === 'tendencia' ? 'ano' : ESTADO.comparar;
        const sel = f[R.dim];
        let linhas = D.valores.map((x) => {
            const ff = Object.assign({}, f, { [R.dim]: x.v });
            const vals = R.colunas.map((c) => (c.share || c.faixaZona ? null : agregar(M[c.metrica], Object.assign({}, ff, c.fix || {}), P.ini, P.fim)));
            return { x, ff, vals };
        });
        const i0 = R.colunas.findIndex((c) => c.metrica);
        const totalShare = linhas.reduce((s, l) => s + (l.vals[i0] || 0), 0);
        if (R.ordenar) linhas = linhas.slice().sort((a, b) => (b.vals[i0] || 0) - (a.vals[i0] || 0));
        const maximos = R.colunas.map((c, ci) => Math.max(0, ...linhas.map((l) => l.vals[ci] || 0)));
        let temDelta = false;
        const corpo = linhas.map((l) => {
            const cels = R.colunas.map((c, ci) => {
                if (c.share) return `<td class="num">${fmt(totalShare ? (l.vals[i0] || 0) / totalShare * 100 : null, 1)}</td>`;
                if (c.faixaZona) return `<td class="num">${l.x.min}–${l.x.max}</td>`;
                const m = M[c.metrica];
                const dl = ci === i0 ? delta(m, l.vals[ci], referencia(m, Object.assign({}, l.ff, c.fix || {}), P.ini, P.fim, comp)) : null;
                if (dl) temDelta = true;
                return celula(m, l.vals[ci], c.barra, maximos[ci], dl);
            }).join('');
            const ativo = sel === l.x.v;
            const sub = l.x.sub || l.x.faixa;
            return `<tr data-est-recorte="${R.dim}" data-v="${l.x.v}" class="${ativo ? 'is-sel' : ''}" title="Filtrar a tela por ${l.x.n}">
                <td class="pv-tabela-nome"><span class="est-nome"><i class="du-dot" style="--du-c: ${l.x.cor}"></i>${l.x.n}</span>${sub ? `<small>${sub}</small>` : ''}</td>${cels}</tr>`;
        }).join('');
        const titulo = R.titulo || ('Por ' + D.rotulo.toLowerCase());
        // a comparação só entra na legenda quando há base para comparar (no
        // período "tudo" não existe ano anterior)
        const legenda = (temDelta ? `▲▼ ${comp === 'media' ? 'vs média de 3 anos' : 'vs ano anterior'} · ` : '') + 'clique filtra a tela';
        return `<div data-codigo="${op.codigo}" class="content-section du-section est-section est-recorte${op.solta ? ' est-recorte--solta' : ''}" style="${op.estilo}">
            <div class="section-head">
                <h3>${titulo.toUpperCase()} · ${P.rot.toUpperCase()}</h3>
                <span class="du-legenda"><span>${legenda}</span></span>
            </div>
            <div class="table-scroll table-scroll--livre est-scroll">
                <table class="pv-tabela du-tabela est-tabela">
                    <thead><tr><th>${D.rotulo}</th>${R.colunas.map(thDe).join('')}</tr></thead>
                    <tbody>${corpo}</tbody>
                </table>
            </div>
        </div>`;
    }

    // ---------- ano a ano ----------
    function tabelaAnos(tela, f, op, cols) {
        const dados = ANOS.map((a) => {
            const ini = diaDe(a, 0, 1);
            const fim = a === ULT.ano ? NH - 1 : diaDe(a, 11, 31);
            return { a, ini, fim, vals: cols.map((c) => agregar(M[c.metrica], Object.assign({}, f, c.fix || {}), ini, fim)) };
        });
        let proj = null;
        if (ESTADO.projecao !== 'off') {
            proj = cols.map((c) => agregarP(M[c.metrica], Object.assign({}, f, c.fix || {}), diaDe(ULT.ano, 0, 1), diaDe(ULT.ano, 11, 31)));
        }
        const maximos = cols.map((c, i) => Math.max(0, ...dados.map((d) => d.vals[i] || 0), ...(proj ? [proj[i] ? proj[i].c : 0] : [])));
        const linhas = dados.slice().reverse().map((d) => {
            const parcial = d.a === ULT.ano;
            const cels = cols.map((c, i) => {
                const m = M[c.metrica];
                const ff = Object.assign({}, f, c.fix || {});
                const dl = parcial ? delta(m, d.vals[i], deslocado(m, ff, d.ini, d.fim, 1)) : null;
                return celula(m, d.vals[i], c.barra, maximos[i], dl);
            }).join('');
            const nome = parcial ? `${d.a}<small>até ${rotDia(NH - 1).slice(0, 5)}</small>` : String(d.a);
            return `<tr${parcial ? ' class="est-linha-atual"' : ''}><td class="pv-tabela-nome">${nome}</td>${cels}</tr>`;
        });
        if (proj) {
            const cels = cols.map((c, i) => {
                const m = M[c.metrica];
                const r = proj[i];
                const ant = dados.find((d) => d.a === ULT.ano - 1).vals[i];
                const dl = r ? delta(m, r.c, ant) : null;
                return celula(m, r ? r.c : null, c.barra, maximos[i], dl).replace('</td>', `<small class="est-faixa-cel">${r ? faixaCurta(m, r) : ''}</small></td>`);
            }).join('');
            linhas.unshift(`<tr class="est-linha-proj"><td class="pv-tabela-nome">${ULT.ano}<small>projetado</small></td>${cels}</tr>`);
        }
        // título e legenda numa linha só: a altura fica para as linhas da tabela
        return `<div data-codigo="${op.codigo}" class="content-section du-section est-section est-anos" style="${op.estilo}">
            <div class="section-head">
                <h3>ANO A ANO</h3>
                <span class="du-legenda"><span>▲▼ contra ${ULT.ano - 1}: mesmo período${proj ? ' · projetado contra o ano fechado' : ''}</span></span>
            </div>
            <div class="du-tabela-wrap table-scroll table-scroll--livre est-scroll">
                <table class="pv-tabela du-tabela est-tabela">
                    <thead><tr><th>Ano</th>${cols.map(thDe).join('')}</tr></thead>
                    <tbody>${linhas.join('')}</tbody>
                </table>
            </div>
        </div>`;
    }

    // ---------- blocos das telas ----------
    // Cada tela escolhe os blocos que mostram melhor o seu dado e onde eles
    // entram numa grade (grid-template-areas):
    //   tempo      gráfico longo (linha do tempo / anos sobrepostos)
    //   recorte    tabela do período por cultura, moega, silo... (clique filtra)
    //   anos       ano a ano, com a linha do ano projetado
    //   mapa       mapa de calor: ano × mês, item × período ou item × ano
    //   calendario uma faixa por ano, um traço por dia (dias acima do limite em destaque)
    //   multiplos  gráficos pequenos lado a lado (por cultura, zona ou indicador)
    //   composicao barra de cada ano dividida pelas partes (culturas, etapas, tipos)
    //   pareto     motivos do maior para o menor, com o acumulado
    //   dispersao  um indicador contra outro (por cooperado ou mês a mês)
    //   acumulado  acumulado do ano, ano contra ano, com a projeção
    const GRADE_PADRAO = { areas: ['a b', 'a c', 'd c'], cols: '1.55fr 1fr', rows: '0.9fr 0.6fr 1fr' };

    function anosNoPeriodo(P) {
        return ANOS.filter((a) => diaDe(a, 11, 31) >= P.ini && diaDe(a, 0, 1) <= P.fim);
    }

    // valores curtos para célula e rótulo: em mil quando a escala é grande
    function divisorDe(maxAbs) {
        return maxAbs >= 10000 ? { div: 1000, pref: 'mil ' } : { div: 1, pref: '' };
    }

    function curto(m, v, dv) {
        if (v == null || !isFinite(v)) return '';
        const x = v / dv.div;
        const casas = dv.div > 1 ? (Math.abs(x) >= 100 ? 0 : 1) : m.casas;
        return fmt(x, casas);
    }

    const aspas = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const tipDe = (linhas) => aspas(linhas.filter(Boolean).join('|'));
    const unidadeTxt = (m, dv) => (dv ? dv.pref : '') + (m.unidade === 'R$' ? 'R$' : m.unidade);

    function cabecalho(titulo, legenda) {
        return `<div class="section-head"><h3>${titulo.toUpperCase()}</h3>${legenda ? `<span class="du-legenda">${legenda}</span>` : ''}</div>`;
    }

    function secao(op, classe, head, corpo) {
        return `<div data-codigo="${op.codigo}" class="content-section du-section est-section ${classe}" style="${op.estilo}" data-est-tipid="${op.key}">${head}${corpo}</div>`;
    }

    // métrica escolhida no "Mostrar" da tela (ou a do próprio bloco)
    function escolhaDe(tela, ctx, b) {
        if (b.seletor && tela.seletor) {
            const o = tela.seletor.find((x) => x.v === ctx.t.sel) || tela.seletor[0];
            return Object.assign({}, o.grafico);
        }
        return b;
    }

    function legendaEscala(m, min, max, dv, comProj) {
        return `<span class="est-escala"><span>${curto(m, min, dv)}</span><i class="est-escala-barra"></i><span>${curto(m, max, dv)} ${unidadeTxt(m, dv)}</span></span>`
            + (comProj ? legItem('est-leg--proj', 'projeção', 'var(--est-seq-1)') : '');
    }

    // linha real cheia + projetada tracejada (+ faixa) num SVG 0–100
    function linhaSvg(v, cor, X, Y, banda, cls) {
        let svg = '';
        let seg = [];
        const segs = [];
        let ultimo = -1;
        v.forEach((r, i) => {
            if (!r || r.proj) {
                if (seg.length) segs.push(seg);
                seg = [];
                return;
            }
            seg.push(X(i) + ',' + Y(r.c));
            ultimo = i;
        });
        if (seg.length) segs.push(seg);
        // ponto isolado (mês com dado entre meses sem): traço de tamanho zero com ponta redonda
        segs.forEach((pts) => { svg += `<polyline class="est-l${cls || ''}${pts.length === 1 ? ' est-l--ponto' : ''}" style="--c: ${cor}" points="${pts.length === 1 ? pts[0] + ' ' + pts[0] : pts.join(' ')}"></polyline>`; });
        const i0 = v.findIndex((r) => r && r.proj);
        if (i0 >= 0) {
            const pts = [];
            const alto = [];
            const baixo = [];
            if (ultimo === i0 - 1 && ultimo >= 0) {
                const p = X(ultimo) + ',' + Y(v[ultimo].c);
                pts.push(p);
                alto.push(p);
                baixo.push(p);
            }
            for (let i = i0; i < v.length; i++) {
                const r = v[i];
                if (!r) continue;
                pts.push(X(i) + ',' + Y(r.c));
                alto.push(X(i) + ',' + Y(r.hi));
                baixo.push(X(i) + ',' + Y(r.lo));
            }
            if (banda && alto.length > 1) svg = `<polygon class="est-banda" style="--c: ${cor}" points="${alto.concat(baixo.slice().reverse()).join(' ')}"></polygon>` + svg;
            if (pts.length > 1) svg += `<polyline class="est-l est-l--proj${cls || ''}" style="--c: ${cor}" points="${pts.join(' ')}"></polyline>`;
        }
        return svg;
    }

    // ---- mapa de calor ----
    function blocoMapa(tela, b, ctx, op) {
        const e = escolhaDe(tela, ctx, b);
        const m = M[e.metrica];
        const f = Object.assign({}, ctx.f, e.fix || {});
        const P = ctx.P;
        let cols;
        let linhas;
        if (b.modo === 'anoMes') {
            const anos = anosNoPeriodo(P);
            if (P.comProj && P.fimProj > diaDe(ULT.ano, 11, 31)) anos.push(ULT.ano + 1);
            cols = MESES.map((x) => ({ rot: x }));
            linhas = anos.slice().reverse().map((a) => ({
                rot: String(a),
                cels: MESES.map((x, mes) => {
                    const ini = Math.max(diaDe(a, mes, 1), P.ini);
                    const fim = Math.min(diaDe(a, mes + 1, 1) - 1, P.fimProj);
                    if (fim < ini) return null;
                    const r = agregarP(m, f, ini, fim);
                    return r ? { r, tip: rotMes((a - ANO0) * 12 + mes) } : null;
                }),
                total: agregar(m, f, Math.max(diaDe(a, 0, 1), P.ini), Math.min(diaDe(a, 11, 31), P.fim)),
            }));
        } else if (b.modo === 'dim') {
            const bs = buckets(ESTADO.agrupar, P.ini, P.fimProj);
            const mostrar = rotulosEixo(bs, ESTADO.agrupar, 12);
            cols = bs.map((x, i) => ({ rot: mostrar.has(i) ? x.curto : '', ano: x.inicioAno && ESTADO.agrupar !== 'ano' ? x.ano : '' }));
            linhas = DIMS[b.dim].valores.map((x) => {
                const ff = Object.assign({}, f, { [b.dim]: x.v });
                return {
                    rot: x.n, cor: x.cor, dim: b.dim, v: x.v, sel: ctx.f[b.dim] === x.v,
                    cels: bs.map((bk) => {
                        const r = agregarP(m, ff, bk.ini, bk.fim);
                        return r ? { r, tip: x.n + ' · ' + bk.rot } : null;
                    }),
                    total: agregar(m, ff, P.ini, P.fim),
                };
            });
        } else {
            const anos = anosNoPeriodo(P);
            cols = anos.map((a) => ({ rot: String(a) + (a === ULT.ano ? '*' : '') }));
            if (P.comProj) cols.push({ rot: ULT.ano + ' proj.' });
            linhas = DIMS[b.dim].valores.map((x) => {
                const ff = Object.assign({}, f, { [b.dim]: x.v });
                const cels = anos.map((a) => {
                    const ini = Math.max(diaDe(a, 0, 1), P.ini);
                    const fim = Math.min(diaDe(a, 11, 31), P.fim);
                    const r = fim >= ini ? agregarP(m, ff, ini, fim) : null;
                    return r ? { r, tip: x.n + ' · ' + a + (a === ULT.ano ? ' até ' + rotDia(Math.min(fim, NH - 1)).slice(0, 5) : '') } : null;
                });
                if (P.comProj) {
                    const r = agregarP(m, ff, diaDe(ULT.ano, 0, 1), diaDe(ULT.ano, 11, 31));
                    cels.push(r ? { r, tip: x.n + ' · ' + ULT.ano + ' projetado' } : null);
                }
                return { rot: x.n, cor: x.cor, dim: b.dim, v: x.v, sel: ctx.f[b.dim] === x.v, cels, total: agregar(m, ff, P.ini, P.fim) };
            });
        }
        const vals = linhas.flatMap((l) => l.cels.filter(Boolean).map((c) => c.r.c));
        let min = vals.length ? Math.min(...vals) : 0;
        let max = vals.length ? Math.max(...vals) : 1;
        if (m.agreg === 'soma' || m.agreg === 'acima') min = Math.min(0, min);
        if (max - min < 1e-9) max = min + 1;
        const dv = divisorDe(Math.max(Math.abs(min), Math.abs(max)));
        // escala por linha: quando uma linha é muito maior que as outras (falta
        // de grão nas paradas), cada uma ganha a sua para mostrar quando pesa
        if (b.escalaPorLinha) {
            linhas.forEach((l) => {
                const vs = l.cels.filter(Boolean).map((c) => c.r.c);
                l.min = Math.min(0, ...vs);
                l.max = Math.max(l.min + 1e-9, ...vs);
            });
        }
        const texto = cols.length <= 16;
        const temProj = linhas.some((l) => l.cels.some((c) => c && c.r.proj));
        const nomeTot = m.agreg === 'soma' || m.agreg === 'acima' ? 'Total' : (m.agreg === 'max' ? 'Máx.' : 'Média');
        let html = `<div class="est-mapa${texto ? '' : ' is-denso'}" style="--nc: ${cols.length}"><span></span>`
            + cols.map((c) => `<span class="est-mapa-col">${c.rot}${c.ano ? `<b>${c.ano}</b>` : ''}</span>`).join('')
            + `<span class="est-mapa-col est-mapa-tot">${nomeTot}</span>`;
        linhas.forEach((l) => {
            const rot = l.cor ? `<span class="est-nome"><i class="du-dot" style="--du-c: ${l.cor}"></i>${l.rot}</span>` : l.rot;
            html += `<span class="est-mapa-rot${l.sel ? ' is-sel' : ''}"${l.dim ? ` data-est-recorte="${l.dim}" data-v="${l.v}" title="Filtrar a tela por ${aspas(l.rot)}"` : ''}>${rot}</span>`;
            html += l.cels.map((c) => {
                if (!c) return '<i class="est-cel is-vazio"></i>';
                const p = b.escalaPorLinha
                    ? clamp((c.r.c - l.min) / (l.max - l.min), 0, 1)
                    : clamp((c.r.c - min) / (max - min), 0, 1);
                const tip = tipDe([c.tip + (c.r.proj ? ' · projeção' : ''), fmtM(m, c.r.c), c.r.proj && c.r.hi - c.r.lo > 1e-9 ? 'faixa ' + faixaTxt(m, c.r) : '']);
                return `<i class="est-cel${p > 0.55 ? ' is-forte' : ''}${c.r.proj ? ' is-proj' : ''}" style="--p: ${p.toFixed(3)}" data-tip="${tip}">${texto ? curto(m, c.r.c, dv) : ''}</i>`;
            }).join('');
            html += `<b class="est-mapa-tot">${l.total == null ? '' : curto(m, l.total, dv)}</b>`;
        });
        html += '</div>';
        const titulo = (b.titulo || e.titulo || m.rotulo) + ' · ' + unidadeTxt(m, dv);
        const leg = b.escalaPorLinha
            ? `<span class="est-escala"><span>menor</span><i class="est-escala-barra"></i><span>maior da linha</span></span>` + (temProj ? legItem('est-leg--proj', 'projeção', 'var(--est-seq-1)') : '')
            : legendaEscala(m, min, max, dv, temProj);
        return secao(op, 'est-mapa-sec', cabecalho(titulo, leg), html);
    }

    // ---- calendário: uma faixa por ano, um traço por dia ----
    const DIAS_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

    function blocoCalendario(tela, b, ctx, op) {
        const m = M[b.metrica];
        const f = Object.assign({}, ctx.f, b.fix || {});
        const P = ctx.P;
        const s = serie(m, f);
        const p = m.peso ? pesoDe(m, f, 0) : null;
        const fim = Math.min(P.fim, NH - 1);
        let min = Infinity;
        let max = -Infinity;
        for (let d = P.ini; d <= fim; d++) {
            if (p && p[d] <= 1e-6) continue;
            if (s[d] < min) min = s[d];
            if (s[d] > max) max = s[d];
        }
        if (m.agreg === 'soma') min = 0;
        if (!(max > min)) max = min + 1;
        let nAcima = 0;
        const anos = anosNoPeriodo(P).reverse();
        const linhas = anos.map((a) => {
            const d0 = diaDe(a, 0, 1);
            let cels = '';
            const dFim = Math.min(diaDe(a, 11, 31), fim);
            for (let d = Math.max(d0, P.ini); d <= dFim; d++) {
                const pos = `grid-column: ${d - d0 + 1}`;
                if (p && p[d] <= 1e-6) {
                    cels += `<i class="est-dia is-vazio" style="${pos}" data-tip="${tipDe([rotDia(d) + ' · ' + DIAS_SEM[CAL.dow[d]], 'sem movimento'])}"></i>`;
                    continue;
                }
                const v = s[d];
                const acima = b.limiar != null && v > b.limiar;
                if (acima) nAcima++;
                cels += `<i class="est-dia${acima ? ' is-acima' : ''}" style="${pos}; --p: ${clamp((v - min) / (max - min), 0, 1).toFixed(2)}" data-tip="${tipDe([rotDia(d) + ' · ' + DIAS_SEM[CAL.dow[d]], fmtM(m, v)])}"></i>`;
            }
            return `<div class="est-cal-ano"><span class="est-cal-rot">${a}</span><div class="est-cal-grade">${cels}</div></div>`;
        }).join('');
        const meses = MESES.map((x, mes) => `<span style="grid-column: ${diaDe(2025, mes, 1) - diaDe(2025, 0, 1) + 1} / span 28">${x}</span>`).join('');
        const dv = divisorDe(max);
        const leg = legendaEscala(m, min, max, dv, false)
            + (b.limiar != null ? legItem('est-leg--acima', `${b.rotuloLimiar} · ${nAcima} ${nAcima === 1 ? 'dia' : 'dias'}`) : '')
            + (p ? legItem('est-leg--vazio', 'sem movimento') : '');
        const corpo = `<div class="est-cal"><div class="est-cal-ano est-cal-meses"><span></span><div class="est-cal-grade">${meses}</div></div>${linhas}</div>`;
        return secao(op, 'est-cal-sec', cabecalho(b.titulo + ' · ' + unidadeTxt(m), leg), corpo);
    }

    // ---- gráficos pequenos lado a lado ----
    function miniGrafico(it, bs, comum, P) {
        const n = bs.length;
        const s0 = it.series[0];
        const vals = [];
        it.series.forEach((s) => s.v.forEach((r) => { if (r) vals.push(r.c, r.lo, r.hi); }));
        it.refs.forEach((r) => vals.push(r.valor));
        if (it.faixa) vals.push(it.faixa[0], it.faixa[1]);
        const esc = comum || escala(vals, false);
        const yv = (v) => clamp((v - esc.min) / (esc.max - esc.min), 0, 1);
        const X = (i) => ((i + 0.5) / n * 100).toFixed(3);
        const Y = (v) => (100 - yv(v) * 100).toFixed(3);
        const svg = it.series.map((s) => linhaSvg(s.v, s.cor, X, Y, it.series.length === 1, '')).join('');
        const faixa = it.faixa ? `<i class="est-faixa-zona" style="--y0: ${yv(it.faixa[0]).toFixed(4)}; --y1: ${yv(it.faixa[1]).toFixed(4)}"></i>` : '';
        const refs = it.refs.map((r) => `<i class="est-ref" style="--y: ${yv(r.valor).toFixed(4)}"></i>`).join('');
        const i0 = bs.findIndex((x) => x.proj);
        const projArea = i0 >= 0 ? `<div class="est-proj-area" style="--x0: ${(i0 / n * 100).toFixed(3)}%"></div>` : '';
        const cols = bs.map((x, i) => `<i data-tip="${tipDe([x.rot + (x.proj ? ' · projeção' : ''), ...it.series.map((s) => (s.nome ? s.nome + ': ' : '') + (s.v[i] ? fmtM(s.m, s.v[i].c) : '—'))])}"></i>`).join('');
        const valor = agregar(s0.m, s0.f, P.ini, P.fim);
        const ref = referencia(s0.m, s0.f, P.ini, P.fim, ESTADO.comparar === 'media' ? 'media' : 'ano');
        const dl = delta(s0.m, valor, ref);
        const legS = it.series.length > 1
            ? `<span class="est-mini-leg">${it.series.map((s) => legItem('est-leg--linha', s.nome + ' ' + fmt(agregar(s.m, s.f, P.ini, P.fim), s.m.casas), s.cor)).join('')}</span>`
            : `<b>${fmtM(s0.m, valor)}</b>${dl ? deltaHtml(dl, '') : ''}`;
        const attrs = it.dim ? ` data-est-recorte="${it.dim}" data-v="${it.v}" title="Filtrar a tela por ${aspas(it.nome)}"` : '';
        return `<div class="est-mini${it.apagado ? ' is-apagado' : ''}${it.sel ? ' is-sel' : ''}"${attrs}>
            <div class="est-mini-head"><span class="est-nome">${it.cor ? `<i class="du-dot" style="--du-c: ${it.cor}"></i>` : ''}${it.nome}</span>${legS}</div>
            <div class="est-mini-graf">
                <span class="est-mini-y" aria-hidden="true"><span>${abrev(esc.max, esc.passo)}</span><span>${abrev(esc.min, esc.passo)}</span></span>
                <div class="est-mini-plot">${faixa}${refs}${projArea}<svg class="est-linhas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg><div class="est-mini-cols" style="--n: ${n}">${cols}</div></div>
            </div>
            <div class="est-mini-x" aria-hidden="true"><span>${bs[0] ? bs[0].rot : ''}</span><span>${bs[n - 1] ? bs[n - 1].rot : ''}</span></div>
        </div>`;
    }

    function blocoMultiplos(tela, b, ctx, op) {
        const P = ctx.P;
        const bs = buckets(ESTADO.agrupar, P.ini, P.fimProj);
        const e = escolhaDe(tela, ctx, b);
        let itens;
        if (b.porDim) {
            const D = DIMS[b.porDim];
            const sel = ctx.f[b.porDim];
            itens = D.valores.map((x) => ({
                nome: x.n, cor: x.cor, dim: b.porDim, v: x.v,
                apagado: !D.semTodos && sel && sel !== '*' && sel !== x.v,
                sel: D.semTodos && sel === x.v,
                series: [{ m: M[e.metrica], f: Object.assign({}, ctx.f, e.fix || {}, { [b.porDim]: x.v }), cor: x.cor }],
                refs: e.refs || [],
                faixa: b.faixaDim ? [x.min, x.max] : null,
            }));
        } else {
            itens = b.itens.map((it) => ({
                nome: it.nome || M[it.metrica || it.series[0].metrica].rotulo,
                series: (it.series || [{ metrica: it.metrica, cor: it.cor }]).map((s) => ({ m: M[s.metrica], f: Object.assign({}, ctx.f, s.fix || {}), cor: s.cor || 'var(--viz-real)', nome: s.nome })),
                refs: it.refs || [],
            }));
        }
        itens.forEach((it) => it.series.forEach((s) => { s.v = bs.map((x) => agregarP(s.m, s.f, x.ini, x.fim)); }));
        let comum = null;
        if (b.escalaComum) {
            const vals = itens.flatMap((it) => it.series.flatMap((s) => s.v.filter(Boolean).flatMap((r) => [r.c, r.lo, r.hi])));
            itens.forEach((it) => it.refs.forEach((r) => vals.push(r.valor)));
            comum = escala(vals, false);
        }
        const unidade = b.porDim ? ' · ' + unidadeTxt(M[e.metrica]) : '';
        const titulo = (b.titulo || ((e.titulo || M[e.metrica].rotulo) + ' por ' + DIMS[b.porDim].rotulo.toLowerCase())) + unidade;
        let leg = '';
        if (P.comProj) leg += legItem('est-leg--proj', 'projeção e faixa provável', 'var(--viz-real)');
        (e.refs || []).filter((r) => r.rotulo && b.porDim).forEach((r) => { leg += legItem('est-leg--ref', r.rotulo); });
        if (b.faixaDim) leg += legItem('est-leg--faixa', 'faixa da zona (Tabela 12)');
        if (!b.porDim) itens.forEach((it) => it.refs.filter((r) => r.rotulo).forEach((r) => { leg += legItem('est-leg--ref', it.nome.toLowerCase() + ': ' + r.rotulo); }));
        if (b.porDim) leg += '<span>clique filtra a tela</span>';
        const minis = itens.map((it) => miniGrafico(it, bs, comum, P)).join('');
        return secao(op, 'est-mult-sec', cabecalho(titulo, leg), `<div class="est-multiplos" style="--mc: ${b.colunas || Math.min(3, itens.length)}">${minis}</div>`);
    }

    // ---- composição de cada ano ----
    function blocoComposicao(tela, b, ctx, op) {
        const m = M[b.metrica];
        const D = DIMS[b.dim];
        const P = ctx.P;
        const sel = ctx.f[b.dim];
        const linhas = anosNoPeriodo(P).map((a) => {
            const ini = Math.max(diaDe(a, 0, 1), P.ini);
            const fim = Math.min(diaDe(a, 11, 31), P.fim, NH - 1);
            const partes = D.valores.map((x) => ({ x, v: agregar(m, Object.assign({}, ctx.f, { [b.dim]: x.v }), ini, fim) || 0 }));
            let sub = '';
            if (ini > diaDe(a, 0, 1)) sub = 'desde ' + rotDia(ini).slice(0, 5);
            else if (fim < diaDe(a, 11, 31)) sub = 'até ' + rotDia(fim).slice(0, 5);
            return { rot: String(a), sub, partes };
        }).reverse();
        if (P.comProj && anosNoPeriodo(P).includes(ULT.ano)) {
            const partes = D.valores.map((x) => {
                const r = agregarP(m, Object.assign({}, ctx.f, { [b.dim]: x.v }), diaDe(ULT.ano, 0, 1), diaDe(ULT.ano, 11, 31));
                return { x, v: r ? r.c : 0 };
            });
            linhas.unshift({ rot: String(ULT.ano), sub: 'proj.', partes, proj: true });
        }
        linhas.forEach((l) => { l.total = l.partes.reduce((s, x) => s + x.v, 0); });
        const maxTot = Math.max(1e-9, ...linhas.map((l) => l.total));
        const dv = divisorDe(maxTot);
        const pct = b.modo === 'pct';
        const corpo = linhas.map((l) => {
            const segs = l.partes.filter((x) => x.v > 0).map((x) => {
                const w = pct ? x.v / (l.total || 1) : x.v / maxTot;
                const share = x.v / (l.total || 1) * 100;
                const txt = w >= 0.08 ? (pct ? fmt(share, 0) + '%' : curto(m, x.v, dv)) : '';
                const apagado = sel && sel !== '*' && sel !== x.x.v;
                return `<i class="${apagado ? 'is-apagado' : ''}" style="--w: ${(w * 100).toFixed(2)}%; --c: ${x.x.cor}" data-est-recorte="${b.dim}" data-v="${x.x.v}" data-tip="${tipDe([x.x.n + ' · ' + l.rot + (l.proj ? ' projetado' : (l.sub ? ' (' + l.sub + ')' : '')), fmtM(m, x.v), fmt(share, 1) + '% do ano'])}">${txt}</i>`;
            }).join('');
            return `<div class="est-comp-linha${l.proj ? ' is-proj' : ''}"><span class="est-comp-rot">${l.rot}${l.sub ? `<small>${l.sub}</small>` : ''}</span><span class="est-comp-barra">${segs}</span><b>${curto(m, l.total, dv)}</b></div>`;
        }).join('');
        const presentes = D.valores.filter((x) => linhas.some((l) => l.partes.some((p) => p.x.v === x.v && p.v > 0)));
        const leg = presentes.map((x) => `<span><i class="du-dot" style="--du-c: ${x.cor}"></i>${x.n}</span>`).join('');
        const titulo = b.titulo + ' · ' + (pct ? '% · total em ' : '') + unidadeTxt(m, dv);
        return secao(op, 'est-comp-sec', cabecalho(titulo, leg), `<div class="est-comp">${corpo}</div>`);
    }

    // ---- Pareto ----
    function blocoPareto(tela, b, ctx, op) {
        const m = M[b.metrica];
        const D = DIMS[b.dim];
        const P = ctx.P;
        const linhas = D.valores.map((x) => ({ x, v: agregar(m, Object.assign({}, ctx.f, { [b.dim]: x.v }), P.ini, P.fim) || 0 }))
            .sort((a, c) => c.v - a.v);
        const total = linhas.reduce((s, l) => s + l.v, 0) || 1;
        const max = linhas[0] && linhas[0].v ? linhas[0].v : 1;
        let acum = 0;
        const sel = ctx.f[b.dim];
        const corpo = linhas.map((l) => {
            const antes = acum;
            acum += l.v / total * 100;
            return `<div class="est-par-linha${antes < 80 ? ' is-vital' : ''}${sel === l.x.v ? ' is-sel' : ''}" data-est-recorte="${b.dim}" data-v="${l.x.v}" data-tip="${tipDe([l.x.n, fmtM(m, l.v), fmt(l.v / total * 100, 1) + '% do total · acumulado ' + fmt(acum, 0) + '%'])}">
                <span class="est-nome"><i class="du-dot" style="--du-c: ${l.x.cor}"></i>${l.x.n}</span>
                <span class="est-par-barra"><i style="--p: ${(l.v / max).toFixed(3)}; --c: ${l.x.cor}"></i></span>
                <b>${fmt(l.v, m.casas)}</b><span>${fmt(l.v / total * 100, 1)}</span><span class="est-par-acum">${fmt(acum, 0)}</span>
            </div>`;
        }).join('');
        const head = `<div class="est-par-linha est-par-head"><span>${D.rotulo}</span><span></span><span>${m.unidade}</span><span>% total</span><span>% acum.</span></div>`;
        return secao(op, 'est-par-sec', cabecalho(b.titulo + ' · ' + P.rot, '<span>em destaque: os que somam 80%</span>'), `<div class="est-pareto">${head}${corpo}</div>`);
    }

    // ---- dispersão ----
    function blocoDispersao(tela, b, ctx, op) {
        const mx = M[b.x];
        const my = M[b.y];
        const P = ctx.P;
        let pts = [];
        if (b.por === 'dim') {
            pts = DIMS[b.dim].valores.map((x) => {
                const ff = Object.assign({}, ctx.f, { [b.dim]: x.v });
                return { x: agregar(mx, ff, P.ini, P.fim), y: agregar(my, ff, P.ini, P.fim), cor: x.cor, rot: x.n, dim: b.dim, v: x.v, sel: ctx.f[b.dim] === x.v };
            }).filter((p) => p.x != null && p.y != null);
        } else {
            for (let km = P.kmIni; km <= P.kmFim; km++) {
                const ini = iniMes(km);
                const fim = fimMes(km);
                if (b.minimo) {
                    const w = agregar(M[b.minimo.metrica], ctx.f, ini, fim);
                    if (w == null || w < b.minimo.valor) continue;
                }
                const x = agregar(mx, ctx.f, ini, fim);
                const y = agregar(my, ctx.f, ini, fim);
                if (x != null && y != null) pts.push({ x, y, ano: ANO0 + Math.floor(km / 12), rot: rotMes(km) });
            }
        }
        const ex = escala(pts.map((p) => p.x), b.por === 'dim' && mx.agreg === 'soma');
        const ey = escala(pts.map((p) => p.y), false);
        const px = (v) => clamp((v - ex.min) / (ex.max - ex.min), 0, 1) * 100;
        const py = (v) => clamp((v - ey.min) / (ey.max - ey.min), 0, 1) * 100;
        let grade = '';
        let eixoY = '';
        let eixoX = '';
        for (let v = ey.min; v <= ey.max + ey.passo / 1000; v += ey.passo) {
            grade += `<i class="est-grade" style="--y: ${(py(v) / 100).toFixed(4)}"></i>`;
            eixoY += `<span style="--y: ${(py(v) / 100).toFixed(4)}">${abrev(v, ey.passo)}</span>`;
        }
        for (let v = ex.min; v <= ex.max + ex.passo / 1000; v += ex.passo) {
            grade += `<i class="est-gx" style="--x: ${(px(v) / 100).toFixed(4)}"></i>`;
            eixoX += `<span style="--x: ${(px(v) / 100).toFixed(4)}">${abrev(v, ex.passo)}</span>`;
        }
        let extra = '';
        let leitura = '';
        const anos = pts.map((p) => p.ano).filter(Boolean);
        const aMin = anos.length ? Math.min(...anos) : 0;
        const aMax = anos.length ? Math.max(...anos) : 0;
        if (b.por === 'dim') {
            const mxT = agregar(mx, Object.assign({}, ctx.f, { [b.dim]: '*' }), P.ini, P.fim);
            const myT = agregar(my, Object.assign({}, ctx.f, { [b.dim]: '*' }), P.ini, P.fim);
            const xm = mx.agreg === 'soma' && pts.length ? mxT / pts.length : mxT;
            if (xm != null) extra += `<i class="est-media-x" style="--x: ${(px(xm) / 100).toFixed(4)}"></i>`;
            if (myT != null) extra += `<i class="est-media-y" style="--y: ${(py(myT) / 100).toFixed(4)}"></i>`;
            leitura = `tracejado: ${mx.agreg === 'soma' ? 'média por ' + DIMS[b.dim].rotulo.toLowerCase() : 'média'} e média geral`;
        } else if (pts.length > 2) {
            const mxv = pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const myv = pts.reduce((s, p) => s + p.y, 0) / pts.length;
            const sxx = pts.reduce((s, p) => s + (p.x - mxv) ** 2, 0);
            const sxy = pts.reduce((s, p) => s + (p.x - mxv) * (p.y - myv), 0);
            const k = sxx ? sxy / sxx : 0;
            const a0 = myv - k * mxv;
            extra += `<svg class="est-linhas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline class="est-tend" points="${px(ex.min).toFixed(2)},${(100 - py(a0 + k * ex.min)).toFixed(2)} ${px(ex.max).toFixed(2)},${(100 - py(a0 + k * ex.max)).toFixed(2)}"></polyline></svg>`;
            leitura = `a cada +1 ${b.xLeitura || mx.unidade}, ${b.yLeitura || my.rotulo.toLowerCase()} ${k >= 0 ? 'sobe' : 'cai'} ${fmt(Math.abs(k), 1)} ${my.unidade}`;
        }
        const pontos = pts.map((p) => {
            const tip = tipDe([p.rot, mx.rotulo + ': ' + fmtM(mx, p.x), my.rotulo + ': ' + fmtM(my, p.y)]);
            if (b.por === 'dim') {
                return `<i class="est-pt${p.sel ? ' is-sel' : ''}" style="--x: ${px(p.x).toFixed(2)}; --y: ${py(p.y).toFixed(2)}; --c: ${p.cor}" data-est-recorte="${p.dim}" data-v="${p.v}" data-tip="${tip}"></i>`
                    + `<span class="est-pt-rot" style="--x: ${px(p.x).toFixed(2)}; --y: ${py(p.y).toFixed(2)}">${p.rot.replace(/^(Faz\.|Sítio) /, '')}</span>`;
            }
            const o = aMax > aMin ? 0.25 + 0.75 * (p.ano - aMin) / (aMax - aMin) : 1;
            return `<i class="est-pt est-pt--mes${p.ano === ULT.ano ? ' is-atual' : ''}" style="--x: ${px(p.x).toFixed(2)}; --y: ${py(p.y).toFixed(2)}; --c: var(--viz-real); --o: ${o.toFixed(2)}" data-tip="${tip}"></i>`;
        }).join('');
        let leg = `<span>↔ ${mx.rotulo} (${mx.unidade}) · ↕ ${my.rotulo} (${my.unidade})</span>`;
        if (b.por !== 'dim') leg += `<span><i class="est-leg est-leg--pt"></i>cada ponto é um mês · mais forte = mais recente</span>`;
        if (leitura) leg += legItem('est-leg--tend', leitura);
        const corpo = `<div class="est-disp">
            <div class="est-disp-y" aria-hidden="true">${eixoY}</div>
            <div class="est-disp-plot" role="img" aria-label="${aspas(b.titulo)}">${grade}${extra}${pontos}</div>
            <div class="est-disp-x" aria-hidden="true">${eixoX}</div>
        </div>`;
        return secao(op, 'est-disp-sec', cabecalho(b.titulo + ' · ' + P.rot, leg), corpo);
    }

    // ---- acumulado do ano, ano contra ano ----
    function graficoAcumulado(m, f, op, titulo, forcarProj) {
        const comProj = forcarProj || ESTADO.projecao !== 'off';
        const series = ANOS.map((a) => {
            let acc = 0;
            let accLo = 0;
            let accHi = 0;
            const pts = [];
            for (let mes = 0; mes < 12; mes++) {
                const ini = diaDe(a, mes, 1);
                const fim = diaDe(a, mes + 1, 1) - 1;
                if (ini >= NT) break;
                if (!comProj && ini >= NH) break;
                const r = agregarP(m, f, ini, fim);
                if (!r) break;
                acc += r.c;
                accLo += r.proj ? r.lo : r.c;
                accHi += r.proj ? r.hi : r.c;
                pts.push({ mes, c: acc, lo: accLo, hi: accHi, proj: r.proj });
            }
            return { a, pts };
        });
        const valores = series.flatMap((s) => s.pts.flatMap((p) => [p.c, p.hi]));
        const esc = escala(valores, true);
        const yv = (v) => clamp((v - esc.min) / (esc.max - esc.min), 0, 1);
        const X = (i) => ((i + 0.5) / 12 * 100).toFixed(3);
        const Y = (v) => (100 - yv(v) * 100).toFixed(3);
        let svg = '';
        let rotulos = '';
        let grade = '';
        let eixoY = '';
        for (let v = esc.min; v <= esc.max + esc.passo / 1000; v += esc.passo) {
            grade += `<i class="est-grade" style="--y: ${yv(v).toFixed(4)}"></i>`;
            eixoY += `<span style="--y: ${yv(v).toFixed(4)}">${abrev(v, esc.passo)}</span>`;
        }
        series.forEach((s) => {
            const atual = s.a === ULT.ano;
            const cor = atual ? 'var(--viz-real)' : (s.a === ULT.ano - 1 ? 'var(--muted)' : 'var(--faint)');
            const cls = atual ? ' est-l--forte' : (s.a === ULT.ano - 1 ? '' : ' est-l--fraca');
            const real = s.pts.filter((p) => !p.proj);
            const proj = s.pts.filter((p) => p.proj);
            if (real.length > 1) svg += `<polyline class="est-l${cls}" style="--c: ${cor}" points="${real.map((p) => X(p.mes) + ',' + Y(p.c)).join(' ')}"></polyline>`;
            if (proj.length) {
                const base = real[real.length - 1];
                const pts = (base ? [base] : []).concat(proj);
                const alto = pts.map((p) => X(p.mes) + ',' + Y(p.hi));
                const baixo = pts.map((p) => X(p.mes) + ',' + Y(p.lo)).reverse();
                svg += `<polygon class="est-banda" style="--c: ${cor}" points="${alto.concat(baixo).join(' ')}"></polygon>`;
                svg += `<polyline class="est-l est-l--proj${cls}" style="--c: ${cor}" points="${pts.map((p) => X(p.mes) + ',' + Y(p.c)).join(' ')}"></polyline>`;
            }
            const ult = s.pts[s.pts.length - 1];
            if (ult) rotulos += `<span class="est-rotulo-ano${atual ? ' is-atual' : ''}" style="left: ${X(ult.mes)}%; bottom: ${(yv(ult.c) * 100).toFixed(2)}%; --c: ${cor}">${s.a}${ult.proj ? '*' : ''} · ${m.unidade === 'R$' ? 'R$ ' : ''}${abrev(ult.c, ult.c >= 10000 ? 1000 : 1)}</span>`;
        });
        const cols = Array.from({ length: 12 }, (_, i) => `<div class="est-col" data-est-pos="${i}"></div>`).join('');
        TIP[op.key] = { tipo: 'acumulado', series, m };
        const leg = legItem('est-leg--linha', String(ULT.ano), 'var(--viz-real)') + legItem('est-leg--linha', String(ULT.ano - 1), 'var(--muted)')
            + legItem('est-leg--linha', 'anos anteriores', 'var(--faint)')
            + (comProj ? legItem('est-leg--proj', 'projeção (*) e faixa provável', 'var(--viz-real)') : '');
        return `<div data-codigo="${op.codigo}" class="content-section du-section est-section est-section--grafico" style="${op.estilo}" data-est-tipid="${op.key}">
            <div class="section-head est-graf-head">
                <h3>${titulo.toUpperCase()} · ${unidadeTxt(m).toUpperCase()}</h3>
                <span class="du-legenda">${leg}</span>
            </div>
            <div class="est-graf est-graf--rotulos est-graf--rotulos-valor" style="--n: 12">
                <div class="est-eixo-y" aria-hidden="true">${eixoY}</div>
                <div class="est-plot" role="img" aria-label="${aspas(titulo)}, ${ANOS[0]} a ${ULT.ano}">
                    ${grade}
                    ${comProj ? `<div class="est-proj-area" style="--x0: ${((ULT.mes + 1) / 12 * 100).toFixed(3)}%"><span>projeção</span></div>` : ''}
                    <svg class="est-linhas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>
                    ${rotulos}
                    <div class="est-cols">${cols}</div>
                </div>
                <div class="est-eixo-x" aria-hidden="true">${MESES.map((x) => `<span>${x}</span>`).join('')}</div>
            </div>
        </div>`;
    }

    function blocoAcumulado(tela, b, ctx, op) {
        return graficoAcumulado(M[b.metrica], Object.assign({}, ctx.f, b.fix || {}), op, b.titulo);
    }

    function renderBloco(tela, b, ctx, op) {
        switch (b.tipo) {
            case 'tempo': return grafico(tela, b.seletor ? cfgGrafico(tela, ctx.t) : b.grafico, ctx.f, ctx.P, op);
            case 'recorte': return recorte(tela, ctx.f, ctx.P, op, b);
            case 'anos': return tabelaAnos(tela, ctx.f, op, b.colunas);
            case 'mapa': return blocoMapa(tela, b, ctx, op);
            case 'calendario': return blocoCalendario(tela, b, ctx, op);
            case 'multiplos': return blocoMultiplos(tela, b, ctx, op);
            case 'composicao': return blocoComposicao(tela, b, ctx, op);
            case 'pareto': return blocoPareto(tela, b, ctx, op);
            case 'dispersao': return blocoDispersao(tela, b, ctx, op);
            case 'acumulado': return blocoAcumulado(tela, b, ctx, op);
            default: return '';
        }
    }

    // linhas da grade podem encolher abaixo do conteúdo (o encaixe da tela decide)
    const trilhas = (s) => s.split(/\s+/).map((x) => (/fr$/.test(x) ? `minmax(0, ${x})` : x)).join(' ');
    const pesosDe = (s) => s.trim().split(/\s+/).map((x) => parseFloat(x) || 1);
    const matrizDe = (grade) => grade.areas.map((l) => l.trim().split(/\s+/));

    // Quando nenhum bloco atravessa as colunas da grade, cada coluna vira uma
    // pilha: o bloco entra com o peso das linhas que ocupava. Assim a coluna
    // se reparte pelo conteúdo (a tabela do recorte fica do tamanho das suas
    // linhas e o ano a ano leva o resto) em vez de cortar linhas da tabela.
    // Devolve null quando algum bloco atravessa colunas: a grade fica como é.
    function colunasDe(grade) {
        const mat = matrizDe(grade);
        const pesos = pesosDe(grade.rows);
        const pilhas = mat[0].map((_, j) => {
            const pilha = [];
            mat.forEach((linha, i) => {
                let it = pilha.find((x) => x.area === linha[j]);
                if (!it) {
                    it = { area: linha[j], peso: 0 };
                    pilha.push(it);
                }
                it.peso += pesos[i] == null ? 1 : pesos[i];
            });
            return pilha;
        });
        const areas = pilhas.flatMap((p) => p.map((x) => x.area));
        return new Set(areas).size === areas.length ? pilhas : null;
    }

    // fração da largura da grade que cada bloco ocupa (gráfico estreito leva
    // menos rótulos no eixo)
    function larguraDasAreas(grade) {
        const pesos = pesosDe(grade.cols);
        const total = pesos.reduce((s, v) => s + v, 0) || 1;
        const out = {};
        matrizDe(grade).forEach((linha) => {
            const daLinha = {};
            linha.forEach((a, j) => { daLinha[a] = (daLinha[a] || 0) + (pesos[j] == null ? 1 : pesos[j]) / total; });
            Object.keys(daLinha).forEach((a) => { out[a] = Math.max(out[a] || 0, daLinha[a]); });
        });
        return out;
    }

    // ---------- tela padrão: filtros, KPIs e a grade de blocos da tela ----------
    function telaPadrao(tela) {
        const t = estadoTela(tela);
        const f = Object.assign({}, t.dims);
        const P = periodo();
        const ctx = { t, f, P };
        const kpis = tela.kpis.map((k) => kpiHtml(k, tela, f, P)).join('') + kpiProjecao(tela, f, P);
        const nK = tela.kpis.length + (tela.kpiProj === false || ESTADO.projecao === 'off' ? 0 : 1);
        const grade = tela.grade || GRADE_PADRAO;
        const pilhas = colunasDe(grade);
        const larguras = larguraDasAreas(grade);
        let letra = 66;    // B, C, D... (A são os KPIs)
        const html = {};
        tela.blocos.forEach((b) => {
            const pilha = pilhas && pilhas.find((p) => p.some((x) => x.area === b.area));
            // a tabela do recorte fica do tamanho das suas linhas; o resto da
            // coluna é dos vizinhos (sozinha na coluna, ela ocupa tudo)
            const solta = pilha && pilha.length > 1 && b.tipo === 'recorte';
            let estilo = `grid-area: ${b.area}`;
            if (pilha) estilo = solta ? 'flex: 0 1 auto' : `flex: ${pilha.find((x) => x.area === b.area).peso.toFixed(3)} 1 0`;
            html[b.area] = renderBloco(tela, b, ctx, {
                codigo: tela.codigo + '-' + String.fromCharCode(letra++),
                area: b.area,
                estilo,
                solta,
                larg: larguras[b.area] || 1,
                key: tela.id + ':' + b.area,
            });
        });
        const colsCss = `grid-template-columns: ${trilhas(grade.cols)}`;
        const corpo = pilhas
            ? `<div class="est-grade-tela est-grade-tela--cols" style="${colsCss}">${pilhas.map((p) => `<div class="est-coluna">${p.map((x) => html[x.area] || '').join('')}</div>`).join('')}</div>`
            : `<div class="est-grade-tela" style="grid-template-areas: ${grade.areas.map((a) => `'${a}'`).join(' ')}; ${colsCss}; grid-template-rows: ${trilhas(grade.rows)}">${tela.blocos.map((b) => html[b.area]).join('')}</div>`;
        return htmlFiltros(tela, t)
            + `<div class="kpi-grid est-kpis" style="--k: ${nK}">${kpis}</div>`
            + corpo
            + (tela.nota ? `<p class="est-nota">${tela.nota}</p>` : '');
    }

    // ---------- visão geral: o caminho do grão ----------
    // Em cima, o volume que entra, seca e sai (gráfico longo) e quanto do ano
    // já foi feito. Embaixo, as etapas na ordem em que o grão passa por elas,
    // cada uma com o histórico ano a ano (o mês a mês só mostrava a safra).
    const ETAPAS = [
        { nome: 'Recepção', metrica: 'rec', goto: 'est-recepcao' },
        { nome: 'Classificação', metrica: 'umidade', goto: 'est-classificacao' },
        { nome: 'Moegas', metrica: 'vazao', goto: 'est-moegas' },
        { nome: 'Secagem', metrica: 'secado', goto: 'est-secagem' },
        { nome: 'Armazenagem', metrica: 'ocup', goto: 'est-armazenagem' },
        { nome: 'Expedição', metrica: 'exp', goto: 'est-expedicao' },
    ];
    const CLIMA = { nome: 'Clima', metrica: 'chuva', goto: 'est-clima' };
    const FECHAMENTO = [['Recebido', 'rec'], ['Secado', 'secado'], ['Expedido', 'exp']];

    // um valor por ano, do primeiro ao corrente: barras nas somas (do zero),
    // linha com pontos nas médias (a variação é pequena perto do nível)
    function historicoAnos(m) {
        const comProj = ESTADO.projecao !== 'off';
        const its = ANOS.map((a) => {
            const ini = diaDe(a, 0, 1);
            const fim = diaDe(a, 11, 31);
            if (a !== ULT.ano) return { a, v: agregar(m, {}, ini, fim), nota: '' };
            const r = comProj ? agregarP(m, {}, ini, fim) : null;
            return r ? { a, v: r.c, proj: true, nota: ' · projetado' } : { a, v: agregar(m, {}, ini, NH - 1), parcial: true, nota: ' · até ' + rotDia(NH - 1).slice(0, 5) };
        }).filter((x) => x.v != null);
        const vals = its.map((x) => x.v);
        const soma = m.agreg === 'soma';
        const max = Math.max(...vals, 1e-9);
        let corpo;
        if (soma) {
            corpo = its.map((x) => `<i class="est-ha-barra${x.proj ? ' is-proj' : ''}${x.parcial ? ' is-parcial' : ''}" style="--h: ${clamp(x.v / max, 0, 1).toFixed(3)}" data-tip="${tipDe([x.a + x.nota, fmtM(m, x.v)])}"></i>`).join('');
        } else {
            const min = Math.min(...vals);
            const amp = Math.max(max - min, Math.abs(max) * 0.02, 1e-9);
            const Y = (v) => 15 + (1 - (v - min) / amp) * 70;
            const X = (i) => (i + 0.5) / its.length * 100;
            corpo = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${its.map((x, i) => X(i).toFixed(2) + ',' + Y(x.v).toFixed(2)).join(' ')}"></polyline></svg>`
                + its.map((x, i) => `<i class="est-ha-ponto${x.proj ? ' is-proj' : ''}" style="left: ${X(i).toFixed(2)}%; top: ${Y(x.v).toFixed(2)}%" data-tip="${tipDe([x.a + x.nota, fmtM(m, x.v)])}"></i>`).join('');
        }
        const ult = its[its.length - 1];
        return `<span class="est-ha${soma ? '' : ' est-ha--linha'}" style="--n: ${its.length}" aria-hidden="true">${corpo}</span>`
            + `<span class="est-ha-eixo" aria-hidden="true"><span>${its[0] ? its[0].a : ''}</span><span>${ult ? ult.a + (ult.proj ? '*' : '') : ''}</span></span>`;
    }

    function etapaHtml(a, tela, P, cls) {
        const m = M[a.metrica];
        const v = agregar(m, {}, P.ini, P.fim);
        return `<button type="button" class="est-etapa${cls || ''}" data-goto="${a.goto}" title="Abrir ${a.nome}">
            <span class="est-etapa-nome">${a.nome}</span>
            <span class="est-etapa-rotulo">${m.rotulo}</span>
            <span class="kpi-value">${valorHtml(m, v)}</span>
            ${rodapeKpi(m, {}, P, v)}
            ${historicoAnos(m)}
        </button>`;
    }

    // quanto do ano já foi feito: barra cheia = realizado, hachura = o que a
    // projeção ainda espera, traço = fechamento do ano anterior
    function fechamentoHtml(tela) {
        const comProj = ESTADO.projecao !== 'off';
        const ini = diaDe(ULT.ano, 0, 1);
        const linhas = FECHAMENTO.map(([nome, id]) => {
            const m = M[id];
            const ate = agregar(m, {}, ini, NH - 1);
            const r = comProj ? agregarP(m, {}, ini, diaDe(ULT.ano, 11, 31)) : null;
            const ant = agregar(m, {}, diaDe(ULT.ano - 1, 0, 1), diaDe(ULT.ano - 1, 11, 31));
            return { nome, m, ate, r, ant };
        });
        const topo = Math.max(1e-9, ...linhas.map((l) => Math.max(l.ant || 0, l.r ? l.r.hi : l.ate || 0)));
        const pc = (v) => (clamp(v / topo, 0, 1) * 100).toFixed(2) + '%';
        const corpo = linhas.map((l) => {
            const dl = l.r ? delta(l.m, l.r.c, l.ant) : delta(l.m, l.ate, deslocado(l.m, {}, ini, NH - 1, 1));
            const feito = l.r && l.r.c ? Math.round(l.ate / l.r.c * 100) : null;
            const tip = tipDe([
                l.nome + ' · ' + ULT.ano,
                'até ' + rotDia(NH - 1).slice(0, 5) + ': ' + fmtM(l.m, l.ate),
                l.r ? 'projetado: ' + fmtM(l.m, l.r.c) + ' (' + faixaTxt(l.m, l.r) + ')' : '',
                (ULT.ano - 1) + ' fechado: ' + fmtM(l.m, l.ant),
            ]);
            return `<div class="est-fech-linha">
                <span class="est-fech-nome">${l.nome}</span>
                <span class="est-fech-valor"><b>${fmt(l.ate, 0)}</b>${l.r ? ` de ${fmt(l.r.c, 0)} t` : ' t'}${feito != null ? `<em>${feito}%</em>` : ''}</span>
                <span class="est-fech-barra" data-tip="${tip}">
                    ${l.r ? `<i class="is-proj" style="width: ${pc(l.r.c)}"></i>` : ''}
                    <i class="is-real" style="width: ${pc(l.ate)}"></i>
                    <i class="is-ant" style="left: ${pc(l.ant)}"></i>
                </span>
                ${deltaHtml(dl, l.r ? `projetado vs ${ULT.ano - 1} · faixa ${faixaCurta(l.m, l.r)}` : `vs mesmo período de ${ULT.ano - 1}`)}
            </div>`;
        }).join('');
        const leg = legItem('est-leg--barra', 'até ' + rotDia(NH - 1).slice(0, 5), 'var(--viz-real)')
            + (comProj ? legItem('est-leg--proj', 'falta, pela projeção', 'var(--viz-real)') : '')
            + legItem('est-leg--ref', (ULT.ano - 1) + ' fechado');
        return `<div data-codigo="${tela.codigo}-B" class="content-section du-section est-section est-fech">
            ${cabecalho('Quanto de ' + ULT.ano + ' já foi feito · t', leg)}
            <div class="est-fech-corpo">${corpo}</div>
        </div>`;
    }

    function telaPainel(tela) {
        const P = periodo();
        const t = { dims: {} };
        const graf = grafico(tela, {
            tipo: 'linha', titulo: 'O que entrou, secou e saiu',
            series: [
                { metrica: 'rec', nome: 'Recebido', cor: 'var(--est-c1)' },
                { metrica: 'secado', nome: 'Secado', cor: 'var(--est-c4)' },
                { metrica: 'exp', nome: 'Expedido', cor: 'var(--est-c2)' },
            ],
        }, {}, P, { codigo: tela.codigo + '-A', key: tela.id + ':a', estilo: '', larg: 0.6 });
        const etapas = ETAPAS.map((a, i) => etapaHtml(a, tela, P, i < ETAPAS.length - 1 ? ' tem-seta' : '')).join('');
        const recordes = [
            ['Recebimento', 'rec'], ['Expedição', 'exp'], ['Ocupação', 'ocup'], ['Umidade do grão', 'umidade'], ['Chuva', 'chuva'],
        ].map(([rot, id]) => {
            const m = M[id];
            let melhor = null;
            buckets('mes', P.ini, P.fim).forEach((b) => {
                const v = agregar(m, {}, b.ini, b.fim);
                if (v != null && (!melhor || v > melhor.v)) melhor = { v, b };
            });
            return `<li><span>${rot}</span><b>${melhor ? fmtM(m, melhor.v) : '—'}</b><em>${melhor ? melhor.b.rot : ''}</em></li>`;
        }).join('');
        const comProj = ESTADO.projecao !== 'off';
        return htmlFiltros(tela, t) + `<div class="est-geral">
            <div class="est-geral-topo">${graf}${fechamentoHtml(tela)}</div>
            <div class="est-geral-base">
                <div data-codigo="${tela.codigo}-C" class="content-section du-section est-section est-fluxo">
                    ${cabecalho('Da recepção à expedição · ' + P.rot, `<span>número: o período do filtro · embaixo: cada ano de ${ANOS[0]} a ${ULT.ano}${comProj ? ' (* projetado)' : ' (' + ULT.ano + ' só até ' + rotDia(NH - 1).slice(0, 5) + ')'}</span>`)}
                    <div class="est-fluxo-etapas">${etapas}</div>
                </div>
                <div data-codigo="${tela.codigo}-D" class="content-section du-section est-section est-fluxo est-fluxo--clima">
                    ${cabecalho('Clima')}
                    <div class="est-fluxo-etapas">${etapaHtml(CLIMA, tela, P, '')}</div>
                </div>
                <div data-codigo="${tela.codigo}-E" class="content-section du-section est-section est-rec-sec">
                    ${cabecalho('Recordes de um mês', '<span>' + P.rot + '</span>')}
                    <ul class="est-recordes">${recordes}</ul>
                </div>
            </div>
        </div>`;
    }

    // ---------- projeção do ano ----------
    const PROJ_INDICADORES = [
        { v: 'rec', n: 'Recebido' }, { v: 'exp', n: 'Expedido' }, { v: 'secado', n: 'Secado' },
        { v: 'cavacoT', n: 'Cavaco' }, { v: 'descontado', n: 'Descontos' }, { v: 'chuva', n: 'Chuva' },
    ];
    const PROJ_TABELA = ['rec', 'cam', 'secado', 'exp', 'cavacoT', 'descontado', 'custoRetorno', 'paradas', 'chuva', 'umidade', 'ocup', 'espera'];

    function telaProjecao(tela) {
        let t = ESTADO.telas[tela.id];
        if (!t || typeof t !== 'object') t = ESTADO.telas[tela.id] = { dims: {}, sel: 'rec' };
        if (!PROJ_INDICADORES.some((x) => x.v === t.sel)) t.sel = 'rec';
        const m = M[t.sel];
        const iniAno = (a) => diaDe(a, 0, 1);
        const fimAno = (a) => diaDe(a, 11, 31);

        // KPIs: fechamento projetado das somas principais
        const kp = ['rec', 'exp', 'secado', 'cavacoT'].map((id) => {
            const mm = M[id];
            const r = agregarP(mm, {}, iniAno(ULT.ano), fimAno(ULT.ano));
            const ant = agregar(mm, {}, iniAno(ULT.ano - 1), fimAno(ULT.ano - 1));
            return kpiCard(tela.codigo + '-A', '<span class="est-tag-proj">Projeção</span> ' + mm.rotulo + ' · ' + ULT.ano, r ? valorHtml(mm, r.c) : '—', rodapeProj(mm, r, ant, 'vs ' + (ULT.ano - 1)), 'est-kpi--proj');
        }).join('');

        // gráfico: acumulado do ano, mês a mês, de cada ano (aqui a projeção aparece sempre)
        const sel = PROJ_INDICADORES.map((o) => pill('data-est-sel', o.v, o.n, t.sel === o.v)).join('');
        const graf = graficoAcumulado(m, {}, { key: tela.id, codigo: tela.codigo + '-B', area: 'auto', estilo: '' }, 'Acumulado do ano · ' + m.rotulo, true);

        // tabela: cada indicador, o ano passado, o ano até hoje e o projetado
        const linhas = PROJ_TABELA.map((id) => {
            const mm = M[id];
            const ant = agregar(mm, {}, iniAno(ULT.ano - 1), fimAno(ULT.ano - 1));
            const ate = agregar(mm, {}, iniAno(ULT.ano), NH - 1);
            const r = agregarP(mm, {}, iniAno(ULT.ano), fimAno(ULT.ano));
            const r12 = agregarP(mm, {}, NH, NT - 1);
            const dl = r ? delta(mm, r.c, ant) : null;
            // a unidade fica ao lado do nome e a variação em coluna própria:
            // cada linha tem no máximo duas de texto e os 12 indicadores cabem
            const num = (v) => (v == null ? '—' : (mm.unidade === 'R$' ? 'R$ ' : '') + fmt(v, mm.casas));
            return `<tr><td class="pv-tabela-nome">${mm.rotulo}${mm.unidade === 'R$' ? '' : `<small>${mm.unidade}</small>`}</td>
                <td class="num">${num(ant)}</td>
                <td class="num">${num(ate)}</td>
                <td class="num est-cel-proj"><b>${num(r ? r.c : null)}</b><small class="est-faixa-cel">${r ? faixaCurta(mm, r) : ''}</small></td>
                <td class="num">${deltaHtml(dl, '')}</td>
                <td class="num est-cel-proj">${num(r12 ? r12.c : null)}<small class="est-faixa-cel">${r12 ? faixaCurta(mm, r12) : ''}</small></td>
            </tr>`;
        }).join('');
        const tabela = `<div data-codigo="${tela.codigo}-C" class="content-section du-section est-section est-anos">
            <div class="section-head">
                <h3>FECHAMENTO DE ${ULT.ano} · TODOS OS INDICADORES</h3>
                <span class="du-legenda"><span>embaixo do projetado, a faixa provável</span></span>
            </div>
            <div class="table-scroll table-scroll--livre est-scroll">
                <table class="pv-tabela du-tabela est-tabela est-tabela--proj">
                    <thead><tr><th>Indicador</th><th class="num">${ULT.ano - 1}<small>fechado</small></th><th class="num">${ULT.ano}<small>até ${rotDia(NH - 1).slice(0, 5)}</small></th><th class="num">${ULT.ano}<small>projetado</small></th><th class="num">▲▼<small>vs ${ULT.ano - 1}</small></th><th class="num">Próx. 12 meses<small>até ${rotDia(NT - 1)}</small></th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
        </div>`;
        const filtros = `<div class="est-filtros"><div class="est-filtros-linha">${grupo('Acumulado de', sel, 'est-fgrupo--mostrar')}</div></div>`;
        return filtros + `<div class="kpi-grid est-kpis" style="--k: 4">${kp}</div>`
            + `<div class="est-proj-corpo">${graf}${tabela}</div>`
            + `<p class="est-nota">Como a projeção é feita: cada dia que falta repete o mesmo dia de ${ULT.ano - 1}, ${ULT.ano - 2} e ${ULT.ano - 3}, cada um ajustado ao ritmo dos últimos 12 meses. O valor é a média dos três; a faixa vai do mais fraco ao mais forte e abre um pouco a cada mês à frente.</p>`;
    }

    // ---------- montagem ----------
    let versao = 0;
    const versaoTela = {};

    function corpoDe(id) {
        return document.querySelector('.est-corpo[data-est="' + id + '"]');
    }

    function montar(id) {
        const tela = TELA[id];
        const corpo = corpoDe(id);
        if (!tela || !corpo) return;
        let html;
        if (tela.tipo === 'painel') html = telaPainel(tela);
        else if (tela.tipo === 'projecao') html = telaProjecao(tela);
        else html = telaPadrao(tela);
        corpo.innerHTML = html;
        const meta = corpo.closest('.screen') && corpo.closest('.screen').querySelector('.screen-meta');
        if (meta) {
            const P = periodo();
            meta.textContent = tela.tipo === 'projecao'
                ? `ESTRATÉGICO • REAL ATÉ ${ULT_ROT} • PROJEÇÃO ATÉ ${rotDia(NT - 1)}`
                : `ESTRATÉGICO • ${P.rot.toUpperCase()} • REAL ATÉ ${ULT_ROT}${P.comProj ? ' • PROJEÇÃO ATÉ ' + rotDia(P.fimProj) : ''}`;
        }
        versaoTela[id] = versao;
        vigiar(id, corpo);
    }

    function telaAtiva() {
        const s = document.querySelector('.screen.active.screen--est');
        return s ? s.id.replace(/^screen-/, '') : null;
    }

    // ---------- encaixe: nada cortado ----------
    // No videowall ninguém rola: a tabela que não cabe no bloco aperta as
    // linhas e, se ainda faltar, reduz a letra, em passos (a rolagem interna
    // só sobra abaixo do último passo). Os rótulos de fim de linha dos
    // gráficos se afastam uns dos outros. Roda ao montar a tela e sempre que
    // um bloco muda de tamanho (janela, troca de tela, modo TV).
    const APERTO = [[1, 1], [0.6, 1], [0.3, 1], [0.3, 0.94], [0.1, 0.94], [0.1, 0.88], [0, 0.88], [0, 0.82], [0, 0.76], [0, 0.7]];   // [respiro da linha, letra]

    function encaixarTabela(w) {
        for (let i = 0; i < APERTO.length; i++) {
            w.style.setProperty('--est-pad', APERTO[i][0]);
            w.style.setProperty('--est-fs', APERTO[i][1]);
            w.classList.toggle('is-apertado', i >= 2);
            if (w.scrollHeight <= w.clientHeight && w.scrollWidth <= w.clientWidth) return;
        }
        // ainda passa na largura (modo TV, letra com piso alto): a letra desce
        // na proporção do que falta. Na altura, sobra a rolagem do bloco (no
        // modo TV ela anda sozinha).
        for (let k = 0; k < 3 && w.scrollWidth > w.clientWidth; k++) {
            const fs = parseFloat(w.style.getPropertyValue('--est-fs')) * (w.clientWidth / w.scrollWidth) * 0.98;
            w.style.setProperty('--est-fs', Math.max(0.5, fs).toFixed(3));
        }
    }

    // rótulos que terminam perto um do outro: mantêm a ordem e ganham distância
    function afastarRotulos(plot) {
        const rs = Array.from(plot.children).filter((el) => el.classList.contains('est-rotulo-ano'));
        if (rs.length < 2) return;
        rs.forEach((r) => { r.style.translate = ''; });
        const its = rs.map((r) => ({ r, y: r.offsetTop, h: r.offsetHeight })).sort((a, b) => a.y - b.y);
        const pos = its.map((it) => it.y);
        for (let i = 1; i < its.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + its[i - 1].h + 1);
        const ult = its.length - 1;
        const pe = plot.clientHeight - its[ult].h;
        if (pos[ult] > pe) {
            pos[ult] = pe;
            for (let i = ult - 1; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - its[i].h - 1);
        }
        its.forEach((it, i) => {
            if (Math.abs(pos[i] - it.y) > 0.5) it.r.style.translate = '0 ' + (pos[i] - it.y).toFixed(1) + 'px';
        });
    }

    // rótulos da dispersão: cada nome fica à direita do seu ponto; se cobre
    // outro nome ou outro ponto, tenta à esquerda, acima, abaixo e nos cantos
    function arrumarDispersao(plot) {
        const rots = Array.from(plot.querySelectorAll('.est-pt-rot'));
        if (rots.length < 2) return;
        rots.forEach((r) => { r.style.translate = ''; });
        const base = plot.getBoundingClientRect();
        const caixa = (el) => {
            const b = el.getBoundingClientRect();
            return { l: b.left - base.left, t: b.top - base.top, r: b.right - base.left, b: b.bottom - base.top };
        };
        const bate = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
        const pontos = rots.map((r) => (r.previousElementSibling ? caixa(r.previousElementSibling) : null));
        const postos = [];
        rots.forEach((r, i) => {
            const c0 = caixa(r);
            const pt = pontos[i];
            if (!pt) {
                postos.push(c0);
                return;
            }
            const w = c0.r - c0.l;
            const h = c0.b - c0.t;
            const g = Math.max(2, c0.l - pt.r);
            const cx = (pt.l + pt.r) / 2;
            const em = (l, t) => ({ l, t, r: l + w, b: t + h });
            const tentativas = [
                c0,
                em(pt.l - g - w, c0.t),
                em(cx - w / 2, pt.t - h - 1),
                em(cx - w / 2, pt.b + 1),
                em(pt.r, pt.t - h),
                em(pt.r, pt.b),
                em(pt.l - w, pt.t - h),
                em(pt.l - w, pt.b),
            ];
            const livre = (c, k) => (k === 0 || (c.l >= 0 && c.r <= base.width && c.t >= 0 && c.b <= base.height))
                && !postos.some((p) => bate(c, p))
                && !pontos.some((p, j) => j !== i && p && bate(c, p));
            const k = tentativas.findIndex(livre);
            const c = tentativas[k < 0 ? 0 : k];
            if (k > 0) r.style.translate = (c.l - c0.l).toFixed(1) + 'px ' + (c.t - c0.t).toFixed(1) + 'px';
            postos.push(c);
        });
    }

    let encaixePendente = false;

    function encaixar() {
        encaixePendente = false;
        document.querySelectorAll('.est-corpo[data-est]').forEach((corpo) => {
            if (!corpo.offsetParent) return;    // tela fora do ar: não há o que medir
            corpo.querySelectorAll('.est-scroll').forEach(encaixarTabela);
            corpo.querySelectorAll('.est-plot').forEach(afastarRotulos);
            corpo.querySelectorAll('.est-disp-plot').forEach(arrumarDispersao);
        });
    }

    function agendarEncaixe() {
        if (encaixePendente) return;
        encaixePendente = true;
        requestAnimationFrame(encaixar);
    }

    const olheiro = typeof ResizeObserver === 'function' ? new ResizeObserver(agendarEncaixe) : null;
    const vigiados = {};

    function vigiar(id, corpo) {
        if (!olheiro) return;
        (vigiados[id] || []).forEach((el) => olheiro.unobserve(el));
        vigiados[id] = Array.from(corpo.querySelectorAll('.est-scroll, .est-plot, .est-disp-plot'));
        vigiados[id].forEach((el) => olheiro.observe(el));
    }

    window.addEventListener('resize', agendarEncaixe);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(agendarEncaixe);
    // o modo TV muda o tamanho do texto sem mudar o do bloco
    if (typeof MutationObserver === 'function') {
        new MutationObserver(agendarEncaixe).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    function ajustar() {
        if (typeof scheduleFit === 'function') scheduleFit();
        encaixar();
        agendarEncaixe();    // de novo depois do ajuste da tela inteira
    }

    let filaMontagem = null;

    // a tela no ar na hora; as outras aos poucos (o PDF de todas precisa delas em dia)
    function remontarTudo() {
        versao++;
        const ativa = telaAtiva();
        if (ativa) montar(ativa);
        ajustar();
        if (filaMontagem) clearTimeout(filaMontagem);
        const pendentes = EST_TELAS.map((t) => t.id).filter((id) => id !== ativa);
        const passo = () => {
            const id = pendentes.shift();
            if (!id) {
                filaMontagem = null;
                return;
            }
            if (versaoTela[id] !== versao) montar(id);
            filaMontagem = setTimeout(passo, 0);
        };
        filaMontagem = setTimeout(passo, 0);
    }

    function remontarUma(id) {
        montar(id);
        ajustar();
    }

    function editando() {
        return typeof isEditing === 'function' && isEditing();
    }

    document.addEventListener('click', (ev) => {
        if (!(ev.target instanceof Element) || editando()) return;
        const corpo = ev.target.closest('.est-corpo[data-est]');
        if (!corpo) return;
        const id = corpo.getAttribute('data-est');
        const tela = TELA[id];
        const alvo = ev.target.closest('[data-est-periodo], [data-est-agrupar], [data-est-projecao], [data-est-comparar], [data-est-modo], [data-est-dim], [data-est-sel], [data-est-recorte]');
        if (!alvo || !tela || alvo.disabled) return;
        const glob = ['periodo', 'agrupar', 'projecao', 'comparar', 'modo'].find((k) => alvo.hasAttribute('data-est-' + k));
        if (glob) {
            ESTADO[glob] = alvo.getAttribute('data-est-' + glob);
            if (glob === 'modo' && ESTADO.modo !== 'anos') ESTADO.modo = 'linha';
            gravarEstado();
            remontarTudo();
            return;
        }
        const t = tela.tipo === 'projecao' ? ESTADO.telas[id] : estadoTela(tela);
        if (alvo.hasAttribute('data-est-sel')) {
            t.sel = alvo.getAttribute('data-est-sel');
        } else if (alvo.hasAttribute('data-est-dim')) {
            t.dims[alvo.getAttribute('data-est-dim')] = alvo.getAttribute('data-v');
        } else {
            const dim = alvo.getAttribute('data-est-recorte');
            const v = alvo.getAttribute('data-v');
            const D = DIMS[dim];
            t.dims[dim] = t.dims[dim] === v && !D.semTodos ? '*' : v;
        }
        gravarEstado();
        remontarUma(id);
    });

    document.addEventListener('change', (ev) => {
        const sel = ev.target;
        if (!(sel instanceof HTMLSelectElement) || editando()) return;
        const corpo = sel.closest('.est-corpo[data-est]');
        if (!corpo) return;
        const id = corpo.getAttribute('data-est');
        const tela = TELA[id];
        if (!tela) return;
        if (sel.hasAttribute('data-est-de') || sel.hasAttribute('data-est-ate')) {
            ESTADO[sel.hasAttribute('data-est-de') ? 'de' : 'ate'] = Number(sel.value);
            ESTADO.periodo = 'custom';
            gravarEstado();
            remontarTudo();
            return;
        }
        if (sel.hasAttribute('data-est-dimsel')) {
            estadoTela(tela).dims[sel.getAttribute('data-est-dimsel')] = sel.value;
            gravarEstado();
            remontarUma(id);
        }
    });

    // tela estratégica aberta pelo menu: em dia com o filtro e com o grupo aberto
    document.addEventListener('click', (ev) => {
        const item = ev.target instanceof Element ? ev.target.closest('.menu-item[data-screen^="est-"]') : null;
        if (!item) return;
        const id = item.getAttribute('data-screen');
        if (versaoTela[id] !== versao) remontarUma(id);
        const grupoMenu = item.closest('.menu-group');
        if (grupoMenu && typeof openOnlyGroup === 'function' && !grupoMenu.classList.contains('is-open')) openOnlyGroup(grupoMenu);
    });

    // ---------- dica do gráfico ----------
    let tip = null;

    function linhaTip(cor, nome, txt) {
        return `<div class="est-tip-linha">${cor ? `<i style="--c: ${cor}"></i>` : ''}<span>${nome}</span><b>${txt}</b></div>`;
    }

    function valorTip(m, r) {
        if (!r) return '—';
        return fmtM(m, r.c) + (r.proj && r.hi - r.lo > 1e-9 ? ` <small>(${faixaTxt(m, r)})</small>` : '');
    }

    function htmlTip(st, col) {
        if (st.tipo === 'tempo') {
            const i = Number(col.getAttribute('data-est-k'));
            const b = st.bs[i];
            if (!b) return '';
            let h = `<div class="est-tip-titulo">${b.rot}${b.proj ? ' · projeção' : ''}</div>`;
            st.S.lista.forEach((s) => {
                const r = s.v[i];
                if (r && (st.S.modo !== 'pilha' || r.c > 0)) h += linhaTip(st.S.modo === 'simples' ? '' : s.cor, s.nome, valorTip(s.m, r));
            });
            if (st.S.modo === 'pilha' && st.T[i]) h += linhaTip('', 'Total', valorTip(st.mP, st.T[i]));
            if (st.C && st.C[i] != null) {
                const atual = st.S.modo === 'pilha' ? st.T[i] : st.S.lista[0].v[i];
                h += `<div class="est-tip-ant">${rotuloComparacao(st.comparar)}: <b>${fmtM(st.mP, st.C[i])}</b> ${atual ? deltaHtml(delta(st.mP, atual.c, st.C[i]), '') : ''}</div>`;
            }
            if (b.misto) h += `<div class="est-tip-ant">real até ${ULT_ROT} + projeção do resto</div>`;
            return h;
        }
        if (st.tipo === 'anos') {
            const pos = Number(col.getAttribute('data-est-pos'));
            let h = '';
            let titulo = '';
            st.anos.slice().reverse().forEach((a) => {
                const x = st.porAno.get(a)[pos];
                if (!x || !x.r) return;
                if (!titulo) titulo = st.g === 'semana' ? 'Semana ' + (pos + 1) : (st.g === 'mes' ? MESES[pos] : TRI[pos]);
                h += linhaTip('', a + (x.r.proj ? ' (projeção)' : ''), valorTip(st.mP, x.r));
            });
            return titulo ? `<div class="est-tip-titulo">${titulo}</div>` + h : '';
        }
        if (st.tipo === 'acumulado') {
            const pos = Number(col.getAttribute('data-est-pos'));
            let h = `<div class="est-tip-titulo">Acumulado até ${MESES[pos]}</div>`;
            st.series.slice().reverse().forEach((s) => {
                const p = s.pts.find((x) => x.mes === pos);
                if (p) h += linhaTip('', s.a + (p.proj ? ' (projeção)' : ''), fmtM(st.m, p.c) + (p.proj ? ` <small>(${faixaTxt(st.m, { proj: true, lo: p.lo, hi: p.hi })})</small>` : ''));
            });
            return h;
        }
        return '';
    }

    // dica pronta no próprio elemento (células, dias, pontos): "título|linha|linha"
    function htmlTipPronta(txt) {
        const partes = txt.split('|');
        return `<div class="est-tip-titulo">${partes[0]}</div>` + partes.slice(1).map((x) => `<div class="est-tip-linha est-tip-linha--txt">${x}</div>`).join('');
    }

    document.addEventListener('pointerover', (ev) => {
        const el = ev.target instanceof Element ? ev.target : null;
        const pronta = el && el.closest('.est-corpo [data-tip]');
        const col = !pronta && el ? el.closest('.est-col') : null;
        const raiz = col && col.closest('[data-est-tipid]');
        const st = raiz && TIP[raiz.getAttribute('data-est-tipid')];
        let html = '';
        if (pronta) html = htmlTipPronta(pronta.getAttribute('data-tip'));
        else if (st) html = htmlTip(st, col);
        if (!html) {
            if (tip) tip.hidden = true;
            return;
        }
        if (!tip) {
            tip = document.createElement('div');
            tip.className = 'est-tip';
            tip.setAttribute('role', 'tooltip');
            document.body.appendChild(tip);
        }
        tip.innerHTML = html;
        tip.hidden = false;
    });

    document.addEventListener('pointermove', (ev) => {
        if (!tip || tip.hidden) return;
        const larg = tip.offsetWidth;
        const alt = tip.offsetHeight;
        let x = ev.clientX + 16;
        let topo = ev.clientY - alt - 12;
        if (x + larg > window.innerWidth - 8) x = ev.clientX - larg - 16;
        if (topo < 8) topo = ev.clientY + 16;
        tip.style.left = x + 'px';
        tip.style.top = topo + 'px';
    });

    // primeira montagem: a tela no ar já, o resto logo depois
    remontarTudo();

    // para conferência no console (window.EST.agregar('rec', {}, 0, 364) etc.)
    window.EST = {
        M, DIMS, NH, NT, ULT, ESTADO,
        agregar: (id, f, a, b) => agregar(M[id], f || {}, a, b),
        agregarP: (id, f, a, b) => agregarP(M[id], f || {}, a, b),
        diaDe, remontarTudo,
    };
})();
