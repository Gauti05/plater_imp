import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-customisation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customisation.component.html',
  styleUrls: ['./customisation.component.css'],
})
export class CustomisationComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);

 storeSlug: string | null | undefined = null;
  loading = false;
  successMessage = '';

  customisation: any = {
    themeColor: '#2563eb',
    accentColor: '#f59e0b',
    darkMode: false,
    showLogoOnReceipt: true,
    receiptHeader: 'Thank you for visiting!',
    receiptFooter: 'Visit again soon!',
    enableDineIn: true,
    enableTakeaway: true,
    enableDelivery: false,
    taxName: 'GST',
    taxPercentage: 5,
    taxInclusive: true,
  };

  async ngOnInit() {
    this.storeSlug =this.route.parent?.snapshot.paramMap.get('storeSlug');
    if (this.storeSlug) await this.loadCustomisation();
  }

  async loadCustomisation() {
    const ref = doc(this.firestore, `Stores/${this.storeSlug}/settings/customisation`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      this.customisation = { ...this.customisation, ...snap.data() };
    }
  }

  async saveCustomisation() {
    this.loading = true;
    const ref = doc(this.firestore, `Stores/${this.storeSlug}/settings/customisation`);
    try {
      await setDoc(ref, this.customisation, { merge: true });
      this.successMessage = '✅ Settings updated successfully!';
      setTimeout(() => (this.successMessage = ''), 3000);
    } catch (err) {
      console.error('Error saving customisation:', err);
    } finally {
      this.loading = false;
    }
  }
}
