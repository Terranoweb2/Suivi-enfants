import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants';
import { 
  LoginForm, 
  RegisterForm, 
  User, 
  ApiResponse, 
  LoginResponse 
} from '../types';

class AuthService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_ENDPOINTS.BASE_URL;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || ERROR_MESSAGES.SERVER_ERROR,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Erreur réseau:', error);
      return {
        success: false,
        error: ERROR_MESSAGES.NETWORK_ERROR,
      };
    }
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.getStoredToken();
    
    return this.makeRequest<T>(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  private async getStoredToken(): Promise<string | null> {
    try {
      const { SecureStore } = await import('expo-secure-store');
      return await SecureStore.getItemAsync('auth_token');
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return null;
    }
  }

  async login(credentials: LoginForm): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>(API_ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterForm): Promise<ApiResponse<LoginResponse>> {
    // Validation côté client
    if (userData.password !== userData.confirmPassword) {
      return {
        success: false,
        error: 'Les mots de passe ne correspondent pas',
      };
    }

    if (userData.password.length < 8) {
      return {
        success: false,
        error: ERROR_MESSAGES.WEAK_PASSWORD,
      };
    }

    // Vérifier le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return {
        success: false,
        error: 'Format d\'email invalide',
      };
    }

    // Vérifier le format du téléphone
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(userData.phone)) {
      return {
        success: false,
        error: ERROR_MESSAGES.INVALID_PHONE,
      };
    }

    const { confirmPassword, ...registrationData } = userData;

    return this.makeRequest<LoginResponse>(API_ENDPOINTS.REGISTER, {
      method: 'POST',
      body: JSON.stringify(registrationData),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>(API_ENDPOINTS.LOGOUT, {
      method: 'POST',
    });
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<LoginResponse>> {
    return this.makeRequest<LoginResponse>(API_ENDPOINTS.REFRESH_TOKEN, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(API_ENDPOINTS.FORGOT_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(API_ENDPOINTS.RESET_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async verifyPhone(phone: string, code: string): Promise<ApiResponse<void>> {
    return this.makeRequest<void>(API_ENDPOINTS.VERIFY_PHONE, {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    });
  }

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.makeAuthenticatedRequest<User>(API_ENDPOINTS.UPDATE_PROFILE, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async getProfile(): Promise<ApiResponse<User>> {
    return this.makeAuthenticatedRequest<User>(API_ENDPOINTS.USER_PROFILE);
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/auth/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Erreur lors de la validation du token:', error);
      return false;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async deleteAccount(): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>('/auth/delete-account', {
      method: 'DELETE',
    });
  }

  async enableTwoFactor(): Promise<ApiResponse<{ qrCode: string; secret: string }>> {
    return this.makeAuthenticatedRequest<{ qrCode: string; secret: string }>('/auth/2fa/enable', {
      method: 'POST',
    });
  }

  async verifyTwoFactor(code: string): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disableTwoFactor(code: string): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // Méthodes utilitaires
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone);
  }

  isValidPassword(password: string): boolean {
    return password.length >= 8 && 
           /[A-Z]/.test(password) && 
           /[a-z]/.test(password) && 
           /[0-9]/.test(password);
  }

  generateSecurePassword(): string {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  // Gestion des sessions
  async extendSession(): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>('/auth/extend-session', {
      method: 'POST',
    });
  }

  async getActiveSessions(): Promise<ApiResponse<Array<{
    id: string;
    device: string;
    location: string;
    lastActive: Date;
    isCurrent: boolean;
  }>>> {
    return this.makeAuthenticatedRequest('/auth/sessions');
  }

  async revokeSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>(`/auth/sessions/${sessionId}/revoke`, {
      method: 'DELETE',
    });
  }

  async revokeAllSessions(): Promise<ApiResponse<void>> {
    return this.makeAuthenticatedRequest<void>('/auth/sessions/revoke-all', {
      method: 'DELETE',
    });
  }
}

export const authService = new AuthService();
export default authService;