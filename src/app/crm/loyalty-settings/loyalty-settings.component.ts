import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router'; 
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';

interface LoyaltyTier {
  name: string;
  minPoints: number;
  multiplier: number;
}

interface LoyaltySettings {
  isEnabled: boolean;
  earnSpendAmount: number; 
  earnPoints: number;      
  redeemPoints: number;    
  redeemValue: number;     
  minRedeemPoints: number; 
  maxEarnPerOrder?: number; 
  maxRedeemPerOrder?: number; 
  welcomeBonusPoints?: number;
  milestoneVisitCount?: number;
  milestoneBonusPoints?: number;
  isCrossStoreLoyaltyEnabled?: boolean;
  // ⭐ HAPPY HOUR SETTINGS
  isHappyHourEnabled?: boolean;
  happyHourDay?: string; // e.g., 'Tuesday'
  happyHourStart?: string; // e.g., '14:00'
  happyHourEnd?: string; // e.g., '17:00'
  happyHourMultiplier?: number; // e.g., 2.0
  tiers: LoyaltyTier[];
}

@Component({
  selector: 'app-loyalty-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink], 
  templateUrl: './loyalty-settings.component.html',
  styleUrl: './loyalty-settings.component.css'
})
export class LoyaltySettingsComponent implements OnInit {
  storeId!: string;
  loading = false;
  saving = false;

  settings: LoyaltySettings = {
    isEnabled: false,
    earnSpendAmount: 100,
    earnPoints: 1,
    redeemPoints: 1,
    redeemValue: 1,
    minRedeemPoints: 50,
    maxEarnPerOrder: 500,
    maxRedeemPerOrder: 1000,
    welcomeBonusPoints: 50,
    milestoneVisitCount: 5,
    milestoneBonusPoints: 100,
    isCrossStoreLoyaltyEnabled: false,
    isHappyHourEnabled: false,
    happyHourDay: 'Everyday',
    happyHourStart: '14:00',
    happyHourEnd: '18:00',
    happyHourMultiplier: 2,
    tiers: [
      { name: 'Silver', minPoints: 0, multiplier: 1 },
      { name: 'Gold', minPoints: 500, multiplier: 1.5 }
    ]
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore
  ) {}

  async ngOnInit() {
    this.storeId = this.route.parent?.snapshot.paramMap.get('storeSlug') ?? '';
    if (this.storeId) {
      await this.loadSettings();
    }
  }

  async loadSettings() {
    this.loading = true;
    try {
      const docRef = doc(this.firestore, `Stores/${this.storeId}/settings/loyalty`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as LoyaltySettings;
        this.settings = { 
          ...this.settings, 
          ...data,
          maxEarnPerOrder: data.maxEarnPerOrder || 500,
          maxRedeemPerOrder: data.maxRedeemPerOrder || 1000,
          welcomeBonusPoints: data.welcomeBonusPoints || 0,
          milestoneVisitCount: data.milestoneVisitCount || 5,
          milestoneBonusPoints: data.milestoneBonusPoints || 0,
          isCrossStoreLoyaltyEnabled: data.isCrossStoreLoyaltyEnabled || false,
          isHappyHourEnabled: data.isHappyHourEnabled || false,
          happyHourDay: data.happyHourDay || 'Everyday',
          happyHourStart: data.happyHourStart || '14:00',
          happyHourEnd: data.happyHourEnd || '18:00',
          happyHourMultiplier: data.happyHourMultiplier || 2
        };
      }
    } catch (error) {
      console.error('Error loading loyalty settings', error);
    } finally {
      this.loading = false;
    }
  }

  addTier() {
    this.settings.tiers.push({ name: 'New Tier', minPoints: 1000, multiplier: 2 });
    this.settings.tiers.sort((a, b) => b.minPoints - a.minPoints);
  }

  removeTier(index: number) {
    this.settings.tiers.splice(index, 1);
  }

  async saveSettings() {
    this.saving = true;
    try {
      this.settings.tiers.sort((a, b) => b.minPoints - a.minPoints);
      const docRef = doc(this.firestore, `Stores/${this.storeId}/settings/loyalty`);
      await setDoc(docRef, this.settings, { merge: true });
      alert('Loyalty settings saved successfully!');
      this.router.navigate(['/', this.storeId, 'crm']);
    } catch (error) {
      console.error('Error saving loyalty settings', error);
      alert('Failed to save settings.');
    } finally {
      this.saving = false;
    }
  }
}