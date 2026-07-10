// Встроенный MQTT-брокер (Aedes): TCP для серверных клиентов + WebSocket для браузерной панели.
const aedes = require('aedes')();
const net = require('net');
const http = require('http');
const { WebSocketServer, createWebSocketStream } = require('ws');
const cfg = require('./config');

function startBroker() {
  // TCP MQTT — ТОЛЬКО localhost (внутренняя шина агенты↔консьюмер). Внешний publish невозможен.
  const tcp = net.createServer(aedes.handle);
  tcp.listen(cfg.mqttPort, cfg.brokerHost, () => console.log(`[broker] MQTT TCP ${cfg.brokerHost}:${cfg.mqttPort}`));

  // MQTT over WebSocket — тоже только localhost (на будущее; панель метрики берёт через polling).
  const httpServer = http.createServer();
  const wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (socket) => {
    const stream = createWebSocketStream(socket);
    stream.on('error', () => {});
    aedes.handle(stream);
  });
  httpServer.listen(cfg.wsPort, cfg.brokerHost, () => console.log(`[broker] MQTT WS   ${cfg.brokerHost}:${cfg.wsPort}`));

  aedes.on('clientError', () => {});
  aedes.on('connectionError', () => {});
  return aedes;
}

module.exports = { aedes, startBroker };
