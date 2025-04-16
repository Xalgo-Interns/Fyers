const FyersSocket = require("fyers-api-v3").fyersDataSocket;
const EventEmitter = require("events");

class SocketManager {
  constructor() {
    this.connections = new Map();
    this.events = new EventEmitter();
  }

  createSocket(userId, accessToken) {
    if (this.connections.has(userId)) {
      return this.connections.get(userId);
    }

    const fyersdata = new FyersSocket(accessToken);

    const onmsg = (message) => {
      console.log(`[${userId}] Raw message:`, message);
      this.events.emit(`${userId}:raw`, message);

      if (message.type === "sf") {
        const liteData = {
          symbol: message.symbol,
          ltp: message.ltp,
          type: "sf",
        };
        console.log(`[${userId}] Emitting LTP data:`, liteData);
        this.events.emit(`${userId}:data`, liteData);
      } else if (message.type === "if") {
        // For index data, include all required fields
        const indexData = {
          symbol: message.symbol,
          ltp: message.ltp,
          prev_close_price: message.prev_close_price || 0,
          high_price: message.high_price || 0,
          low_price: message.low_price || 0, 
          open_price: message.open_price || 0,
          ch: message.ch || 0,
          chp: message.chp || 0,
          type: "if"
        };
        console.log(`[${userId}] Emitting Index data:`, indexData);
        this.events.emit(`${userId}:data`, indexData);
      } else {
        this.events.emit(`${userId}:data`, message);
      }
    };

    const onconnect = () => {
      console.log(`[${userId}] Connected`);
      this.events.emit(`${userId}:connected`);

      const connection = this.connections.get(userId);
      if (connection) {
        connection.connected = true;

        if (connection.pendingSymbols.size > 0) {
          console.log(`[${userId}] Processing ${connection.pendingSymbols.size} pending symbols`);
          
          const pendingSymbols = Array.from(connection.pendingSymbols);
          const hasIndexSymbols = pendingSymbols.some(s => s.symbol.endsWith('-INDEX'));
          
          if (hasIndexSymbols) {
            console.log(`[${userId}] Setting full mode for index data`);
            fyersdata.mode(fyersdata.FullMode);
          } else {
            console.log(`[${userId}] Setting lite mode for regular symbols`);
            fyersdata.mode(fyersdata.LiteMode);
          }

          const symbols = pendingSymbols.map(s => s.symbol);

          // Subscribe symbols in chunks to avoid overwhelming the socket
          const CHUNK_SIZE = 50;
          for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
            const chunk = symbols.slice(i, i + CHUNK_SIZE);
            console.log(`[${userId}] Subscribing to chunk:`, chunk);
            fyersdata.subscribe(chunk);
            chunk.forEach((s) => connection.subscribedSymbols.add(s));
          }

          connection.pendingSymbols.clear();
          fyersdata.autoreconnect();
        }
      }
    };

    const onerror = (err) => {
      console.error(`[${userId}] Error:`, err);
      this.events.emit(`${userId}:error`, err);
    };

    const onclose = () => {
      console.log(`[${userId}] Socket closed`);
      this.events.emit(`${userId}:closed`);
      this.connections.delete(userId);
    };

    fyersdata.on("message", onmsg);
    fyersdata.on("connect", onconnect);
    fyersdata.on("error", onerror);
    fyersdata.on("close", onclose);

    const connection = {
      socket: fyersdata,
      subscribedSymbols: new Set(),
      pendingSymbols: new Set(),
      connected: false,
      userId,
      disconnect: () => {
        fyersdata.close();
        this.connections.delete(userId);
      },
    };

    this.connections.set(userId, connection);

    // Explicitly connect the socket
    console.log(`[${userId}] Initiating socket connection...`);
    fyersdata.connect();

    return connection;
  }

  subscribeToSymbols(userId, symbols, enableDepth = false, isIndex = false) {
    const connection = this.connections.get(userId);
    if (!connection) {
      throw new Error("No active connection found");
    }

    if (!connection.connected) {
      console.log(`[${userId}] Socket not ready, queueing symbols:`, symbols);
      symbols.forEach((s) => {
        connection.pendingSymbols.add({ 
          symbol: s, 
          enableDepth: enableDepth,
          isIndex: isIndex 
        });
      });
      return;
    }

    // Set appropriate mode based on symbol type
    if (isIndex) {
      console.log(`[${userId}] Setting full mode for index data`);
      connection.socket.mode(connection.socket.FullMode);
    } else {
      console.log(`[${userId}] Setting lite mode for LTP data`);
      connection.socket.mode(connection.socket.LiteMode);
    }

    // Subscribe in a single call
    console.log(`[${userId}] Subscribing to symbols:`, symbols);
    connection.socket.subscribe(symbols);
    symbols.forEach((s) => connection.subscribedSymbols.add(s));

    // Enable auto-reconnect after subscription
    connection.socket.autoreconnect();
  }

  setLiteMode(userId) {
    const connection = this.connections.get(userId);
    if (!connection) {
      throw new Error("No active connection found");
    }

    const symbols = Array.from(connection.subscribedSymbols);
    console.log(`[${userId}] Current symbols for mode setting:`, symbols);

    // For indices, always use full mode
    if (symbols.some((s) => s.endsWith("-INDEX"))) {
      console.log(`[${userId}] Using full mode for indices`);
      connection.socket.mode(connection.socket.FullMode);
    } else {
      console.log(`[${userId}] Setting lite mode for non-index symbols`);
      connection.socket.mode(connection.socket.LiteMode);
    }
  }
}

module.exports = new SocketManager();
