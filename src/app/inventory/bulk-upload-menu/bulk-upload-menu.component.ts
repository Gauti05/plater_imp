import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where
} from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-bulk-upload-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-upload-menu.component.html',
  styleUrls: ['./bulk-upload-menu.component.css']
})
export class BulkUploadMenuComponent implements OnInit {
  storeSlug: string = '';
  csvFile: File | null = null;
  parsedData: any[] = [];
  uploading: boolean = false;
  uploadSummary: string = '';

  constructor(private firestore: Firestore, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    const root = this.route.snapshot.root;
    this.storeSlug = root.firstChild?.paramMap.get('storeSlug') || '';
    console.log('BulkUploadMenu storeSlug:', this.storeSlug);
  }

  handleFileChange(event: any) {
    this.csvFile = event.target.files[0];
  }

  async parseCSV() {
    if (!this.csvFile) return;

    const text = await this.csvFile.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim());

    this.parsedData = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((h, i) => {
        row[h] = values[i];
      });
      return row;
    });

    console.log('Parsed CSV:', this.parsedData);
  }

  async uploadToFirestore() {
    if (!this.parsedData.length) return alert('No parsed data to upload');

    this.uploading = true;
    let added = 0;
    let updatedCategories: string[] = [];

    const categoryCollection = collection(this.firestore, `Stores/${this.storeSlug}/menuCategories`);
    const menuCollection = collection(this.firestore, `Stores/${this.storeSlug}/menuItems`);

    // Fetch existing categories once to minimize reads
    const existingCategoriesSnapshot = await getDocs(categoryCollection);
    const existingCategories = existingCategoriesSnapshot.docs.map(d => d.data()['name']);

    for (const row of this.parsedData) {
      const name = row['Name']?.trim();
      const category = row['Category']?.trim();
      const price = Number(row['Price (₹)']) || 0;
      const status = String(row['Status']).toLowerCase() === 'true';
      const trackInventory = String(row['Inventory Tracking']).toLowerCase() === 'true';

      if (!name || !category || price <= 0) {
        console.warn('Skipping invalid row:', row);
        continue;
      }

      // ✅ Add category if not exists
      if (!existingCategories.includes(category)) {
        const newCategoryRef = doc(categoryCollection);
        await setDoc(newCategoryRef, { name: category });
        existingCategories.push(category);
        updatedCategories.push(category);
      }

      // ✅ Add menu item
      const newMenuRef = doc(menuCollection);
      await setDoc(newMenuRef, {
        name,
        category,
        price,
        isActive: status,
        trackInventory,
        type: 'menu-item',
        allergens: [],
        recipe: [],
        imageUrl: '',
      });
      added++;
    }

    this.uploadSummary = `✅ ${added} menu items added successfully.  
📁 New categories created: ${updatedCategories.join(', ') || 'None'}`;

    this.uploading = false;
    console.log(this.uploadSummary);
  }

  backToList() {
    this.router.navigate([`/${this.storeSlug}/inventory/menu-items`]);
  }
}
