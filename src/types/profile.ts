/**
 * Type definitions for user profile
 */

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  image: string;
  location: string;
  bio: string;
}

export interface ProfileUpdateRequest {
  fullName: string;
  location?: string;
  bio?: string;
}

export interface ProfileResponse {
  success: boolean;
  profile?: UserProfile;
  error?: string;
  message?: string;
}

export interface ProfileValidationRules {
  fullName: {
    required: true;
    minLength: 1;
    maxLength: 100;
  };
  location: {
    required: false;
    maxLength: 200;
  };
  bio: {
    required: false;
    maxLength: 500;
  };
}

export const PROFILE_VALIDATION: ProfileValidationRules = {
  fullName: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  location: {
    required: false,
    maxLength: 200,
  },
  bio: {
    required: false,
    maxLength: 500,
  },
};
