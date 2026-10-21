import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle,
  IonCardContent, IonIcon, IonItem, IonInput, IonText, IonButton, IonSpinner
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { lockClosed } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle,
    IonCardContent, IonIcon, IonItem, IonInput, IonText, IonButton, IonSpinner
  ],
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.scss']
})
export class VerifyComponent {
  pin: string = '';
  errorMsg: string = '';
  isVerifying = false;
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    addIcons({ 'lock-closed': lockClosed });
  }

  async verify() {
    if (this.isVerifying) return;
    this.errorMsg = '';
    
    if (this.pin.length !== 4) {
      this.errorMsg = 'PIN must be exactly 4 digits.';
      return;
    }

    this.isVerifying = true;
    this.authService.verifyPin(this.pin).pipe(
      finalize(() => this.isVerifying = false)
    ).subscribe(success => {
      if (success) {
        this.router.navigate(['/']);
      } else {
        this.errorMsg = 'Invalid PIN. Please try again.';
      }
    });
  }
}
