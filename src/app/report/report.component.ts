import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule, formatDate, NgClass, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  Firestore, collection, getDocs, query, where, orderBy, Timestamp, doc
} from '@angular/fire/firestore';

import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import 'chart.js/auto';

import { GoogleGenerativeAI } from '@google/generative-ai';

/* ----------------------------- Firestore Types ---------------------------- */
type DailySales = { id?: string; date: any; totalSales: number; totalOrders: number; onlineSales?: number; offlineSales?: number; notes?: string; createdAt: any; };
type DailyLeads = { id?: string; date: any; totalLeads: number; qualifiedLeads: number; notInterestedLeads: number; notes?: string; createdAt: any; };
interface InventoryEntry { category: string; sets: number; assortments: number; }
interface DailyInventory { id?: string; date: any; entries: InventoryEntry[]; notes?: string; createdAt: any; }

type ProductDoc = { id?: string; name?: string; category?: string; price?: number; totalInventory?: number; activeStatus?: string | boolean; totalSold?: number };

type ReportRow = Record<string, any>;

/* ----------------------------- AI Types ----------------------------- */
export type ReportPlan = {
  timeRange: { preset?: 'last_7d'|'last_30d'|'last_90d', start?: string, end?: string };
  groupBy?: 'day'|'week'|'month';
  reportType:
    | 'sales-summary'
    | 'leads-summary'
    | 'inventory-snapshot'
    | 'category-performance'
    | 'daily-log';
  focus?: {
    compare?: Array<'sales_vs_leads'|'category_performance'>;
  };
  output?: { narrativeStyle?: 'executive'|'detailed'|'bullet'; };
};

