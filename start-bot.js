const fs = require('fs');
const { exec } = require('child_process');

const lockFile = './tmp/bot.lock';

if (fs.existsSync(lockFile)) {
  console.log('🚫 Bot já está rodando!');
  process.exit(1);
}

fs.writeFileSync(lockFile, process.pid);

const bot = exec('SIMULATE=true node bot.js');

bot.stdout.on('data', (data) => process.stdout.write(data));
bot.stderr.on('data', (data) => process.stderr.write(data));

bot.on('close', (code) => {
  fs.unlinkSync(lockFile);
  console.log(`Bot finalizado com código ${code}`);
});
