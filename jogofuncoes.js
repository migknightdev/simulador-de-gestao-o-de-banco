window.__JGO_SCRIPTS__ = window.__JGO_SCRIPTS__ || {};
window.__JGO_SCRIPTS__['jogofuncoes.js'] = true;

let dinheiro = 1000;
let level = 1;
let xp = 0;
let xpRequired = 100;
let investimentoAtivo = false;
let funcionarios = 0;
let clientesInterval = null;
const impostoIntervaloMs = 3 * 60 * 1000; // 3 minutos
let impostoDeadline = null;
let impostoTimerId = null;
let impostoAtivo = true;

let tempoBaseClientes = 20000; // 20 segundos
let reducaoPorFuncionario = 3000; // 3s a menos por funcionário
let clientesAtendidos = 0;
let clientesPendentes = [];
let clienteCounter = 0;

let currentUser = localStorage.getItem('currentUser') || 'default';

let loginsSalvos = JSON.parse(localStorage.getItem('logins')) || [];
let userdata = loginsSalvos.find(l => l.nome === currentUser)

let bankName = userdata ? userdata.banco : 'default'
console.log("Usuário atual:", currentUser);
console.log("Banco atual:", bankName);

let currentZIndex = 1000;
let investimentoInterval = null;

// ===== Z-INDEX =====
function getNextZIndex() {
  return ++currentZIndex;
}

// ===== DRAG =====
function makeDraggable(element, handle) {
  if (!element || !handle) return;
  let isDragging = false;
  let offsetX, offsetY;

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    element.style.zIndex = getNextZIndex();
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      element.style.left = (e.clientX - offsetX) + 'px';
      element.style.top = (e.clientY - offsetY) + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
}

// ===== GUI (SUBSTITUI ALERT / CONFIRM) =====
function guiAlert(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('guiOverlay');
    const msg = document.getElementById('alerta');
    const ok = document.getElementById('guiOk');

    msg.textContent = message;
    overlay.classList.remove('hidden');
    ok.classList.remove('hidden');

    ok.onclick = () => {
      overlay.classList.add('hidden');
      ok.classList.add('hidden');
      resolve(true);
    };
  });
}

function guiConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('guiOverlay');
    const msg = document.getElementById('alerta');
    const ok = document.getElementById('guiOk');
    const cancel = document.getElementById('guiCancel');

    msg.textContent = message;
    overlay.classList.remove('hidden');
    ok.classList.remove('hidden');
    cancel.classList.remove('hidden');

    ok.onclick = () => {
      overlay.classList.add('hidden');
      ok.classList.add('hidden');
      cancel.classList.add('hidden');
      resolve(true);
    };

    cancel.onclick = () => {
      overlay.classList.add('hidden');
      ok.classList.add('hidden');
      cancel.classList.add('hidden');
      resolve(false);
    };
  });
}

// ===== DIAGNÓSTICO =====
const errosJaMostrados = new Set();
const filaErros = [];
let exibindoErro = false;

function podeUsarGuiAlert() {
  return !!(
    document.getElementById('guiOverlay') &&
    document.getElementById('alerta') &&
    document.getElementById('guiOk')
  );
}

function reportarErroCritico(mensagem, arquivo, linha) {
  const detalhe = `${arquivo}:${linha}`;
  const chave = `${mensagem}|${detalhe}`;
  console.log(`[ERRO CRÍTICO] ${mensagem} (${detalhe})`);

  if (errosJaMostrados.has(chave)) return;
  errosJaMostrados.add(chave);

  const texto = `ERRO CRÍTICO: ${mensagem}\nVeja o console para detalhes.`;
  filaErros.push(texto);

  if (exibindoErro) return;
  exibindoErro = true;

  const mostrarProximo = () => {
    const msg = filaErros.shift();
    if (!msg) {
      exibindoErro = false;
      return;
    }
    if (podeUsarGuiAlert()) {
      guiAlert(msg).then(mostrarProximo);
    } else {
      alert(msg);
      mostrarProximo();
    }
  };

  mostrarProximo();
}

function linhaAtual(pulo = 2) {
  const stack = new Error().stack;
  if (!stack) return 0;
  const linhas = stack.split('\n');
  const alvo = linhas[pulo];
  if (!alvo) return 0;
  const match = alvo.match(/:(\d+):\d+\)?$/);
  return match ? parseInt(match[1], 10) : 0;
}

function checarFuncao(nome, descricao, arquivo, linha) {
  if (typeof window[nome] !== 'function') {
    reportarErroCritico(
      `Função ${nome} (${descricao}) não encontrada`,
      arquivo,
      linha || linhaAtual(3)
    );
    return false;
  }
  return true;
}

function checarNumero(valor, descricao, arquivo, linha) {
  if (!Number.isFinite(valor)) {
    reportarErroCritico(
      `Valor inválido para ${descricao} (esperado número)`,
      arquivo,
      linha || linhaAtual(3)
    );
    return false;
  }
  return true;
}

function checarBooleano(valor, descricao, arquivo, linha) {
  if (typeof valor !== 'boolean') {
    reportarErroCritico(
      `Valor inválido para ${descricao} (esperado boolean)`,
      arquivo,
      linha || linhaAtual(3)
    );
    return false;
  }
  return true;
}

