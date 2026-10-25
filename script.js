// ============================================================
// PAINEL DO DIA
// ============================================================

// ---------- Utilidades ----------

// Atalho: $('hora') é o mesmo que document.getElementById('hora')
const $ = (id) => document.getElementById(id);

// O localStorage pode falhar (modo privado, por exemplo),
// então lemos e gravamos dentro de try / catch.
function lerSalvo(chave, padrao) {
    try {
        const texto = localStorage.getItem(chave);
        return texto ? JSON.parse(texto) : padrao;
    } catch (erro) {
        return padrao;
    }
}

function gravar(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
    } catch (erro) {
        console.error('Não foi possível salvar:', erro);
    }
}

// Troca o desenho de um ícone: trocarIcone('clima-icone', 'sun')
function trocarIcone(idDoSvg, nome) {
    document.querySelector(`#${idDoSvg} use`).setAttribute('href', `#i-${nome}`);
}

// Data de hoje no formato "2026-10-24", usando o horário LOCAL.
// (toISOString() usa o horário de Londres e erraria o dia à noite.)
function dataISO(data = new Date()) {
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
}

// Cria um identificador único pra cada tarefa e compromisso
function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Cria um botão pequeno só com ícone (✕, check...). Reaproveitado em várias listas.
function criarBotaoIcone(classe, icone, rotulo, aoClicar) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = classe;
    botao.setAttribute('aria-label', rotulo);
    botao.innerHTML = `<svg class="icone"><use href="#i-${icone}"></use></svg>`;
    botao.addEventListener('click', aoClicar);
    return botao;
}

// ============================================================
// 1) DATA, HORA, SAUDAÇÃO, NOME E COR DO DIA
// ============================================================

// A que horas começa cada período. MUDE OS NÚMEROS pra ajustar do seu jeito!
// Antes das 6h é madrugada.
const HORARIOS = { manha: 6, tarde: 12, noite: 18 };

const SAUDACOES = {
    madrugada: { texto: 'Boa madrugada', emoji: '🌌' },
    manha: { texto: 'Bom dia', emoji: '☀️' },
    tarde: { texto: 'Boa tarde', emoji: '🌤️' },
    noite: { texto: 'Boa noite', emoji: '🌙' },
};

let nome = lerSalvo('nome', '');

function periodoDoDia(hora) {
    if (hora < HORARIOS.manha) return 'madrugada';
    if (hora < HORARIOS.tarde) return 'manha';
    if (hora < HORARIOS.noite) return 'tarde';
    return 'noite';
}

function atualizarRelogio() {
    const agora = new Date();
    const periodo = periodoDoDia(agora.getHours());
    const saudacao = SAUDACOES[periodo];

    $('data').textContent = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('hora').textContent = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('saudacao').textContent = nome ? `${saudacao.texto}, ${nome}!` : `${saudacao.texto}!`;
    $('emoji').textContent = saudacao.emoji;

    // Troca as cores do painel inteiro (veja body.madrugada, body.manha... no CSS).
    // Usamos classList pra mexer só nas classes de período e não apagar as outras.
    document.body.classList.remove('madrugada', 'manha', 'tarde', 'noite');
    document.body.classList.add(periodo);

    // Passou da meia-noite com a página aberta? Então começa um dia novo.
    if (virarODiaSePreciso()) {
        diaSelecionado = dataISO();
        calAno = agora.getFullYear();
        calMes = agora.getMonth();
        mostrarTarefas();
        mostrarCalendario();
        mostrarEventosDoDia();
        mostrarPomodoros();
        mostrarFrase();
    }
}

$('form-nome').addEventListener('submit', (evento) => {
    evento.preventDefault();

    nome = $('input-nome').value.trim();
    gravar('nome', nome);
    atualizarRelogio();

    $('msg-nome').textContent = nome ? `Pronto! Agora você é ${nome} por aqui.` : 'Nome removido da saudação.';
    $('input-nome').value = '';
});

// ============================================================
// 2) LOCALIZAÇÃO (cidade escolhida)
// ============================================================

  const LOCAL_PADRAO = { nome: 'São Paulo', estado: 'São Paulo', pais: 'Brasil', lat: -23.55, lon: -46.63 };
let local = lerSalvo('local', LOCAL_PADRAO);

