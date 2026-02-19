import { Component, OnInit, inject } from '@angular/core';
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
  query,
  orderBy,
  getDocs,
  where,
  documentId,
} from '@angular/fire/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from '@angular/fire/storage';
import { NgxImageCompressService } from 'ngx-image-compress'; 
import { Auth, authState } from '@angular/fire/auth'; 

interface MenuItem {
  id?: string;
  name: string;
  category: string;
  price: number;
  type: 'menu-item';
  allergens?: string[];
  recipe?: { rawMaterialId: string; name: string; quantity: number; unit: string }[];
  isActive: boolean;
  imageUrl?: string;
  trackInventory: boolean;
  taxRate?: number; 
}

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  stock: number;
}

@Component({
  selector: 'app-add-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, TitleCasePipe],
  templateUrl: './add-menu.component.html',
  styleUrls: ['./add-menu.component.css']
})
export class AddMenuComponent implements OnInit {
  private fireAuth = inject(Auth); 
  isEditMode = false;
  isSaving = false;
  isSyncingCategories = false; 

  menuItem: MenuItem = {
    name: '',
    category: '',
    price: 0,
    type: 'menu-item',
    allergens: [],
    recipe: [],
    isActive: true,
    trackInventory: true,
    taxRate: 0 
  };

  availableCategories: string[] = [];
  newCategory = '';
  showNewCategoryInput = false;

  availableRawMaterials: RawMaterial[] = [];
  selectedRawMaterialId = '';
  recipeQuantity = 0;
  selectedDisplayUnit = '';

  readonly commonAllergens = ['Dairy', 'Eggs', 'Nuts', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Gluten'];
  readonly INF = Infinity;

  targetProfitMargin = 50;
  imageFile: File | null = null;
  imagePreviewUrl: string | ArrayBuffer | null = null;
  private imageStoragePath: string | null = null; 

  totalServingsInInventory = 0;
  storeSlug = '';

  publishToAll = false;
  allStoreSlugs: string[] = [];

  private readonly unitConversionMap: { [key: string]: [string, number] } = {
    'kg': ['g', 1000],
    'kilogram': ['g', 1000],
    'litre': ['ml', 1000],
    'liter': ['ml', 1000],
    'dozen': ['piece', 12],
    'box': ['unit', 1],
    'g': ['g', 1],
    'ml': ['ml', 1],
    'unit': ['unit', 1],
    'piece': ['piece', 1],
    'l': ['ml', 1000]
  };

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private firestore: Firestore,
    private imageCompress: NgxImageCompressService 
  ) {}

