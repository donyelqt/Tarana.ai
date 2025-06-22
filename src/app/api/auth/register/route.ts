import { NextResponse } from 'next/server';
import { createUserInSupabase } from '@/lib/auth'; // Updated import

// This is a simple demo implementation with in-memory storage
// In a real application, you would also:
// 1. Use a proper database
// 2. Add more comprehensive error handling
// 3. Implement rate limiting

// Email validation regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Password validation - at least 8 chars, with at least one number and one letter
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export async function POST(request: Request) {
  try {
    const { fullName, email, password } = await request.json();

    // Validate required fields
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { 
          error: 'Password must be at least 8 characters long and contain at least one letter and one number' 
        },
        { status: 400 }
      );
    }

    // Sanitize inputs (basic XSS protection)
    const sanitizedFullName = fullName.trim().replace(/[<>]/g, '');
    const sanitizedEmail = email.trim().toLowerCase();

    try {
      // Add the user to our in-memory storage with password hashing
      // await addUser(sanitizedFullName, sanitizedEmail, password);
      await createUserInSupabase(sanitizedFullName, sanitizedEmail, password); // Use Supabase function

      // Return success response (without exposing sensitive data)
      return NextResponse.json(
        { success: true, message: 'User registered successfully' },
        { status: 201 }
      );
    } catch (userError: unknown) {
      // Handle specific user creation errors
      if (userError instanceof Error) {
        if (userError.message === 'User with this email already exists') {
          return NextResponse.json(
            { error: userError.message },
            { status: 409 } // Conflict status code
          );
        }
        // For other errors thrown by createUserInSupabase (e.g., 'Failed to create user')
        return NextResponse.json(
          { error: userError.message }, 
          { status: 400 } // Bad Request or a more appropriate status
        );
      }
      // If it's not an Error instance, re-throw for the outer catch block to handle as 500
      throw userError; 
    }
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}