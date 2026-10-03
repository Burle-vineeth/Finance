import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './verify.component.html',
  styleUrls: ['./verify.component.scss']
})
export class VerifyComponent {
  pin: string = '';
  errorMsg: string = '';
  private authService = inject(AuthService);
  private router = inject(Router);

  async verify() {
    this.errorMsg = '';
    
    if (this.pin.length !== 4) {
      this.errorMsg = 'PIN must be exactly 4 digits.';
      return;
    }

    this.authService.verifyPin(this.pin).subscribe(success => {
      if (success) {
        this.router.navigate(['/']);
      } else {
        this.errorMsg = 'Invalid PIN. Please try again.';
      }
    });
  }
}
