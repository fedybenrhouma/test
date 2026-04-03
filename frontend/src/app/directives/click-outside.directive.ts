import { Directive, HostListener, Output, EventEmitter, ElementRef } from '@angular/core';

@Directive({
  selector: '[clickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  public onClick(event: MouseEvent): void {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.clickOutside.emit();
    }
  }
}
