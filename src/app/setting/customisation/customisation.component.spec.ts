import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomisationComponent } from './customisation.component';

describe('CustomisationComponent', () => {
  let component: CustomisationComponent;
  let fixture: ComponentFixture<CustomisationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomisationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomisationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
