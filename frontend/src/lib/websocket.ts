import EventEmitter from 'eventemitter3';

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(token: string) {
    super();
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
      const url = `${wsUrl}/ws/chat?token=${this.token}`;
      
      console.log('Connecting to WebSocket:', url);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected successfully');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            console.log('📩 WebSocket raw message:', event.data);
            
            // Split by newline in case multiple messages are sent together
            const messages = event.data.trim().split('\n').filter((line: string) => line.trim());
            
            messages.forEach((msgStr: string) => {
              try {
                const data = JSON.parse(msgStr);
                console.log('📦 WebSocket parsed message:', data);
                
                // Emit event based on message type
                if (data.type) {
                  console.log(`🔔 Emitting event: ${data.type}`, data.payload);
                  this.emit(data.type, data.payload);
                } else {
                  console.warn('Message without type:', data);
                }
              } catch (parseError) {
                console.error('Failed to parse individual message:', msgStr, parseError);
              }
            });
          } catch (error) {
            console.error('Failed to process WebSocket message:', error, 'Raw data:', event.data);
          }
        };

        this.ws.onerror = (error) => {
          // console.error('❌ WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          this.handleReconnect();
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  sendMessage(receiverId: number, content: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket is not connected');
      return;
    }

    const message = {
      type: 'message',
      payload: {
        receiver_id: receiverId,
        content: content,
      },
    };

    console.log('📤 Sending message:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendTyping(receiverId: number, isTyping: boolean) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'typing',
      payload: {
        receiver_id: receiverId,
        is_typing: isTyping,
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  sendReceipt(messageId: number, status: 'delivered' | 'read') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'receipt',
      payload: {
        message_id: messageId,
        status: status,
      },
    };

    console.log('📬 Sending receipt:', message);
    this.ws.send(JSON.stringify(message));
  }

  // WebRTC Signaling Methods
  sendCallRequest(calleeId: number, callType: 'audio' | 'video') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket is not connected');
      return;
    }

    const message = {
      type: 'call-request',
      payload: {
        to: calleeId,
        call_type: callType,
      },
    };

    console.log('📞 Sending call request:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendCallAccept(callId: string, callerId: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'call-accept',
      payload: {
        call_id: callId,
        to: callerId,
      },
    };

    console.log('✅ Sending call accept:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendCallReject(callId: string, callerId: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'call-reject',
      payload: {
        call_id: callId,
        to: callerId,
      },
    };

    console.log('❌ Sending call reject:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendCallEnd(callId: string, otherUserId: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'call-end',
      payload: {
        call_id: callId,
        to: otherUserId,
      },
    };

    console.log('📴 Sending call end:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendOffer(callId: string, to: number, sdp: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'offer',
      payload: {
        call_id: callId,
        to: to,
        sdp: sdp,
      },
    };

    console.log('📤 Sending SDP offer:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendAnswer(callId: string, to: number, sdp: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'answer',
      payload: {
        call_id: callId,
        to: to,
        sdp: sdp,
      },
    };

    console.log('📤 Sending SDP answer:', message);
    this.ws.send(JSON.stringify(message));
  }

  sendIceCandidate(callId: string, to: number, candidate: RTCIceCandidateInit) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'ice-candidate',
      payload: {
        call_id: callId,
        to: to,
        candidate: candidate,
      },
    };

    console.log('📤 Sending ICE candidate:', message);
    this.ws.send(JSON.stringify(message));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
