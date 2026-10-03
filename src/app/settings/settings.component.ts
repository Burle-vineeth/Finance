import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonItem, IonInput, IonButton, IonIcon, IonToast, IonButtons, IonBackButton
} from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { keyOutline, lockClosedOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
    IonCardTitle, IonCardContent, IonItem, IonInput, IonButton, IonIcon, IonToast, IonButtons, IonBackButton
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {
  private authService = inject(AuthService);
  
  changePinData = { oldPin: '', newPin: '' };
  
  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({ 'key-outline': keyOutline, 'lock-closed-outline': lockClosedOutline });
  }

  displayToast(message: string, color: string = 'success') {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }

  onChangePin() {
    this.authService.changePin(this.changePinData.oldPin, this.changePinData.newPin).subscribe({
      next: (res) => {
        this.displayToast(res.message, 'success');
        this.changePinData = { oldPin: '', newPin: '' };
      },
      error: (err) => {
        this.displayToast(err.error?.message || 'Error changing PIN', 'danger');
      }
    });
  }
}
