import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoyaltySettingsComponent } from './loyalty-settings.component';

describe('LoyaltySettingsComponent', () => {
  let component: LoyaltySettingsComponent;
  let fixture: ComponentFixture<LoyaltySettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoyaltySettingsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoyaltySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
