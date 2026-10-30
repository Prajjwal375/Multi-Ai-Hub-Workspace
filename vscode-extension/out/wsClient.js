"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsClient = void 0;
const http = __importStar(require("http"));
const crypto = __importStar(require("crypto"));
const HOST = '127.0.0.1';
const PORT = 54321;
const RECONNECT_INTERVAL = 5000;
/**
 * Minimal WebSocket client using Node's built-in http.request upgrade.
 * No external npm dependencies — works inside a VS Code extension as-is.
 */
class WsClient {
    constructor() {
        this.socket = null;
        this.reconnectTimer = null;
        this.statusListeners = [];
        this.disposed = false;
        this.connected = false;
    }
    connect() {
        if (this.disposed)
            return;
        this.cleanup();
        const key = crypto.randomBytes(16).toString('base64');
        const expectedAccept = crypto
            .createHash('sha1')
            .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            .digest('base64');
        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: '/',
            headers: {
                Connection: 'Upgrade',
                Upgrade: 'websocket',
                'Sec-WebSocket-Key': key,
                'Sec-WebSocket-Version': '13',
            },
        });
        req.on('upgrade', (res, socket) => {
            const accept = res.headers['sec-websocket-accept'];
            if (accept !== expectedAccept) {
                socket.destroy();
                this.scheduleReconnect();
                return;
            }
            this.socket = socket;
            this.connected = true;
            this.emitStatus(true);
            socket.on('data', () => {
                // incoming frames from server — we don't need to process them
            });
            socket.on('error', () => {
                this.onDisconnect();
            });
            socket.on('close', () => {
                this.onDisconnect();
            });
            socket.on('end', () => {
                this.onDisconnect();
            });
        });
        req.on('error', () => {
            this.scheduleReconnect();
        });
        req.end();
    }
    /** Send a JSON message as a masked WebSocket text frame. */
    send(message) {
        if (!this.socket || !this.connected)
            return;
        try {
            const payload = Buffer.from(JSON.stringify(message), 'utf8');
            const frame = encodeFrame(payload);
            this.socket.write(frame);
        }
        catch {
            /* ignore */
        }
    }
    onStatusChange(listener) {
        this.statusListeners.push(listener);
    }
    isConnected() {
        return this.connected;
    }
    dispose() {
        this.disposed = true;
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.cleanup();
    }
    onDisconnect() {
        if (this.connected) {
            this.connected = false;
            this.emitStatus(false);
        }
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        if (this.disposed)
            return;
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_INTERVAL);
    }
    cleanup() {
        this.connected = false;
        if (this.socket) {
            this.socket.removeAllListeners();
            try {
                this.socket.destroy();
            }
            catch { /* ignore */ }
            this.socket = null;
        }
    }
    emitStatus(connected) {
        for (const l of this.statusListeners)
            l(connected);
    }
}
exports.WsClient = WsClient;
/**
 * Encode a text payload as a masked WebSocket frame (RFC 6455).
 * Client→server frames MUST be masked.
 */
function encodeFrame(payload) {
    const len = payload.length;
    const mask = crypto.randomBytes(4);
    let header;
    if (len < 126) {
        header = Buffer.allocUnsafe(6);
        header[0] = 0x81; // FIN + opcode 1 (text)
        header[1] = 0x80 | len; // MASK bit + 7-bit length
        mask.copy(header, 2);
    }
    else if (len < 65536) {
        header = Buffer.allocUnsafe(8);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(len, 2);
        mask.copy(header, 4);
    }
    else {
        header = Buffer.allocUnsafe(14);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeUInt32BE(0, 2);
        header.writeUInt32BE(len, 6);
        mask.copy(header, 10);
    }
    const masked = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) {
        masked[i] = payload[i] ^ mask[i % 4];
    }
    return Buffer.concat([header, masked]);
}
//# sourceMappingURL=wsClient.js.map