/* --------------------------- Component --------------------------- */
@Component({
  selector: 'app-report',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass, NgStyle, BaseChartDirective],
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ReportComponent implements OnInit {
  loading = false;
  storeSlug: string | null = null;

  reportType:
    | 'sales-summary'
    | 'leads-summary'
    | 'inventory-snapshot'
    | 'category-performance'
    | 'daily-log' = 'sales-summary';

  groupBy: 'day' | 'week' | 'month' = 'day';

  startStr = this.toYmd(this.addDays(new Date(), -30));
  endStr   = this.toYmd(new Date());

  salesData: DailySales[] = [];
  leadsData: DailyLeads[] = [];
  inventoryData: DailyInventory[] = [];
  productsData: ProductDoc[] = [];

  rows: ReportRow[] = [];
  kpi: any = {};

  salesTrendData: ChartData<'line'> = {
    labels: [],
    datasets: [{ label: 'Revenue', data: [], tension: 0.35, fill: false, pointRadius: 2, borderWidth: 2 }]
  };
  
  // ⭐ FIXED CHART OPTIONS: Neutral gray text so it's readable on Dark and Light backgrounds
  salesTrendOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: true, labels: { color: '#9CA3AF' } } 
    },
    scales: { 
      x: { 
        grid: { display: false },
        ticks: { color: '#9CA3AF' }
      }, 
      y: { 
        border: { display: false },
        grid: { color: '#334155' },
        ticks: { color: '#9CA3AF' }
      } 
    }
  };

  aiLoading = false;
  aiPlan: ReportPlan | null = null;
  aiNarrativeMd = '';
  showAiPanel = false;
  aiPrompt = '';
  aiSuggestions = [
    'compare sales and leads performance over the last 3 months',
    'show me top performing categories for last 30 days',
    'give me a daily log of sales, leads, and inventory for last week',
    'summarize inventory status and low stock items',
  ];
  
  // Hardcoded for Gemini
  geminiApiKey = 'YOUR_GEMINI_API_KEY'; // replace with actual
  private genAI?: GoogleGenerativeAI;
  
  constructor(private fs: Firestore, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.storeSlug =this.route.parent?.snapshot.paramMap.get('storeSlug') ?? null;
    if (this.geminiApiKey) {
      try { this.genAI = new GoogleGenerativeAI(this.geminiApiKey); }
      catch { this.genAI = undefined; }
    }
    this.fetch();
  }

  /* ======================= Firestore fetch ======================= */
  async fetch() {
    if (!this.storeSlug) {
      console.error('Store slug missing in report component');
      return;
    }
    this.loading = true;
    try {
      const sDate = this.parseYmd(this.startStr);
      const eDate = this.parseYmd(this.endStr);
      const startTs = Timestamp.fromDate(new Date(sDate.setHours(0, 0, 0, 0)));
      const endTs   = Timestamp.fromDate(new Date(eDate.setHours(23, 59, 59, 999)));

      const base = doc(this.fs, 'Stores', this.storeSlug);

      const salesQuery = query(collection(base, 'sales'), where('date', '>=', startTs), where('date', '<=', endTs), orderBy('date', 'asc'));
      const leadsQuery = query(collection(base, 'leads'), where('date', '>=', startTs), where('date', '<=', endTs), orderBy('date', 'asc'));
      const inventoryQuery = query(collection(base, 'inventory'), where('date', '>=', startTs), where('date', '<=', endTs), orderBy('date', 'asc'));
      const productsQuery = query(collection(base, 'products'));

      const [salesSnap, leadsSnap, inventorySnap, productsSnap] = await Promise.all([
        getDocs(salesQuery), getDocs(leadsQuery), getDocs(inventoryQuery), getDocs(productsQuery)
      ]);
      
      this.salesData = this.safeDocs(salesSnap).map(this.normalizeSales);
      this.leadsData = this.safeDocs(leadsSnap).map(this.normalizeLeads);
      this.inventoryData = this.safeDocs(inventorySnap).map(this.normalizeInventory);
      this.productsData = this.safeDocs(productsSnap).map(this.normalizeProduct);

      this.compute();
      this.restoreColumnPrefs();
      this.loadPresetList();
    } catch (err: any) {
      console.error('Fetch error:', err);
      this.notify(err?.message || 'Failed to load reports', 'error');
    } finally {
      this.loading = false;
    }
  }

  private safeDocs = <T>(snap: any) => snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) as T }));
  private normalizeTimestamp(ts: any): Date { return ts instanceof Timestamp ? ts.toDate() : new Date((ts as any)?.seconds * 1000); }
  private num(v: any, fallback = 0) { const n = Number(v); return isNaN(n) ? fallback : n; }
  private normalizeSales = (s: DailySales): DailySales => ({ ...s, date: this.normalizeTimestamp(s.date), totalSales: this.num(s.totalSales), totalOrders: this.num(s.totalOrders), onlineSales: this.num(s.onlineSales), offlineSales: this.num(s.offlineSales) });
  private normalizeLeads = (l: DailyLeads): DailyLeads => ({ ...l, date: this.normalizeTimestamp(l.date), totalLeads: this.num(l.totalLeads), qualifiedLeads: this.num(l.qualifiedLeads), notInterestedLeads: this.num(l.notInterestedLeads) });
  private normalizeInventory = (i: DailyInventory): DailyInventory => ({ ...i, date: this.normalizeTimestamp(i.date), entries: i.entries || [] });
  private normalizeProduct = (p: ProductDoc): ProductDoc => ({...p, totalInventory: this.num(p.totalInventory), totalSold: this.num(p.totalSold) });
  
  /* ======================== Derivations ========================= */
  private compute() {
    this.rows = [];
    this.kpi = {};
    const sales = this.salesData;
    const leads = this.leadsData;
    const inventory = this.inventoryData;

    const toDate = (ts: DailySales['date']) => new Date(ts);
    const g = this.groupBy;
    const fmt = (d: Date) => {
      if (g === 'day') return formatDate(d, 'MMM d', 'en-IN');
      if (g === 'week') return 'W' + this.getWeekNumber(d) + ' ' + d.getFullYear();
      return formatDate(d, 'MMM y', 'en-IN');
    };

    const buckets = new Map<string, { sales: number; leads: number; orders: number; qualifiedLeads: number }>();
    sales.forEach(s => {
      const d = toDate(s.date);
      const key = fmt(d);
      const b = buckets.get(key) || { sales: 0, leads: 0, orders: 0, qualifiedLeads: 0 };
      b.sales += s.totalSales; b.orders += s.totalOrders; buckets.set(key, b);
    });
    leads.forEach(l => {
      const d = toDate(l.date);
      const key = fmt(d);
      const b = buckets.get(key) || { sales: 0, leads: 0, orders: 0, qualifiedLeads: 0 };
      b.leads += l.totalLeads; b.qualifiedLeads += l.qualifiedLeads; buckets.set(key, b);
    });

    const labels = [...buckets.keys()];
    this.salesTrendData = {
      labels,
      datasets: [
        { label: 'Sales', data: labels.map(k => buckets.get(k)?.sales || 0), tension: 0.35, fill: false, pointRadius: 2, borderWidth: 2 },
        { label: 'Leads', data: labels.map(k => buckets.get(k)?.leads || 0), tension: 0.35, fill: false, pointRadius: 2, borderWidth: 2 }
      ]
    };

    switch (this.reportType) {
      case 'sales-summary':
        const totalSales = sales.reduce((a,b)=>a+b.totalSales,0);
        const totalOrders = sales.reduce((a,b)=>a+b.totalOrders,0);
        this.kpi = { sales: totalSales, orders: totalOrders, aov: totalOrders ? totalSales / totalOrders : 0, topCategory: this.getTopCategory() };
        this.rows = labels.map(l => {
          const b = buckets.get(l)!;
          return { Period: l, Sales: b.sales, Orders: b.orders, AOV: b.orders ? b.sales / b.orders : 0 };
        });
        break;

      case 'leads-summary':
        const totalLeads = leads.reduce((a,b)=>a+b.totalLeads,0);
        const qualifiedLeads = leads.reduce((a,b)=>a+b.qualifiedLeads,0);
        this.kpi = { leads: totalLeads, qualifiedLeads, conversionRate: totalLeads ? (qualifiedLeads/totalLeads)*100 : 0, bestDay: this.getBestLeadDay() };
        this.rows = labels.map(l => {
          const b = buckets.get(l)!;
          return { Period: l, 'Total Leads': b.leads, 'Qualified': b.qualifiedLeads, 'Not Interested': b.leads - b.qualifiedLeads, 'Conversion Rate': b.leads ? (b.qualifiedLeads/b.leads)*100 : 0 };
        });
        break;

      case 'inventory-snapshot':
        this.kpi = { totalStock: this.getTotalStock(), lowStock: this.getLowStockCount(), soldThisPeriod: this.getSoldThisPeriod(), topSellingProduct: this.getTopSellingProduct() };
        this.rows = this.productsData.map(p => ({
            Product: p.name,
            Category: p.category,
            'In Stock': p.totalInventory,
            'Total Sold': p.totalSold
        }));
        break;

      case 'category-performance':
        const catMap = new Map<string, { sales: number; orders: number }>();
        sales.forEach(s => {
          if (s.onlineSales) {
            const cat = 'Online';
            const v = catMap.get(cat) || { sales: 0, orders: 0 };
            v.sales += s.onlineSales;
            v.orders += 1;
            catMap.set(cat, v);
          }
          if (s.offlineSales) {
            const cat = 'Offline';
            const v = catMap.get(cat) || { sales: 0, orders: 0 };
            v.sales += s.offlineSales;
            v.orders += 1;
            catMap.set(cat, v);
          }
        });
        this.kpi = { topCategory: this.getTopCategory(), categorySales: Array.from(catMap.values()).reduce((a,b)=>a+b.sales,0) };
        this.rows = [...catMap.entries()].map(([key, val]) => ({ Category: key, Sales: val.sales, Orders: val.orders }));
        break;

      case 'daily-log':
        const combined = new Map<string, any>();
        sales.forEach(s => {
            const dateStr = formatDate(s.date as Date, 'yyyy-MM-dd', 'en-IN');
            const data = combined.get(dateStr) || { date: dateStr, sales: 0, leads: 0, inventory: 0, notes: s.notes };
            data.sales += s.totalSales;
            combined.set(dateStr, data);
        });
        leads.forEach(l => {
            const dateStr = formatDate(l.date as Date, 'yyyy-MM-dd', 'en-IN');
            const data = combined.get(dateStr) || { date: dateStr, sales: 0, leads: 0, inventory: 0, notes: l.notes };
            data.leads += l.totalLeads;
            combined.set(dateStr, data);
        });
        inventory.forEach(i => {
            const dateStr = formatDate(i.date as Date, 'yyyy-MM-dd', 'en-IN');
            const data = combined.get(dateStr) || { date: dateStr, sales: 0, leads: 0, inventory: 0, notes: i.notes };
            const total = i.entries.reduce((sum, e) => sum + e.sets + e.assortments, 0);
            data.inventory += total;
            combined.set(dateStr, data);
        });
        this.rows = Array.from(combined.values()).sort((a,b)=> new Date(b.date).getTime() - new Date(a.date).getTime());
        this.kpi = { sales: sales.reduce((a,b)=>a+b.totalSales,0), leads: leads.reduce((a,b)=>a+b.totalLeads,0), totalStock: this.getTotalStock() };
        break;
    }
  }

  getTopCategory(): string {
    const catMap = new Map<string, number>();
    this.productsData.forEach(p => {
        catMap.set(p.category || 'N/A', (catMap.get(p.category || 'N/A') || 0) + (p.totalSold || 0));
    });
    const sorted = [...catMap.entries()].sort((a,b) => b[1] - a[1]);
    return sorted[0]?.[0] || '—';
  }
  getBestLeadDay(): string {
    const dayMap = new Map<string, number>();
    this.leadsData.forEach(l => {
        const day = formatDate(l.date as Date, 'EEEE', 'en-IN');
        dayMap.set(day, (dayMap.get(day) || 0) + l.totalLeads);
    });
    const sorted = [...dayMap.entries()].sort((a,b) => b[1] - a[1]);
    return sorted[0]?.[0] || '—';
  }
  getTotalStock(): number { return this.productsData.reduce((a, p) => a + (p.totalInventory || 0), 0); }
  getLowStockCount(): number { return this.productsData.filter(p => (p.totalInventory || 0) <= 5).length; }
  getSoldThisPeriod(): number { return this.productsData.reduce((a, p) => a + (p.totalSold || 0), 0); }
  getTopSellingProduct(): string { const sorted = [...this.productsData].sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0)); return sorted[0]?.name || '—'; }

  /* ============================ AI ============================== */
  async aiSearchReport(userPrompt: string) {
    if (!this.genAI) { this.notify('Gemini API key is missing or invalid', 'error'); return; }
    this.aiLoading = true;
    this.aiNarrativeMd = '';
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      const system = `You are a helpful assistant for business analytics. Your output is ONLY a valid JSON object of type ReportPlan.
      type ReportPlan = {
        timeRange: { preset?: 'last_7d'|'last_30d'|'last_90d', start?: string, end?: string };
        groupBy?: 'day'|'week'|'month';
        reportType: 'sales-summary'|'leads-summary'|'inventory-snapshot'|'category-performance'|'daily-log';
        focus?: { compare?: Array<'sales_vs_leads'|'category_performance'>; };
        output?: { narrativeStyle?: 'executive'|'detailed'|'bullet'; };
      };
      Rules: - If time is mentioned, set timeRange; else default preset last_30d.
      - Prefer groupBy=day for ≤90d, month for >90d.
      - Choose the closest reportType from the allowed list.
      - Return RAW JSON only. No prose, no code fences.`;
      
      const user = `User prompt: ${userPrompt}\nReturn JSON only.`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }]}],
        generationConfig: { responseMimeType: 'application/json' }
      });
      let text = result.response.text();
      text = text.replace(/```json\s*/i, '').replace(/```\s*$/i, '').trim();
      let plan: ReportPlan | null = null;
      try { plan = JSON.parse(text); } catch (e) { console.error('AI plan parsing failed', e); }
      if (!plan || !plan.reportType) { plan = { timeRange: { preset: 'last_30d' }, reportType: 'sales-summary', groupBy: 'day' }; }
      this.aiPlan = plan;
      this.applyPlanFromAI(plan);
      void this.generateAINarrative();
    } catch (err) {
      console.error('AI search error', err);
      this.notify('AI search failed. Please try again.', 'error');
    } finally { this.aiLoading = false; }
  }

  private applyPlanFromAI(plan: ReportPlan) {
    if (plan.timeRange?.preset) {
      const map: Record<string, number> = { 'last_7d': 7, 'last_30d': 30, 'last_90d': 90 };
      const days = map[plan.timeRange.preset];
      if (days) this.setPresetDays(days);
    } else if (plan.timeRange?.start && plan.timeRange?.end) {
      this.startStr = plan.timeRange.start.slice(0, 10);
      this.endStr   = plan.timeRange.end.slice(0, 10);
      this.onDateChange();
    }
    if (plan.groupBy) this.setGroupBy(plan.groupBy);
    if (plan.reportType) this.setReportType(plan.reportType);
  }
  
  private async generateAINarrative() {
    if (!this.genAI) return;
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const style = this.aiPlan?.output?.narrativeStyle || 'executive';
    const aggregates = {
      reportType: this.reportType,
      period: { start: this.startStr, end: this.endStr },
      kpi: this.kpi,
      salesTrend: this.salesTrendData.datasets[0]?.data,
      leadsTrend: this.salesTrendData.datasets[1]?.data,
      dailyLog: this.rows
    };
    const prompt = `Create a concise ${style} summary for the following store report. Use markdown for formatting.
    INPUT JSON:
    ${JSON.stringify(aggregates)}
    `;
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }]}],
      generationConfig: { responseMimeType: 'text/plain' }
    });
    let md = result.response.text().replace(/```(?:md|markdown)?\s*/i,'').replace(/```\s*$/i,'').trim();
    this.aiNarrativeMd = md || '';
  }

  /* ============================ UI helpers ======================= */
  labelForType(t: string) {
    const map: Record<string, string> = {
      'sales-summary': 'Sales Summary', 'leads-summary': 'Leads Summary', 'inventory-snapshot': 'Inventory Snapshot',
      'category-performance': 'Category Performance', 'daily-log': 'Daily Log'
    };
    return map[t] || t;
  }
  labelForGroup(g: 'day' | 'week' | 'month') { return g === 'day' ? 'Grouped by Day' : g === 'week' ? 'Grouped by Week' : 'Grouped by Month'; }
  private addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
  toYmd(d: Date) { return formatDate(d, 'yyyy-MM-dd', 'en-IN'); }
  private parseYmd(s: string) { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
  private getWeekNumber(d: Date): number {
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil(((+target - +yearStart) / 86400000 + 1) / 7);
  }
  private notify(msg: string, type: 'success'|'error'|'info' = 'info') { console[type === 'error' ? 'error' : 'log'](msg); }
  onDateChange() { this.fetch(); }
  setReportType(val: any) { this.reportType = val; this.compute(); }
  setGroupBy(val: 'day' | 'week' | 'month') { this.groupBy = val; this.compute(); }
  setPresetDays(days: number) {
    const start = this.addDays(new Date(), -days);
    this.startStr = this.toYmd(start);
    this.endStr = this.toYmd(new Date());
    this.onDateChange();
  }

  exportCSV() {
    const data = this.rows; if (!data?.length) return;
    const cols = Object.keys(data[0]);
    const csv = [ cols.join(','), ...data.map(r => cols.map(c => this.escapeCsv(r[c])).join(',')) ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const file = `${this.reportType}_${this.startStr}_${this.endStr}.csv`;
    a.href = url; a.download = file; a.click();
    URL.revokeObjectURL(url);
  }
  private escapeCsv(val: any) { if (val === null || val === undefined) return ''; const str = String(val); return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str; }
  printPDF() {
    const data = this.rows; if (!data?.length) { this.notify('No data to print.'); return; }
    const cols = Object.keys(data[0]); const title = `${this.labelForType(this.reportType)} Report`;
    const w = window.open('', '_blank', 'width=1024,height=768'); if (!w) return;
    w.document.write(`<html><head><title>${title}</title><style>body{font-family:sans-serif;}</style></head><body><h1>${title}</h1><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${cols.map(c=>`<td>${r[c]}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  }
  
  colPickerOpen = false;
  presetOpen = false;
  presetName = '';
  presetList: string[] = [];
  tableQuery = '';
  selectedRow: any = null;
  private colKey(type: string) { return `report_cols_${type}`; }
  isColVisibleMap = new Map<string, boolean>();
  toggleColPicker(){ this.colPickerOpen = !this.colPickerOpen; }
  isColVisible(key: string){ return this.isColVisibleMap.get(key) !== false; }
  toggleColumn(key: string, checked: boolean | null | undefined){
    const val = !!checked; this.isColVisibleMap.set(key, val);
    localStorage.setItem(this.colKey(this.reportType), JSON.stringify(Object.fromEntries(this.isColVisibleMap)));
  }
  showAllColumns(){ if (!this.rows?.length) return; Object.keys(this.rows[0]).forEach(k=>this.isColVisibleMap.set(k,true)); localStorage.setItem(this.colKey(this.reportType), JSON.stringify(Object.fromEntries(this.isColVisibleMap))); }
  hideAllColumns(){ if (!this.rows?.length) return; Object.keys(this.rows[0]).forEach(k=>this.isColVisibleMap.set(k,false)); localStorage.setItem(this.colKey(this.reportType), JSON.stringify(Object.fromEntries(this.isColVisibleMap))); }
  private restoreColumnPrefs(){
    const raw = localStorage.getItem(this.colKey(this.reportType));
    if (!this.rows?.length) { this.isColVisibleMap.clear(); return; }
    if (raw){ const obj = JSON.parse(raw) || {}; Object.keys(this.rows[0]).forEach(k=>{ this.isColVisibleMap.set(k, obj[k] !== false); }); }
    else { Object.keys(this.rows[0]).forEach(k=>this.isColVisibleMap.set(k,true)); }
  }
  filteredRows(): any[] { if (!this.rows?.length) return []; const q = (this.tableQuery || '').toLowerCase().trim(); if (!q) return this.rows; const keys = Object.keys(this.rows[0]); return this.rows.filter(r => keys.some(k => String(r[k] ?? '').toLowerCase().includes(q))); }
  selectRow(row: any){ this.selectedRow = row; }
  copyCell(val: any){ try { navigator.clipboard.writeText(String(val ?? '')); } catch {} }
  private presetKey = 'report_presets_v1';
  private loadPresetList(){ const obj = JSON.parse(localStorage.getItem(this.presetKey) || '{}'); this.presetList = Object.keys(obj); }
  savePreset(){ const name = (this.presetName || '').trim(); if (!name) return; const obj = JSON.parse(localStorage.getItem(this.presetKey) || '{}'); obj[name] = { reportType: this.reportType, groupBy: this.groupBy, startStr: this.startStr, endStr: this.endStr, columns: Object.fromEntries(this.isColVisibleMap) }; localStorage.setItem(this.presetKey, JSON.stringify(obj)); this.presetName = ''; this.loadPresetList(); }
  loadPreset(name: string){ const obj = JSON.parse(localStorage.getItem(this.presetKey) || '{}'); const p = obj[name]; if (!p) return; this.reportType = p.reportType || this.reportType; this.groupBy = p.groupBy || this.groupBy; this.startStr = p.startStr || this.startStr; this.endStr = p.endStr || this.endStr; this.fetch(); }
  deletePreset(name: string){ const obj = JSON.parse(localStorage.getItem(this.presetKey) || '{}'); delete obj[name]; localStorage.setItem(this.presetKey, JSON.stringify(obj)); this.loadPresetList(); }
  onColumnToggleChange(key: string, ev: Event) { const input = ev.target as HTMLInputElement | null; const checked = !!input?.checked; this.toggleColumn(key, checked); }
}