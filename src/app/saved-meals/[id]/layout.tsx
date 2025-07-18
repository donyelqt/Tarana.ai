import { Metadata } from 'next';

// Extended data for individual meal pages
const mealDetailsData = {
  '1': {
    name: 'Cafe Ysap',
    about: 'A cozy café tucked in the heart of Baguio, Café Ysap serves home-cooked Filipino meals made with fresh, local ingredients.',
  },
  '2': {
    name: 'Golden Wok Cafe',
    about: 'Golden Wok Cafe offers authentic Chinese cuisine with a Filipino twist.',
  },
  '3': {
    name: 'Sakura Sip & Snack',
    about: 'Sakura Sip & Snack is a charming Japanese-inspired café offering a variety of teas, coffees, and light snacks.',
  }
};

type Params = {
  id: string;
};

export async function generateMetadata({ 
  params 
}: { 
  params: Params;
}): Promise<Metadata> {
  // Read route params
  const id = params.id;

  // Fetch data
  const mealDetails = mealDetailsData[id as keyof typeof mealDetailsData];

  return {
    title: mealDetails ? `Tarana.ai | ${mealDetails.name}` : 'Tarana.ai | Saved Meal',
    description: mealDetails?.about || 'View and manage your saved meals from various restaurants.',
  };
}

export default function SavedMealLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 