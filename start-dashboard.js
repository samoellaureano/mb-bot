const fs = require('fs');
const { exec } = require('child_process');

const lockFile = './tmp/dashboard.lock';

if (fs.existsSync(lockFile)) {
  console.log('🚫 Dashboard já está rodando!');
  process.exit(1);
}

fs.writeFileSync(lockFile, process.pid);

const dashboard = exec('node dashboard.js');

dashboard.stdout.on('data', (data) => process.stdout.write(data));
dashboard.stderr.on('data', (data) => process.stderr.write(data));

dashboard.on('close', (code) => {
  fs.unlinkSync(lockFile);
  console.log(`Dashboard finalizado com código ${code}`);
});
