import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  private readonly url = 'http://localhost:3000'; // Make sure this matches backend URL or Nginx proxy

  constructor(private authService: AuthService) {
    this.connect();
    
    // Automatically join room when authenticated
    this.authService.isAuthenticated$.subscribe(isAuthenticated => {
        if (isAuthenticated) {
            const user = JSON.parse(localStorage.getItem('current_user') || '{}');
            if (user && user.id) {
                this.socket.emit('join_user_room', user.id);
            }
        }
    });
  }

  private connect() {
    this.socket = io(this.url, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      
      const userStr = localStorage.getItem('current_user');
      if (userStr) {
          const user = JSON.parse(userStr);
          if (user && user.id) {
              this.socket.emit('join_user_room', user.id);
          }
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  // Generic method to listen to events
  listen<T>(eventName: string): Observable<T> {
    return new Observable((subscriber) => {
      this.socket.on(eventName, (data: T) => {
        subscriber.next(data);
      });
    });
  }

  // Method to emit events
  emit(eventName: string, data: any) {
    this.socket.emit(eventName, data);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
