const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

export type WSMessageType = 
  | 'message' 
  | 'message_sent' 
  | 'typing' 
  | 'receipt' 
  | 'user_status';

export interface WSMessage {
  type: WSMessageType;
  payload: any;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Map<WSMessageType, Set<(payload: any) => void>> = new Map();

  constructor(private token: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${WS_URL}/ws/chat`);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          
          // Send authentication
          this.send('auth', { token: this.token });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: WSMessage) {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message.payload));
    }
  }

  on(type: WSMessageType, handler: (payload: any) => void) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
  }

  off(type: WSMessageType, handler: (payload: any) => void) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  send(type: WSMessageType, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  sendMessage(receiverId: number, content: string) {
    this.send('message', { receiver_id: receiverId, content });
  }

  sendTyping(receiverId: number, isTyping: boolean) {
    this.send('typing', { receiver_id: receiverId, is_typing: isTyping });
  }

  sendReceipt(messageId: number, status: 'delivered' | 'read') {
    this.send('receipt', { message_id: messageId, status });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = 1000 * this.reconnectAttempts;
      
      console.log(`Attempting to reconnect in ${delay}ms...`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch(() => {
          // Will retry again if connection fails
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
