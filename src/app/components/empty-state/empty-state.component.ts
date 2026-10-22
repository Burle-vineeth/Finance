import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { folderOpenOutline } from 'ionicons/icons';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-container">
      <div class="empty-icon"><ion-icon [name]="icon"></ion-icon></div>
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
    </div>
  `,
  styles: [`
    .empty-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1rem;
      text-align: center;
      color: var(--app-text-2);

      .empty-icon {
        display: grid;
        place-items: center;
        width: 64px;
        height: 64px;
        margin-bottom: 1rem;
        border-radius: 20px;
        font-size: 28px;
        color: var(--app-text-3);
        background: var(--app-surface-2);
      }

      h3 {
        font-size: 1.05rem;
        font-weight: 700;
        margin: 0 0 0.35rem 0;
        color: var(--app-text);
      }

      p {
        font-size: 0.875rem;
        margin: 0;
      }
    }
  `],
  standalone: true,
  imports: [CommonModule, IonIcon]
})
export class EmptyStateComponent {
  @Input() icon: string = 'folder-open-outline';
  @Input() title: string = 'No Data Found';
  @Input() message: string = 'There is nothing to display here yet.';

  constructor() {
    addIcons({ 'folder-open-outline': folderOpenOutline });
  }
}
