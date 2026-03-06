import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BrandBannerComponent } from './brand-banner.component.js';

describe('BrandBannerComponent', () => {
  let fixture: ComponentFixture<BrandBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandBannerComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(BrandBannerComponent);
    fixture.detectChanges();
  });

  it('renders logo and mascot with defaults', () => {
    const anchor = fixture.nativeElement.querySelector('a');
    expect(anchor?.getAttribute('aria-label')).toBe('Back to EcoCut home via EcoCut branding');
    const images = fixture.nativeElement.querySelectorAll('img');
    expect(images.length).toBe(2);
    expect(images[0].getAttribute('src')).toContain('eco-logo');
  });

  it('falls back to placeholder when mascot fails to load', () => {
    const mascot: HTMLImageElement = fixture.nativeElement.querySelector('.brand-banner__mascot');
    expect(mascot).toBeTruthy();
    mascot.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(mascot.getAttribute('src')).toContain('mascot-placeholder');
  });

  it('hides the mascot block when disabled', () => {
    fixture.componentRef.setInput('showMascot', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.brand-banner__mascot')).toBeFalsy();
  });

  it('updates mascot src when input changes', () => {
    fixture.componentRef.setInput('mascotSrc', 'assets/brand/new.png');
    fixture.detectChanges();
    const mascot: HTMLImageElement = fixture.nativeElement.querySelector('.brand-banner__mascot');
    expect(mascot.getAttribute('src')).toContain('new.png');
  });

  it('falls back to default mascot when provided value is empty', () => {
    fixture.componentRef.setInput('mascotSrc', '   ');
    fixture.detectChanges();
    const mascot: HTMLImageElement = fixture.nativeElement.querySelector('.brand-banner__mascot');
    expect(mascot.getAttribute('src')).toContain('eco-mascot');
  });
});
