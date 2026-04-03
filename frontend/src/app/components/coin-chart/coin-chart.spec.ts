import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoinChart } from './coin-chart';

describe('CoinChart', () => {
  let component: CoinChart;
  let fixture: ComponentFixture<CoinChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoinChart]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoinChart);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
