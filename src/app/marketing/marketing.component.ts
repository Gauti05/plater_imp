

import { Component, OnInit, OnDestroy, NgZone } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router'; 
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, query, where, getDoc, setDoc, onSnapshot, writeBatch, orderBy } from '@angular/fire/firestore'; 

interface Campaign {
  id?: string;
  name: string;
  channel: 'SMS' | 'Email' | 'Push App';
  status: 'Active' | 'Scheduled' | 'Completed' | 'Draft' | 'Automated';
  audienceSize: number;
  conversions: number;
  budgetSpent: number;
  revenueGenerated: number;
  linkedPromo?: string;
}

interface PromoCode {
  id?: string; 
  code: string;
  type: 'Percentage' | 'Flat';
  value: number;
  uses: number;
  maxUses: number;
  status: 'Active' | 'Expired';
}

interface AutomationRule {
  id: string;
  trigger: string;
  action: string;
  isEnabled: boolean;
  lastRun?: any;
}

// ⭐ NEW: Feedback Interface
interface Feedback {
  id?: string;
  rating: number;
  comments: string;
  customerMobile: string;
  createdAt: any;
}

@Component({
  selector: 'app-marketing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marketing.component.html',
  styleUrls: ['./marketing.component.css']
})
export class MarketingComponent implements OnInit, OnDestroy {
  storeId!: string; 

  totalCampaignRevenue: number = 0;
  activePromosCount: number = 0;
  totalAudienceReached: number = 0;

  campaigns: Campaign[] = [];
  promoCodes: PromoCode[] = [];
  feedbacks: Feedback[] = []; // ⭐ NEW
  
  ownedStores: { id: string, name: string }[] = [];

  segments = [
    { name: 'VIP', count: 0, color: 'gold', description: 'High spenders & frequent visitors' },
    { name: 'Dormant', count: 0, color: 'red', description: 'No visit in last 30 days' },
    { name: 'New', count: 0, color: 'green', description: 'First-time visitors' }
  ];

  automations: AutomationRule[] = [
    { id: 'welcome', trigger: 'New Customer Signup', action: 'Send Welcome Discount', isEnabled: false },
    { id: 'winback', trigger: 'Customer becomes Dormant', action: 'Send "We Miss You" SMS', isEnabled: false },
    { id: 'vip', trigger: 'Customer hits VIP status', action: 'Send Loyalty Reward', isEnabled: false },
    { id: 'good_review', trigger: '5-Star Feedback', action: 'Auto-reply with VIP Promo', isEnabled: false },
    { id: 'bad_review', trigger: '1 or 2-Star Feedback', action: 'Auto-reply with Apology Promo', isEnabled: false }
  ];

  showCampaignModal: boolean = false;
  newCampaign = {
    name: '',
    segment: '',
    channel: 'SMS' as 'SMS' | 'Email' | 'Push App',
    message: '',
    budgetSpent: 0,
    linkedPromo: '',
    applyToAllStores: false 
  };

  showPromoModal: boolean = false;
  newPromo = {
    code: '',
    type: 'Percentage' as 'Percentage' | 'Flat',
    value: 0,
    maxUses: 100,
    applyToAllStores: false 
  };

  aiSuggestion: any = null;
  isGeneratingMessage: boolean = false;
  geminiApiKey: string = 'AIzaSyBxXMj1D_kqSE6AVHx4_6BbMYrblToB5ys'; 

  private campaignSub: any;
  private promoSub: any; 
  private feedbackSub: any; // ⭐ NEW

  constructor(private route: ActivatedRoute, private zone: NgZone) {}

  async ngOnInit() {
    this.storeId = this.route.parent?.snapshot.paramMap.get('storeSlug') ?? '';
    
    if (this.storeId) {
      await this.loadOwnedStores(); 
      this.loadLivePromoCodes(); 
      this.loadLiveCampaigns(); 
      this.loadLiveFeedback(); // ⭐ NEW
      await this.refreshSegmentCounts();
      await this.loadAutomationSettings();
      this.generateAiInsights();
    }
  }

  ngOnDestroy() {
    if (this.campaignSub) this.campaignSub(); 
    if (this.promoSub) this.promoSub(); 
    if (this.feedbackSub) this.feedbackSub(); // ⭐ NEW
  }