function mostrarLocal() {
    $('local-nome').textContent = [local.nome, local.estado].filter(Boolean).join(', ');
    $('local-detalhe').textContent = [local.nome, local.estado, local.pais].filter(Boolean).join(' • ');
}

// ============================================================
// 3) CLIMA E PREVISÃO (Open-Meteo)
// ============================================================

// A API devolve um NÚMERO pro clima. Aqui traduzimos em texto e ícone.
const CODIGOS_CLIMA = {
    0: ['Céu limpo', 'sun'],
    1: ['Predominantemente limpo', 'sun'],
    2: ['Parcialmente nublado', 'cloud-sun'],
    3: ['Nublado', 'cloud'],
    45: ['Neblina', 'cloud-fog'],
    48: ['Neblina', 'cloud-fog'],
    51: ['Garoa fraca', 'cloud-rain'],
    53: ['Garoa', 'cloud-rain'],
    55: ['Garoa forte', 'cloud-rain'],
    56: ['Garoa congelante', 'cloud-rain'],
    57: ['Garoa congelante', 'cloud-rain'],
    61: ['Chuva fraca', 'cloud-rain'],
    63: ['Chuva', 'cloud-rain'],
    65: ['Chuva forte', 'cloud-rain'],
    66: ['Chuva congelante', 'cloud-rain'],
    67: ['Chuva congelante', 'cloud-rain'],
    71: ['Neve fraca', 'snowflake'],
    73: ['Neve', 'snowflake'],
    75: ['Neve forte', 'snowflake'],
    77: ['Grãos de neve', 'snowflake'],
    80: ['Pancadas de chuva', 'cloud-rain'],
    81: ['Pancadas de chuva', 'cloud-rain'],
    82: ['Pancadas fortes', 'cloud-rain'],
    85: ['Pancadas de neve', 'snowflake'],
    86: ['Pancadas de neve', 'snowflake'],
    95: ['Trovoada', 'cloud-lightning'],
    96: ['Trovoada com granizo', 'cloud-lightning'],
    99: ['Trovoada com granizo', 'cloud-lightning'],
};

function descreverClima(codigo, ehDia) {
    const [descricao, icone] = CODIGOS_CLIMA[codigo] || ['Clima indisponível', 'cloud'];
    let iconeFinal = icone;

    // De noite, trocamos o sol pela lua
    if (!ehDia && icone === 'sun') iconeFinal = 'moon';
    if (!ehDia && icone === 'cloud-sun') iconeFinal = 'cloud-moon';

    return { descricao, icone: iconeFinal };
}

async function atualizarClima() {
    try {
        const url = 'https://api.open-meteo.com/v1/forecast'
            + `?latitude=${local.lat}&longitude=${local.lon}`
            + '&current=temperature_2m,weather_code,is_day'
            + '&daily=weather_code,temperature_2m_max,temperature_2m_min'
            + '&forecast_days=5&timezone=auto';

        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
        const dados = await resposta.json();

        const atual = dados.current;
        const clima = descreverClima(atual.weather_code, atual.is_day === 1);

        $('clima-temp').textContent = `${Math.round(atual.temperature_2m)}°`;
        $('clima-desc').textContent = clima.descricao;
        trocarIcone('clima-icone', clima.icone);

        mostrarPrevisao(dados.daily);
    } catch (erro) {
        console.error('Erro ao buscar o clima:', erro);
        $('clima-temp').textContent = '--°';
        $('clima-desc').textContent = 'Não foi possível carregar';
    }
}

function mostrarPrevisao(diario) {
    const lista = $('lista-previsao');
    lista.innerHTML = '';

    diario.time.forEach((dia, i) => {
        // O meio-dia evita problemas de fuso horário na conversão da data
        const data = new Date(dia + 'T12:00:00');
        const nomeDoDia = i === 0 ? 'Hoje' : data.toLocaleDateString('pt-BR', { weekday: 'long' });
        const dataCurta = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
        const clima = descreverClima(diario.weather_code[i], true);

        const li = document.createElement('li');
        li.innerHTML = `
            <svg class="icone ic-azul"><use href="#i-${clima.icone}"></use></svg>
            <div class="previsao-dia">
                <strong>${nomeDoDia}</strong>
                <span>${clima.descricao} • ${dataCurta}</span>
            </div>
            <div class="previsao-temp">
                ${Math.round(diario.temperature_2m_max[i])}° <span>${Math.round(diario.temperature_2m_min[i])}°</span>
            </div>`;
        lista.appendChild(li);
    });
}

