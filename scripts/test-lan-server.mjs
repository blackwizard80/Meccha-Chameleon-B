import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const port = 32123;
const child = spawn(process.execPath, ['public/nodejs/server.cjs'], {
  env: { ...process.env, MOBILE_LAN_SERVER: '1', NODE_ENV: 'production', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let logs = '';
child.stdout.on('data', (chunk) => (logs += chunk.toString()));
child.stderr.on('data', (chunk) => (logs += chunk.toString()));

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    if (child.exitCode !== null) throw new Error(`LAN server exited early: ${logs}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/lan-info`);
      if (response.ok) return response.json();
    } catch {
      // Server is still starting.
    }
    await delay(250);
  }
  throw new Error(`LAN server did not become ready: ${logs}`);
}

function waitForMessage(socket, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for LAN message')), timeoutMs);
    const onMessage = (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off('message', onMessage);
      resolve(message);
    };
    socket.on('message', onMessage);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

let host;
let guest;
try {
  const info = await waitForServer();
  if (!Array.isArray(info.localIps) || info.port !== port) {
    throw new Error('LAN info endpoint returned an invalid response');
  }

  const lanIp = info.localIps.find((ip) => ip !== '127.0.0.1');
  const hostUrl = `ws://127.0.0.1:${port}`;
  const guestUrl = lanIp ? `ws://${lanIp}:${port}` : hostUrl;

  host = await connect(hostUrl);
  const hostWelcomePromise = waitForMessage(host, (m) => m.type === 'welcome');
  host.send(JSON.stringify({ type: 'create_room', playerName: 'Host', settings: {} }));
  const hostWelcome = await hostWelcomePromise;
  if (!hostWelcome.room?.roomId) throw new Error('Host room was not created');

  guest = await connect(guestUrl);
  const guestWelcomePromise = waitForMessage(guest, (m) => m.type === 'welcome');
  const hostUpdatePromise = waitForMessage(
    host,
    (m) => m.type === 'room_state' && m.room?.players?.length === 2,
  );
  guest.send(JSON.stringify({
    type: 'join_room',
    roomId: hostWelcome.room.roomId,
    playerName: 'Guest',
  }));
  const guestWelcome = await guestWelcomePromise;
  await hostUpdatePromise;
  if (guestWelcome.room?.players?.length !== 2) {
    throw new Error('Guest did not join the host room');
  }

  console.log('LAN server smoke test passed: HTTP discovery, host room, and second-player join.');
} finally {
  host?.close();
  guest?.close();
  child.kill('SIGTERM');
}
