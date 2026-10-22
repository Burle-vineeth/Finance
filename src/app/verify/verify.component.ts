import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonIcon, IonItem, IonInput, IonButton, IonSpinner
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { lockClosed, alertCircleOutline } from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonIcon, IonItem, IonInput, IonButton, IonSpinner
  ],
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.scss']
})
export class VerifyComponent {
  username: string = '';
  pin: string = '';
  errorMsg: string = '';
  isVerifying = false;
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    addIcons({ 'lock-closed': lockClosed, 'alert-circle-outline': alertCircleOutline });
    this.username = this.authService.lastUsername;
  }

  async verify() {
    if (this.isVerifying) return;
    this.errorMsg = '';
    
    if (!this.username.trim()) {
      this.errorMsg = 'Enter your username.';
      return;
    }
    if (this.pin.length !== 4) {
      this.errorMsg = 'PIN must be exactly 4 digits.';
      return;
    }

    this.isVerifying = true;
    this.authService.login(this.username.trim(), this.pin).pipe(
      finalize(() => this.isVerifying = false)
    ).subscribe(result => {
      if (result.success) {
        this.pin = '';
        this.router.navigateByUrl(this.authService.homeUrl(), { replaceUrl: true });
      } else {
        this.errorMsg = result.message || 'Wrong username or PIN. Please try again.';
      }
    });
  }
}