// ============================================================
// 4) DÓLAR E EURO (AwesomeAPI) E CONTAGEM PARA A PRÓXIMA ATUALIZAÇÃO
// ============================================================

const INTERVALO_DOLAR = 300; // segundos entre cada atualização (300 = 5 minutos)
let segundosRestantes = INTERVALO_DOLAR;

const reais = (numero) => numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Transforma a variação (em %) em texto com seta e a classe de cor
function formatarVariacao(variacao) {
    const valor = Math.abs(variacao).toFixed(2).replace('.', ',');

    if (variacao > 0) return { texto: `▲ ${valor}%`, classe: 'sobe' };
    if (variacao < 0) return { texto: `▼ ${valor}%`, classe: 'desce' };
    return { texto: `= ${valor}%`, classe: '' };
}

async function atualizarDolar() {
    try {
        const resposta = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
        if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
        const dados = await resposta.json();

        // ----- Dólar -----
        const usd = dados.USDBRL;
        const dolar = parseFloat(usd.bid);
        const variacao = parseFloat(usd.pctChange);
        const maxima = parseFloat(usd.high);
        const minima = parseFloat(usd.low);
        if (Number.isNaN(dolar) || Number.isNaN(variacao)) throw new Error('Dados inesperados');

        const v = formatarVariacao(variacao);
        $('dolar').textContent = reais(dolar);
        $('variacao').textContent = `${v.texto} hoje`;
        $('variacao').className = `detalhe ${v.classe}`;
        $('dolar-faixa').textContent = (Number.isNaN(maxima) || Number.isNaN(minima))
            ? ''
            : `Máx ${reais(maxima)} • Mín ${reais(minima)}`;

        // ----- Euro (se vier algum problema, só esconde a linha) -----
        const eur = dados.EURBRL;
        const euro = eur ? parseFloat(eur.bid) : NaN;
        const variacaoEuro = eur ? parseFloat(eur.pctChange) : NaN;

        if (Number.isNaN(euro) || Number.isNaN(variacaoEuro)) {
            $('euro').hidden = true;
        } else {
            const ve = formatarVariacao(variacaoEuro);
            $('euro-valor').textContent = `Euro ${reais(euro)}`;
            $('euro-variacao').textContent = ve.texto;
            $('euro-variacao').className = ve.classe;
            $('euro').hidden = false;
        }
    } catch (erro) {
        console.error('Erro ao buscar a cotação:', erro);
        $('dolar').textContent = 'R$ --';
        $('variacao').textContent = 'Não foi possível carregar';
        $('variacao').className = 'detalhe';
        $('dolar-faixa').textContent = '';
        $('euro').hidden = true;
    }
}

function mostrarContagem() {
    const min = Math.floor(segundosRestantes / 60);
    const seg = segundosRestantes % 60;
    $('proxima').textContent = `Atualiza em ${min}:${String(seg).padStart(2, '0')}`;
}

function passarUmSegundo() {
    segundosRestantes--;

    if (segundosRestantes <= 0) {
        atualizarDolar();
        segundosRestantes = INTERVALO_DOLAR;
    }

    mostrarContagem();
}

// ============================================================
// 5) TAREFAS (com horário, prioridade e limpeza diária)
// ============================================================

// Cada tarefa: { id, texto, feita, hora: '14:30' ou '', alta: true/false }
// Também aceita tarefas de versões antigas (só texto, sem id)
let tarefas = lerSalvo('tarefas', [])
    .map((t) => (typeof t === 'string' ? { texto: t, feita: false } : t))
    .filter((t) => t && typeof t.texto === 'string')
    .map((t) => ({
        id: t.id || novoId(),
        texto: t.texto,
        feita: Boolean(t.feita),
        hora: t.hora || '',
        alta: Boolean(t.alta),
    }));

// Dia em que o painel foi aberto pela última vez
let ultimoDia = lerSalvo('ultimoDia', '');

function salvarTarefas() {
    gravar('tarefas', tarefas);
}

