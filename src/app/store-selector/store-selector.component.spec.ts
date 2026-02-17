import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StoreSelectorComponent } from './store-selector.component';

describe('StoreSelectorComponent', () => {
  let component: StoreSelectorComponent;
  let fixture: ComponentFixture<StoreSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StoreSelectorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StoreSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