function checarArray(valor, descricao, arquivo, linha) {
  if (!Array.isArray(valor)) {
    reportarErroCritico(
      `Valor inválido para ${descricao} (esperado array)`,
      arquivo,
      linha || linhaAtual(3)
    );
    return false;
  }
  return true;
}

function checarElementoId(id, descricao, arquivo, linha) {
  if (!document.getElementById(id)) {
    reportarErroCritico(`Elemento #${id} (${descricao}) não encontrado`, arquivo, linha);
    return false;
  }
  return true;
}

function checarElementoClasse(classe, descricao, arquivo, linha) {
  if (!document.querySelector(`.${classe}`)) {
    reportarErroCritico(`Elemento .${classe} (${descricao}) não encontrado`, arquivo, linha);
    return false;
  }
  return true;
}

function checarScriptsCarregados() {
  const scripts = Array.from(document.scripts).filter(s => s.src);
  const registry = window.__JGO_SCRIPTS__ || {};
  let ok = true;

  scripts.forEach((s) => {
    let nome = '';
    try {
      nome = new URL(s.src, location.href).pathname.split('/').pop();
    } catch {
      const partes = String(s.src).split('/');
      nome = partes[partes.length - 1] || '';
    }
    if (!nome) return;

    if (!registry[nome]) {
      reportarErroCritico(`Script ${nome} não carregou`, nome, 1);
      ok = false;
    }
  });

  return ok;
}

const ARQUIVOS_PROJETO = [
  'buttonfake.css',
  'config.html',
  'configMenu.html',
  'gui.css',
  'infologin.js',
  'jogo.html',
  'jogofuncoes.js',
  'login.html',
  'logon.html',
  'menu.html',
  'principal.html',
  'sttlejogo.css',
  'styles.css'
];

function acharLinha(html, trecho) {
  const idx = html.indexOf(trecho);
  if (idx === -1) return 1;
  return html.slice(0, idx).split(/\r\n|\r|\n/).length;
}

function acharLinhaPorIndice(texto, indice) {
  if (indice <= 0) return 1;
  return texto.slice(0, indice).split(/\r\n|\r|\n/).length;
}

function extrairLinhaDeErro(err) {
  if (!err) return 0;
  if (typeof err.lineNumber === 'number') return err.lineNumber;
  const stack = String(err.stack || err.message || '');
  const match = stack.match(/:(\d+):\d+/);
  return match ? parseInt(match[1], 10) : 0;
}

function checarHtmlBasico(arquivo, html) {
  let ok = true;
  const lower = html.toLowerCase();

  if (!lower.includes('<html')) {
    reportarErroCritico('Tag <html> ausente', arquivo, 1);
    ok = false;
  }
  if (!lower.includes('</html>')) {
    reportarErroCritico('Tag </html> ausente', arquivo, 1);
    ok = false;
  }
  if (!lower.includes('<head')) {
    reportarErroCritico('Tag <head> ausente', arquivo, 1);
    ok = false;
  }
  if (!lower.includes('</head>')) {
    reportarErroCritico('Tag </head> ausente', arquivo, 1);
    ok = false;
  }
  if (!lower.includes('<body')) {
    reportarErroCritico('Tag <body> ausente', arquivo, 1);
    ok = false;
  }
  if (!lower.includes('</body>')) {
    reportarErroCritico('Tag </body> ausente', arquivo, 1);
    ok = false;
  }

  // Ignora conteúdo de scripts, styles e comentários para evitar falsos positivos
  const ignoreRanges = [];

  const addRange = (inicio, fim) => {
    if (inicio >= 0 && fim > inicio) {
      ignoreRanges.push([inicio, fim]);
    }
  };

  const commentRe = /<!--[\s\S]*?-->/g;
  let cm;
  while ((cm = commentRe.exec(html))) {
    addRange(cm.index, cm.index + cm[0].length);
  }

  const tagRe = /<(script|style)\b[^>]*>/gi;
  let tm;
  while ((tm = tagRe.exec(html))) {
    const tag = tm[1].toLowerCase();
    const openEnd = html.indexOf('>', tm.index);
    if (openEnd === -1) break;
    const closeStart = html.toLowerCase().indexOf(`</${tag}`, openEnd + 1);
    if (closeStart === -1) break;
    addRange(openEnd + 1, closeStart);
  }

  const dentroDeIgnorados = (idx) =>
    ignoreRanges.some(([inicio, fim]) => idx >= inicio && idx < fim);

  // Verifica atributos href/src com aspas fechadas
  ['href', 'src'].forEach((attr) => {
    const re = new RegExp(`<[^>]+\\b${attr}\\s*=`, 'gi');
    let m;
    while ((m = re.exec(html))) {
      if (dentroDeIgnorados(m.index)) continue;
      const start = m.index + m[0].length;
      const rest = html.slice(start);
      const trimmed = rest.replace(/^\s+/, '');
      const offset = rest.length - trimmed.length;
      const quote = trimmed[0];
      const linha = acharLinhaPorIndice(html, m.index);

      if (quote !== '"' && quote !== "'") {
        reportarErroCritico(`Atributo ${attr} sem aspas`, arquivo, linha);
        ok = false;
        continue;
      }

      const endQuote = trimmed.indexOf(quote, 1);
      const endTag = trimmed.indexOf('>');
      if (endQuote === -1 || (endTag !== -1 && endQuote > endTag)) {
        reportarErroCritico(`Atributo ${attr} com aspas não fechadas`, arquivo, linha);
        ok = false;
      }
    }
  });

  return ok;
}

