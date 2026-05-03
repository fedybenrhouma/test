import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

interface Message {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-trade-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trade-chat.component.html',
  styleUrls: ['./trade-chat.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class TradeChatComponent implements AfterViewChecked, OnDestroy, OnChanges {
  @Input() trade: any;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  messages: Message[] = [
    {
      role: 'agent',
      content: 'Hello! I am your AI Trading Analyst. I have access to this trade\'s execution details, the market context before entry, and the agent debate log. How can I help you analyze this trade today?',
      timestamp: new Date()
    }
  ];
  
  userInput = '';
  isTyping = false;
  private abortController: AbortController | null = null;

  constructor(private authService: AuthService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['trade'] && changes['trade'].currentValue) {
      const currentId = changes['trade'].currentValue.id;
      const previousId = changes['trade'].previousValue?.id;
      
      if (currentId !== previousId) {
        this.resetChat();
      }
    }
  }

  resetChat() {
    this.stopStreaming();
    this.userInput = '';
    this.messages = [
      {
        role: 'agent',
        content: 'Hello! I am your AI Trading Analyst. I have access to this trade\'s execution details, the market context before entry, and the agent debate log. How can I help you analyze this trade today?',
        timestamp: new Date()
      }
    ];
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.stopStreaming();
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  sendMessage() {
    if (!this.userInput.trim() || this.isTyping) return;

    const userQuestion = this.userInput.trim();
    this.messages.push({
      role: 'user',
      content: userQuestion,
      timestamp: new Date()
    });
    
    this.userInput = '';
    this.startStreaming(userQuestion);
  }

  async startStreaming(question: string) {
    this.isTyping = true;
    this.abortController = new AbortController();
    
    const agentMessage: Message = {
      role: 'agent',
      content: '',
      timestamp: new Date()
    };
    this.messages.push(agentMessage);

    try {
      const token = this.authService.getToken();
      const response = await fetch(`http://localhost:3000/api/trades/${this.trade.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question }),
        signal: this.abortController.signal
      });

      if (!response.ok) throw new Error('Failed to connect to chat');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

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
                agentMessage.content += data.content;
              } else if (data.error) {
                agentMessage.content = `Error: ${data.error}`;
              }
            } catch (e) {
              // Ignore partial JSON or invalid lines
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Streaming error:', error);
        agentMessage.content = 'Sorry, I encountered an error while trying to respond. Please try again.';
      }
    } finally {
      this.isTyping = false;
      this.abortController = null;
    }
  }

  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isTyping = false;
  }

  onClose() {
    this.stopStreaming();
    this.close.emit();
  }
}
