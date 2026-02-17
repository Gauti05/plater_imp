import { Component, OnInit, AfterViewInit, NgZone, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Loader } from '@googlemaps/js-api-loader';


@Component({
  selector: 'app-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add.component.html',
  styleUrl: './add.component.css',
  encapsulation: ViewEncapsulation.None

})
export class AddComponent {
  storeId = '';
  loading = false;

  customer: any = {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    apartment: '',
    city: '',
    state: '',
    pin: '',
    source: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
   
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    const slug = this.route.parent?.parent?.snapshot.paramMap.get('slug');
    if (!slug) {
      alert('Invalid store ID');
      return;
    }
    this.storeId = slug;
  }

  ngAfterViewInit(): void {
    const loader = new Loader({
      apiKey: 'AIzaSyAQuZFJy-7WEHUGAv31PTUPf99rDdxDn20',
      libraries: ['places']
    });

    loader.load().then(() => {
      const input = document.getElementById('autocomplete') as HTMLInputElement;
      if (input) {
        const autocomplete = new google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: 'in' }
        });

        autocomplete.addListener('place_changed', () => {
          this.ngZone.run(() => {
            const place = autocomplete.getPlace();
            if (place.address_components) {
              const parsed = this.parseAddressComponents(place.address_components);

              const partialAddress = [
                parsed.premise,
                parsed.subpremise,
                parsed.sublocality,
                parsed.route,
                parsed.streetNumber,
              ].filter(Boolean).join(', ').trim();

              this.customer.address = partialAddress;
              this.customer.apartment = parsed.apartment;
              this.customer.city = parsed.city;
              this.customer.state = parsed.state;
              this.customer.pin = parsed.postalCode;
            }
          });
        });
      }
    });
  }

  parseAddressComponents(components: google.maps.GeocoderAddressComponent[]) {
    const address: any = {
      streetNumber: '',
      route: '',
      sublocality: '',
      premise: '',
      subpremise: '',
      apartment: '',
      city: '',
      state: '',
      postalCode: ''
    };

    for (const component of components) {
      const types = component.types;
      if (types.includes('street_number')) address.streetNumber = component.long_name;
      if (types.includes('route')) address.route = component.long_name;
      if (types.includes('sublocality') || types.includes('sublocality_level_1')) address.sublocality = component.long_name;
      if (types.includes('premise')) address.premise = component.long_name;
      if (types.includes('subpremise')) address.subpremise = component.long_name;
      if (types.includes('locality')) address.city = component.long_name;
      if (types.includes('administrative_area_level_1')) address.state = component.long_name;
      if (types.includes('postal_code')) address.postalCode = component.long_name;
    }

    address.apartment = address.sublocality || address.subpremise || address.premise;
    return address;
  }

  async saveCustomer() {
    if (!this.customer.firstName || !this.customer.phone || !this.customer.email) {
      // this.toast.show('Please fill all required fields', 'error');
      return;
    }

    this.loading = true;
    const id = uuidv4();
    const docRef = doc(this.firestore, `stores/${this.storeId}/customers/${id}`);
    try {
      await setDoc(docRef, {
        ...this.customer,
        createdAt: new Date()
      });
      // this.toast.show('Customer added successfully', 'success');
      this.router.navigate([`/stores/${this.storeId}/crm`]);
    } catch (err) {
      // this.toast.show('Error saving customer', 'error');
    }
    this.loading = false;
  }
}