// Compara a data salva com a de hoje. Se mudou, apaga as tarefas JÁ FEITAS
// (as que faltam continuam). Devolve true quando o dia virou.
function virarODiaSePreciso() {
    const hoje = dataISO();
    if (ultimoDia === hoje) return false;

    // Na primeira vez que o painel roda não há "dia anterior", então não apaga nada
    if (ultimoDia !== '') {
        tarefas = tarefas.filter((t) => !t.feita);
        salvarTarefas();
    }

    ultimoDia = hoje;
    gravar('ultimoDia', hoje);
    return true;
}

// Ordem na tela: pendentes primeiro, depois prioridade alta, depois por horário
function compararTarefas(a, b) {
    if (a.feita !== b.feita) return a.feita ? 1 : -1;
    if (a.alta !== b.alta) return a.alta ? -1 : 1;
    return (a.hora || '99:99').localeCompare(b.hora || '99:99');
}

function mostrarTarefas() {
    const lista = $('lista-tarefas');
    lista.innerHTML = '';

    [...tarefas].sort(compararTarefas).forEach((tarefa) => {
        const li = document.createElement('li');
        if (tarefa.feita) li.classList.add('feita');

        const check = criarBotaoIcone('check', 'check', 'Marcar como feita', () => {
            tarefa.feita = !tarefa.feita;
            salvarTarefas();
            mostrarTarefas();
        });
        check.setAttribute('aria-pressed', String(tarefa.feita));
        li.appendChild(check);

        if (tarefa.alta) {
            const bandeira = document.createElement('span');
            bandeira.className = 'bandeira';
            bandeira.title = 'Prioridade alta';
            bandeira.innerHTML = '<svg class="icone"><use href="#i-flag"></use></svg>';
            li.appendChild(bandeira);
        }

        // Usamos textContent (e não innerHTML) pro texto digitado
        // nunca ser interpretado como código HTML.
        const texto = document.createElement('span');
        texto.className = 'texto';
        texto.textContent = tarefa.texto;
        li.appendChild(texto);

        if (tarefa.hora) {
            const hora = document.createElement('span');
            hora.className = 'hora-badge';
            hora.textContent = tarefa.hora;
            li.appendChild(hora);
        }

        li.appendChild(criarBotaoIcone('apagar', 'x', 'Apagar tarefa', () => {
            tarefas = tarefas.filter((t) => t.id !== tarefa.id);
            salvarTarefas();
            mostrarTarefas();
        }));

        lista.appendChild(li);
    });

    // Progresso: quantas já foram feitas
    const feitas = tarefas.filter((t) => t.feita).length;
    const total = tarefas.length;
    $('contador').textContent = `${feitas}/${total}`;
    $('barra-progresso').style.width = total === 0 ? '0%' : `${(feitas / total) * 100}%`;
    $('sem-tarefas').hidden = total > 0;
}

// Usar <form> faz a tecla Enter funcionar sozinha
$('form-tarefa').addEventListener('submit', (evento) => {
    evento.preventDefault();

    const campo = $('nova-tarefa');
    const texto = campo.value.trim();
    if (texto === '') return;

    tarefas.push({
        id: novoId(),
        texto: texto,
        feita: false,
        hora: $('nova-hora').value,
        alta: $('nova-alta').checked,
    });
    salvarTarefas();
    mostrarTarefas();

    campo.value = '';
    $('nova-hora').value = '';
    $('nova-alta').checked = false;
    campo.focus();
});

// ============================================================
// 6) FOCO (POMODORO)
// ============================================================

const FOCO_MIN = 25;  // minutos de foco
const PAUSA_MIN = 5;  // minutos de pausa

let modoFoco = true;               // true = foco, false = pausa
let restanteMs = FOCO_MIN * 60 * 1000;
let fimEm = null;                  // quando o relógio vai zerar (null = parado)

let pomodoros = lerSalvo('pomodoros', { data: '', quantidade: 0 });

function quantidadePomodorosHoje() {
    return pomodoros.data === dataISO() ? pomodoros.quantidade : 0;
}

function mostrarPomodoros() {
    const q = quantidadePomodorosHoje();
    $('pomo-contagem').textContent = q === 1 ? '1 pomodoro hoje' : `${q} pomodoros hoje`;
}

