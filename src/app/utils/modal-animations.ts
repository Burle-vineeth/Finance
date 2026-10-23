import { Animation, createAnimation } from '@ionic/angular/standalone';

// Full-screen modals slide up from the bottom, and back down when closed, without fading.
// Ionic's default Android/desktop animation fades the modal in, and while it is half transparent the
// page behind shows through the form, which looks like a flicker.
export const slideUpEnter = (baseEl: HTMLElement): Animation => {
  const root = baseEl.shadowRoot!;

  const backdrop = createAnimation()
    .addElement(root.querySelector('ion-backdrop')!)
    .fromTo('opacity', '0.01', 'var(--backdrop-opacity)');

  const wrapper = createAnimation()
    .addElement(root.querySelector('.modal-wrapper')!)
    .fromTo('transform', 'translateY(100%)', 'translateY(0%)')
    .fromTo('opacity', '1', '1');

  return createAnimation()
    .addElement(baseEl)
    .easing('cubic-bezier(0.32, 0.72, 0, 1)')
    .duration(320)
    .addAnimation([backdrop, wrapper]);
};

export const slideDownLeave = (baseEl: HTMLElement): Animation => slideUpEnter(baseEl).direction('reverse');
