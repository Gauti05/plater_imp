import { Component, computed, signal, ViewEncapsulation, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import emailjs from '@emailjs/browser';

interface EmailLog {
  email: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp?: Date;
  error?: string;
}

@Component({
  selector: 'app-mailer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mailer.component.html',
  styleUrls: ['./mailer.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class MailerComponent implements AfterViewChecked {
  
  // --- CONFIGURATION ---
  // 1. Set to true to send REAL emails.
  // 2. Set to false to SIMULATE (safe for testing UI).
  readonly USE_REAL_EMAIL = false;

  // --- EMAILJS CREDENTIALS ---
  // Get these from https://www.emailjs.com/
  private readonly SERVICE_ID = 'YOUR_SERVICE_ID';
  private readonly TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
  private readonly PUBLIC_KEY = 'YOUR_PUBLIC_KEY';

  // --- DOM REFERENCES ---
  @ViewChild('logContainer') private logContainer!: ElementRef;

  // --- STATE SIGNALS ---
  isSending = signal(false);
  shouldStop = signal(false);
  
  // --- MODELS ---
  rawRecipients = '';
  subject = '';
  body = '';
  
  parsedRecipients: string[] = [];
  logs: EmailLog[] = []; 
  
  // --- COMPUTED METRICS ---
  validRecipientsCount = computed(() => this.parsedRecipients.length);
  totalToSend = signal(0);
  sentCount = signal(0);
  failedCount = signal(0);
  
  progressPercentage = computed(() => {
    if (this.totalToSend() === 0) return 0;
    return Math.round(((this.sentCount() + this.failedCount()) / this.totalToSend()) * 100);
  });

  // --- LIFECYCLE ---
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  // --- ACTIONS ---

  parseRecipients() {
    if (!this.rawRecipients) {
      this.parsedRecipients = [];
      return;
    }

    // Split by newline, comma, semicolon, or pipe
    const rawList = this.rawRecipients.split(/[\n,;|]+/);
    
    // Strict Email Regex
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

    this.parsedRecipients = rawList
      .map(email => email.trim())
      .filter(email => email.length > 0 && emailRegex.test(email));
      
    // Remove duplicates
    this.parsedRecipients = [...new Set(this.parsedRecipients)];
  }

  clearRecipients() {
    this.rawRecipients = '';
    this.parseRecipients();
  }

  clearLogs() {
    this.logs = [];
    this.sentCount.set(0);
    this.failedCount.set(0);
    this.totalToSend.set(0);
  }

  stopCampaign() {
    this.shouldStop.set(true);
  }

  async startCampaign() {
    if (this.parsedRecipients.length === 0 || !this.subject) return;

    this.isSending.set(true);
    this.shouldStop.set(false);
    this.clearLogs();
    
    this.totalToSend.set(this.parsedRecipients.length);

    // 1. Initialize logs as pending
    this.logs = this.parsedRecipients.map(email => ({
      email,
      status: 'pending'
    }));

    // 2. Process Queue
    for (let i = 0; i < this.parsedRecipients.length; i++) {
      if (this.shouldStop()) break;

      const email = this.parsedRecipients[i];
      
      try {
        if (this.USE_REAL_EMAIL) {
          await this.sendRealEmail(email, this.subject, this.body);
        } else {
          await this.simulateEmailSend(email, this.subject, this.body);
        }
        
        this.updateLogStatus(email, 'sent');
        this.sentCount.update(c => c + 1);
        
      } catch (error) {
        console.error(`Failed to send to ${email}`, error);
        this.updateLogStatus(email, 'failed');
        this.failedCount.update(c => c + 1);
      }

      // Small delay to prevent API rate limiting (even in real mode)
      await this.delay(this.USE_REAL_EMAIL ? 1000 : 500); 
    }

    this.isSending.set(false);
  }

  // --- HELPERS ---

  private updateLogStatus(email: string, status: 'sent' | 'failed') {
    const logIndex = this.logs.findIndex(l => l.email === email);
    if (logIndex !== -1) {
      // Create new object to trigger change detection
      this.logs[logIndex] = {
        ...this.logs[logIndex],
        status,
        timestamp: new Date()
      };
      // Create new array reference
      this.logs = [...this.logs]; 
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.logContainer) {
        this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- SENDING LOGIC ---

  /**
   * ACTUAL EMAIL SENDING (via EmailJS)
   */
  private async sendRealEmail(to: string, subject: string, body: string): Promise<void> {
    const templateParams = {
      to_email: to,
      subject: subject,
      message: body, 
      // NOTE: In your EmailJS template, use {{message}} for the body
    };

    await emailjs.send(
      this.SERVICE_ID, 
      this.TEMPLATE_ID, 
      templateParams, 
      this.PUBLIC_KEY
    );
  }

  /**
   * SIMULATION MODE
   */
  private async simulateEmailSend(to: string, subject: string, body: string): Promise<boolean> {
    const randomDelay = Math.floor(Math.random() * 800) + 200;
    
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 10% failure rate
        if (Math.random() > 0.9) {
          reject('Network Error');
        } else {
          console.log(`[SIMULATION] Sent to: ${to}`);
          resolve(true);
        }
      }, randomDelay);
    });
  }
}