function duracaoDoModoMs() {
    return (modoFoco ? FOCO_MIN : PAUSA_MIN) * 60 * 1000;
}

function mostrarPomodoro() {
    const totalSeg = Math.ceil(restanteMs / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    const tempo = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;

    $('pomo-tempo').textContent = tempo;
    $('modo-foco').textContent = `Foco ${FOCO_MIN} min`;
    $('modo-pausa').textContent = `Pausa ${PAUSA_MIN} min`;
    $('modo-foco').classList.toggle('ativo', modoFoco);
    $('modo-pausa').classList.toggle('ativo', !modoFoco);

    const rodando = fimEm !== null;
    const parouNoMeio = !rodando && restanteMs < duracaoDoModoMs();
    trocarIcone('pomo-icone', rodando ? 'pause' : 'play');
    $('pomo-iniciar-texto').textContent = rodando ? 'Pausar' : (parouNoMeio ? 'Continuar' : 'Iniciar');

    // Mostra o tempo na aba do navegador enquanto está rodando
    document.title = rodando ? `${tempo} • ${modoFoco ? 'Foco' : 'Pausa'}` : 'Painel do Dia';
}

// Apito curto quando o tempo acaba
function apitar() {
    try {
        const audio = new (window.AudioContext || window.webkitAudioContext)();
        const oscilador = audio.createOscillator();
        const volume = audio.createGain();
        oscilador.connect(volume);
        volume.connect(audio.destination);
        oscilador.frequency.value = 880;
        volume.gain.setValueAtTime(0.2, audio.currentTime);
        volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
        oscilador.start();
        oscilador.stop(audio.currentTime + 0.8);
    } catch (erro) {
        // sem som, sem problema
    }
}

function definirModo(foco) {
    modoFoco = foco;
    fimEm = null;
    restanteMs = duracaoDoModoMs();
    mostrarPomodoro();
}

function iniciarOuPausar() {
    if (fimEm === null) {
        fimEm = Date.now() + restanteMs;      // começou: calcula quando vai zerar
    } else {
        restanteMs = Math.max(0, fimEm - Date.now());
        fimEm = null;                          // pausou: guarda quanto faltava
    }
    mostrarPomodoro();
}

function terminarCiclo() {
    apitar();

    if (modoFoco) {
        pomodoros = { data: dataISO(), quantidade: quantidadePomodorosHoje() + 1 };
        gravar('pomodoros', pomodoros);
        mostrarPomodoros();
    }

    // Foco acabou → vai pra pausa (e vice-versa), parado esperando você
    definirModo(!modoFoco);
}

// Roda várias vezes por segundo. Usamos a hora real (Date.now) e não "menos 1 segundo",
// porque o navegador desacelera os timers quando a aba fica em segundo plano.
function passarTempoDoPomodoro() {
    if (fimEm === null) return;

    restanteMs = Math.max(0, fimEm - Date.now());
    if (restanteMs === 0) {
        terminarCiclo();
    } else {
        mostrarPomodoro();
    }
}

$('pomo-iniciar').addEventListener('click', iniciarOuPausar);
$('pomo-reiniciar').addEventListener('click', () => definirModo(modoFoco));
$('modo-foco').addEventListener('click', () => definirModo(true));
$('modo-pausa').addEventListener('click', () => definirModo(false));

// ============================================================
// 7) FRASE DO DIA
// ============================================================

// Troque ou acrescente frases do seu jeito!
const FRASES = [
    'Um passo de cada vez já é caminhar.',
    'Começar imperfeito vale mais do que esperar o momento perfeito.',
    'Hoje você só precisa fazer a próxima tarefa.',
    'Constância vence motivação.',
    'Todo erro no código é o computador te ensinando alguma coisa.',
    'Pequenos progressos todos os dias viram grandes resultados.',
    'Foque em um bloco de 25 minutos de cada vez.',
    'Descansar também faz parte de estudar.',
    'O que você aprende hoje, você usa amanhã.',
    'Todo programador já travou num erro. Quem continua, aprende.',
    'Organizar o dia é cuidar de quem você vai ser amanhã.',
    'Feito é melhor do que perfeito.',
    'A dúvida de hoje é a resposta de amanhã.',
];

// A frase "do dia" muda sozinha a cada dia, seguindo o número do dia no ano
function diaDoAno() {
    const hoje = new Date();
    const inicioDoAno = new Date(hoje.getFullYear(), 0, 0);
    return Math.floor((hoje - inicioDoAno) / 86400000);
}

let indiceFrase = diaDoAno() % FRASES.length;

function mostrarFrase() {
    $('frase-texto').textContent = `“${FRASES[indiceFrase]}”`;
}

$('nova-frase').addEventListener('click', () => {
    let sorteada;
    do {
        sorteada = Math.floor(Math.random() * FRASES.length);
    } while (sorteada === indiceFrase && FRASES.length > 1);

    indiceFrase = sorteada;
    mostrarFrase();
});

// ============================================================
// 8) CALENDÁRIO E COMPROMISSOS
// ============================================================

// Cada compromisso: { id, data: '2026-10-24', texto, hora: '14:30' ou '' }
let eventos = lerSalvo('eventos', [])
    .filter((e) => e && typeof e.texto === 'string' && typeof e.data === 'string')
    .map((e) => ({ id: e.id || novoId(), data: e.data, texto: e.texto, hora: e.hora || '' }));

let calAno = new Date().getFullYear();
let calMes = new Date().getMonth(); // 0 = janeiro
let diaSelecionado = dataISO();

function salvarEventos() {
    gravar('eventos', eventos);
}

function eventosDoDia(data) {
    return eventos
        .filter((e) => e.data === data)
        .sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));
}

