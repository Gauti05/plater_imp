import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collectionData,
  query,
  orderBy
} from '@angular/fire/firestore';
import { map } from 'rxjs/operators';

// Define the shape of a raw material item
interface RawMaterial {
  id?: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  lowStockThreshold: number;
  type: 'raw-material';
  costPerUnit: number;
  inventoryValue: number;
  isActive: boolean;
}

@Component({
  selector: 'app-add-raw-material',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, TitleCasePipe],
  templateUrl: './add-raw-material.component.html',
  styleUrls: ['./add-raw-material.component.css']
})
export class AddRawMaterialComponent implements OnInit {
  isEditMode: boolean = false;
  rawMaterial: RawMaterial = {
    name: '',
    category: '',
    stock: 0,
    unit: '',
    lowStockThreshold: 10,
    type: 'raw-material',
    costPerUnit: 0,
    inventoryValue: 0,
    isActive: true
  };

  availableCategories: string[] = [];
  newCategory: string = '';
  showNewCategoryInput: boolean = false;

  readonly availableUnits: string[] = ['kg', 'g', 'L', 'ml', 'unit', 'box'];

  storeSlug: string = '';

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    // ✅ Resolve storeSlug from root params
    const root = this.route.snapshot.root;
    const slug = root.firstChild?.paramMap.get('storeSlug');
    this.storeSlug = slug || '';
    console.log('AddRawMaterial storeSlug:', this.storeSlug);

    this.loadCategories();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.loadRawMaterial(id);
    }
  }

  /** ✅ Load categories from `stores/{storeSlug}/rawMaterials` */
  loadCategories() {
    const rawMatCollection = collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`);
    collectionData(query(rawMatCollection, orderBy('category', 'asc')), { idField: 'id' })
      .pipe(
        map((items: any[]) =>
          Array.from(new Set(items.map(item => item.category))).filter(Boolean)
        )
      )
      .subscribe(categories => {
        this.availableCategories = categories;
      });
  }

  /** ✅ Fetch raw material by ID from store-specific collection */
  async loadRawMaterial(id: string) {
    const docRef = doc(this.firestore, `Stores/${this.storeSlug}/rawMaterials/${id}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      this.rawMaterial = { id: docSnap.id, ...(docSnap.data() as RawMaterial) };
    } else {
      console.error('Raw material not found.');
      this.router.navigate([`/${this.storeSlug}/inventory/raw-materials`]);
    }
  }

  /** ✅ Save or update raw material in store-specific collection */
  async saveRawMaterial() {
    if (this.showNewCategoryInput && this.newCategory) {
      this.rawMaterial.category = this.newCategory.trim();
    }

    if (!this.rawMaterial.name || !this.rawMaterial.category) {
      console.error('Name, Category, and Stock are required.');
      return;
    }

    // Auto-calc inventory value
    this.rawMaterial.inventoryValue =
      this.rawMaterial.stock * (this.rawMaterial.costPerUnit || 0);

    const collectionRef = collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`);

    try {
      if (this.isEditMode && this.rawMaterial.id) {
        const docRef = doc(collectionRef, this.rawMaterial.id);
        await updateDoc(docRef, this.rawMaterial as any);
        console.log('Raw material updated successfully!');
      } else {
        const newDocRef = doc(collectionRef);
        await setDoc(newDocRef, this.rawMaterial as any);
        console.log('Raw material added successfully!');
      }

      // ✅ Navigate back including storeSlug
      this.router.navigate([`/${this.storeSlug}/inventory/raw-materials`]);
    } catch (e) {
      console.error('Error saving raw material:', e);
    }
  }
}