function checarJsSintaxe(arquivo, js) {
  if (js.trim().length === 0) {
    reportarErroCritico('Arquivo JS vazio', arquivo, 1);
    return false;
  }
  try {
    // Compila sem executar
    new Function(js);
    return true;
  } catch (err) {
    const linha = extrairLinhaDeErro(err) || 1;
    reportarErroCritico(`JS inválido: ${err.message || 'erro de sintaxe'}`, arquivo, linha);
    return false;
  }
}

function checarCssSintaxe(arquivo, css) {
  if (css.trim().length === 0) {
    reportarErroCritico('Arquivo CSS vazio', arquivo, 1);
    return false;
  }

  if (typeof CSSStyleSheet !== 'undefined' && CSSStyleSheet.prototype.replaceSync) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      return true;
    } catch (err) {
      const linha = extrairLinhaDeErro(err) || 1;
      reportarErroCritico(`CSS inválido: ${err.message || 'erro de sintaxe'}`, arquivo, linha);
      return false;
    }
  }

  // Fallback simples: checar balanceamento de chaves
  let balance = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') balance++;
    if (ch === '}') balance--;
  }
  if (balance !== 0) {
    reportarErroCritico('CSS com chaves desbalanceadas', arquivo, 1);
    return false;
  }

  return true;
}

