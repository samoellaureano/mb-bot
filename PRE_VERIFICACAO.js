/**
 * INSTRUÇÕES RÁPIDAS DE EXECUÇÃO
 * Teste Live Completo até 20:30
 * 
 * Abra este arquivo e leia rapidamente para começar!
 */

/*

╔════════════════════════════════════════════════════════════════╗
║                  🚀 COMECE AQUI - 30 SEGUNDOS                ║
╚════════════════════════════════════════════════════════════════╝

PASSO 1: Abra terminal (CMD) na pasta do projeto
-------------------------------------------------
C:\PROJETOS_PESSOAIS\mb-bot>


PASSO 2: Execute (Windows)
--------------------------
run_test_live.bat

Ou (Linux/Mac):
./run_test_live.sh


PASSO 3: Monitorar (abra outro terminal)
---------------------------------------
http://localhost:3001

Ou no terminal:
node monitor_live.js


PRONTO! ✅ Teste rodará até 20:30 automaticamente


════════════════════════════════════════════════════════════════

O QUE SERÁ TESTADO:
═════════════════════════════════════════════════════════════════

✓ VALORES:
  - Preços (BTC-BRL) - integridade e variação
  - Spreads - dentro de limites 1.2% a 2.0%
  - Saldos BTC e BRL - números válidos

✓ CÁLCULOS:
  - Ordens - campos, status, preços
  - Lucro - acompanhamento 24h
  - Conversão de valores

✓ CONVICÇÃO:
  - Sistema de confiança (0-100%)
  - 6 indicadores técnicos analisados
  - Classificação: VERY_STRONG até VERY_WEAK
  - Impacto no tamanho de ordem

✓ LUCRO E SALDO:
  - Validação com API Mercado Bitcoin
  - Consistência entre ciclos
  - Histórico 24 horas


════════════════════════════════════════════════════════════════

MONITORAMENTO EM TEMPO REAL:
═════════════════════════════════════════════════════════════════

Opção 1: Dashboard Web
  URL: http://localhost:3001
  Atualiza: A cada 3 segundos
  Mostra: Preços, Saldos, PnL, Convicção

Opção 2: Terminal Monitor
  Terminal novo: node monitor_live.js
  Atualiza: A cada 2 segundos
  Mostra: Contagem regressiva, métricas, alertas

Opção 3: Logs em Arquivo
  Pasta: logs/
  Arquivos:
    - bot_*.log
    - dashboard_*.log
    - teste_*.log


════════════════════════════════════════════════════════════════

RESULTADO FINAL (após 20:30):
═════════════════════════════════════════════════════════════════

Arquivo gerado: teste_live_YYYY-MM-DDTHH-mm-ss.json

Contém:
  - Número de ciclos executados
  - Ordens abertas e executadas
  - Lucro total em 24h
  - Saldos BTC e BRL
  - Convicção média
  - Distribuição de níveis de convicção
  - Status de 5 validações
  - Lista de erros (deve estar vazia)
  - Lista de alertas

Status Final:
  ✅ TESTE APROVADO (se 5/5 validações OK)
  ⚠️  TESTE PARCIAL (se 3-4 validações OK)
  ❌ TESTE FALHOU (se < 3 validações OK)


════════════════════════════════════════════════════════════════

TROUBLESHOOTING RÁPIDO:
═════════════════════════════════════════════════════════════════

Problema: "SIMULATE não está em false"
Solução:  Edite .env e mude para SIMULATE=false

Problema: "npm: command not found"
Solução:  npm install

Problema: "Port 3001 already in use"
Solução:  Feche outro dashboard ou altere PORT em dashboard.js

Problema: "Cannot find module"
Solução:  npm install && npm run migrate

Problema: "API connection failed"
Solução:  Verifique API_KEY e API_SECRET em .env
         node test-client.js (para testar conexão)


════════════════════════════════════════════════════════════════

CUSTOMIZAÇÕES RÁPIDAS:
═════════════════════════════════════════════════════════════════

Mudar hora de término:
  Edite: test_live_complete.js
  Encontre: const ALVO_TERMINO = '20:30:00';
  Altere para: const ALVO_TERMINO = '18:00:00';

Mudar ciclo do bot (padrão 30s):
  Edite: .env
  Encontre: CYCLE_SEC=30
  Altere para: CYCLE_SEC=15

Aumentar spread (padrão 1.5%):
  Edite: .env
  Encontre: SPREAD_PCT=0.015
  Altere para: SPREAD_PCT=0.020


════════════════════════════════════════════════════════════════

DOCUMENTAÇÃO COMPLETA:
═════════════════════════════════════════════════════════════════

Leia para mais detalhes:
  - TESTE_LIVE_RESUMO.md      (resumo executivo)
  - GUIA_TESTE_LIVE.md         (guia completo)
  - TESTE_LIVE_START.md        (visual overview)
  - CONFIDENCE_SYSTEM.md       (sistema de convicção técnico)
  - GUIA_CONVICCAO.md          (guia rápido de convicção)


════════════════════════════════════════════════════════════════

SCRIPTS ÚTEIS:
═════════════════════════════════════════════════════════════════

npm run test:live           # Rodar teste até 20:30
npm run test:conviction     # Testar sistema de convicção
npm run test:analyzer       # Analisar histórico
npm run live                # Bot só (LIVE mode)
npm run dashboard           # Dashboard só
npm run simulate            # Bot em simulação
npm run stats               # Ver estatísticas 24h
npm run orders              # Ver últimas 20 ordens
node clean_and_sync.js      # Sincronizar com API


════════════════════════════════════════════════════════════════

PRÓXIMAS AÇÕES:
═════════════════════════════════════════════════════════════════

1. Execute: run_test_live.bat
2. Abra: http://localhost:3001
3. Espere: 5 horas até 20:30
4. Analise: Arquivo JSON gerado
5. Ajuste: Parâmetros em .env se necessário
6. Rode novamente: Com ajustes


════════════════════════════════════════════════════════════════

                    🎯 VAMOS COMEÇAR!

                   run_test_live.bat


════════════════════════════════════════════════════════════════

*/

