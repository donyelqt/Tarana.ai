'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export default function DebugMealsPage() {
  const { data: session, status } = useSession();
  const [meals, setMeals] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/saved-meals');
      const data = await response.json();
      
      if (!response.ok) {
        setError(JSON.stringify(data, null, 2));
      } else {
        setMeals(data);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const createTestMeal = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/saved-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafe_name: 'Test Cafe',
          meal_type: 'Lunch',
          price: 15.99,
          good_for: 'Solo',
          location: 'Downtown',
          image: 'https://example.com/image.jpg',
          tags: ['healthy', 'quick'],
          menu_items: []
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(JSON.stringify(data, null, 2));
      } else {
        setMeals(null);
        alert('Meal created! Click "Fetch Meals" to see it.');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Saved Meals</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Session Status:</h2>
        <p>Status: {status}</p>
        {session && (
          <>
            <p>User ID: {session.user?.id}</p>
            <p>Email: {session.user?.email}</p>
            <p>Has Access Token: {session.accessToken ? 'Yes' : 'No'}</p>
          </>
        )}
      </div>

      <div className="space-x-4 mb-6">
        <button
          onClick={fetchMeals}
          disabled={loading || status !== 'authenticated'}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          {loading ? 'Loading...' : 'Fetch Meals'}
        </button>
        
        <button
          onClick={createTestMeal}
          disabled={loading || status !== 'authenticated'}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
        >
          Create Test Meal
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded">
          <h2 className="font-semibold text-red-700 mb-2">Error:</h2>
          <pre className="text-sm overflow-auto">{error}</pre>
        </div>
      )}

      {meals && (
        <div className="p-4 bg-green-100 border border-green-400 rounded">
          <h2 className="font-semibold text-green-700 mb-2">Results:</h2>
          <pre className="text-sm overflow-auto">{JSON.stringify(meals, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
