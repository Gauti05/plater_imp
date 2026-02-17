import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockAdjustmentListComponent } from './stock-adjustment-list.component';

describe('StockAdjustmentListComponent', () => {
  let component: StockAdjustmentListComponent;
  let fixture: ComponentFixture<StockAdjustmentListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockAdjustmentListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StockAdjustmentListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
