import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QrMenuComponent } from './qr-menu.component';

describe('QrMenuComponent', () => {
  let component: QrMenuComponent;
  let fixture: ComponentFixture<QrMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrMenuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QrMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
