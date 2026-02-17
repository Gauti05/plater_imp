import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs
} from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';

interface ModifierOption {
  label: string;
  price: number;
}
interface Modifier {
  id?: string;
  name: string;
  type: 'addon' | 'variation';
  options: ModifierOption[];
  associatedMenuItems: string[];
  isActive: boolean;
}

@Component({
  selector: 'app-add-modifier',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-modifier.component.html',
  styleUrls: ['./add-modifier.component.css']
})
export class AddModifierComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  public router = inject(Router);

  storeSlug: string = '';

  modifier: Modifier = {
    name: '',
    type: 'addon',
    options: [{ label: '', price: 0 }],
    associatedMenuItems: [],
    isActive: true
  };

  menuItems: { id: string; name: string }[] = [];
  filteredMenuItems: { id: string; name: string }[] = [];
  menuSearchTerm = '';
  isEditMode = false;

  statusMessage = '';
  statusType: 'success' | 'error' | '' = '';

 async ngOnInit() {
  // ✅ Resolve storeSlug from route or any parent route
  let route: ActivatedRoute | null = this.route;
  while (route) {
    const slug = route.snapshot.paramMap.get('storeSlug');
    if (slug) {
      this.storeSlug = slug;
      break;
    }
    route = route.parent;
  }

  if (!this.storeSlug) {
    console.error('❌ storeSlug not found in route hierarchy');
    return;
  }

  console.log('✅ Resolved storeSlug:', this.storeSlug);

  const id = this.route.snapshot.paramMap.get('id');
  this.isEditMode = !!id;

  // ✅ Fetch menu items
  const menuCol = collection(this.firestore, `Stores/${this.storeSlug}/menuItems`);
  const snap = await getDocs(menuCol);
  this.menuItems = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  this.filteredMenuItems = [...this.menuItems];

  // ✅ Load modifier if editing
  if (id) {
    const docRef = doc(this.firestore, `Stores/${this.storeSlug}/modifiers/${id}`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      this.modifier = { id: docSnap.id, ...(docSnap.data() as Modifier) };
    }
  }
}


  addOption() {
    this.modifier.options.push({ label: '', price: 0 });
  }

  removeOption(i: number) {
    this.modifier.options.splice(i, 1);
  }

  filterMenuItems() {
    const term = this.menuSearchTerm.toLowerCase();
    this.filteredMenuItems = this.menuItems.filter(m =>
      m.name.toLowerCase().includes(term)
    );
  }

  toggleMenuItem(menuId: string, checked: boolean) {
    if (checked) {
      if (!this.modifier.associatedMenuItems.includes(menuId)) {
        this.modifier.associatedMenuItems.push(menuId);
      }
    } else {
      this.modifier.associatedMenuItems = this.modifier.associatedMenuItems.filter(id => id !== menuId);
    }
  }

  async saveModifier() {
    const colRef = collection(this.firestore, `Stores/${this.storeSlug}/modifiers`);
    let modifierId: string;

    try {
      if (this.isEditMode && this.modifier.id) {
        modifierId = this.modifier.id;
        await updateDoc(doc(colRef, modifierId), this.modifier as any);
      } else {
        const newDocRef = doc(colRef);
        modifierId = newDocRef.id;
        await setDoc(newDocRef, { ...this.modifier, id: modifierId });
      }

      // 🔄 Sync modifiers inside menu items
      await this.syncMenuItems(modifierId);

      this.statusMessage = '✅ Modifier saved successfully!';
      this.statusType = 'success';
      setTimeout(() => (this.statusMessage = ''), 3000);

      // ✅ Redirect back with storeSlug
      this.router.navigate([`/${this.storeSlug}/inventory/modifiers`]);
    } catch (e) {
      console.error('Error saving modifier:', e);
      this.statusMessage = '❌ Error saving modifier!';
      this.statusType = 'error';
    }
  }

  private async syncMenuItems(modifierId: string) {
    const menuCol = collection(this.firestore, `Stores/${this.storeSlug}/menuItems`);

    // 1. Remove modifier from all menu items
    const snap = await getDocs(menuCol);
    for (const m of snap.docs) {
      const data = m.data();
      let modifiers = data['modifiers'] || [];
      if (modifiers.includes(modifierId)) {
        modifiers = modifiers.filter((id: string) => id !== modifierId);
        await updateDoc(doc(menuCol, m.id), { modifiers });
      }
    }

    // 2. Add modifier to selected menu items
    for (const menuId of this.modifier.associatedMenuItems) {
      const menuDocRef = doc(menuCol, menuId);
      const menuSnap = await getDoc(menuDocRef);
      if (menuSnap.exists()) {
        const menuData = menuSnap.data();
        const modifiers = menuData['modifiers'] || [];
        if (!modifiers.includes(modifierId)) {
          modifiers.push(modifierId);
          await updateDoc(menuDocRef, { modifiers });
        }
      }
    }
  }
}
