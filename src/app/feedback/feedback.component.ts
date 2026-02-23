import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Firestore, collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback.component.html',
  styleUrls: ['./feedback.component.css']
})
export class FeedbackComponent implements OnInit {
  storeSlug: string | null = null;
  storeId: string | null = null;
  storeName: string = 'Our Restaurant';

  rating: number = 0;
  hoverRating: number = 0;
  comments: string = '';
  customerMobile: string = '';

  isSubmitted: boolean = false;
  generatedPromo: string | null = null; // Shows the customer their reward instantly
  promoMessage: string = '';

  constructor(private route: ActivatedRoute, private firestore: Firestore) {}

  async ngOnInit() {
    this.storeSlug = this.route.snapshot.paramMap.get('storeSlug');
    if (this.storeSlug) {
      const q = query(collection(this.firestore, 'Stores'), where('slug', '==', this.storeSlug));
      const snap = await getDocs(q);
      if (!snap.empty) {
        this.storeId = snap.docs[0].id;
        this.storeName = snap.docs[0].data()['name'] || 'Our Restaurant';
      }
    }
  }

  setRating(val: number) { this.rating = val; }
  setHover(val: number) { this.hoverRating = val; }

  async submitFeedback() {
    if (this.rating === 0 || !this.customerMobile || !this.storeId) {
      alert("Please provide a rating and your mobile number.");
      return;
    }

    try {
      // 1. Save the Review to Firebase
      const feedbackPayload = {
        rating: this.rating,
        comments: this.comments,
        customerMobile: this.customerMobile,
        createdAt: serverTimestamp(),
        status: 'Unread'
      };
      await addDoc(collection(this.firestore, `Stores/${this.storeId}/feedback`), feedbackPayload);

      // 2. ⭐ FEEDBACK-DRIVEN MARKETING AUTOMATION ENGINE
      // Check what automations the manager has turned on in the Marketing Hub
      const settingsSnap = await getDoc(doc(this.firestore, `Stores/${this.storeId}/settings/marketing`));
      const automations = settingsSnap.exists() ? (settingsSnap.data()['automationStates'] || {}) : {};

      if (this.rating <= 2 && automations['bad_review']) {
        // Automatically generate a 20% OFF win-back promo code
        this.generatedPromo = 'WECARE20-' + Math.floor(1000 + Math.random() * 9000);
        this.promoMessage = "We are so sorry we didn't meet your expectations. Please give us another chance. Use this code for 20% off your next visit!";
        await this.autoGeneratePromo(this.generatedPromo, 20, 'Percentage');
      } 
      else if (this.rating === 5 && automations['good_review']) {
        // Automatically generate a ₹100 Flat VIP thank you promo code
        this.generatedPromo = 'VIPTHANKS-' + Math.floor(1000 + Math.random() * 9000);
        this.promoMessage = "Wow, 5 stars! Thank you for the love. Here is a special ₹100 flat discount for your next feast!";
        await this.autoGeneratePromo(this.generatedPromo, 100, 'Flat');
      }

      this.isSubmitted = true;
    } catch (e) {
      console.error("Error submitting feedback", e);
      alert("Something went wrong. Please try again.");
    }
  }

  // Helper to instantly inject the reward into the POS database
  private async autoGeneratePromo(code: string, value: number, type: 'Percentage' | 'Flat') {
    if (!this.storeId) return;
    const promoToSave = {
      code: code,
      type: type,
      value: value,
      uses: 0,
      maxUses: 1, // Single-use code just for them!
      status: 'Active'
    };
    await addDoc(collection(this.firestore, `Stores/${this.storeId}/promos`), promoToSave);
  }
}