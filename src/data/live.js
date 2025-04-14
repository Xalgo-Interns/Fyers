const WebSocket = require('ws');
const EventEmitter = require('events');

const CONNECTION_STATES = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

const RATE_LIMIT = {
  MAX_RECONNECT_ATTEMPTS: 3,
  MAX_SYMBOLS_PER_REQUEST: 50,
  PING_INTERVAL: 30000
};

class LiveFeedConnection {
  constructor(userId, accessToken, symbols) {
    this.userId = userId;
    this.accessToken = accessToken;
    this.subscribedSymbols = symbols || [];
    this.state = CONNECTION_STATES.CONNECTING;
    this.ws = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
  }

  connect() {
    try {
      this.ws = new WebSocket('wss://ws.fyers.in/socket/v2');
      
      this.ws.on('open', () => {
        this.setState(CONNECTION_STATES.CONNECTED);
        this.authenticate();
        this.startPingInterval();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data));
      });

      this.ws.on('error', (error) => {
        console.error(`WebSocket error for ${this.userId}:`, error);
        this.handleError(error);
      });

      this.ws.on('close', () => {
        this.handleClose();
      });

    } catch (error) {
      console.error(`Failed to create WebSocket for ${this.userId}:`, error);
      this.handleError(error);
    }
  }

  setState(newState) {
    this.state = newState;
    marketDataEvents.emit(`${this.userId}:state`, newState);
  }

  startPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, RATE_LIMIT.PING_INTERVAL);
  }

  authenticate() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'authenticate',
        token: this.accessToken
      }));
    }
  }

  handleMessage(message) {
    // Emit market data updates
    marketDataEvents.emit(`${this.userId}:data`, message);
    console.log(`📡 Live data update for user ${this.userId}`);
  }

  handleError(error) {
    this.setState(CONNECTION_STATES.ERROR);
    marketDataEvents.emit(`${this.userId}:error`, error);
    
    if (this.reconnectAttempts < RATE_LIMIT.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 5000 * this.reconnectAttempts);
    } else {
      marketDataEvents.emit(`${this.userId}:max_retries_reached`);
    }
  }

  handleClose() {
    this.setState(CONNECTION_STATES.DISCONNECTED);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    marketDataEvents.emit(`${this.userId}:disconnected`);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }

  getState() {
    return this.state;
  }
}

// Initialize event emitter for market data
const marketDataEvents = new EventEmitter();
const activeConnections = new Map();

function subscribeToLiveData(userId, accessToken, symbols) {
  // Close existing connection if any
  if (activeConnections.has(userId)) {
    activeConnections.get(userId).close();
  }

  const connection = new LiveFeedConnection(userId, accessToken, symbols);
  activeConnections.set(userId, connection);
  connection.connect();

  return connection;
}

module.exports = {
  subscribeToLiveData,
  marketDataEvents,
  CONNECTION_STATES,
  getActiveConnections: () => Array.from(activeConnections.keys())
};
