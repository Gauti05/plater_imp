import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, query, getDocs } from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage'; 
import { ActivatedRoute } from '@angular/router';

interface ItemGroup {
  id?: string;
  name: string;
  type: 'Basic' | 'Time-Based' | 'Smart' | 'Diet' | 'Fixed-Combo' | 'BYO-Combo' | 'Conditional' | 'QR-Driven';
  itemIds: string[];
  isActive: boolean;
  config?: any;
  imageUrl?: string; 
}

@Component({
  selector: 'app-item-group-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-group-list.component.html',
  styleUrls: ['./item-group-list.component.css']
})
export class ItemGroupListComponent implements OnInit {
  private firestore = inject(Firestore);
  private storage = inject(Storage); 
  private route = inject(ActivatedRoute);

  storeSlug = '';
  itemGroups: ItemGroup[] = [];
  menuItems: any[] = [];
  
  showModal = false;
  isUploadingImage = false; 
  editingGroup: ItemGroup = this.defaultGroup();

  groupTypes = [
    { id: 'Basic', label: 'Basic Group', desc: 'Manual category management' },
    { id: 'Time-Based', label: 'Time Based', desc: 'Appears during specific hours' },
    { id: 'Smart', label: 'Smart Group', desc: 'Dynamic (e.g. Best Sellers)' },
    { id: 'Diet', label: 'Diet/Preference', desc: 'Veg, Non-Veg, etc.' },
    { id: 'Fixed-Combo', label: 'Fixed Combo', desc: 'Set bundle at fixed price' },
    { id: 'BYO-Combo', label: 'Build Your Own', desc: 'Pick X from Category Y' },
    { id: 'Conditional', label: 'Conditional', desc: 'Buy X get Y deals' },
    { id: 'QR-Driven', label: 'QR Driven', desc: 'Visible only on QR menu' }
  ];

  ngOnInit() {
    this.route.root.firstChild?.paramMap.subscribe(params => {
      this.storeSlug = params.get('storeSlug') || '';
      if (this.storeSlug) {
        this.loadGroups();
        this.loadMenuItems();
      }
    });
  }

  // ⭐ FIXED: Initialize the advanced config structure so checkboxes and inputs bind correctly
  defaultGroup(): ItemGroup {
    return { 
      name: '', 
      type: 'Basic', 
      itemIds: [], 
      isActive: true, 
      config: { byoMode: 'simple', allowEntireMenu: false, steps: [] }, 
      imageUrl: '' 
    };
  }

  loadGroups() {
    const ref = collection(this.firestore, `Stores/${this.storeSlug}/itemGroups`);
    collectionData(ref, { idField: 'id' }).subscribe(data => {
      this.itemGroups = data as ItemGroup[];
    });
  }

  async loadMenuItems() {
    const snap = await getDocs(collection(this.firestore, `Stores/${this.storeSlug}/menuItems`));
    this.menuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  openCreateModal(group?: ItemGroup) {
    this.editingGroup = group ? JSON.parse(JSON.stringify(group)) : this.defaultGroup();
    // Safety check for old groups lacking the new structure
    if (!this.editingGroup.config) this.editingGroup.config = {};
    if (this.editingGroup.type === 'BYO-Combo') {
      this.editingGroup.config.byoMode = this.editingGroup.config.byoMode || 'simple';
      this.editingGroup.config.allowEntireMenu = !!this.editingGroup.config.allowEntireMenu;
      this.editingGroup.config.steps = this.editingGroup.config.steps || [];
    }
    this.showModal = true;
  }

  // ⭐ NEW: Controls whether to show the default bottom item list based on the BYO mode
  showDefaultSelectionEngine(): boolean {
    const type = this.editingGroup.type;
    if (type === 'Smart' || type === 'Diet') return false;
    if (type === 'BYO-Combo') {
      if (this.editingGroup.config?.allowEntireMenu) return false;
      if (this.editingGroup.config?.byoMode === 'steps') return false;
    }
    return true;
  }

  // ⭐ NEW: Step management methods
  addBYOStep() {
    if (!this.editingGroup.config.steps) this.editingGroup.config.steps = [];
    this.editingGroup.config.steps.push({ name: '', selectionCount: 1, itemIds: [] });
  }

  removeBYOStep(index: number) {
    this.editingGroup.config.steps.splice(index, 1);
  }

  toggleBYOStepItem(stepIndex: number, itemId: string) {
    const step = this.editingGroup.config.steps[stepIndex];
    if (!step.itemIds) step.itemIds = [];
    const idx = step.itemIds.indexOf(itemId);
    if (idx > -1) step.itemIds.splice(idx, 1);
    else step.itemIds.push(itemId);
  }

  toggleItemSelection(itemId: string) {
    const index = this.editingGroup.itemIds.indexOf(itemId);
    if (index > -1) this.editingGroup.itemIds.splice(index, 1);
    else this.editingGroup.itemIds.push(itemId);
  }

  async uploadComboImage(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isUploadingImage = true;
    try {
      const filePath = `Stores/${this.storeSlug}/combos/${Date.now()}_${file.name}`;
      const storageRef = ref(this.storage, filePath);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      this.editingGroup.imageUrl = url;
    } catch (error) {
      console.error("Error uploading image: ", error);
      alert("Failed to upload image. Please check your Firebase Storage rules.");
    }
    this.isUploadingImage = false;
  }

  async saveGroup() {
    if (!this.editingGroup.name) {
      alert("Please enter a group name.");
      return;
    }

    // ⭐ FIXED: Skip validation for auto groups AND dynamic BYO groups
    const type = this.editingGroup.type;
    const isAutoGroup = type === 'Smart' || type === 'Diet';
    const isEntireMenuBYO = type === 'BYO-Combo' && this.editingGroup.config?.allowEntireMenu;
    const isStepsBYO = type === 'BYO-Combo' && this.editingGroup.config?.byoMode === 'steps';
    
    if (!isAutoGroup && !isEntireMenuBYO && !isStepsBYO && this.editingGroup.itemIds.length === 0) {
      alert("Please select at least one item for this group.");
      return;
    }

    const colRef = collection(this.firestore, `Stores/${this.storeSlug}/itemGroups`);
    const id = this.editingGroup.id || doc(collection(this.firestore, 'temp')).id;
    
    await setDoc(doc(colRef, id), { ...this.editingGroup, id: id }, { merge: true });
    this.showModal = false;
  }

  async deleteGroup(id: string) {
    if (confirm("Delete this group?")) {
      await deleteDoc(doc(this.firestore, `Stores/${this.storeSlug}/itemGroups`, id));
    }
  }
}