// Script de exemplo para verificar que tudo está OK antes de rodar:

const fs = require('fs');
const chalk = require('chalk');

console.log(chalk.bold.cyan('\n🔍 PRÉ-VERIFICAÇÃO DE TESTE LIVE\n'));

let ok = true;

// Verificar .env
if (!fs.existsSync('.env')) {
    console.log(chalk.red('❌ .env não encontrado'));
    ok = false;
} else {
    const env = fs.readFileSync('.env', 'utf8');
    if (env.includes('SIMULATE=true')) {
        console.log(chalk.red('❌ SIMULATE=true - Mude para SIMULATE=false'));
        ok = false;
    } else if (env.includes('SIMULATE=false')) {
        console.log(chalk.green('✓ SIMULATE=false (MODO LIVE)'));
    }
    
    if (env.includes('API_KEY=') && !env.includes('API_KEY=seu_api')) {
        console.log(chalk.green('✓ API_KEY configurada'));
    } else {
        console.log(chalk.red('❌ API_KEY não configurada'));
        ok = false;
    }
}

// Verificar arquivos necessários
const arquivos = [
    'bot.js',
    'dashboard.js',
    'db.js',
    'mb_client.js',
    'test_live_complete.js'
];

console.log();
arquivos.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(chalk.green(`✓ ${file}`));
    } else {
        console.log(chalk.red(`❌ ${file} faltando`));
        ok = false;
    }
});

// Verificar node_modules
console.log();
if (fs.existsSync('node_modules')) {
    console.log(chalk.green('✓ node_modules instalado'));
} else {
    console.log(chalk.red('❌ node_modules faltando - execute: npm install'));
    ok = false;
}

// Resultado
console.log();
if (ok) {
    console.log(chalk.bold.green('✅ TUDO OK! Pode executar: run_test_live.bat\n'));
} else {
    console.log(chalk.bold.red('⚠️  Verifique os problemas acima antes de rodar.\n'));
    process.exit(1);
}