function checarHtmlConteudo(arquivo, html) {
  let ok = true;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nome = arquivo.toLowerCase();

  function checarRegex(regex, mensagem, trecho) {
    if (!regex.test(html)) {
      reportarErroCritico(mensagem, arquivo, acharLinha(html, trecho || ''));
      ok = false;
    }
  }

  const precisaGui = true;
  const temGuiCss = !!doc.querySelector('link[href$="gui.css"]');
  const temGuiOverlay = !!doc.getElementById('guiOverlay');
  const temAlerta = !!doc.getElementById('alerta');
  const temGuiOk = !!doc.getElementById('guiOk');
  const temGuiCancel = !!doc.getElementById('guiCancel');
  const temScriptJogo = !!doc.querySelector('script[src*="jogofuncoes.js"]');

  if (precisaGui && !temGuiCss) {
    reportarErroCritico('Faltando link para gui.css', arquivo, acharLinha(html, 'gui.css'));
    ok = false;
  }
  if (precisaGui && !temGuiOverlay) {
    reportarErroCritico('Faltando #guiOverlay', arquivo, 1);
    ok = false;
  }
  if (precisaGui && !temAlerta) {
    reportarErroCritico('Faltando #alerta', arquivo, 1);
    ok = false;
  }
  if (precisaGui && !temGuiOk) {
    reportarErroCritico('Faltando #guiOk', arquivo, 1);
    ok = false;
  }
  if (precisaGui && !temGuiCancel) {
    reportarErroCritico('Faltando #guiCancel', arquivo, 1);
    ok = false;
  }
  if (precisaGui && !temScriptJogo) {
    reportarErroCritico('Faltando script jogofuncoes.js', arquivo, acharLinha(html, 'jogofuncoes.js'));
    ok = false;
  }

  if (nome === 'menu.html') {
    checarRegex(/href\s*=\s*["']jogo\.html["']/i, 'Link para jogo.html inválido ou ausente', 'jogo.html');
    checarRegex(/href\s*=\s*["']principal\.html["']/i, 'Link para principal.html inválido ou ausente', 'principal.html');
    checarRegex(/href\s*=\s*["']configMenu\.html["']/i, 'Link para configMenu.html inválido ou ausente', 'configMenu.html');
  }

  if (nome === 'principal.html') {
    checarRegex(/href\s*=\s*["']login\.html["']/i, 'Link para login.html inválido ou ausente', 'login.html');
    checarRegex(/href\s*=\s*["']logon\.html["']/i, 'Link para logon.html inválido ou ausente', 'logon.html');
  }

  if (nome === 'login.html') {
    checarRegex(/id\s*=\s*["']loginName["']/i, 'Campo #loginName ausente', 'loginName');
    checarRegex(/id\s*=\s*["']loginBankName["']/i, 'Campo #loginBankName ausente', 'loginBankName');
    checarRegex(/id\s*=\s*["']loginPassword["']/i, 'Campo #loginPassword ausente', 'loginPassword');
    checarRegex(/script[^>]+src\s*=\s*["']infologin\.js["']/i, 'Script infologin.js ausente', 'infologin.js');
  }

  if (nome === 'logon.html') {
    checarRegex(/id\s*=\s*["']loginName["']/i, 'Campo #loginName ausente', 'loginName');
    checarRegex(/id\s*=\s*["']loginPassword["']/i, 'Campo #loginPassword ausente', 'loginPassword');
    checarRegex(/script[^>]+src\s*=\s*["']infologin\.js["']/i, 'Script infologin.js ausente', 'infologin.js');
  }

  if (nome === 'config.html') {
    checarRegex(/resetProgress\s*\(\s*\)/i, 'Função resetProgress não encontrada no HTML', 'resetProgress');
  }

  if (nome === 'configmenu.html') {
    checarRegex(/href\s*=\s*["']menu\.html["']/i, 'Link para menu.html inválido ou ausente', 'menu.html');
  }

  if (nome === 'jogo.html') {
    checarRegex(/id\s*=\s*["']dinheiro["']/i, 'HUD #dinheiro ausente', 'dinheiro');
    checarRegex(/id\s*=\s*["']clientesWindow["']/i, 'Janela clientes ausente', 'clientesWindow');
  }

  return ok;
}

async function checarArquivos() {
  let ok = true;
  const unicos = Array.from(new Set(ARQUIVOS_PROJETO));

  await Promise.all(
    unicos.map(async (arquivo) => {
      try {
        const resposta = await fetch(arquivo, { cache: 'no-store' });
        if (!resposta.ok) {
          reportarErroCritico(`Arquivo ${arquivo} não encontrado`, arquivo, 1);
          ok = false;
          return;
        }
        const texto = await resposta.text();
        if (texto.trim().length === 0) {
          reportarErroCritico('Arquivo vazio', arquivo, 1);
          ok = false;
          return;
        }

        const lower = arquivo.toLowerCase();
        if (lower.endsWith('.html')) {
          if (!checarHtmlBasico(arquivo, texto)) ok = false;
          if (!checarHtmlConteudo(arquivo, texto)) ok = false;
        } else if (lower.endsWith('.js')) {
          if (!checarJsSintaxe(arquivo, texto)) ok = false;
        } else if (lower.endsWith('.css')) {
          if (!checarCssSintaxe(arquivo, texto)) ok = false;
        }
      } catch (err) {
        reportarErroCritico(`Não foi possível acessar ${arquivo}`, arquivo, 1);
        ok = false;
      }
    })
  );

  return ok;
}

function extrairArquivoLinha(stack) {
  if (!stack) return { arquivo: 'desconhecido', linha: 0 };
  const linhas = stack.split('\n');
  for (let i = 2; i < linhas.length; i++) {
    const match = linhas[i].match(/(https?:\/\/.*|file:.*|\\[^:]+|\/[^:]+):(\d+):(\d+)/);
    if (match) {
      const caminho = match[1];
      const arquivo = caminho.split('/').pop().split('\\').pop();
      return { arquivo: arquivo || 'desconhecido', linha: parseInt(match[2], 10) || 0 };
    }
  }
  return { arquivo: 'desconhecido', linha: 0 };
}

const consoleErrorOriginal = console.error.bind(console);
console.error = (...args) => {
  consoleErrorOriginal(...args);
  const msg = args.map(a => {
    if (typeof a === 'string') return a;
    try {
      return JSON.stringify(a);
    } catch {
      return String(a);
    }
  }).join(' ');
  const info = extrairArquivoLinha(new Error().stack);
  reportarErroCritico(`console.error: ${msg}`, info.arquivo, info.linha);
};

window.addEventListener('error', (event) => {
  if (event.target && event.target !== window) {
    const src = event.target.src || event.target.href || '';
    const nome = src ? src.split('/').pop() : 'recurso';
    reportarErroCritico(`Falha ao carregar recurso: ${nome}`, nome || 'recurso', 1);
    return;
  }
  const arquivo = event.filename ? event.filename.split('/').pop() : 'desconhecido';
  const linha = event.lineno || 0;
  reportarErroCritico(event.message || 'Erro desconhecido', arquivo, linha);
}, true);

window.addEventListener('unhandledrejection', (event) => {
  const motivo = event.reason instanceof Error ? event.reason.message : String(event.reason);
  reportarErroCritico(`Promise rejeitada: ${motivo}`, 'jogofuncoes.js', 0);
});

function isGamePage() {
  return !!(document.getElementById('dinheiro') || document.getElementById('clientesWindow'));
}

async function testarPrograma() {
  let ok = true;
  const pagina = (location.pathname.split('/').pop() || '').toLowerCase();
  const isConfig = pagina.includes('config');
  const arquivoGui = isConfig ? 'config.html' : 'jogo.html';
  const linhasGui = isConfig
    ? { guiOverlay: 31, alerta: 33, guiOk: 35, guiCancel: 36 }
    : { guiOverlay: 101, alerta: 103, guiOk: 105, guiCancel: 106 };

  ok = (await checarArquivos()) && ok;
  ok = checarScriptsCarregados() && ok;

  ok = checarElementoId('guiOverlay', 'Overlay de alerta', arquivoGui, linhasGui.guiOverlay) && ok;
  ok = checarElementoId('alerta', 'Texto do alerta', arquivoGui, linhasGui.alerta) && ok;
  ok = checarElementoId('guiOk', 'Botão OK do alerta', arquivoGui, linhasGui.guiOk) && ok;
  ok = checarElementoId('guiCancel', 'Botão Cancelar do alerta', arquivoGui, linhasGui.guiCancel) && ok;

  const arquivoJs = 'jogofuncoes.js';
  ok = checarFuncao('guiAlert', 'alerta customizado', arquivoJs) && ok;
  ok = checarFuncao('guiConfirm', 'confirmação customizada', arquivoJs) && ok;
  ok = checarFuncao('salvarEstado', 'salvar estado', arquivoJs) && ok;
  ok = checarFuncao('carregarEstado', 'carregar estado', arquivoJs) && ok;
  ok = checarFuncao('makeDraggable', 'drag de janelas', arquivoJs) && ok;

  const temInfoLogin = !!document.querySelector('script[src*="infologin.js"]');
  if (temInfoLogin) {
    const arquivoLogin = 'infologin.js';
    ok = checarFuncao('salvarLogins', 'salvar logins', arquivoLogin) && ok;
    ok = checarFuncao('carregarLogins', 'carregar logins', arquivoLogin) && ok;
    ok = checarFuncao('adicionarLogin', 'adicionar login', arquivoLogin) && ok;
    ok = checarFuncao('listarLogins', 'listar logins', arquivoLogin) && ok;
    ok = checarFuncao('buscarLoginPorNome', 'buscar login', arquivoLogin) && ok;
  }

  if (!isGamePage()) {
    if (ok) {
      console.log('Tudo em ordem');
    }
    return ok;
  }

  ok = checarElementoId('dinheiro', 'HUD dinheiro', 'jogo.html', 22) && ok;
  ok = checarElementoId('level', 'HUD level', 'jogo.html', 23) && ok;
  ok = checarElementoId('xp', 'HUD XP', 'jogo.html', 24) && ok;
  ok = checarElementoId('atendidos', 'HUD clientes', 'jogo.html', 25) && ok;
  ok = checarElementoId('funcionarios', 'HUD funcionarios', 'jogo.html', 26) && ok;
  ok = checarElementoId('clientesWindow', 'Janela clientes', 'jogo.html', 36) && ok;
  ok = checarElementoClasse('clientes-header', 'Cabeçalho clientes', 'jogo.html', 37) && ok;
  ok = checarElementoId('clientesList', 'Lista clientes', 'jogo.html', 41) && ok;
  ok = checarElementoId('lojaWindow', 'Janela loja', 'jogo.html', 47) && ok;
  ok = checarElementoClasse('loja-header', 'Cabeçalho loja', 'jogo.html', 48) && ok;
  ok = checarElementoId('lojaList', 'Lista loja', 'jogo.html', 52) && ok;
  ok = checarElementoId('bancoWindow', 'Janela banco', 'jogo.html', 64) && ok;
  ok = checarElementoClasse('banco-header', 'Cabeçalho banco', 'jogo.html', 65) && ok;
  ok = checarElementoId('bancoList', 'Lista banco', 'jogo.html', 69) && ok;
  ok = checarElementoId('caixaWindow', 'Janela caixa', 'jogo.html', 75) && ok;
  ok = checarElementoClasse('caixa-header', 'Cabeçalho caixa', 'jogo.html', 76) && ok;
  ok = checarElementoId('caixaList', 'Lista caixa', 'jogo.html', 80) && ok;
  ok = checarElementoId('temporizador', 'Temporizador imposto', 'jogo.html', 84) && ok;
  ok = checarElementoId('terminalWindow', 'Janela terminal', 'jogo.html', 89) && ok;
  ok = checarElementoClasse('terminal-header', 'Cabeçalho terminal', 'jogo.html', 90) && ok;
  ok = checarElementoId('terminalLog', 'Log terminal', 'jogo.html', 94) && ok;
  ok = checarElementoId('terminalInput', 'Input terminal', 'jogo.html', 96) && ok;

  ok = checarFuncao('atualizarDinheiro', 'atualização dinheiro', arquivoJs) && ok;
  ok = checarFuncao('atualizarLevel', 'atualização level', arquivoJs) && ok;
  ok = checarFuncao('atualizarXp', 'atualização XP', arquivoJs) && ok;
  ok = checarFuncao('atualizarClientes', 'atualização clientes', arquivoJs) && ok;
  ok = checarFuncao('atualizarFuncionarios', 'atualização funcionários', arquivoJs) && ok;
  ok = checarFuncao('adicionarDinheiro', 'adicionar dinheiro', arquivoJs) && ok;
  ok = checarFuncao('perdeDinheiro', 'remover dinheiro', arquivoJs) && ok;
  ok = checarFuncao('iniciarTimerClientes', 'timer clientes', arquivoJs) && ok;
  ok = checarFuncao('iniciarTimerImposto', 'timer imposto', arquivoJs) && ok;
  ok = checarFuncao('abrirchat', 'abrir chat', arquivoJs) && ok;
  ok = checarFuncao('abrirLoja', 'abrir loja', arquivoJs) && ok;
  ok = checarFuncao('abrirBanco', 'abrir banco', arquivoJs) && ok;
  ok = checarFuncao('abrirCaixa', 'abrir caixa', arquivoJs) && ok;
  ok = checarFuncao('abrirConta', 'abrir conta', arquivoJs) && ok;
  ok = checarFuncao('contratar', 'contratar funcionário', arquivoJs) && ok;
  ok = checarFuncao('investimento', 'investimento', arquivoJs) && ok;
  ok = checarFuncao('executarComandoTerminal', 'comandos terminal', arquivoJs) && ok;

  ok = checarNumero(dinheiro, 'dinheiro', arquivoJs) && ok;
  ok = checarNumero(level, 'level', arquivoJs) && ok;
  ok = checarNumero(xp, 'xp', arquivoJs) && ok;
  ok = checarNumero(xpRequired, 'xpRequired', arquivoJs) && ok;
  ok = checarNumero(clientesAtendidos, 'clientesAtendidos', arquivoJs) && ok;
  ok = checarNumero(funcionarios, 'funcionarios', arquivoJs) && ok;
  ok = checarBooleano(investimentoAtivo, 'investimentoAtivo', arquivoJs) && ok;
  ok = checarBooleano(impostoAtivo, 'impostoAtivo', arquivoJs) && ok;
  ok = checarArray(clientesPendentes, 'clientesPendentes', arquivoJs) && ok;

  if (ok) {
    console.log('js e html Tudo em ordem');
  }
  return ok;
}

// ===== SAVE / LOAD =====
function salvarEstado() {
  const p = `${currentUser}_`;
  localStorage.setItem(p + 'dinheiro', dinheiro);
  localStorage.setItem(p + 'level', level);
  localStorage.setItem(p + 'xp', xp);
  localStorage.setItem(p + 'xpRequired', xpRequired);
  localStorage.setItem(p + 'clientesAtendidos', clientesAtendidos);
  localStorage.setItem(p + 'clientesPendentes', JSON.stringify(clientesPendentes));
  localStorage.setItem(p + 'clienteCounter', clienteCounter);
  localStorage.setItem(p + 'investimentoAtivo', investimentoAtivo);
  localStorage.setItem(p + 'funcionarios', funcionarios);
  localStorage.setItem(p + 'impostoAtivo', impostoAtivo);
}

function carregarEstado() {
  const p = `${currentUser}_`;
  dinheiro = parseInt(localStorage.getItem(p + 'dinheiro')) || 1000;
  level = parseInt(localStorage.getItem(p + 'level')) || 1;
  xp = parseInt(localStorage.getItem(p + 'xp')) || 0;
  xpRequired = parseInt(localStorage.getItem(p + 'xpRequired')) || 100;
  clientesAtendidos = parseInt(localStorage.getItem(p + 'clientesAtendidos')) || 0;
  clientesPendentes = JSON.parse(localStorage.getItem(p + 'clientesPendentes')) || [];
  clienteCounter = parseInt(localStorage.getItem(p + 'clienteCounter')) || 0;
  investimentoAtivo = localStorage.getItem(p + 'investimentoAtivo') === 'true';
  funcionarios = parseInt(localStorage.getItem(p + 'funcionarios')) || 0;
  const impostoSalvo = localStorage.getItem(p + 'impostoAtivo');
  impostoAtivo = impostoSalvo === null ? true : impostoSalvo === 'true';
}

// ===== HUD =====
const h3 = document.getElementById("dinheiro");
const h3Level = document.getElementById("level");
const h3Xp = document.getElementById("xp");
const h3Clientes = document.getElementById("atendidos");
const h3Funcionarios = document.getElementById("funcionarios");
const h3Temporizador = document.getElementById("temporizador");

function animarElemento(elemento, classe) {
  if (!elemento) return;
  elemento.classList.remove(classe);
  // Reinicia a animação quando chamada em sequência
  void elemento.offsetWidth;
  elemento.classList.add(classe);
  elemento.addEventListener('animationend', () => {
    elemento.classList.remove(classe);
  }, { once: true });
}

function atualizarDinheiro() {
  if (!h3) return;
  h3.textContent = `Dinheiro: R$ ${dinheiro}`;
}

function formatarTempo(ms) {
  const totalSegundos = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  const s = String(segundos).padStart(2, '0');
  return `${minutos}:${s}`;
}

function atualizarTemporizador(ms) {
  if (!h3Temporizador) return;
  h3Temporizador.textContent = `imposto em: ${formatarTempo(ms)}`;
}

function atualizarFuncionarios() {
  if (!h3Funcionarios) return;
  h3Funcionarios.textContent = `Funcionários: ${funcionarios}`;
}
function atualizarClientes() {
  if (!h3Clientes) return;
  h3Clientes.textContent = `Clientes Atendidos: ${clientesAtendidos}`;
}

function atualizarLevel() {
  if (!h3Level) return;
  h3Level.textContent = `Level: ${level}`;
}

function atualizarXp() {
  if (!h3Xp) return;
  h3Xp.textContent = `XP: ${xp}/${xpRequired}`;
}

// ===== DINHEIRO =====
function adicionarDinheiro(valor) {
  dinheiro = Math.max(0, dinheiro + valor);
  atualizarDinheiro();
  if (valor > 0) animarElemento(h3, 'dinheiro-ganho');
  if (valor < 0) animarElemento(h3, 'dinheiro-perda');
  salvarEstado();
}

function perdeDinheiro(valor) {
  dinheiro = Math.max(0, dinheiro - valor);
  atualizarDinheiro();
  if (valor > 0) animarElemento(h3, 'dinheiro-perda');
  salvarEstado();
}

// ===== XP =====
function adicionarXp(valor) {
  xp += valor;

  if (valor > 0) animarElemento(h3Xp, 'level-ganho');
  if (valor < 0) animarElemento(h3Xp, 'level-perda');

  while (xp >= xpRequired) {
    xp -= xpRequired;
    level++;
    xpRequired = level * 100;
    atualizarLevel();
    animarElemento(h3Level, 'level-ganho');
  }

  atualizarXp();
  salvarEstado();
}

// ===== CLIENTES =====
function adicionarClientes(valor) {
  clientesAtendidos += valor;
  atualizarClientes();
  if (valor > 0) animarElemento(h3Clientes, 'cliente-ganho');
  if (valor < 0) animarElemento(h3Clientes, 'cliente-perda');
  salvarEstado();
}

// ===== JANELAS =====
function abrirchat() {
  const w = document.getElementById('clientesWindow');
  w.style.display = 'flex';
  w.style.zIndex = getNextZIndex();
}

function abrirCaixa() {
  const w = document.getElementById('caixaWindow');
  w.style.display = 'flex';
  w.style.zIndex = getNextZIndex();
}

function fecharCaixa() {
  document.getElementById('caixaWindow').style.display = 'none';
}

function fecharClientes() {
  document.getElementById('clientesWindow').style.display = 'none';
}

function abrirLoja() {
  const w = document.getElementById('lojaWindow');
  w.style.display = 'flex';
  w.style.zIndex = getNextZIndex();
}

function fecharLoja() {
  document.getElementById('lojaWindow').style.display = 'none';
}

function abrirBanco() {
  const w = document.getElementById('bancoWindow');
  if (!w) return;
  w.style.display = 'flex';
  w.style.zIndex = getNextZIndex();

  // Atualizar informações do banco
  const bancoList = document.getElementById('bancoList');
  if (!bancoList) return;
  bancoList.innerHTML = `
    <h4>Banco Atual: ${bankName}</h4>
    <p>Usuário: ${currentUser}</p>
    <p>Dinheiro em Conta: R$ ${dinheiro}</p>
  `;
}
function fecharbanco() {
  document.getElementById('bancoWindow').style.display = 'none';
}

function abrirTerminal() {
  const w = document.getElementById('terminalWindow');
  w.style.display = 'flex';
  w.style.zIndex = getNextZIndex();
  const input = document.getElementById('terminalInput');
  if (input) input.focus();
}

function fecharTerminal() {
  document.getElementById('terminalWindow').style.display = 'none';
}


// ===== CONTRATAR =====
async function contratar() {
  if (funcionarios >= 3) {
    await guiAlert('Você já contratou o número máximo de funcionários (3).');
    return;
  }

  if (dinheiro >= 1000 && level >= 4) {
    perdeDinheiro(1000);
    funcionarios++;
    salvarEstado();
    iniciarTimerClientes();
    atualizarFuncionarios();
    animarElemento(h3Funcionarios, 'funcionario-ganho');
    await guiAlert(`Funcionário contratado! Você agora tem ${funcionarios} funcionário(s).`);
  } else {
    await guiAlert('Você não tem dinheiro suficiente ou nível necessário.');
  }

}


// ===== INVESTIMENTO =====
function iniciarInvestimento() {
  if (investimentoInterval) return;
  investimentoInterval = setInterval(() => {
    adicionarDinheiro(50);
  }, 10000);
}

async function investimento() {
  if (investimentoAtivo) {
    await guiAlert('Você já possui um investimento ativo.');
    return;
  }

  if (dinheiro >= 500 && level >= 2) {
    perdeDinheiro(500);
    investimentoAtivo = true;
    salvarEstado();
    iniciarInvestimento();
    await guiAlert('Investimento realizado! Você ganhará R$ 50 a cada 10 segundos.');
  } else {
    await guiAlert('Você não tem dinheiro suficiente ou nível necessário.');
  }
}

// ===== CLIENTES TIMER =====
function iniciarTimerClientes() {
  if (clientesInterval) {
    clearInterval(clientesInterval);
  }

  clientesInterval = setInterval(() => {
    clienteCounter++;

    clientesPendentes.push({
      id: clienteCounter,
      nome: `Cliente ${clienteCounter}`
    });

    atualizarListaClientes();
    salvarEstado();
  }, calcularTempoCliente());
}


function calcularTempoCliente() {
  const tempo = tempoBaseClientes - (funcionarios * reducaoPorFuncionario);
  return Math.max(5000, tempo);
}

// ===== IMPOSTO TIMER =====
function aplicarImposto() {
  const impostoValor = 1000;
  perdeDinheiro(impostoValor);
  guiAlert(`Imposto cobrado: R$ ${impostoValor}`);
}


function iniciarTimerImposto() {
  if (!h3Temporizador) return;
  if (!impostoAtivo) {
    if (impostoTimerId) clearInterval(impostoTimerId);
    h3Temporizador.textContent = 'imposto desativado';
    return;
  }

  const p = `${currentUser}_`;
  const salvo = parseInt(localStorage.getItem(p + 'impostoDeadline'));
  const agora = Date.now();

  if (Number.isFinite(salvo) && salvo > agora) {
    impostoDeadline = salvo;
  } else {
    impostoDeadline = agora + impostoIntervaloMs;
  }

  localStorage.setItem(p + 'impostoDeadline', impostoDeadline);

  if (impostoTimerId) clearInterval(impostoTimerId);

  atualizarTemporizador(impostoDeadline - Date.now());

  impostoTimerId = setInterval(() => {
    const now = Date.now();
    let restante = impostoDeadline - now;

    if (restante <= 0) {
      aplicarImposto();
      impostoDeadline = now + impostoIntervaloMs;
      localStorage.setItem(p + 'impostoDeadline', impostoDeadline);
      restante = impostoDeadline - now;
    }

    atualizarTemporizador(restante);
  }, 1000);
}

function setImpostoAtivo(ativo) {
  impostoAtivo = ativo;
  salvarEstado();
  if (impostoAtivo) {
    iniciarTimerImposto();
  } else {
    if (impostoTimerId) clearInterval(impostoTimerId);
    if (h3Temporizador) {
      h3Temporizador.textContent = 'imposto desativado';
    }
  }
}


// ===== LISTA CLIENTES =====
function atualizarListaClientes() {
  const clientesList = document.getElementById('clientesList');
  if (!clientesList) return;
  clientesList.innerHTML = '';

  clientesPendentes.forEach(cliente => {
    const div = document.createElement('div');
    div.className = 'cliente-item';
    div.innerHTML = `<strong>${cliente.nome}</strong><br>ID: ${cliente.id}`;
    clientesList.appendChild(div);
  });
}

// ===== ABRIR CONTA =====
async function abrirConta() {
  if (clientesPendentes.length === 0) {
    await guiAlert('Nenhum cliente pendente!');
    return;
  }

  clientesPendentes.shift();
  adicionarClientes(1);
  adicionarDinheiro(100);
  adicionarXp(50);

  atualizarListaClientes();
  salvarEstado();
}

// ===== TERMINAL =====
function adicionarLinhaTerminal(texto) {
  const log = document.getElementById('terminalLog');
  if (!log) return;
  const div = document.createElement('div');
  div.className = 'linha';
  div.textContent = texto;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function executarComandoTerminal(comando) {
  const texto = comando.trim();
  if (!texto) return;

  const lower = texto.toLowerCase();

  if (lower === 'help' || lower === 'ajuda') {
    adicionarLinhaTerminal('Comandos disponíveis:');
    adicionarLinhaTerminal('- dinheiro = 1000 (adiciona dinheiro)');
    adicionarLinhaTerminal('- imposto = true | false (ativa/desativa imposto)');
    adicionarLinhaTerminal('- ativa imposto');
    adicionarLinhaTerminal('- desativa imposto');
    return;
  }

  let match = lower.match(/^dinheiro\s*=\s*(-?\d+)/);
  if (match) {
    const valor = parseInt(match[1], 10);
    adicionarDinheiro(valor);
    adicionarLinhaTerminal(`+ R$ ${valor} adicionados.`);
    return;
  }

  match = lower.match(/^imposto\s*=\s*(true|false)/);
  if (match) {
    const ativo = match[1] === 'true';
    setImpostoAtivo(ativo);
    adicionarLinhaTerminal(ativo ? 'Imposto ativado.' : 'Imposto desativado.');
    return;
  }

  if (lower === 'desativa imposto') {
    setImpostoAtivo(false);
    adicionarLinhaTerminal('Imposto desativado.');
    return;
  }

  if (lower === 'ativa imposto') {
    setImpostoAtivo(true);
    adicionarLinhaTerminal('Imposto ativado.');
    return;
  }

  adicionarLinhaTerminal('Comando não reconhecido.');
}

function enviarComandoTerminal() {
  const input = document.getElementById('terminalInput');
  if (!input) return;
  const texto = input.value;
  if (texto.trim() === '') return;
  adicionarLinhaTerminal(`> ${texto}`);
  executarComandoTerminal(texto);
  input.value = '';
}

// ===== INÍCIO =====
function iniciarJogo() {
  carregarEstado();
  if (investimentoAtivo) iniciarInvestimento();

  atualizarDinheiro();
  atualizarLevel();
  atualizarFuncionarios();
  atualizarXp();
  atualizarClientes();
  iniciarTimerClientes();
  iniciarTimerImposto();
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await testarPrograma();

  if (!isGamePage()) return;

  iniciarJogo();

  makeDraggable(
    document.getElementById('clientesWindow'),
    document.querySelector('.clientes-header')
  );

  makeDraggable(
    document.getElementById('lojaWindow'),
    document.querySelector('.loja-header')
  );

  makeDraggable(
    document.getElementById('bancoWindow'),
    document.querySelector('.banco-header')
  );

  makeDraggable(
    document.getElementById('terminalWindow'),
    document.querySelector('.terminal-header')
  );

  makeDraggable(
    document.getElementById('caixaWindow'),
    document.querySelector('.caixa-header')
  );

  const terminalInput = document.getElementById('terminalInput');
  if (terminalInput) {
    terminalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        enviarComandoTerminal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      abrirTerminal();
    }
  });
});


