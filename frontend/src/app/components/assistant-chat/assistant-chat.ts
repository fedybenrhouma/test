import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-assistant-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assistant-chat.html',
  styleUrls: ['./assistant-chat.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AssistantChatComponent implements OnInit, AfterViewChecked, OnDestroy {
  isOpen = false;
  messages: Message[] = [
    { role: 'assistant', content: 'Greeting, human. I am the Hive-Mind Assistant. I can help you interpret market analyses or manage your portfolio. How can I assist you?' }
  ];
  userInput = '';
  isTyping = false;
  private abortController: AbortController | null = null;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  constructor(private authService: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {}

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.stopStreaming();
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    this.cdr.markForCheck();
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  sendMessage() {
    if (!this.userInput.trim() || this.isTyping) return;

    const question = this.userInput.trim();
    this.messages.push({ role: 'user', content: question });
    this.userInput = '';
    this.startStreaming(question);
  }

  async startStreaming(question: string) {
    this.isTyping = true;
    this.abortController = new AbortController();
    
    const assistantMessage: Message = { role: 'assistant', content: '' };
    this.messages.push(assistantMessage);

    try {
      const token = this.authService.getToken();
      const response = await fetch(`http://localhost:3000/api/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question }),
        signal: this.abortController.signal
      });

      if (!response.ok) throw new Error('Assistant offline');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No connection');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                assistantMessage.content += data.content;
                this.cdr.markForCheck();
              }
            } catch (e) {}
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        assistantMessage.content = 'System error. Please reconnect.';
      }
    } finally {
      this.isTyping = false;
      this.abortController = null;
      this.cdr.markForCheck();
    }
  }

  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isTyping = false;
  }
}
