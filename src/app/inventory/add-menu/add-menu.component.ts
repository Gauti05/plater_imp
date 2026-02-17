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
  query,
  orderBy,
  getDocs,
  where,
  limit,
} from '@angular/fire/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject 
} from '@angular/fire/storage';
import { NgxImageCompressService } from 'ngx-image-compress'; 

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
  // 👇 NEW: Tax rate property
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
    // 👇 NEW: Default tax rate
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
    
    await this.loadCategories(); 
    await this.loadRawMaterials();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      await this.loadMenuItem(id); 
    }
  }

  /* ---------------- Categories ---------------- */
  private async seedCategoriesFromMenuItems(): Promise<void> {
      const menuCol = collection(this.firestore, `Stores/${this.storeSlug}/menuItems`);
      const catCol = collection(this.firestore, `Stores/${this.storeSlug}/menuCategories`);

      const menuSnapshot = await getDocs(menuCol);
      const uniqueMenuCategories = Array.from(new Set(
          menuSnapshot.docs
              .map(d => (d.data() as MenuItem).category)
              .filter(cat => !!cat)
      ));

      if (uniqueMenuCategories.length === 0) return;

      const existingCategoriesSnapshot = await getDocs(catCol);
      const existingCategoryNames = existingCategoriesSnapshot.docs
          .map(d => d.data()['name']);

      const categoriesToSeed = uniqueMenuCategories.filter(cat => 
          !existingCategoryNames.includes(cat)
      );

      if (categoriesToSeed.length > 0) {
          for (const categoryName of categoriesToSeed) {
              const newDocRef = doc(catCol);
              await setDoc(newDocRef, { name: categoryName });
          }
      }
  }
  
  async loadCategories(): Promise<void> {
    const categoryCollection = collection(this.firestore, `Stores/${this.storeSlug}/menuCategories`);
    
    const querySnapshot = await getDocs(query(categoryCollection, orderBy('name', 'asc')));

    const categories = querySnapshot.docs
        .map(d => d.data()['name'])
        .filter(name => !!name);

    this.availableCategories = Array.from(new Set(categories));
    
    if (!this.isEditMode) {
      this.menuItem.category = '';
    }
  }

  async saveNewCategory() {
    if (!this.newCategory.trim()) return;
    const categoryCollection = collection(this.firestore, `Stores/${this.storeSlug}/menuCategories`);
    const newDocRef = doc(categoryCollection);
    
    await setDoc(newDocRef, { name: this.newCategory.trim() });
    
    const newCatName = this.newCategory.trim();
    if (!this.availableCategories.includes(newCatName)) {
        this.availableCategories = [...this.availableCategories, newCatName].sort();
    }
    
    this.menuItem.category = newCatName;
    
    this.newCategory = '';
    this.showNewCategoryInput = false;
  }
 
  /* ---------------- Raw Materials ---------------- */
  async loadRawMaterials() {
    const rawMaterialCollection = collection(this.firestore, `Stores/${this.storeSlug}/rawMaterials`);
    const q = query(rawMaterialCollection, orderBy('name', 'asc'));
    const querySnapshot = await getDocs(q);
    this.availableRawMaterials = querySnapshot.docs.map(d => ({
      id: d.id,
      name: d.data()['name'],
      unit: d.data()['unit'],
      costPerUnit: d.data()['costPerUnit'] || 0,
      stock: d.data()['stock'] || 0
    }));
  }

  /* ---------------- Load Existing ---------------- */
  async loadMenuItem(id: string) {
    const docRef = doc(this.firestore, `Stores/${this.storeSlug}/menuItems/${id}`);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      console.error('Menu item not found.');
      this.router.navigate(['/', this.storeSlug, 'inventory', 'menu-items']);
      return;
    }

    const data = snap.data() as MenuItem;
    this.menuItem = { id: snap.id, ...data };
    
    if (this.menuItem.imageUrl) {
      this.imagePreviewUrl = this.menuItem.imageUrl;
      const url = new URL(this.menuItem.imageUrl);
      this.imageStoragePath = url.pathname; 
    }

    // Ensure taxRate is set to 0 if it was missing in old data
    if (this.menuItem.taxRate === undefined || this.menuItem.taxRate === null) {
      this.menuItem.taxRate = 0;
    }

    this.calculateTotalServings();
  }

  /* ---------------- Image Upload & Compression ---------------- */
  private dataURItoBlob(dataURI: string, fileName: string): File {
    const split = dataURI.split(',');
    const mime = split[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const byteString = atob(split[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }

    const blob = new Blob([ab], { type: mime });
    return new File([blob], fileName, { type: mime });
  }

  async uploadImageToStorage(file: File, name: string): Promise<string> {
    const storage = getStorage();
    const fileName = `${name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.jpg`;
    const storageRef = ref(storage, `menuImages/${this.storeSlug}/${fileName}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }

  handleImageChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    
    this.imageFile = null;
    this.imagePreviewUrl = null;
    this.imageStoragePath = null;
    this.menuItem.imageUrl = undefined;

    const reader = new FileReader();

    reader.onload = async (e: any) => {
      const imageBase64 = e.target.result;

      this.imageCompress.compressFile(imageBase64, -1, 50, 50, 800, 800).then(
        (compressedBase64: string) => {
          const compressedFile = this.dataURItoBlob(compressedBase64, file.name);

          this.imageFile = compressedFile;
          this.imagePreviewUrl = compressedBase64;
        },
        (error) => {
          console.error('Image compression failed, uploading original:', error);
          this.imageFile = file;
          this.imagePreviewUrl = imageBase64;
        }
      );
    };

    reader.readAsDataURL(file);
  }
  
  removeImage() {
    this.imageFile = null;
    this.imagePreviewUrl = null;
    this.menuItem.imageUrl = undefined; 
    
    this.imageStoragePath = null;
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }


  /* ---------------- Unit Conversion Logic ---------------- */

  getDisplayUnit(baseUnit: string): string {
    const unit = baseUnit.toLowerCase();
    const conversion = this.unitConversionMap[unit];

    if (conversion) {
      return conversion[0];
    }

    return baseUnit;
  }

  convertToBaseUnit(baseUnit: string, quantityInDisplayUnit: number): number {
    const unit = baseUnit.toLowerCase();
    const conversion = this.unitConversionMap[unit];

    if (conversion) {
      const factor = conversion[1];
      return factor > 0 ? quantityInDisplayUnit / factor : quantityInDisplayUnit;
    }

    return quantityInDisplayUnit;
  }

  convertToDisplayUnit(baseUnit: string, quantityInBaseUnit: number): number {
    const unit = baseUnit.toLowerCase();
    const conversion = this.unitConversionMap[unit];

    if (conversion) {
      const factor = conversion[1];
      return quantityInBaseUnit * factor;
    }

    return quantityInBaseUnit;
  }

  onRawMaterialSelect() {
    const selected = this.availableRawMaterials.find(rm => rm.id === this.selectedRawMaterialId);
    this.selectedDisplayUnit = selected ? this.getDisplayUnit(selected.unit) : '';
  }

  /* ---------------- Save Menu Item ---------------- */
  async saveMenuItem() {
    if (this.showNewCategoryInput && this.newCategory) {
      await this.saveNewCategory(); 
    }

    if (!this.menuItem.name || !this.menuItem.category || this.menuItem.price <= 0) {
      console.error('Required fields missing');
      return;
    }

    this.isSaving = true;

    try {
      if (this.imageFile) {
        this.menuItem.imageUrl = await this.uploadImageToStorage(this.imageFile, this.menuItem.name);
      } else if (this.menuItem.imageUrl === undefined) {
        this.menuItem.imageUrl = ''; 
      }

      const col = collection(this.firestore, `Stores/${this.storeSlug}/menuItems`);
      if (this.isEditMode && this.menuItem.id) {
        await updateDoc(doc(col, this.menuItem.id), this.menuItem as any);
      } else {
        await setDoc(doc(col), this.menuItem as any);
      }

      setTimeout(() => {
        this.isSaving = false;
        this.router.navigate(['/', this.storeSlug, 'inventory', 'menu-items']);
      }, 1000);
    } catch (e) {
      console.error('Save error:', e);
      this.isSaving = false;
    }
  }

  /* ---------------- Allergens ---------------- */
  toggleAllergen(a: string) {
    const arr = this.menuItem.allergens || [];
    const i = arr.indexOf(a);
    i > -1 ? arr.splice(i, 1) : arr.push(a);
    this.menuItem.allergens = arr;
  }

  isAllergenSelected(a: string): boolean {
    return this.menuItem.allergens?.includes(a) || false;
  }

  /* ---------------- Recipe ---------------- */
  addIngredientToRecipe() {
    if (!this.selectedRawMaterialId || this.recipeQuantity <= 0) return;

    const mat = this.availableRawMaterials.find(r => r.id === this.selectedRawMaterialId);
    if (!mat) return;

    if (!this.menuItem.recipe) this.menuItem.recipe = [];

    const baseQtyToAdd = this.convertToBaseUnit(mat.unit, this.recipeQuantity);

    const existing = this.menuItem.recipe.find(r => r.rawMaterialId === mat.id);

    if (existing) {
      existing.quantity += baseQtyToAdd;
    } else {
      this.menuItem.recipe.push({
        rawMaterialId: mat.id,
        name: mat.name,
        quantity: baseQtyToAdd, 
        unit: mat.unit
      });
    }

    this.selectedRawMaterialId = '';
    this.recipeQuantity = 0;
    this.selectedDisplayUnit = '';
    this.calculateTotalServings();
  }

  removeIngredientFromRecipe(i: number) {
    this.menuItem.recipe?.splice(i, 1);
    this.calculateTotalServings();
  }

  /* ---------------- Calculations ---------------- */
  get totalPlateCost(): number {
    return (
      this.menuItem.recipe?.reduce((sum, ing) => {
        const mat = this.availableRawMaterials.find(r => r.id === ing.rawMaterialId);
        return sum + (mat ? mat.costPerUnit * ing.quantity : 0);
      }, 0) || 0
    );
  }

  /**
   * 👇 RENAMED: Calculates the recommended price EXCLUDING tax based on target margin.
   */
  get recommendedBaseSellingPrice(): number {
    const margin = this.targetProfitMargin / 100;
    const basePrice = this.totalPlateCost / (1 - margin);
    return isNaN(basePrice) || !isFinite(basePrice) ? 0 : basePrice;
  }

  /**
   * 👇 NEW: Calculates the final price INCLUDING tax.
   */
  get recommendedSellingPriceWithTax(): number {
    const basePrice = this.recommendedBaseSellingPrice;
    const taxRate = (this.menuItem.taxRate || 0) / 100;
    // Price Incl. Tax = Base Price * (1 + Tax Rate)
    const priceWithTax = basePrice * (1 + taxRate);
    return isNaN(priceWithTax) || !isFinite(priceWithTax) ? 0 : priceWithTax;
  }

  // OLD GETTER: Aliased to the new price-with-tax getter to update the Price input hint.
  // Note: This relies on the original HTML binding being `recommendedSellingPrice`
  get recommendedSellingPrice(): number {
    return this.recommendedSellingPriceWithTax;
  }
  
  calculateTotalServings() {
    if (!this.menuItem.trackInventory) {
      this.totalServingsInInventory = this.INF;
      return;
    }
    if (!this.menuItem.recipe?.length) {
      this.totalServingsInInventory = 0;
      return;
    }

    let max = this.INF;
    for (const ing of this.menuItem.recipe) {
      const mat = this.availableRawMaterials.find(r => r.id === ing.rawMaterialId);

      if (mat && ing.quantity > 0) {
        const s = Math.floor(mat.stock / ing.quantity);
        if (s < max) max = s;
      } else {
        max = 0;
        break;
      }
    }
    this.totalServingsInInventory = max;
  }
}