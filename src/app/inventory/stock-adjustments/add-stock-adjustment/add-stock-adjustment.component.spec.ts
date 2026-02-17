import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddStockAdjustmentComponent } from './add-stock-adjustment.component';

describe('AddStockAdjustmentComponent', () => {
  let component: AddStockAdjustmentComponent;
  let fixture: ComponentFixture<AddStockAdjustmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddStockAdjustmentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddStockAdjustmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
