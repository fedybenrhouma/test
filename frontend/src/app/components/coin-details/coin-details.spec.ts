import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoinDetails } from './coin-details';

describe('CoinDetails', () => {
  let component: CoinDetails;
  let fixture: ComponentFixture<CoinDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinDetails]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoinDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
