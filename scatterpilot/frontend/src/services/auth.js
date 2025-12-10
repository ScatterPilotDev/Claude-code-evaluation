import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js';
import { COGNITO_CONFIG } from '../config';

class AuthService {
  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: COGNITO_CONFIG.userPoolId,
      ClientId: COGNITO_CONFIG.clientId
    });
    this.currentUser = null;
  }

  /**
   * Sign up a new user
   */
  async signUp(email, password) {
    return new Promise((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email
        })
      ];

      this.userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          user: result.user,
          userConfirmed: result.userConfirmed,
          userSub: result.userSub
        });
      });
    });
  }

  /**
   * Sign in an existing user
   */
  async signIn(email, password) {
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session) => {
          this.currentUser = cognitoUser;
          const tokens = {
            idToken: session.getIdToken().getJwtToken(),
            accessToken: session.getAccessToken().getJwtToken(),
            refreshToken: session.getRefreshToken().getToken()
          };

          // Store tokens in localStorage
          localStorage.setItem('idToken', tokens.idToken);
          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);

          resolve({ session, tokens });
        },
        onFailure: (err) => {
          reject(err);
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Handle new password required flow if needed
          reject(new Error('New password required'));
        }
      });
    });
  }

  /**
   * Sign out the current user
   */
  signOut() {
    const cognitoUser = this.userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    this.currentUser = null;

    // Clear tokens from localStorage
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  /**
   * Get the current user session
   */
  async getCurrentSession() {
    return new Promise((resolve, reject) => {
      const cognitoUser = this.userPool.getCurrentUser();

      if (!cognitoUser) {
        reject(new Error('No user logged in'));
        return;
      }

      cognitoUser.getSession((err, session) => {
        if (err) {
          reject(err);
          return;
        }

        if (!session.isValid()) {
          reject(new Error('Session expired'));
          return;
        }

        this.currentUser = cognitoUser;
        resolve(session);
      });
    });
  }

  /**
   * Get the current ID token (JWT)
   */
  async getIdToken() {
    try {
      const session = await this.getCurrentSession();
      return session.getIdToken().getJwtToken();
    } catch (error) {
      // Try to get from localStorage as fallback
      const token = localStorage.getItem('idToken');
      if (!token) {
        throw new Error('Not authenticated');
      }
      return token;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    try {
      await this.getCurrentSession();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current user info
   */
  async getUserInfo() {
    return new Promise((resolve, reject) => {
      const cognitoUser = this.userPool.getCurrentUser();

      if (!cognitoUser) {
        reject(new Error('No user logged in'));
        return;
      }

      cognitoUser.getSession((err, session) => {
        if (err) {
          reject(err);
          return;
        }

        cognitoUser.getUserAttributes((err, attributes) => {
          if (err) {
            reject(err);
            return;
          }

          const userInfo = {};
          attributes.forEach(attr => {
            userInfo[attr.Name] = attr.Value;
          });

          resolve(userInfo);
        });
      });
    });
  }

  /**
   * Confirm user registration with code (if email verification is enabled)
   */
  async confirmRegistration(email, code) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool
      });

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  /**
   * Resend confirmation code
   */
  async resendConfirmationCode(email) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool
      });

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }
}

export default new AuthService();
