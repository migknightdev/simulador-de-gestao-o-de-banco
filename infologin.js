window.__JGO_SCRIPTS__ = window.__JGO_SCRIPTS__ || {};
window.__JGO_SCRIPTS__['infologin.js'] = true;

let loginName = document.getElementById("loginName");
let loginBankName = document.getElementById("loginBankName");
let loginPassword = document.getElementById("loginPassword");

// Array para armazenar múltiplos logins
let logins = [];

// Função para salvar logins no localStorage
function salvarLogins() {
    localStorage.setItem('logins', JSON.stringify(logins));
}

// Função para carregar logins do localStorage
function carregarLogins() {
    let loginsSalvos = localStorage.getItem('logins');
    if (loginsSalvos) {
        logins = JSON.parse(loginsSalvos);
    }
}

// Função para adicionar um novo login ao array
function adicionarLogin(name, bankName, password) {
    let novoLogin = {
        nome: name,
        banco: bankName,
        senha: password
    };
    logins.push(novoLogin);
    salvarLogins(); // Salva após adicionar
    console.log("Login adicionado:", novoLogin);
    console.log("Logins atuais:", logins);
}

// Função para listar todos os logins
function listarLogins() {
    if (logins.length === 0) {
        alert('Nenhum login cadastrado.');
        return;
    }
    let lista = 'Lista de logins:\n';
    logins.forEach((login, index) => {
        let senhaCensurada = login.senha.charAt(0) + '***';
        lista += `${index + 1}. Nome: ${login.nome}, Banco: ${login.banco}, Senha: ${senhaCensurada}\n`;
    });
    alert(lista);
}

// Função para buscar um login por nome
function buscarLoginPorNome(nome) {
    return logins.find(login => login.nome === nome);
}

// Carregar logins ao iniciar a página
carregarLogins();
