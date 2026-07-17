import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { folderOpenOutline } from 'ionicons/icons';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-container">
      <ion-icon [name]="icon"></ion-icon>
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
      padding: 3rem 1rem;
      text-align: center;
      color: var(--ion-color-medium);
      
      ion-icon {
        font-size: 48px;
        margin-bottom: 1rem;
        opacity: 0.5;
      }
      
      h3 {
        font-size: 1.2rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        color: var(--ion-color-dark);
      }
      
      p {
        font-size: 0.95rem;
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
