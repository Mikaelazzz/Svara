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
          this.handleMessage(event);
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

  private handleMessage(event: MessageEvent) {
    try {
      console.log('📩 WebSocket raw message:', event.data);
      
      // Split by newline to handle multiple JSON objects in one message
      const messages = event.data.split('\n').filter((msg: string) => msg.trim());
      
      for (const msgStr of messages) {
        try {
          const message = JSON.parse(msgStr);
          console.log('📦 WebSocket parsed message:', message);

          const { type, payload } = message;

          if (!type) {
            console.error('❌ Message missing type field:', message);
            continue;
          }

          console.log(`🔔 Emitting event: ${type}`, payload);
          console.log(`🔔 Listeners for '${type}':`, this.listenerCount(type));
          console.log(`🔔 All registered events:`, this.eventNames());

          // Emit the event to all listeners
          this.emit(type, payload);
          
          console.log(`✅ Event ${type} emitted successfully`);
          console.log(`✅ Emitted to ${this.listenerCount(type)} listeners`);

          // Handle specific message types
          switch (type) {
            case 'message':
              // Chat message received
              break;
            case 'typing':
              // Typing indicator
              break;
            case 'user_status':
              // User online/offline status
              break;
            case 'call-request':
            case 'call-request-ack':
            case 'call-accept':
            case 'call-reject':
            case 'call-end':
            case 'offer':
            case 'answer':
            case 'ice-candidate':
            case 'mute-status':
              console.log(`📞 WebRTC signaling event: ${type}`);
              // These are handled by event listeners
              break;
            default:
              console.log(`ℹ️ Unhandled message type: ${type}`);
          }
        } catch (parseError) {
          console.error('❌ Error parsing individual message:', parseError, msgStr);
        }
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error, event.data);
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

  // Send mute status to other user during call
  sendMuteStatus(callId: string, toUserId: number, isMuted: boolean) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: 'mute-status',
      payload: {
        call_id: callId,
        to: toUserId,
        is_muted: isMuted,
      },
    };

    console.log('🔇 Sending mute status:', message);
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
