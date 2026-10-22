import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonButton, IonIcon, IonToast, IonButtons, IonBackButton, IonSpinner,
  AlertController, ActionSheetController
} from '@ionic/angular/standalone';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';
import { keyOutline, lockClosedOutline, logOutOutline, personAddOutline, peopleOutline, ellipsisHorizontal } from 'ionicons/icons';
import { addIcons } from 'ionicons';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonItem, IonInput, IonButton, IonIcon, IonToast, IonButtons, IonBackButton, IonSpinner
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  public authService = inject(AuthService);
  private apiService = inject(ApiService);
  private alertController = inject(AlertController);
  private actionSheetController = inject(ActionSheetController);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  changePinData = { oldPin: '', newPin: '' };
  isChangingPin = false;

  // Everyone who can sign in (admin only)
  users: any[] = [];

  showToast = false;
  toastMessage = '';
  toastColor = 'success';

  constructor() {
    addIcons({
      'key-outline': keyOutline, 'lock-closed-outline': lockClosedOutline, 'log-out-outline': logOutOutline,
      'person-add-outline': personAddOutline, 'people-outline': peopleOutline, 'ellipsis-horizontal': ellipsisHorizontal
    });
  }

  ngOnInit() {
    if (this.authService.isAdmin()) {
      this.loadUsers();
      this.apiService.refresh$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadUsers());
    }
  }

  displayToast(message: string, color: string = 'success') {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }

  onChangePin() {
    if (this.isChangingPin) return;

    this.isChangingPin = true;
    this.authService.changePin(this.changePinData.oldPin, this.changePinData.newPin).pipe(
      finalize(() => this.isChangingPin = false)
    ).subscribe({
      next: (res) => {
        this.displayToast(res.message, 'success');
        this.changePinData = { oldPin: '', newPin: '' };
      },
      error: (err) => {
        this.displayToast(err.error?.message || 'Error changing PIN', 'danger');
      }
    });
  }

  async confirmSignOut() {
    const alert = await this.alertController.create({
      header: 'Sign out?',
      message: 'You will need your username and PIN to sign in again.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Sign out', role: 'destructive', handler: () => { this.signOut(); } }
      ]
    });
    await alert.present();
  }

  private signOut() {
    this.authService.logout();
    this.router.navigateByUrl('/verify', { replaceUrl: true });
  }

  // --- Team (admin only) ---

  loadUsers() {
    this.apiService.getUsers().subscribe({
      next: (res) => this.users = res.data,
      error: (err) => console.error(err)
    });
  }

  async addStaff() {
    const alert = await this.alertController.create({
      header: 'Add staff member',
      message: 'They sign in with this username and PIN.',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Full name' },
        { name: 'username', type: 'text', placeholder: 'Username, e.g. ravi', attributes: { autocapitalize: 'off' } },
        { name: 'pin', type: 'password', placeholder: '4-digit PIN', attributes: { inputmode: 'numeric', maxlength: 4 } },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (data) => {
            if (!data?.name?.trim() || !data?.username?.trim() || !/^\d{4}$/.test(data?.pin || '')) {
              this.displayToast('Enter a name, a username and a 4-digit PIN', 'warning');
              return false;
            }
            this.apiService.createStaff({ name: data.name.trim(), username: data.username.trim(), pin: data.pin }).subscribe({
              next: () => this.displayToast(`${data.name.trim()} can now sign in as ${data.username.trim().toLowerCase()}`),
              error: (err) => this.displayToast(this.errorText(err, 'Could not add staff member'), 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async manageStaff(user: any) {
    if (user.role !== 'STAFF') return;
    const sheet = await this.actionSheetController.create({
      header: `${user.name} (${user.username})`,
      buttons: [
        { text: 'Reset PIN', handler: () => { this.resetPin(user); } },
        { text: 'Rename', handler: () => { this.rename(user); } },
        user.active
          ? { text: 'Disable account', role: 'destructive', handler: () => { this.confirmSetActive(user, false); } }
          : { text: 'Enable account', handler: () => { this.confirmSetActive(user, true); } },
        { text: 'Cancel', role: 'cancel' },
      ]
    });
    await sheet.present();
  }

  private async resetPin(user: any) {
    const alert = await this.alertController.create({
      header: `New PIN for ${user.name}`,
      message: 'They will be signed out and need the new PIN to sign in.',
      inputs: [{ name: 'pin', type: 'password', placeholder: '4-digit PIN', attributes: { inputmode: 'numeric', maxlength: 4 } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Set PIN',
          handler: (data) => {
            if (!/^\d{4}$/.test(data?.pin || '')) {
              this.displayToast('The PIN must be 4 digits', 'warning');
              return false;
            }
            this.apiService.resetStaffPin(user.id, data.pin).subscribe({
              next: () => this.displayToast(`New PIN set for ${user.name}`),
              error: (err) => this.displayToast(this.errorText(err, 'Could not reset PIN'), 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async rename(user: any) {
    const alert = await this.alertController.create({
      header: 'Rename',
      inputs: [{ name: 'name', type: 'text', value: user.name, placeholder: 'Full name' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (data) => {
            const name = data?.name?.trim();
            if (!name) return false;
            this.apiService.updateStaff(user.id, { name }).subscribe({
              next: () => this.displayToast('Name updated'),
              error: (err) => this.displayToast(this.errorText(err, 'Could not rename'), 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async confirmSetActive(user: any, active: boolean) {
    const alert = await this.alertController.create({
      header: active ? `Enable ${user.name}?` : `Disable ${user.name}?`,
      message: active
        ? 'They can sign in again with their PIN.'
        : 'They are signed out at once and can\'t sign in. Their past entries stay on record.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: active ? 'Enable' : 'Disable',
          role: active ? undefined : 'destructive',
          handler: () => {
            this.apiService.updateStaff(user.id, { active }).subscribe({
              next: () => this.displayToast(active ? `${user.name} can sign in again` : `${user.name} is disabled`, active ? 'success' : 'medium'),
              error: (err) => this.displayToast(this.errorText(err, 'Could not update'), 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private errorText(err: any, fallback: string): string {
    const error = err?.error?.error ?? err?.error?.message;
    return (Array.isArray(error) ? error[0] : error) || fallback;
  }
}
