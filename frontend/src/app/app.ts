import { Component, computed, ElementRef, signal, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage, ChatService, Gender, OnlineUser } from './chat.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {

  @ViewChild('chatBox') private chatBox?: ElementRef<HTMLDivElement>;

  username = '';
  age: number | null = null;
  gender: Gender | '' = '';
  isHuman = false;
  chatStarted = false;
  message = '';
  onlineSearch = '';
  private readonly desktopMedia = window.matchMedia('(min-width: 761px)');
  showOnlinePanel = this.desktopMedia.matches;

  messages = signal<ChatMessage[]>([]);
  onlineUsers = signal<OnlineUser[]>([]);
  typingUsers = signal<OnlineUser[]>([]);
  readonly filteredOnlineUsers = computed(() => {
    const search = this.onlineSearchSignal().trim().toLowerCase();
    return this.onlineUsers()
      .filter(user => !search || user.username.toLowerCase().includes(search))
      .sort((left, right) => left.username.localeCompare(right.username));
  });
  readonly visibleOnlineUsers = computed(() => this.filteredOnlineUsers().slice(0, 50));
  readonly onlineUserIds = computed(() => new Set(this.onlineUsers().map(user => user.userId)));
  readonly currentUserId: string;
  private readonly onlineSearchSignal = signal('');
  private typingTimer?: ReturnType<typeof setTimeout>;

  constructor(private chatService: ChatService) {
    this.currentUserId = this.chatService.getCurrentUserId();
  }

  ngOnInit() {
    this.desktopMedia.addEventListener('change', this.handleViewportChange);

    this.chatService.receiveChatHistory((messages) => {
      this.messages.set(messages.slice(-500));
      this.scrollToLatest();
    });

    this.chatService.receiveMessage((message) => {
      const shouldScroll = this.isNearLatestMessage();
      this.messages.update(messages => [...messages, message].slice(-500));
      if (shouldScroll || message.userId === this.currentUserId) {
        this.scrollToLatest();
      }
      if (message.userId !== this.currentUserId) {
        this.chatService.markAsRead(message.id);
      }
    });

    this.chatService.receivePresenceSnapshot((users) => this.onlineUsers.set(users));

    this.chatService.receivePresenceChange(({ online, user }) => {
      this.onlineUsers.update(users => {
        const remainingUsers = users.filter(currentUser => currentUser.userId !== user.userId);
        return online ? [...remainingUsers, user] : remainingUsers;
      });
    });

    this.chatService.receiveTyping(({ userId, username, gender, age, isTyping }) => {
      this.typingUsers.update(users => isTyping
        ? [...users.filter(user => user.userId !== userId), { userId, username, gender, age }]
        : users.filter(user => user.userId !== userId));
    });

    this.chatService.receiveReadReceipt(({ messageId, readBy }) => {
      this.messages.update(messages => messages.map(message =>
        message.id === messageId ? { ...message, readBy } : message));
    });
  }

  ngOnDestroy() {
    this.desktopMedia.removeEventListener('change', this.handleViewportChange);
  }

  private readonly handleViewportChange = (event: MediaQueryListEvent) => {
    this.showOnlinePanel = event.matches;
  };

  startChat() {
    const username = this.username.trim();
    const gender = this.gender;
    if (username.length < 3 || username.length > 20 ||
      this.age === null || this.age < 18 || this.age > 99 ||
        (gender !== 'Male' && gender !== 'Female') || !this.isHuman) {
      return;
    }

    this.username = username;
    this.chatService.registerUser(username, gender, this.age);
    this.chatStarted = true;
  }

  limitUsername(username: string) {
    this.username = username.slice(0, 20);
  }

  limitAge(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 2);
    this.age = input.value ? Number(input.value) : null;
  }

  onMessageInput() {
    this.chatService.setTyping(Boolean(this.message.trim()));
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.chatService.setTyping(false), 1500);
  }

  isOnline(userId: string) {
    return this.onlineUserIds().has(userId);
  }

  updateOnlineSearch(search: string) {
    this.onlineSearch = search;
    this.onlineSearchSignal.set(search);
  }

  private isNearLatestMessage() {
    const chatBox = this.chatBox?.nativeElement;
    if (!chatBox) {
      return true;
    }

    return chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 80;
  }

  private scrollToLatest() {
    requestAnimationFrame(() => {
      const chatBox = this.chatBox?.nativeElement;
      if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    });
  }

  sendMessage() {
    if (!this.message.trim()) {
      return;
    }

    this.chatService.sendMessage({
      text: this.message
    });

    this.message = '';
    clearTimeout(this.typingTimer);
    this.chatService.setTyping(false);
  }
}