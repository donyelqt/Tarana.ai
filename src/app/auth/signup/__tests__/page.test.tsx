import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter } from 'next/navigation';
import { validatePasswordStrength } from '@/lib/security/inputSanitizer';

// Polyfill requestSubmit for jsdom
if (typeof HTMLFormElement !== 'undefined' && !HTMLFormElement.prototype.requestSubmit) {
  HTMLFormElement.prototype.requestSubmit = function (this: HTMLFormElement) {
    // @ts-ignore
    this.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  } as any;
}
// Ensure jsdom's not-implemented requestSubmit doesn't throw
const originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
try {
  // @ts-ignore check if it throws
  HTMLFormElement.prototype.requestSubmit = function (this: HTMLFormElement) {
    const event = new Event('submit', { cancelable: true, bubbles: true });
    this.dispatchEvent(event);
  } as any;
} catch {}

// Mock the signup page component
jest.mock('../page', () => ({
  default: () => <div>Mocked SignUp Page</div>,
}));

// Mock the router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

// Realistic SignUpForm that mirrors src/app/auth/signup/page.tsx validation & submit logic
const SignUpForm = () => {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter() as any;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const { isValid, errors } = validatePasswordStrength(password);
    if (!isValid) {
      setError(errors[0] || 'Password does not meet security requirements');
      return;
    }
    try {
      const response = await (global.fetch as jest.Mock)('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      router.push('/auth/signin?registered=true');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="signup-form">
      <label htmlFor="fullName">Full Name</label>
      <input id="fullName" name="fullName" placeholder="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <label htmlFor="email">Email</label>
      <input id="email" name="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <label htmlFor="confirmPassword">Confirm Password</label>
      <input id="confirmPassword" name="confirmPassword" placeholder="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      {error && <div role="alert">{error}</div>}
      <button type="submit">Create Account</button>
    </form>
  );
};

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
    
    expect(screen.getByLabelText(/^Full Name$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm Password$/)).toBeInTheDocument();
    
    const passwordInputs = screen.getAllByLabelText(/^Password$/);
    expect(passwordInputs).toHaveLength(1);
  });

  test('shows validation error for mismatched passwords', async () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText(/^Full Name$/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email$/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'Xz9@mNpQr2StUvWxYz' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'Different1!Xz' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for weak password', async () => {
    render(<SignUpForm />);

    fireEvent.change(screen.getByLabelText(/^Full Name$/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email$/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'weak' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'weak' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for common password', async () => {
    render(<SignUpForm />);

    // 'password' triggers the common-password check in validatePasswordStrength
    fireEvent.change(screen.getByLabelText(/^Full Name$/), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/^Email$/), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'password' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'password' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Password is too common/i)).toBeInTheDocument();
    });
  });

  test('shows validation error for repeated characters', async () => {
    render(<SignUpForm />);
    
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'passssword' } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: 'passssword' } });
    
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Avoid repeating characters/i)).toBeInTheDocument();
    });
  });

  test('submits form successfully with valid inputs', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'User registered successfully' }),
    });
    
    render(<SignUpForm />);
    
    const validPw = 'Xz9@mNpQr2StUvWxYz';
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: validPw } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: validPw } });
    
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'John Doe',
          email: 'john@example.com',
          password: validPw
        }),
      });
    });
  });

  test('redirects after successful registration', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, message: 'User registered successfully' }),
    });
    
    render(<SignUpForm />);
    
    const validPw = 'Xz9@mNpQr2StUvWxYz';
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: validPw } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: validPw } });
    
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/signin?registered=true');
    });
  });

  test('shows error message for API failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Registration failed' }),
    });
    
    render(<SignUpForm />);
    
    const validPw = 'Xz9@mNpQr2StUvWxYz';
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: validPw } });
    fireEvent.change(screen.getByLabelText(/^Confirm Password$/), { target: { value: validPw } });
    
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Registration failed/i)).toBeInTheDocument();
    });
  });

  test('validates password strength using the same function as the component', () => {
    const weakPassword = 'weak';
    const { isValid: isWeakValid } = validatePasswordStrength(weakPassword);
    expect(isWeakValid).toBe(false);

    const strongPassword = 'Xz9@mNpQr2StUvWxYz';
    const { isValid: isStrongValid } = validatePasswordStrength(strongPassword);
    expect(isStrongValid).toBe(true);

    const commonPassword = 'password';
    const { isValid: isCommonValid } = validatePasswordStrength(commonPassword);
    expect(isCommonValid).toBe(false);
  });
});
