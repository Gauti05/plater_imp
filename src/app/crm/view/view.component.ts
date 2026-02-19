import {
  Component,
  OnInit,
  ViewEncapsulation,
  AfterViewInit,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  Timestamp,
  getDocs,
  updateDoc,
  deleteDoc,
  orderBy
} from '@angular/fire/firestore';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ViewComponent implements OnInit, AfterViewInit, OnDestroy {
  storeId = '';
  customerId = '';
  loading = true;

  customer: any = null;
  notes: any[] = [];
  reminders: any[] = [];
  emailLogs: any[] = [];
  orders: any[] = [];
  walletTransactions: any[] = []; // ⭐ Added for Wallet Ledger

  // Lead owner (assignee) — LEAD-LEVEL ONLY
  teamUsers: Array<{id:string; name:string; email?:string; role?:string; active?:boolean}> = [];
  assignedToUserId: string = '';
  assignedToName: string = '';
  assignedAt: Date | null = null;
  selectedAssigneeId: string = '';

  clv = 0;
  aov = 0;
  lastPurchaseDate = '';
  repeatIntervalDays = 0;
  mostPurchasedProduct = '';
  paymentReceived = 0;
  paymentPending = 0;

  // This property holds the final, MERGED list of tags for display.
  autoTags: string[] = [];
  topProducts: { [key: string]: { count: number; value: number } } = {};
  
  // 🔑 MANUAL TAGGING STATE (Saved/loaded from customer document)
  manualTags: string[] = [];
  manualTagInput: string = '';
  
  newNote = '';
  newReminder = '';
  reminderDate = '';
  selectedReminderDate: string = '';
  newReminderType: string = 'general';

  chartType: 'line' | 'bar' = 'line';
  chartLoading = true;
  private calendarInstance: Calendar | null = null;
  private ro?: ResizeObserver;

  selectedReminder: any = {
    id: '',
    text: '',
    dueDate: new Date(),
    type: 'general'
  };

  // ===== Pipeline / header chips =====
  pipelineStage: 'new'|'contacted'|'qualified'|'won'|'lost' = 'new';

  // ===== Lead Score & New Charts =====
  leadScore = 0;
  estCloseDays = 30;             
  estCloseText = 'medium confidence';

  leadGaugeData: ChartData<'doughnut'> = {
    labels: ['Score', 'Remain'],
    datasets: [{ data: [0, 100], borderWidth: 0 }]
  };
  leadGaugeOptions: ChartOptions<'doughnut'> = {
    cutout: '70%',
    rotation: -90,
    circumference: 180,
    plugins: { legend: { display: false } }
  };

  forecastBarData: ChartData<'bar'> = {
    labels: ['New', 'Contacted', 'Qualified', 'Won', 'Lost'],
    datasets: [{ label: 'Win %', data: [10, 30, 60, 95, 5] }]
  };
  forecastBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.parsed.y}%` } } },
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => `${v}%` } } }
  };

  funnelBarData: ChartData<'bar'> = {
    labels: ['Touchpoints', 'Qualified', 'Proposals', 'Won'],
    datasets: [{ label: 'Count', data: [0,0,0,0] }]
  };
  funnelBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true, suggestedMax: 5 } }
  };

  productBarData: ChartData<'bar'> = { labels: [], datasets: [{ label: 'Win Likelihood %', data: [] }] };
  productBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } } }
  };

  paymentDoughnutData: ChartData<'doughnut'> = {
    labels: ['Received', 'Pending'],
    datasets: [{ data: [0, 0] }]
  };
  doughnutOptions: ChartOptions<'doughnut'> = { plugins: { legend: { position: 'bottom' } } };

  revenueChartData: ChartConfiguration<'line'|'bar'>['data'] = { labels: [], datasets: [] };
  revenueChartOptions: ChartOptions<'line'|'bar'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { title: { display: true, text: 'Date' }, ticks: { color: '#6b7280' } },
      y: { title: { display: true, text: 'Value (₹)' }, ticks: { color: '#6b7280' }, beginAtZero: true }
    }
  };

  private _showCalendarView: boolean = true;
  get showCalendarView(): boolean { return this._showCalendarView; }
  set showCalendarView(value: boolean) {
    this._showCalendarView = value;
    if (value) setTimeout(() => this.renderCalendar(), 100);
  }

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
      this.storeId = this.route.parent?.snapshot.paramMap.get('storeSlug') ?? '';
      const customerId = this.route.snapshot.paramMap.get('id') ?? '';

    this.customerId = customerId;
    this.loadTeam(); 
    this.loadCustomerData();
  }

  ngAfterViewInit(): void {
    setTimeout(() => { if (this.showCalendarView) this.renderCalendar(); }, 300);

    this.zone.runOutsideAngular(() => {
      const root = document.querySelector('.container');
      if (!root || (window as any).ResizeObserver === undefined) return;
      this.ro = new ResizeObserver(() => {
        window.dispatchEvent(new Event('resize'));
        if (this.calendarInstance) this.calendarInstance.updateSize();
      });
      this.ro.observe(root);
    });
  }

  ngOnDestroy(): void {
    if (this.calendarInstance) this.calendarInstance.destroy();
    if (this.ro) this.ro.disconnect();
  }

  // ⭐ NEW: Fetch Points Transaction History
  async loadWalletTransactions() {
    try {
      const walletRef = collection(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/pointsTransactions`);
      const q = query(walletRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      this.walletTransactions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      console.error("Error loading wallet transactions", e);
    }
  }
  
  // ===== Assign / Team (Lead-level only) =====
  async loadTeam() {
    try {
      const ref = collection(this.firestore, `Stores/${this.storeId}/customers`);
      const snap = await getDocs(ref);
      this.teamUsers = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(u => u.active !== false)
        .map(u => ({ id: u.id, name: u.name || u.fullName || u.email || 'User', email: u.email, role: u.role || 'User', active: u.active !== false }));
    } catch (e) {
      console.warn('Failed to load team users', e);
      this.teamUsers = [];
    }
  }

  openAssignModal() {
    this.selectedAssigneeId = this.assignedToUserId || '';
    const el = document.getElementById('assignOwnerModal');
    (window as any).bootstrap?.Modal.getOrCreateInstance(el)?.show();
  }

  async assignLead() {
    if (!this.selectedAssigneeId) return;
    const found = this.teamUsers.find(u => u.id === this.selectedAssigneeId);
    const name = found?.name || 'User';
    const payload: any = {
      assignedToUserId: this.selectedAssigneeId,
      assignedToName: name,
      assignedAt: new Date()
    };
    const ref = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}`);
    await updateDoc(ref, payload);
    this.assignedToUserId = payload.assignedToUserId;
    this.assignedToName = payload.assignedToName;
    this.assignedAt = payload.assignedAt;

    try {
      const notesRef = collection(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/notes`);
      await addDoc(notesRef, { text: `Lead assigned to ${name}`, createdAt: new Date(), type: 'System' });
    } catch {}
  }

  async unassignLead() {
    const ref = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}`);
    await updateDoc(ref, { assignedToUserId: '', assignedToName: '', assignedAt: null });
    this.assignedToUserId = '';
    this.assignedToName = '';
    this.assignedAt = null;
  }

  // ===== Data load =====
  async loadCustomerData() {
    this.loading = true;

    try {
      const customerRef = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}`);
      const snap = await getDoc(customerRef);
      this.customer = snap.exists() ? snap.data() : null;

      this.assignedToUserId = this.customer?.['assignedToUserId'] || '';
      this.assignedToName = this.customer?.['assignedToName'] || '';
      const _assignedAt = this.customer?.['assignedAt'];
      this.assignedAt = _assignedAt?.toDate?.() || (_assignedAt ? new Date(_assignedAt) : null);

      this.pipelineStage = (this.customer?.pipelineStage as any) || this.pipelineStage;

      const orderRef = collection(this.firestore, `Stores/${this.storeId}/orders`);
      const qy = query(orderRef, where('customerMobile', '==', this.customerId)); // Fixed: using customerMobile to link orders
      const orderSnap = await getDocs(qy);
      this.orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const notesRef = collection(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/notes`);
      const notesSnap = await getDocs(notesRef);
      this.notes = notesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const remindersRef = collection(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/reminders`);
      const remindersSnap = await getDocs(remindersRef);
      this.reminders = remindersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const emailsRef = collection(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/emails`);
      const emailSnap = await getDocs(emailsRef);
      this.emailLogs = emailSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      await this.loadWalletTransactions(); // ⭐ Load Ledger
      
      this.manualTags = Array.isArray(this.customer?.manualTags) 
                        ? this.customer.manualTags.filter((t: string) => t && typeof t === 'string') 
                        : [];
      
      this.calculateOrderStats();
      this.autoTags = this.calculateAndMergeTags();
      this.updateCustomerContactedDate();

      this.leadScore = this.computeLeadScore();
      this.updateLeadGauge();
      this.updateForecastBar();
      this.updateFunnel();
      this.updatePaymentDoughnut();
      this.updateProductWinLikelihood();
      this.updateEstClose();

      if (this.showCalendarView) this.renderCalendar();
    } catch (error) {
      console.error('Error loading customer details:', error);
    }

    this.loading = false;
  }

  calculateOrderStats() {
    this.chartLoading = true;

    if (!this.orders?.length) {
      this.revenueChartData = { labels: [], datasets: [{ data: [], label: 'Order Value' }] };
      this.paymentReceived = 0;
      this.paymentPending = 0;
      this.chartLoading = false;
      return;
    }

    this.clv = 0;
    this.paymentReceived = 0;
    this.paymentPending = 0;
    this.topProducts = {};
    this.lastPurchaseDate = '';
    this.repeatIntervalDays = 0;

    const orderDates: Date[] = [];
    const labels: string[] = [];
    const series: number[] = [];

    for (const order of this.orders) {
      const total = order.total || 0;
      const paid = (order.payments || []).reduce((sum: any, p: { amount: any; }) => sum + (Number(p.amount) || 0), 0);
      this.paymentReceived += paid;
      this.paymentPending += Math.max(0, total - paid);

      const createdAt = order.createdAt?.toDate?.() || new Date();
      this.clv += total;
      orderDates.push(createdAt);
      labels.push(formatDate(createdAt, 'dd MMM', 'en-IN'));
      series.push(total);

      for (const item of order.items || []) {
        const name = item.name || item.productName || 'Unknown';
        const qty = item.quantity || 1;
        const value = item.total || (item.unitPrice || item.price || 0) * qty;

        if (!this.topProducts[name]) this.topProducts[name] = { count: 0, value: 0 };
        this.topProducts[name].count += qty;
        this.topProducts[name].value += value;
      }
    }

    this.aov = Math.round(this.clv / this.orders.length);

    if (orderDates.length > 1) {
      orderDates.sort((a, b) => a.getTime() - b.getTime());
      const totalGap = (orderDates[orderDates.length - 1].getTime() - orderDates[0].getTime()) / 86400000;
      this.repeatIntervalDays = Math.round(totalGap / (orderDates.length - 1));
    }

    const lastOrderDate = orderDates[orderDates.length - 1];
    if (lastOrderDate) this.lastPurchaseDate = formatDate(lastOrderDate, 'dd MMM yyyy', 'en-IN');

    this.revenueChartData = {
      labels,
      datasets: [{
        data: series,
        label: 'Order Value',
        tension: 0.4,
        borderColor: '#0c66ee',
        backgroundColor: this.chartType === 'line' ? 'rgba(12,102,238,0.1)' : '#0c66ee',
        fill: this.chartType === 'line',
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    };

    this.chartLoading = false;

    this.mostPurchasedProduct = this.getTopProductKeys().reduce((top, key) =>
      this.topProducts[key].count > (this.topProducts[top]?.count || 0) ? key : top,
      ''
    );
  }

  updatePaymentDoughnut() {
    this.paymentDoughnutData = {
      labels: ['Received', 'Pending'],
      datasets: [{ data: [this.paymentReceived, this.paymentPending] }]
    };
  }
  
  renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    if (this.calendarInstance) this.calendarInstance.destroy();

    this.calendarInstance = new Calendar(calendarEl, {
      plugins: [dayGridPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      height: 'auto',
      contentHeight: 320,
      aspectRatio: 1.6,
      events: this.reminders.map(r => ({
        title: r.text,
        date: r.dueDate?.toDate?.() || r.dueDate,
        extendedProps: { type: r.type || 'general', id: r.id, text: r.text },
        backgroundColor: '#10b981',
        textColor: '#ffffff',
        borderColor: 'transparent'
      })),
      eventDidMount(info) {
        info.el.setAttribute('title', `${info.event.title} (${info.event.extendedProps['type']})`);
      },
      eventClick: (info) => {
        this.selectedReminder = {
          ...info.event.extendedProps,
          id: info.event.extendedProps['id'],
          text: info.event.extendedProps['text'],
          dueDate: info.event.start
        };
        this.selectedReminderDate = this.formatForInput(this.selectedReminder.dueDate);
        const modalEl = document.getElementById('viewReminderModal');
        (window as any).bootstrap.Modal.getOrCreateInstance(modalEl)?.show();
      }
    });

    this.calendarInstance.render();
  }
  
  private stageWeight(stage: string): number {
    const map: Record<string, number> = { new: 20, contacted: 35, qualified: 65, won: 95, lost: 5 };
    return map[stage] ?? 20;
  }

  private recencyBoost(): number {
    let latest = 0;
    const lastOrder = this.orders?.[this.orders.length - 1]?.createdAt;
    if (lastOrder?.toDate) latest = Math.max(latest, lastOrder.toDate().getTime());
    else if (lastOrder) latest = Math.max(latest, new Date(lastOrder).getTime());
    for (const n of this.notes) {
      const d = n.createdAt?.toDate?.() || n.createdAt;
      if (d) latest = Math.max(latest, new Date(d).getTime());
    }
    for (const r of this.reminders) {
      const d = r.dueDate?.toDate?.() || r.dueDate;
      if (d) latest = Math.max(latest, new Date(d).getTime());
    }
    if (!latest) return 0;
    const days = (Date.now() - latest) / 86400000;
    if (days <= 7) return 15;
    if (days <= 30) return 8;
    if (days <= 90) return 3;
    return 0;
  }

  private engagementBoost(): number {
    const touches = (this.notes?.length || 0) + (this.reminders?.length || 0);
    if (touches >= 6) return 12;
    if (touches >= 3) return 8;
    if (touches >= 1) return 4;
    return 0;
  }

  private valueBoost(): number {
    const v = this.clv;
    if (v > 100000) return 18;
    if (v > 50000)  return 12;
    if (v > 20000)  return 8;
    if (v >  5000)  return 4;
    return 0;
  }

  private computeLeadScore(): number {
    const base = this.stageWeight(this.pipelineStage);
    const score = Math.min(100, Math.round(base + this.recencyBoost() + this.engagementBoost() + this.valueBoost()));
    return score;
  }
  
  private updateLeadGauge() {
    this.leadGaugeData = {
      labels: ['Score', 'Remain'],
      datasets: [{
        data: [this.leadScore, Math.max(0, 100 - this.leadScore)],
        backgroundColor: ['#10b981', 'rgba(16,185,129,0.15)'],
        borderWidth: 0
      }]
    };
  }

  private updateForecastBar() {
    const probs = { new: 10, contacted: 30, qualified: 60, won: 95, lost: 5 };
    const labels = ['New', 'Contacted', 'Qualified', 'Won', 'Lost'];
    const values = [probs.new, probs.contacted, probs.qualified, probs.won, probs.lost];
    const idx = ['new','contacted','qualified','won','lost'].indexOf(this.pipelineStage);

    this.forecastBarData = {
      labels,
      datasets: [{
        label: 'Win %',
        data: values,
        backgroundColor: labels.map((_, i) => i === idx ? '#0ea5e9' : 'rgba(14,165,233,0.25)'),
        borderWidth: 0
      }]
    };
  }

  private updateFunnel() {
    const touchpoints = (this.notes?.length || 0) + (this.reminders?.length || 0);
    const qualified   = this.pipelineStage === 'qualified' || this.pipelineStage === 'won' ? 1 : 0;
    const proposals   = (this.reminders?.some(r => r.type === 'meeting' || r.type === 'payment') ? 1 : 0) || (this.orders?.length ? 1 : 0);
    const won         = this.pipelineStage === 'won' || (this.orders?.length > 0 ? 1 : 0);

    const t = Math.max(1, Math.min(8, touchpoints));
    const q = qualified ? Math.min(t, 3) : 0;
    const p = proposals ? Math.min(t, 2) : 0;
    const w = won ? 1 : 0;

    this.funnelBarData = {
      labels: ['Touchpoints', 'Qualified', 'Proposals', 'Won'],
      datasets: [{ label: 'Count', data: [t, q, p, w], backgroundColor: ['#e5f6ff','#cdeafe','#bfe0fd','#93c5fd'], borderWidth: 0 }]
    };

    this.funnelBarOptions = { ...this.funnelBarOptions, scales: { x: { beginAtZero: true, suggestedMax: Math.max(4, t) } } };
  }

  private updateProductWinLikelihood() {
    const keys = this.getTopProductKeys();
    if (keys.length === 0) {
      this.productBarData = { labels: [], datasets: [{ label: 'Win Likelihood %', data: [] }] };
      return;
    }

    const maxCount = Math.max(...keys.map(k => this.topProducts[k].count || 0), 1);
    const recentBoost = Math.min(15, this.recencyBoost()); 
    const leadBoost = Math.round(this.leadScore / 10); 

    const data = keys.map(k => {
      const base = Math.round((this.topProducts[k].count / maxCount) * 70); 
      return Math.min(100, base + recentBoost + leadBoost);
    });

    this.productBarData = {
      labels: keys,
      datasets: [{ label: 'Win Likelihood %', data, backgroundColor: 'rgba(16,185,129,0.35)', borderWidth: 0 }]
    };
  }

  private updateEstClose() {
    const baseDays = { new: 45, contacted: 30, qualified: 14, won: 1, lost: 90 }[this.pipelineStage] ?? 30;
    const recency = this.recencyBoost();   
    const engage  = this.engagementBoost(); 
    const scoreAdj = Math.floor((this.leadScore - 50) / 10); 

    const estimate = Math.max(1, Math.round(baseDays - recency/2 - engage/2 - scoreAdj));
    this.estCloseDays = estimate;

    if (this.leadScore >= 80) this.estCloseText = 'high confidence';
    else if (this.leadScore >= 55) this.estCloseText = 'medium confidence';
    else this.estCloseText = 'low confidence';
  }

  // ===== UI helpers =====
  leadChipClass(score: number) {
    if (score >= 80) return 'chip-high';
    if (score >= 55) return 'chip-med';
    return 'chip-low';
  }

  savePipelineStage() {
    if (!this.customerId) return;
    const ref = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}`);
    updateDoc(ref, { pipelineStage: this.pipelineStage }).catch(() => {});
    this.leadScore = this.computeLeadScore();
    this.updateLeadGauge();
    this.updateForecastBar();
    this.updateFunnel();
    this.updateProductWinLikelihood();
    this.updateEstClose();
  }

  addNoteFromQuick() {
    this.newNote = '';
    const modalEl = document.getElementById('noteModal');
    (window as any).bootstrap.Modal.getOrCreateInstance(modalEl)?.show();
  }

  openReminder(reminder: any) {
    this.selectedReminder = { 
      ...reminder, 
      dueDate: reminder.dueDate?.toDate?.() || reminder.dueDate
    };
    this.selectedReminderDate = this.formatForInput(this.selectedReminder.dueDate);
    const modalEl = document.getElementById('viewReminderModal');
    (window as any).bootstrap.Modal.getOrCreateInstance(modalEl)?.show();
  }

  formatForInput(date: Date): string { return new Date(date).toISOString().slice(0, 16); }

  updateCustomerContactedDate() {
    if (this.notes.length > 0) {
      const latestNote = this.notes.reduce((a: any, b: any) =>
        new Date(a.createdAt?.toDate?.() || a.createdAt) > new Date(b.createdAt?.toDate?.() || b.createdAt) ? a : b
      );
      this.customer.lastContactedOn = formatDate(latestNote.createdAt?.toDate?.() || latestNote.createdAt, 'dd MMM yyyy', 'en-IN');
    }
  }

  getTopProductKeys(): string[] { return Object.keys(this.topProducts || {}); }

  formatDate(ts: any) { return formatDate(ts?.toDate?.() || ts, 'dd MMM yyyy', 'en-IN'); }

  calculateAndMergeTags(): string[] {
    const calculatedAutoTags: string[] = [];
    if (this.clv > 20000) calculatedAutoTags.push('💰 High-Spender');
    if (this.orders.length > 3) calculatedAutoTags.push('🔁 Repeat Buyer');
    if (this.orders.length === 0) calculatedAutoTags.push('✨ New Prospect');
    const lastOrder = this.orders?.[this.orders.length - 1]?.createdAt?.toDate?.();
    if (lastOrder) {
      const daysSince = (Date.now() - new Date(lastOrder).getTime()) / 86400000;
      if (daysSince > 60) calculatedAutoTags.push('🚫 Churn Risk');
    }
    if (this.reminders.length > 0) calculatedAutoTags.push('📅 Engaged');
    
    return Array.from(new Set([...calculatedAutoTags, ...(this.manualTags || [])]));
  }
  
  toggleChartType() {
    this.chartType = this.chartType === 'line' ? 'bar' : 'line';
    const ds = this.revenueChartData.datasets?.[0] as any;
    if (ds) {
      ds.backgroundColor = this.chartType === 'line' ? 'rgba(12,102,238,0.1)' : '#0c66ee';
      ds.fill = this.chartType === 'line';
    }
  }

  // ===== Notes =====
  async addNote() {
    if (!this.newNote.trim()) return;
    const payload: any = { 
      text: this.newNote.trim(), 
      createdAt: new Date(), 
      pinned: false, 
      type: 'General'
    };
    const notesRef = collection(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/notes`);
    await addDoc(notesRef, payload);
    this.newNote = '';
    this.loadCustomerData();
  }

  // ===== Reminders =====
  async addReminder() {
    if (!this.newReminder.trim() || !this.reminderDate) return;
    const payload: any = { 
      text: this.newReminder.trim(), 
      dueDate: Timestamp.fromDate(new Date(this.reminderDate)), 
      createdAt: new Date(), 
      type: this.newReminderType
    };
    const remindersRef = collection(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/reminders`);
    await addDoc(remindersRef, payload);
    this.newReminder = '';
    this.reminderDate = '';
    this.newReminderType = 'general';
    this.loadCustomerData();
  }

  async updateReminder() {
    if (!this.selectedReminder?.id) return;
    const ref = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/reminders/${this.selectedReminder.id}`);
    await updateDoc(ref, { 
      text: this.selectedReminder.text, 
      type: this.selectedReminder.type || 'general', 
      dueDate: Timestamp.fromDate(new Date(this.selectedReminderDate))
    });
    this.loadCustomerData();
  }

  async deleteReminder() {
    if (!this.selectedReminder?.id) return;
    const ref = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/reminders/${this.selectedReminder.id}`);
    await deleteDoc(ref);
    this.loadCustomerData();
  }

  async snoozeReminder(reminderId: string, days: number) {
    const reminderRef = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}/reminders/${reminderId}`);
    const newDue = new Date(); newDue.setDate(newDue.getDate() + days);
    await updateDoc(reminderRef, { dueDate: Timestamp.fromDate(newDue) });
    this.loadCustomerData();
  }
  
  addManualTag(event: Event) {
    const input = this.manualTagInput.trim().toLowerCase();
    if (!input) return;
    if (event instanceof KeyboardEvent) event.preventDefault(); 
    if (!this.manualTags.includes(input)) this.manualTags.push(input);
    this.manualTagInput = '';
  }

  removeManualTag(tag: string) {
    this.manualTags = this.manualTags.filter(t => t !== tag);
  }

  async saveManualTags() {
    this.loading = true;
    try {
      const ref = doc(this.firestore, `Stores/${this.storeId}/customers/${this.customerId}`);
      await updateDoc(ref, { manualTags: this.manualTags.filter(t => t.trim().length > 0) });
      await this.loadCustomerData(); 
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  isDormant(): boolean {
    const last = this.orders?.length ? (this.orders[this.orders.length - 1]?.createdAt?.toDate?.() || this.orders[this.orders.length - 1]?.createdAt || null) : null;
    if (!last) return false;
    const days = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    return days > 90;
  }
}