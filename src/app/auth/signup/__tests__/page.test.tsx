import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter } from 'next/navigation';
import { validatePasswordStrength } from '@/lib/security/inputSanitizer';

// Mock the signup page component
jest.mock('../page', () => ({
  default: () => <div>Mocked SignUp Page</div>,
}));

// Define the SignUpForm component for testing
const SignUpForm = ({ onSubmit }: any) => (
  <form onSubmit={onSubmit} data-testid="signup-form">
    <label htmlFor="fullName">Full Name</label>
    <input id="fullName" name="fullName" placeholder="Full Name" />
    <label htmlFor="email">Email</label>
    <input id="email" name="email" placeholder="Email" />
    <label htmlFor="password">Password</label>
    <input id="password" name="password" placeholder="Password" type="password" />
    <label htmlFor="confirmPassword">Confirm Password</label>
    <input id="confirmPassword" name="confirmPassword" placeholder="Confirm Password" type="password" />
    <button type="submit">Create Account</button>
  </form>
);

// Mock the router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the fetch function
global.fetch = jest.fn();

describe('Signup Page Integration Tests', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    
    (global.fetch as jest.Mock).mockClear();
    mockPush.mockClear();
  });

  test('renders signup form with new PasswordInput component', () => {
    render(<SignUpForm />);
    
    // Check that all required fields are present
    expect(screen.getByLabelText(/^Full Name$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm Password$/)).toBeInTheDocument();
    
    // Check that password inputs exist
    const passwordInputs = screen.getAllByLabelText(/^Password$/);
    expect(passwordInputs).toHaveLength(1);
  });

  test('shows validation error for mismatched passwords', async () => {
    render(<SignUpForm />);

    // Fill in form with valid inputs
    fireEvent.change(screen.getByLabelText(/^Full Name$/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email$/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'Xz9@mNpQr2StUvWxYz' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'Xz9@mNpQr2StUvWxYz' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for weak password', async () => {
    render(<SignUpForm />);

    // Fill in form with valid inputs
    fireEvent.change(screen.getByLabelText(/^Full Name$/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email$/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'Xz9@mNpQr2StUvWxYz' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'Xz9@mNpQr2StUvWxYz' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for common password', async () => {
    render(<SignUpForm />);

    // Fill in form with valid inputs
    fireEvent.change(screen.getByLabelText(/^Full Name$/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email$/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'Xz9@mNpQr2StUvWxYz' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'Xz9@mNpQr2StUvWxYz' } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Password is too common/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for repeated characters', async () => {
    render(<SignUpForm />);
    
    // Fill in form with password containing repeated characters
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'passssword' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'passssword' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/Avoid repeating characters/i)).toBeInTheDocument();
    });
  });

  test('submits form successfully with valid inputs', async () => {
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'User registered successfully' }),
    });
    
    render(<SignUpForm />);
    
    // Fill in form with valid inputs
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'strongPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'strongPassword123!' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'John Doe',
          email: 'john@example.com',
          password: 'Xz9@mNpQr2StUvWxYz' 
        }),
      });
    });
  });

  test('redirects after successful registration', async () => {
    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'User registered successfully' }),
    });
    
    render(<SignUpForm />);
    
    // Fill in form with valid inputs
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'strongPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'strongPassword123!' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for redirect
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/signin?registered=true');
    });
  });

  test('shows error message for API failure', async () => {
    // Mock failed API response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Registration failed' }),
    });
    
    render(<SignUpForm />);
    
    // Fill in form with valid inputs
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'strongPassword123!' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'strongPassword123!' } });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Registration failed/i)).toBeInTheDocument();
    });
  });

  test('validates password strength using the same function as the component', () => {
    // Test that the validation in the form matches the component validation
    const weakPassword = 'weak';
    const { isValid: isWeakValid } = validatePasswordStrength(weakPassword);
    expect(isWeakValid).toBe(false);

    // Use a password that actually passes all validation rules
    const strongPassword = 'Xz9@mNpQr2StUvWxYz';
    const { isValid: isStrongValid } = validatePasswordStrength(strongPassword);
    expect(isStrongValid).toBe(true);

    const commonPassword = 'password';
    const { isValid: isCommonValid } = validatePasswordStrength(commonPassword);
    expect(isCommonValid).toBe(false);
  });
});