function mostrarCalendario() {
    const primeiroDia = new Date(calAno, calMes, 1);
    const diasNoMes = new Date(calAno, calMes + 1, 0).getDate(); // dia 0 do mês seguinte = último dia deste
    const diasVazios = primeiroDia.getDay(); // 0 = domingo
    const hoje = dataISO();

    $('cal-titulo').textContent = primeiroDia.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const grade = $('cal-grade');
    grade.innerHTML = '';

    for (const letra of ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']) {
        const el = document.createElement('div');
        el.className = 'cal-semana';
        el.textContent = letra;
        grade.appendChild(el);
    }

    for (let i = 0; i < diasVazios; i++) {
        grade.appendChild(document.createElement('div'));
    }

    for (let dia = 1; dia <= diasNoMes; dia++) {
        const iso = dataISO(new Date(calAno, calMes, dia));

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'cal-dia';
        botao.textContent = dia;

        if (iso === hoje) botao.classList.add('hoje');
        if (iso === diaSelecionado) botao.classList.add('selecionado');
        if (eventosDoDia(iso).length > 0) botao.classList.add('tem-evento');

        botao.addEventListener('click', () => {
            diaSelecionado = iso;
            mostrarCalendario();
            mostrarEventosDoDia();
        });

        grade.appendChild(botao);
    }
}

function mostrarEventosDoDia() {
    const data = new Date(diaSelecionado + 'T12:00:00');
    $('eventos-titulo').textContent = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    const lista = $('lista-eventos');
    lista.innerHTML = '';

    const doDia = eventosDoDia(diaSelecionado);

    doDia.forEach((evento) => {
        const li = document.createElement('li');

        const texto = document.createElement('span');
        texto.className = 'texto';
        texto.textContent = evento.texto;

        if (evento.hora) {
            const hora = document.createElement('span');
            hora.className = 'hora-badge';
            hora.textContent = evento.hora;
            li.appendChild(hora);
        }

        li.appendChild(texto);
        li.appendChild(criarBotaoIcone('apagar', 'x', 'Apagar compromisso', () => {
            eventos = eventos.filter((e) => e.id !== evento.id);
            salvarEventos();
            mostrarCalendario();
            mostrarEventosDoDia();
        }));

        lista.appendChild(li);
    });

    $('sem-eventos').hidden = doDia.length > 0;
}

$('form-evento').addEventListener('submit', (evento) => {
    evento.preventDefault();

    const campo = $('novo-evento');
    const texto = campo.value.trim();
    if (texto === '') return;

    eventos.push({ id: novoId(), data: diaSelecionado, texto: texto, hora: $('novo-evento-hora').value });
    salvarEventos();
    mostrarCalendario();
    mostrarEventosDoDia();

    campo.value = '';
    $('novo-evento-hora').value = '';
    campo.focus();
});

