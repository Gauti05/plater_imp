import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddRawMaterialComponent } from './add-raw-material.component';

describe('AddRawMaterialComponent', () => {
  let component: AddRawMaterialComponent;
  let fixture: ComponentFixture<AddRawMaterialComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddRawMaterialComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddRawMaterialComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
