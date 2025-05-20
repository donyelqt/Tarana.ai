import { NextResponse } from 'next/server';

// This is a simple demo implementation
// In a real application, you would:
// 1. Validate the input data
// 2. Hash the password
// 3. Store the user in a database
// 4. Handle errors properly

export async function POST(request: Request) {
  try {
    const { fullName, email, password } = await request.json();

    // Validate input
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // In a real application, you would check if the user already exists
    // and hash the password before storing it

    // For demo purposes, we'll just return a success response
    return NextResponse.json(
      { success: true, message: 'User registered successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}