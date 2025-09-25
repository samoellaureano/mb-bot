// api/bot.js
import { exec } from 'child_process';

export default function handler(req, res) {
  const simulate = req.query.simulate === 'true' ? 'true' : 'false';

  // Executa o bot uma vez, passando SIMULATE
  exec(`SIMULATE=${simulate} node bot.js`, (error, stdout, stderr) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
    res.status(200).json({ success: true, output: stdout || stderr });
  });
}