$('cal-anterior').addEventListener('click', () => {
    calMes--;
    if (calMes < 0) {
        calMes = 11;
        calAno--;
    }
    mostrarCalendario();
});

$('cal-proximo').addEventListener('click', () => {
    calMes++;
    if (calMes > 11) {
        calMes = 0;
        calAno++;
    }
    mostrarCalendario();
});

// ============================================================
// 9) CONFIGURAÇÕES: escolher a cidade
// ============================================================

$('form-cidade').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const digitado = $('input-cidade').value.trim();
    if (digitado === '') return;

    // Aceita "Campo Maior" ou "Campo Maior, Piauí" (o estado ajuda quando existem cidades com o mesmo nome)
    const [nomeDaCidade, dica = ''] = digitado.split(',').map((parte) => parte.trim());

    const mensagem = $('msg-cidade');
    mensagem.textContent = 'Buscando...';

    try {
        const url = 'https://geocoding-api.open-meteo.com/v1/search'
            + `?name=${encodeURIComponent(nomeDaCidade)}&count=10&language=pt&format=json`;
        const resposta = await fetch(url);
        if (!resposta.ok) throw new Error('HTTP ' + resposta.status);
        const dados = await resposta.json();

        if (!dados.results || dados.results.length === 0) {
            mensagem.textContent = 'Cidade não encontrada. Confira o nome e tente de novo.';
            return;
        }

        // Tira acentos e maiúsculas pra comparar "Piauí" com "piaui"
        const limpar = (texto) => (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

        // Se você digitou o estado, fica só com as cidades daquele estado
        let candidatas = dados.results;
        if (dica !== '') {
            const filtradas = candidatas.filter((c) => limpar(c.admin1).includes(limpar(dica)));
            if (filtradas.length > 0) candidatas = filtradas;
        }

        // Cidades do Brasil vêm primeiro
        candidatas = [...candidatas.filter((c) => c.country_code === 'BR'), ...candidatas.filter((c) => c.country_code !== 'BR')];

        const cidade = candidatas[0];
        local = {
            nome: cidade.name,
            estado: cidade.admin1 || '',
            pais: cidade.country || '',
            lat: cidade.latitude,
            lon: cidade.longitude,
        };
        gravar('local', local);

        mostrarLocal();
        atualizarClima();
        $('input-cidade').value = '';
        mensagem.textContent = `Pronto! Cidade salva: ${[local.nome, local.estado].filter(Boolean).join(', ')}.`;
    } catch (erro) {
        console.error('Erro ao buscar a cidade:', erro);
        mensagem.textContent = 'Não foi possível buscar agora. Tente de novo em instantes.';
    }
});

// ============================================================
// 10) BARRA DE BAIXO (troca de telas)
// ============================================================

function abrirTela(nomeDaTela) {
    document.querySelectorAll('.tela').forEach((tela) => tela.classList.remove('ativa'));
    $('tela-' + nomeDaTela).classList.add('ativa');

    document.querySelectorAll('.barra button').forEach((botao) => {
        botao.classList.toggle('ativo', botao.dataset.tela === nomeDaTela);
    });
}

document.querySelectorAll('.barra button').forEach((botao) => {
    botao.addEventListener('click', () => {
        // Clicar de novo no botão já ativo volta pro início
        const jaEstaAberto = botao.classList.contains('ativo');
        abrirTela(jaEstaAberto ? 'inicio' : botao.dataset.tela);
    });
});

// ============================================================
// INÍCIO: tudo que roda quando a página abre
// ============================================================

virarODiaSePreciso();   // limpa as tarefas feitas de ontem, se for um dia novo

atualizarRelogio();
setInterval(atualizarRelogio, 1000);

mostrarLocal();
mostrarTarefas();
mostrarPomodoro();
mostrarPomodoros();
mostrarFrase();
mostrarCalendario();
mostrarEventosDoDia();
setInterval(passarTempoDoPomodoro, 250);

atualizarClima();
setInterval(atualizarClima, 30 * 60 * 1000); // a cada 30 minutos

atualizarDolar();
mostrarContagem();
setInterval(passarUmSegundo, 1000);

// Liga a animação de troca de cor só depois da primeira pintura da página
requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('pronto')));