  async loadOwnedStores() {
    const db = getFirestore();
    try {
      const currentStoreSnap = await getDoc(doc(db, 'Stores', this.storeId));
      if (currentStoreSnap.exists()) {
        const data = currentStoreSnap.data();
        const ownerId = data['ownerId'] || data['adminUid'];
        if (ownerId) {
          let q = query(collection(db, 'Stores'), where('ownerId', '==', ownerId));
          let snap = await getDocs(q);
          if (snap.empty) {
             q = query(collection(db, 'Stores'), where('adminUid', '==', ownerId));
             snap = await getDocs(q);
          }
          this.ownedStores = snap.docs.map(d => ({ id: d.id, name: d.data()['name'] || d.id }));
        }
      }
    } catch (e) {
      console.error("Error loading owned stores:", e);
    }
  }

  loadLiveCampaigns() {
    const db = getFirestore();
    const campaignRef = collection(db, 'Stores', this.storeId, 'campaigns');
    this.campaignSub = onSnapshot(campaignRef, (snap) => {
      this.zone.run(() => {
        this.campaigns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        this.campaigns.sort((a, b) => (b.id! > a.id! ? 1 : -1)); 
        this.calculateMetrics();
      });
    });
  }

  loadLivePromoCodes() {
    const db = getFirestore();
    const promoRef = collection(db, 'Stores', this.storeId, 'promos');
    this.promoSub = onSnapshot(promoRef, (snap) => {
      this.zone.run(() => {
        this.promoCodes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PromoCode));
        this.promoCodes.sort((a, b) => (b.id! > a.id! ? 1 : -1)); 
        this.calculateMetrics();
      });
    });
  }

  // ⭐ NEW: Live Feedback Listener
  loadLiveFeedback() {
    const db = getFirestore();
    const feedbackRef = collection(db, 'Stores', this.storeId, 'feedback');
    const q = query(feedbackRef, orderBy('createdAt', 'desc'));
    this.feedbackSub = onSnapshot(q, (snap) => {
      this.zone.run(() => {
        this.feedbacks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback));
      });
    });
  }

  async generateCreativeMessage() {
    if (!this.newCampaign.name || !this.newCampaign.segment) {
      alert("Please enter a Campaign Name and select a Target Audience first!");
      return;
    }
    this.isGeneratingMessage = true;
    try {
      const prompt = `You are an expert restaurant marketing copywriter...`; // Shortened for display
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        this.newCampaign.message = data.candidates[0].content.parts[0].text.trim();
      }
    } catch (error: any) {
      this.newCampaign.message = this.generateFallbackMessage(this.newCampaign.channel, this.newCampaign.segment, this.newCampaign.name);
    } finally {
      this.isGeneratingMessage = false;
    }
  }

  private generateFallbackMessage(channel: string, segment: string, campaignName: string): string {
    const isSMS = channel === 'SMS';
    const promoText = this.newCampaign.linkedPromo ? ` Use code ${this.newCampaign.linkedPromo}.` : '';
    if (segment === 'VIP') return isSMS ? `Hey VIP! Early access to our ${campaignName}.${promoText}` : `🌟 VIP Reward: ${campaignName} 🌟`;
    return `Check out our ${campaignName}!${promoText}`;
  }

  async loadAutomationSettings() {
    const db = getFirestore();
    const settingsRef = doc(db, 'Stores', this.storeId, 'settings', 'marketing');
    try {
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        const savedStates = snap.data()['automationStates'] || {};
        this.automations.forEach(rule => {
          if (savedStates[rule.id] !== undefined) rule.isEnabled = savedStates[rule.id];
        });
      }
    } catch (e) {}
  }

  async toggleAutomation(rule: AutomationRule) {
    rule.isEnabled = !rule.isEnabled; 
    const db = getFirestore();
    const settingsRef = doc(db, 'Stores', this.storeId, 'settings', 'marketing');
    const states: any = {};
    this.automations.forEach(r => states[r.id] = r.isEnabled);
    try { await setDoc(settingsRef, { automationStates: states }, { merge: true }); } catch (e) { rule.isEnabled = !rule.isEnabled; }
  }

  async refreshSegmentCounts() {
    const db = getFirestore();
    const customerRef = collection(db, 'Stores', this.storeId, 'customers');
    const snap = await getDocs(customerRef);
    let vip = 0; let dormant = 0; let newCust = 0;
    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data['lifetimeSpend'] > 10000) vip++;
      else if (data['visitCount'] <= 1) newCust++;
      else dormant++;
    });
    this.segments[0].count = vip; this.segments[1].count = dormant; this.segments[2].count = newCust;
  }

  calculateMetrics() {
    this.totalCampaignRevenue = this.campaigns.reduce((sum, camp) => sum + (camp.revenueGenerated || 0), 0);
    this.totalAudienceReached = this.campaigns.reduce((sum, camp) => sum + (camp.audienceSize || 0), 0);
    this.activePromosCount = this.promoCodes.filter(p => p.status === 'Active').length;
  }

  getConversionRate(conversions: number, audience: number): number {
    return (!audience) ? 0 : (conversions / audience) * 100;
  }

  getFinancialROI(camp: Campaign): number {
    if (!camp.budgetSpent) return camp.revenueGenerated > 0 ? 100 : 0;
    return ((camp.revenueGenerated - camp.budgetSpent) / camp.budgetSpent) * 100;
  }

  async togglePromoStatus(promo: PromoCode) {
    promo.status = promo.status === 'Active' ? 'Expired' : 'Active';
    if (this.storeId && promo.id) {
      const db = getFirestore();
      await updateDoc(doc(db, 'Stores', this.storeId, 'promos', promo.id), { status: promo.status });
    }
  }

  openCampaignModal() {
    this.showCampaignModal = true;
    this.newCampaign = { name: '', segment: this.segments[0].name, channel: 'SMS', message: '', budgetSpent: 0, linkedPromo: '', applyToAllStores: false };
  }

  closeCampaignModal() { this.showCampaignModal = false; }

  async saveCampaign() {
    if (!this.newCampaign.name || !this.newCampaign.message) { alert("Missing fields"); return; }
    const selectedSeg = this.segments.find(s => s.name === this.newCampaign.segment);
    const campToSave = {
      name: this.newCampaign.name, channel: this.newCampaign.channel, status: 'Scheduled',
      audienceSize: selectedSeg ? selectedSeg.count : 0, conversions: 0, budgetSpent: this.newCampaign.budgetSpent || 0,
      revenueGenerated: 0, linkedPromo: this.newCampaign.linkedPromo || null, message: this.newCampaign.message
    };
    if (this.storeId) {
      const db = getFirestore();
      if (this.newCampaign.applyToAllStores && this.ownedStores.length > 0) {
        const batch = writeBatch(db);
        const currentStoreRef = doc(collection(db, 'Stores', this.storeId, 'campaigns'));
        batch.set(currentStoreRef, campToSave);
        this.ownedStores.forEach(store => {
          if (store.id !== this.storeId) {
            const docRef = doc(collection(db, 'Stores', store.id, 'campaigns'));
            batch.set(docRef, campToSave);
          }
        });
        await batch.commit();
      } else { await addDoc(collection(db, 'Stores', this.storeId, 'campaigns'), campToSave); }
    }
    this.closeCampaignModal();
  }

  openPromoModal() {
    this.showPromoModal = true;
    this.newPromo = { code: '', type: 'Percentage', value: 0, maxUses: 100, applyToAllStores: false };
  }

  closePromoModal() { this.showPromoModal = false; }

  async savePromoCode() {
    if (!this.newPromo.code || Number(this.newPromo.value) <= 0) { alert("Invalid data"); return; }
    const promoToSave = {
      code: this.newPromo.code.toUpperCase().replace(/\s+/g, ''), 
      type: this.newPromo.type, value: Number(this.newPromo.value),
      uses: 0, maxUses: Number(this.newPromo.maxUses) || 100, status: 'Active'
    };
    if (this.storeId) {
      const db = getFirestore();
      if (this.newPromo.applyToAllStores && this.ownedStores.length > 0) {
        const batch = writeBatch(db);
        const currentStoreRef = doc(collection(db, 'Stores', this.storeId, 'promos'));
        batch.set(currentStoreRef, promoToSave);
        this.ownedStores.forEach(store => {
          if (store.id !== this.storeId) {
            const docRef = doc(collection(db, 'Stores', store.id, 'promos'));
            batch.set(docRef, promoToSave);
          }
        });
        await batch.commit();
      } else { await addDoc(collection(db, 'Stores', this.storeId, 'promos'), promoToSave); }
    }
    this.closePromoModal();
  }

  generateAiInsights() {
    this.aiSuggestion = { title: 'Welcome Bonus Momentum', description: `Turn your new customers into regulars!`, actionText: 'Draft Campaign', fillData: { segment: 'New', channel: 'SMS', discount: 10, isFlat: false } };
  }

  applyAiSuggestion() {
     if (!this.aiSuggestion) return;
     this.showCampaignModal = true;
     this.newCampaign = { name: `AI: ${this.aiSuggestion.title}`, segment: this.aiSuggestion.fillData.segment, channel: this.aiSuggestion.fillData.channel, message: '', budgetSpent: 0, linkedPromo: '', applyToAllStores: false };
  }
}