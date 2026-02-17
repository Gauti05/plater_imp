import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);

 storeSlug: string | null | undefined = null;

  loading = false;
  successMessage = '';

  restaurant: any = {
    name: '',
    slug: '',
    adminUid: '',
    createdAt: '',
    createdBy: '',
    plan: '',
    planExpiry: '',
    licenseKey: '',
    isActive: true,

    // Editable fields
    email: '',
    phone: '',
    gstNumber: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    openingTime: '',
    closingTime: '',
    logoUrl: '',
  };

  async ngOnInit() {
    this.storeSlug =this.route.parent?.snapshot.paramMap.get('storeSlug');


    if (this.storeSlug) {
      await this.loadProfile();
    }
  }

  async loadProfile() {
    const ref = doc(this.firestore, `Stores/${this.storeSlug}`);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      this.restaurant = { ...this.restaurant, ...snap.data() };
    }
  }

  async saveProfile() {
    this.loading = true;
    const ref = doc(this.firestore, `Stores/${this.storeSlug}`);
    try {
      await setDoc(
        ref,
        {
          email: this.restaurant.email,
          phone: this.restaurant.phone,
          gstNumber: this.restaurant.gstNumber,
          address: this.restaurant.address,
          city: this.restaurant.city,
          state: this.restaurant.state,
          pincode: this.restaurant.pincode,
          openingTime: this.restaurant.openingTime,
          closingTime: this.restaurant.closingTime,
          logoUrl: this.restaurant.logoUrl,
        },
        { merge: true }
      );

      this.successMessage = '✅ Profile updated successfully!';
      setTimeout(() => (this.successMessage = ''), 3000);
    } catch (e) {
      console.error('Error updating profile:', e);
    } finally {
      this.loading = false;
    }
  }

  onLogoChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.restaurant.logoUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
}