  async ngOnInit(): Promise<void> {
    const root = this.route.snapshot.root;
    const slug = root.firstChild?.paramMap.get('storeSlug');
    this.storeSlug = slug || '';
    
    // ⭐ THE FIX: Fetch the user's actual stores to sync to, instead of locking behind Superadmin
    authState(this.fireAuth).subscribe(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(this.firestore, `Users/${user.uid}`));
        const userData = userDoc.data();
        if (userData) {
          await this.loadAllStores(user.uid, userData['storeId'], userData['userRole']); 
        }
      }
    });

    await this.loadCategories(); 
    await this.loadRawMaterials();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      await this.loadMenuItem(id); 
    }
  }

  // ⭐ THE FIX: Properly gather all branches belonging to this SaaS user
  async loadAllStores(uid: string, assignedStoreId: string, role: string) {
    const storesRef = collection(this.firestore, 'Stores');
    
    if (role === 'Superadmin') {
      const storesSnap = await getDocs(storesRef);
      this.allStoreSlugs = storesSnap.docs.map(d => d.data()['slug'] || d.id);
    } else {
      // Gather assigned store + owned stores (Same fix applied to store selector)
      const qAssigned = getDocs(query(storesRef, where(documentId(), '==', assignedStoreId || '')));
      const qOwned = getDocs(query(storesRef, where('ownerId', '==', uid)));

      const [snapAssigned, snapOwned] = await Promise.all([qAssigned, qOwned]);
      
      const allDocs = [...snapAssigned.docs, ...snapOwned.docs];
      const uniqueSlugs = Array.from(new Set(allDocs.map(d => d.data()['slug'] || d.id)));
      
      this.allStoreSlugs = uniqueSlugs;
    }
  }

  async loadCategories(): Promise<void> {
    const categoryCollection = collection(this.firestore, `Stores/${this.storeSlug}/menuCategories`);
    const querySnapshot = await getDocs(query(categoryCollection, orderBy('name', 'asc')));
    this.availableCategories = querySnapshot.docs.map(d => d.data()['name']).filter(name => !!name);
  }

  async saveNewCategory() {
    if (!this.newCategory.trim()) return;
    const categoryCollection = collection(this.firestore, `Stores/${this.storeSlug}/menuCategories`);
    await setDoc(doc(categoryCollection), { name: this.newCategory.trim() });
    const newCatName = this.newCategory.trim();
    if (!this.availableCategories.includes(newCatName)) {
        this.availableCategories = [...this.availableCategories, newCatName].sort();
    }
    this.menuItem.category = newCatName;
    this.newCategory = '';
    this.showNewCategoryInput = false;
  }
 
  async loadRawMaterials() {
    const rawMaterialCollection = collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`);
    const querySnapshot = await getDocs(query(rawMaterialCollection, orderBy('name', 'asc')));
    this.availableRawMaterials = querySnapshot.docs.map(d => ({
      id: d.id,
      name: d.data()['name'],
      unit: d.data()['unit'],
      costPerUnit: d.data()['costPerUnit'] || 0,
      stock: d.data()['stock'] || 0
    }));
  }

  async loadMenuItem(id: string) {
    const docRef = doc(this.firestore, `Stores/${this.storeSlug}/menuItems/${id}`);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      this.router.navigate(['/', this.storeSlug, 'inventory', 'menu-items']);
      return;
    }
    this.menuItem = { id: snap.id, ...snap.data() as MenuItem };
    if (this.menuItem.imageUrl) this.imagePreviewUrl = this.menuItem.imageUrl;
    this.calculateTotalServings();
  }

  async saveMenuItem() {
    if (this.showNewCategoryInput && this.newCategory) await this.saveNewCategory(); 
    if (!this.menuItem.name || !this.menuItem.category || this.menuItem.price <= 0) return;

    this.isSaving = true;
    try {
      if (this.imageFile) {
        this.menuItem.imageUrl = await this.uploadImageToStorage(this.imageFile, this.menuItem.name);
      }

      const itemId = this.menuItem.id || doc(collection(this.firestore, `temp`)).id;
      this.menuItem.id = itemId;

      // ⭐ Sync logic is now active for normal users!
      if (this.publishToAll && this.allStoreSlugs.length > 0) {
        const savePromises = this.allStoreSlugs.map(async (slug) => {
          // 1. Make sure the category exists in the other store
          const catRef = collection(this.firestore, `Stores/${slug}/menuCategories`);
          const catCheck = await getDocs(query(catRef, where('name', '==', this.menuItem.category)));
          if (catCheck.empty) await setDoc(doc(catRef, doc(collection(this.firestore, 'temp')).id), { name: this.menuItem.category });
          
          // 2. Save the menu item
          const colRef = collection(this.firestore, `Stores/${slug}/menuItems`);
          return setDoc(doc(colRef, itemId), this.menuItem as any, { merge: true });
        });
        await Promise.all(savePromises);
      } else {
        const colRef = collection(this.firestore, `Stores/${this.storeSlug}/menuItems`);
        await setDoc(doc(colRef, itemId), this.menuItem as any, { merge: true });
      }

      this.isSaving = false;
      this.router.navigate(['/', this.storeSlug, 'inventory', 'menu-items']);
    } catch (e) {
      console.error('Save error:', e);
      this.isSaving = false;
    }
  }

  addIngredientToRecipe() {
    if (!this.selectedRawMaterialId || this.recipeQuantity <= 0) return;
    const mat = this.availableRawMaterials.find(r => r.id === this.selectedRawMaterialId);
    if (!mat) return;
    const baseQtyToAdd = this.convertToBaseUnit(mat.unit, this.recipeQuantity);
    const existing = this.menuItem.recipe?.find(r => r.rawMaterialId === mat.id);
    if (existing) {
      existing.quantity += baseQtyToAdd;
    } else {
      if (!this.menuItem.recipe) this.menuItem.recipe = [];
      this.menuItem.recipe.push({ rawMaterialId: mat.id, name: mat.name, quantity: baseQtyToAdd, unit: mat.unit });
    }
    this.selectedRawMaterialId = ''; this.recipeQuantity = 0;
    this.calculateTotalServings();
  }

  removeIngredientFromRecipe(i: number) {
    this.menuItem.recipe?.splice(i, 1);
    this.calculateTotalServings();
  }

  handleImageChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imageCompress.compressFile(e.target.result, -1, 50, 50, 800, 800).then(
        (compressed) => {
          this.imageFile = this.dataURItoBlob(compressed, file.name);
          this.imagePreviewUrl = compressed;
        }
      );
    };
    reader.readAsDataURL(file);
  }

  private dataURItoBlob(dataURI: string, fileName: string): File {
    const split = dataURI.split(',');
    const byteString = atob(split[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new File([ab], fileName, { type: split[0].match(/:(.*?);/)?.[1] || 'image/jpeg' });
  }

  async uploadImageToStorage(file: File, name: string): Promise<string> {
    const storage = getStorage();
    const storageRef = ref(storage, `menuImages/central/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  removeImage() {
    this.imageFile = null; this.imagePreviewUrl = null; delete this.menuItem.imageUrl;
  }

  getDisplayUnit(baseUnit: string): string {
    return this.unitConversionMap[baseUnit.toLowerCase()]?.[0] || baseUnit;
  }

  convertToBaseUnit(baseUnit: string, qty: number): number {
    const factor = this.unitConversionMap[baseUnit.toLowerCase()]?.[1] || 1;
    return qty / factor;
  }

  convertToDisplayUnit(baseUnit: string, qty: number): number {
    const factor = this.unitConversionMap[baseUnit.toLowerCase()]?.[1] || 1;
    return qty * factor;
  }

  onRawMaterialSelect() {
    const selected = this.availableRawMaterials.find(rm => rm.id === this.selectedRawMaterialId);
    this.selectedDisplayUnit = selected ? this.getDisplayUnit(selected.unit) : '';
  }

  get totalPlateCost(): number {
    return this.menuItem.recipe?.reduce((sum, ing) => {
      const mat = this.availableRawMaterials.find(r => r.id === ing.rawMaterialId);
      return sum + (mat ? mat.costPerUnit * ing.quantity : 0);
    }, 0) || 0;
  }

  get recommendedBaseSellingPrice(): number {
    const margin = this.targetProfitMargin / 100;
    const basePrice = this.totalPlateCost / (1 - margin);
    return isFinite(basePrice) ? basePrice : 0;
  }

  get recommendedSellingPriceWithTax(): number {
    const basePrice = this.recommendedBaseSellingPrice;
    const taxRate = (this.menuItem.taxRate || 0) / 100;
    return basePrice * (1 + taxRate);
  }

  calculateTotalServings() {
    if (!this.menuItem.trackInventory) { this.totalServingsInInventory = this.INF; return; }
    if (!this.menuItem.recipe?.length) { this.totalServingsInInventory = 0; return; }
    let max = this.INF;
    for (const ing of this.menuItem.recipe) {
      const mat = this.availableRawMaterials.find(r => r.id === ing.rawMaterialId);
      if (mat && ing.quantity > 0) {
        max = Math.min(max, Math.floor(mat.stock / ing.quantity));
      } else { max = 0; break; }
    }
    this.totalServingsInInventory = max;
  }

  toggleAllergen(a: string) {
    const arr = this.menuItem.allergens || [];
    const i = arr.indexOf(a);
    i > -1 ? arr.splice(i, 1) : arr.push(a);
    this.menuItem.allergens = arr;
  }

  isAllergenSelected(a: string): boolean { return this.menuItem.allergens?.includes(a) || false; }
}