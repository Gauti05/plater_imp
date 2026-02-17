import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiStudioComponent } from './ai-studio.component';

describe('AiStudioComponent', () => {
  let component: AiStudioComponent;
  let fixture: ComponentFixture<AiStudioComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiStudioComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiStudioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
