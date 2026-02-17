import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoiceSlipComponent } from './invoice-slip.component';

describe('InvoiceSlipComponent', () => {
  let component: InvoiceSlipComponent;
  let fixture: ComponentFixture<InvoiceSlipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoiceSlipComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvoiceSlipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
