import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkUploadMenuComponent } from './bulk-upload-menu.component';

describe('BulkUploadMenuComponent', () => {
  let component: BulkUploadMenuComponent;
  let fixture: ComponentFixture<BulkUploadMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkUploadMenuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BulkUploadMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
