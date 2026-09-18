import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/environment';

export type Gender = 'Male' | 'Female';

export interface ChatMessage {
  id: string;
  userId: string;
  user: string;
  gender: Gender;
  age: number;
  text: string;
  time: Date;
  readBy: number;
}

export interface OnlineUser {
  userId: string;
  username: string;
  gender: Gender;
  age: number;
}

export interface TypingUpdate extends OnlineUser {
  isTyping: boolean;
}

export interface PresenceChange {
  online: boolean;
  user: OnlineUser;
}

export interface ReadReceipt {
  messageId: string;
  readBy: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private socket: Socket;
  private readonly userId = this.getUserId();

  constructor() {
    this.socket = io(environment.apiUrl);
  }

  registerUser(username: string, gender: Gender, age: number) {
    const register = () => this.socket.emit('register-user', {
      userId: this.userId,
      username,
      gender,
      age
    });

    this.socket.on('connect', register);
    if (this.socket.connected) {
      register();
    }
  }

  sendMessage(message: { text: string }) {
    this.socket.emit('chat-message', message);
  }

  receiveMessage(callback: (data: ChatMessage) => void) {
    this.socket.on('chat-message', callback);
  }

  receiveChatHistory(callback: (messages: ChatMessage[]) => void) {
    this.socket.on('chat-history', callback);
  }

  setTyping(isTyping: boolean) {
    this.socket.emit('typing', isTyping);
  }

  receiveTyping(callback: (data: TypingUpdate) => void) {
    this.socket.on('typing-update', callback);
  }

  receivePresenceSnapshot(callback: (users: OnlineUser[]) => void) {
    this.socket.on('presence-snapshot', callback);
  }

  receivePresenceChange(callback: (change: PresenceChange) => void) {
    this.socket.on('presence-change', callback);
  }

  markAsRead(messageId: string) {
    this.socket.emit('message-read', messageId);
  }

  receiveReadReceipt(callback: (receipt: ReadReceipt) => void) {
    this.socket.on('read-receipt', callback);
  }

  getCurrentUserId() {
    return this.userId;
  }

  private getUserId() {
    const storageKey = 'chat-user-id';
    const existingId = localStorage.getItem(storageKey);
    if (existingId) {
      return existingId;
    }

    const userId = crypto.randomUUID();
    localStorage.setItem(storageKey, userId);
    return userId;
  }
}